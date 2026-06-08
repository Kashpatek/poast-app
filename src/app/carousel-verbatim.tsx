"use client";
import { useEffect, useState, useMemo } from "react";
import { D as C, ft, mn, gf, getSurfaceProvider, getPreferredProvider } from "./shared-constants";
import { showToast } from "./toast-context";
import { COVER_TEMPLATES, renderCoverFullSvg, type CoverTemplateId } from "./carousel-covers";

// Mirror of the types in carousel.tsx — kept narrow to what this wizard needs.
type ThemeKey = "general" | "internal" | "external" | "capital";

interface Slide {
  type: string;
  title?: string;
  subtitle?: string;
  bodyText?: string;
  imageUrl?: string;
  bodySize: number;
  titleSize: number;
  subtitleSize: number;
  captionSize: number;
  caption?: string;
  position: number;
  id: string;
  titleAnchor?: "top" | "center";
  titleMarginTop?: number;
  bodyAnchor?: "top" | "center";
  imageHeight?: number;
  imagePosition?: string;
  imageFit?: string;
  coverTemplate?: CoverTemplateId;
  coverAccent?: string;
  coverShowSub?: boolean;
  coverDual?: boolean;
}

interface CarouselState {
  category: ThemeKey;
  url?: string;
  text?: string;
  mode: string;
  pageCount: number;
  fileName?: string;
  articleImages?: string[];
  selectedArticleImage?: string | null;
  fetchingImages?: boolean;
  generationMode?: "ai" | "verbatim";
}

interface GeneratedSlide {
  type: string;
  title?: string;
  subtitle?: string;
  body_text?: string;
  image_url?: string;
  subtext?: string;
}

const THEMES: Record<ThemeKey, { color: string; prefix: string; label: string }> = {
  general:  { prefix: "YB", color: "#D4A853", label: "General" },
  internal: { prefix: "Y",  color: "#F7B041", label: "Internal" },
  external: { prefix: "B",  color: "#0B86D1", label: "External" },
  capital:  { prefix: "G",  color: "#2EAD8E", label: "Capital" },
};

const CAROUSEL_SURFACE = "carousel";

function carouselProvider(): "claude" | "gemini" | "grok" {
  return getSurfaceProvider(CAROUSEL_SURFACE) || getPreferredProvider();
}

function splitVerbatim(text: string, pageCount: number): GeneratedSlide[] {
  var raw = String(text || "").trim();
  if (!raw) return [];
  var rawChunks = raw.split(/\n\s*\n|\n-{3,}\n/).map(function(s) { return s.trim(); }).filter(Boolean);
  if (rawChunks.length === 1) {
    rawChunks = raw.split(/\n+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }
  if (!rawChunks.length) rawChunks = [raw];

  var target = pageCount && pageCount > 0
    ? Math.max(1, pageCount)
    : Math.min(7, Math.max(3, rawChunks.length));

  var chunks: string[] = rawChunks.slice();
  if (chunks.length > target) {
    var grouped: string[] = [];
    var groupSize = Math.ceil(chunks.length / target);
    for (var i = 0; i < chunks.length; i += groupSize) {
      grouped.push(chunks.slice(i, i + groupSize).join("\n\n"));
    }
    chunks = grouped.slice(0, target);
  } else if (chunks.length < target) {
    var safety = 0;
    while (chunks.length < target && safety++ < 64) {
      var longestIdx = 0;
      for (var j = 0; j < chunks.length; j++) {
        if (chunks[j].length > chunks[longestIdx].length) longestIdx = j;
      }
      var longest = chunks[longestIdx];
      var sentences = longest.match(/[^.!?]+[.!?]+(\s|$)|\S[^.!?]*$/g);
      if (!sentences || sentences.length < 2) break;
      var mid = Math.ceil(sentences.length / 2);
      var first = sentences.slice(0, mid).join("").trim();
      var second = sentences.slice(mid).join("").trim();
      if (!first || !second) break;
      chunks.splice(longestIdx, 1, first, second);
    }
  }

  var slides: GeneratedSlide[] = [];
  for (var k = 0; k < chunks.length; k++) {
    var c = chunks[k];
    if (k === 0 && chunks.length > 1) {
      var firstLine = (c.split(/\n/)[0] || c).trim();
      var rest = c.slice(firstLine.length).trim();
      slides.push({ type: "COVER", title: firstLine.slice(0, 140), subtitle: rest });
    } else if (k === chunks.length - 1 && chunks.length > 1) {
      slides.push({ type: "BODY_FINAL", body_text: c });
    } else if (chunks.length === 1) {
      var firstLine2 = (c.split(/\n/)[0] || c).trim();
      var rest2 = c.slice(firstLine2.length).trim();
      slides.push({ type: "COVER", title: firstLine2.slice(0, 140), subtitle: rest2 });
    } else {
      slides.push({ type: k % 2 === 1 ? "BODY_A" : "BODY_B", body_text: c });
    }
  }
  return slides;
}

function getSlidePositions(count: number): number[] {
  if (count === 1) return [4];
  if (count === 2) return [1, 4];
  if (count === 3) return [1, 2, 4];
  var positions = [1];
  for (var i = 1; i < count - 1; i++) {
    positions.push(i % 2 === 1 ? 2 : 3);
  }
  positions.push(4);
  return positions;
}

function apiSlidesToEditorSlides(apiSlides: GeneratedSlide[], slideCount: number): Slide[] {
  var positions = getSlidePositions(slideCount);
  return apiSlides.map(function(apiSl, i): Slide {
    var pos = positions[i] || (i === apiSlides.length - 1 ? 4 : 2);
    var type = "body";
    if (pos === 1) type = "cover";
    else if (apiSl.type === "BODY_IMAGE") type = "image_text";
    else if (apiSl.type === "BODY_LARGE_IMAGE") type = "large_image";

    var bodyText = apiSl.body_text || "";
    bodyText = bodyText.replace(/^\s*[-*]\s+/gm, "\n").replace(/^\s*\d+[.)]\s+/gm, "\n").replace(/\n{3,}/g, "\n\n").trim();

    return {
      id: "slide-" + i,
      position: pos,
      type: type,
      title: apiSl.title || "",
      titleSize: 74,
      subtitle: apiSl.subtitle || "",
      subtitleSize: 34,
      bodyText: bodyText,
      bodySize: 28,
      imageUrl: apiSl.image_url || "",
      imageHeight: type === "cover" ? 46 : type === "image_text" ? 50 : type === "large_image" ? 72 : 45,
      imagePosition: "center",
      imageFit: "cover",
      caption: apiSl.subtext || "",
      captionSize: 18,
      titleAnchor: "top",
      titleMarginTop: 80,
      bodyAnchor: "top",
    };
  });
}

type SubStep = "paste" | "cover" | "title" | "image" | "confirm";

const SUB_STEPS: { id: SubStep; label: string }[] = [
  { id: "paste",   label: "Paste" },
  { id: "title",   label: "Title" },
  { id: "image",   label: "Image" },
  { id: "cover",   label: "Cover" },
  { id: "confirm", label: "Confirm" },
];

export interface VerbatimWizardProps {
  state: CarouselState;
  setState: React.Dispatch<React.SetStateAction<CarouselState>>;
  onCancel: () => void;
  onComplete: (slides: Slide[]) => void;
}

export function VerbatimWizard(props: VerbatimWizardProps): React.ReactElement {
  var state = props.state;
  var setState = props.setState;

  var _sub = useState<SubStep>("paste"), sub = _sub[0], setSub = _sub[1];

  var _selTpl = useState<CoverTemplateId | null>(null), selectedTemplateId = _selTpl[0], setSelectedTemplateId = _selTpl[1];
  var _dual = useState(false), dual = _dual[0], setDual = _dual[1];

  var _chosenTitle = useState(""), chosenTitle = _chosenTitle[0], setChosenTitle = _chosenTitle[1];
  var _chosenSub = useState(""), chosenSubtitle = _chosenSub[0], setChosenSubtitle = _chosenSub[1];
  var _incSub = useState(false), includeSubtitle = _incSub[0], setIncludeSubtitle = _incSub[1];
  var _upper = useState(true), upper = _upper[0], setUpper = _upper[1];
  var _tight = useState(false), tight = _tight[0], setTight = _tight[1];

  var _titleIdeas = useState<{ title: string; subtitle: string }[]>([]), titleIdeas = _titleIdeas[0], setTitleIdeas = _titleIdeas[1];
  var _titleLoad = useState(false), titleLoading = _titleLoad[0], setTitleLoading = _titleLoad[1];
  var _subLoad = useState(false), subLoading = _subLoad[0], setSubLoading = _subLoad[1];
  var _subIdeas = useState<string[]>([]), subtitleIdeas = _subIdeas[0], setSubtitleIdeas = _subIdeas[1];

  var _imgTab = useState<"ai" | "upload" | "skip">("ai"), imageTab = _imgTab[0], setImageTab = _imgTab[1];
  var _imgUrl = useState(""), chosenImageUrl = _imgUrl[0], setChosenImageUrl = _imgUrl[1];
  var _imgVariants = useState<string[]>([]), imgVariants = _imgVariants[0], setImgVariants = _imgVariants[1];
  var _imgLoad = useState(false), imgLoading = _imgLoad[0], setImgLoading = _imgLoad[1];
  var _imgPrompt = useState(""), imagePrompt = _imgPrompt[0], setImagePrompt = _imgPrompt[1];
  var _imgPromptLoad = useState(false), imagePromptLoading = _imgPromptLoad[0], setImagePromptLoading = _imgPromptLoad[1];
  var _imgPromptKey = useState(""), imagePromptKey = _imgPromptKey[0], setImagePromptKey = _imgPromptKey[1];

  var _pasteDrag = useState(false), pasteDrag = _pasteDrag[0], setPasteDrag = _pasteDrag[1];
  var _uploadDrag = useState(false), uploadDrag = _uploadDrag[0], setUploadDrag = _uploadDrag[1];

  var accent = THEMES[state.category].color;

  function handleTextFile(file: File | null | undefined) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var result = e.target ? (e.target.result as string) : "";
      setState(function(s) { return Object.assign({}, s, { text: result, fileName: file.name }); });
    };
    reader.readAsText(file);
  }

  function handleImageFile(file: File | null | undefined) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var result = e.target ? (e.target.result as string) : "";
      setChosenImageUrl(result);
    };
    reader.readAsDataURL(file);
  }

  async function fetchTitleIdeas() {
    if (titleLoading) return;
    var text = (state.text || "").trim();
    if (!text) { showToast("Paste the analyst's text first."); return; }
    setTitleLoading(true);
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verbatim-titles",
          text: text,
          category: state.category,
          provider: carouselProvider(),
        }),
      });
      var d = await r.json();
      if (!r.ok || d.error) { showToast(d.error || "Failed to generate titles."); return; }
      var pairs = (d.pairs || []) as { title: string; subtitle: string }[];
      if (!pairs.length) {
        // Back-compat for old payload shape.
        var legacy = (d.titles || []) as string[];
        pairs = legacy.map(function(t) { return { title: t, subtitle: "" }; });
      }
      if (!pairs.length) { showToast("No titles returned. Try again."); return; }
      setTitleIdeas(pairs);
    } catch (e) {
      showToast("Network error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTitleLoading(false);
    }
  }

  async function fetchSubtitleSuggestion() {
    if (subLoading) return;
    if (!chosenTitle.trim()) { showToast("Choose a title first."); return; }
    setSubLoading(true);
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verbatim-subtitle",
          text: state.text || "",
          title: chosenTitle,
          category: state.category,
          provider: carouselProvider(),
        }),
      });
      var d = await r.json();
      if (!r.ok || d.error) { showToast(d.error || "Failed to suggest subtitle."); return; }
      var subs = (d.subtitles || []) as string[];
      if (!subs.length && d.subtitle) subs = [String(d.subtitle)];
      if (!subs.length) { showToast("No subtitles returned. Try again."); return; }
      setSubtitleIdeas(subs);
    } catch (e) {
      showToast("Network error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubLoading(false);
    }
  }

  async function fetchImagePromptSuggestion() {
    if (imagePromptLoading) return;
    if (!chosenTitle.trim()) return;
    setImagePromptLoading(true);
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verbatim-image-prompt",
          title: chosenTitle,
          subtitle: includeSubtitle ? chosenSubtitle : "",
          category: state.category,
          text: (state.text || "").slice(0, 1500),
          provider: carouselProvider(),
        }),
      });
      var d = await r.json();
      if (!r.ok || d.error) { showToast(d.error || "Failed to suggest a prompt."); return; }
      if (d.prompt) setImagePrompt(String(d.prompt));
    } catch (e) {
      showToast("Network error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImagePromptLoading(false);
    }
  }

  async function fetchImageVariants() {
    if (imgLoading) return;
    if (!chosenTitle.trim()) { showToast("Set a title first — image gen uses it as the prompt anchor."); return; }
    setImgLoading(true);
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generateImage",
          title: chosenTitle,
          subtitle: includeSubtitle ? chosenSubtitle : "",
          slideText: (state.text || "").slice(0, 500),
          category: state.category,
          slideType: "COVER",
          customPrompt: imagePrompt.trim() || undefined,
        }),
      });
      var d = await r.json();
      if (!r.ok || d.error) { showToast(d.error || "Image generation failed."); return; }
      var imgs = (d.images || []) as string[];
      if (!imgs.length) { showToast("No images returned. Try again."); return; }
      setImgVariants(imgs);
    } catch (e) {
      showToast("Network error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImgLoading(false);
    }
  }

  // Auto-fetch a suggested image prompt when entering the image step
  // with a title set and no prompt yet (or when title/subtitle changed
  // since the last fetch). Key debounces re-fetches.
  useEffect(function() {
    if (sub !== "image" || imageTab !== "ai") return;
    if (!chosenTitle.trim()) return;
    var key = chosenTitle + "|" + (includeSubtitle ? chosenSubtitle : "") + "|" + state.category;
    if (key === imagePromptKey && imagePrompt.trim()) return;
    setImagePromptKey(key);
    if (!imagePrompt.trim()) fetchImagePromptSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, imageTab, chosenTitle, chosenSubtitle, includeSubtitle, state.category]);

  function canContinue(): boolean {
    if (sub === "paste") return !!(state.text || "").trim();
    if (sub === "cover") return !!selectedTemplateId;
    if (sub === "title") return !!chosenTitle.trim();
    if (sub === "image") return true;
    if (sub === "confirm") return !!selectedTemplateId && !!chosenTitle.trim();
    return false;
  }

  function goNext() {
    if (!canContinue()) return;
    if (sub === "paste") setSub("title");
    else if (sub === "title") setSub("image");
    else if (sub === "image") setSub("cover");
    else if (sub === "cover") setSub("confirm");
    else if (sub === "confirm") handleBuild();
  }

  function goBack() {
    if (sub === "paste") { props.onCancel(); return; }
    if (sub === "title") setSub("paste");
    else if (sub === "image") setSub("title");
    else if (sub === "cover") setSub("image");
    else if (sub === "confirm") setSub("cover");
  }

  function handleBuild() {
    if (!selectedTemplateId) { showToast("Pick a cover template."); return; }
    var raw = (state.text || "").trim();
    if (!raw) { showToast("Paste the analyst's text first."); return; }
    var targetCount = state.mode === "manual" ? (state.pageCount || 5) : 0;
    var verbSlides = splitVerbatim(raw, targetCount);
    if (!verbSlides.length) { showToast("Could not split that text into slides."); return; }
    var editorSlides = apiSlidesToEditorSlides(verbSlides, verbSlides.length);

    var cover: Slide = {
      id: "slide-0",
      position: 1,
      type: "cover",
      title: chosenTitle,
      titleSize: 74,
      subtitle: includeSubtitle ? chosenSubtitle : "",
      subtitleSize: 34,
      bodyText: "",
      bodySize: 28,
      imageUrl: chosenImageUrl,
      imageHeight: 46,
      imagePosition: "center",
      imageFit: "cover",
      caption: "",
      captionSize: 18,
      titleAnchor: "top",
      titleMarginTop: 80,
      bodyAnchor: "top",
      coverTemplate: selectedTemplateId,
      coverAccent: THEMES[state.category].color,
      coverShowSub: includeSubtitle,
      coverDual: dual,
    };

    var slides = [cover].concat(editorSlides.slice(1));
    props.onComplete(slides);
  }

  // ─── Step body renderers ───
  function renderPaste() {
    var charCount = (state.text || "").length;
    return <div>
      <div style={{ fontFamily: gf, fontSize: 30, fontWeight: 900, color: C.tx, letterSpacing: -0.6, marginBottom: 6 }}>Drop in the analyst&apos;s prose</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginBottom: 24, maxWidth: 640 }}>Multi-page X thread? Paste the whole thing — each paragraph becomes a slide. We won&apos;t rewrite a word.</div>

      <div onDragOver={function(e) { e.preventDefault(); setPasteDrag(true); }} onDragLeave={function() { setPasteDrag(false); }} onDrop={function(e) { e.preventDefault(); setPasteDrag(false); if (e.dataTransfer.files.length) handleTextFile(e.dataTransfer.files[0]); }} style={{ marginBottom: 20 }}>
        <textarea
          value={state.text || ""}
          onChange={function(e) { var v = e.target.value; setState(function(s) { return Object.assign({}, s, { text: v }); }); }}
          placeholder="Paste the article, the thread, the memo — whatever the analyst wrote. Use blank lines to mark paragraph breaks."
          rows={14}
          style={{ width: "100%", padding: "16px 18px", background: pasteDrag ? accent + "08" : C.card, border: "1px solid " + (pasteDrag ? accent : C.border), borderRadius: 12, color: C.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }}
          onFocus={function(e) { e.currentTarget.style.borderColor = accent; }}
          onBlur={function(e) { e.currentTarget.style.borderColor = C.border; }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
          <label style={{ fontFamily: mn, fontSize: 10, color: C.txm, cursor: "pointer", padding: "5px 12px", border: "1px solid " + C.border, borderRadius: 6, background: C.card }}>
            Upload .txt
            <input type="file" accept=".txt,.md" onChange={function(e) { handleTextFile(e.target.files && e.target.files[0]); }} style={{ display: "none" }} />
          </label>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{charCount.toLocaleString()} chars</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Category</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(Object.keys(THEMES) as ThemeKey[]).map(function(key) {
              var t = THEMES[key];
              var sel = state.category === key;
              return <div key={key} onClick={function() { setState(function(s) { return Object.assign({}, s, { category: key }); }); }} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: sel ? t.color + "12" : C.card, border: "1px solid " + (sel ? t.color : C.border), transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: sel ? t.color : C.border }} />
                  <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: sel ? t.color : C.tx }}>{t.label}</div>
                  <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: C.txd }}>{t.prefix}</div>
                </div>
              </div>;
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Slide Count</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <div onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "auto", pageCount: 0 }); }); }} style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: state.mode === "auto" ? accent + "12" : C.card, border: "1px solid " + (state.mode === "auto" ? accent : C.border), minWidth: 56, textAlign: "center" }}>
              <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: state.mode === "auto" ? accent : C.tx }}>Auto</div>
            </div>
            {[3, 5, 7].map(function(n) {
              var sel = state.mode === "manual" && state.pageCount === n;
              return <div key={n} onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "manual", pageCount: n }); }); }} style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: sel ? accent + "12" : C.card, border: "1px solid " + (sel ? accent : C.border), minWidth: 56, textAlign: "center" }}>
                <div style={{ fontFamily: mn, fontSize: 14, fontWeight: 700, color: sel ? accent : C.tx }}>{n}</div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>;
  }

  function renderCover() {
    var previewTitle = chosenTitle.trim() || "The new era of infrastructure";
    var previewSub = includeSubtitle && chosenSubtitle.trim() ? chosenSubtitle : "";
    return <div>
      <div style={{ fontFamily: gf, fontSize: 30, fontWeight: 900, color: C.tx, letterSpacing: -0.6, marginBottom: 6 }}>Pick a cover style</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginBottom: 24, maxWidth: 640 }}>The cover is your hook. Previews use your title + image — click whichever framing lands hardest.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {COVER_TEMPLATES.map(function(tpl) {
          var sel = selectedTemplateId === tpl.id;
          var svg = renderCoverFullSvg(tpl.id, {
            title: previewTitle,
            subtitle: previewSub,
            accent: accent,
            imageUrl: chosenImageUrl,
            dual: tpl.id === "03" ? dual : false,
            logoStyle: "auto",
            showSub: !!previewSub,
            showLogo: true,
            showMeta: true,
            upper: upper,
            tight: tight,
          });
          return <div key={tpl.id} onClick={function() { setSelectedTemplateId(tpl.id); }} style={{ position: "relative", cursor: "pointer", borderRadius: 14, overflow: "hidden", border: sel ? "2px solid " + accent : "2px solid " + C.border, transition: "all 0.15s", background: C.card, boxShadow: sel ? "0 0 0 4px " + accent + "20" : "none" }}>
            <div style={{ width: "100%", aspectRatio: "1080/1350", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: svg }} />
            <div style={{ position: "absolute", top: 8, left: 8, fontFamily: mn, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.55)", padding: "3px 8px", borderRadius: 5, fontWeight: 700, letterSpacing: 0.5 }}>{tpl.id} · {tpl.name}</div>
            {sel && <div style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: accent, color: C.bg, fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{"✓"}</div>}
          </div>;
        })}
      </div>

      {selectedTemplateId && COVER_TEMPLATES.find(function(t) { return t.id === selectedTemplateId; })?.supportsDual && <div style={{ marginTop: 18, padding: "12px 16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div onClick={function() { setDual(!dual); }} style={{ width: 36, height: 20, borderRadius: 10, background: dual ? accent : C.border, position: "relative", cursor: "pointer", transition: "all 0.15s" }}>
          <div style={{ position: "absolute", top: 2, left: dual ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.15s" }} />
        </div>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: accent, letterSpacing: 1, fontWeight: 700 }}>DUAL IMAGE</div>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Diptych template — split the cover into two stacked images.</div>
        </div>
      </div>}
    </div>;
  }

  function renderTitle() {
    return <div>
      <div style={{ fontFamily: gf, fontSize: 30, fontWeight: 900, color: C.tx, letterSpacing: -0.6, marginBottom: 6 }}>Build the cover title</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginBottom: 24, maxWidth: 640 }}>The hook that makes someone stop scrolling.</div>

      <div style={{ marginBottom: 18 }}>
        <button onClick={fetchTitleIdeas} disabled={titleLoading} style={{ padding: "10px 18px", borderRadius: 8, background: titleLoading ? C.card : accent + "15", border: "1px solid " + accent + "40", color: accent, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: titleLoading ? "wait" : "pointer", letterSpacing: 0.2 }}>
          {titleLoading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid " + accent + "30", borderTopColor: accent, display: "inline-block", animation: "vspin 0.8s linear infinite" }} /> Generating...</span> : "✨ Generate Title Ideas with AI"}
        </button>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes vspin{to{transform:rotate(360deg)}}" }} />
      </div>

      {titleIdeas.length > 0 && <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Ideas · click to use title + subtitle</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {titleIdeas.map(function(idea, i) {
            var sel = chosenTitle === idea.title;
            return <div key={i} onClick={function() {
              setChosenTitle(idea.title);
              if (idea.subtitle) {
                setChosenSubtitle(idea.subtitle);
                setIncludeSubtitle(true);
              }
              setSubtitleIdeas([]);
            }} style={{ padding: "14px 16px", borderRadius: 10, background: sel ? accent + "12" : C.card, border: "1px solid " + (sel ? accent : C.border), cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={function(e) { if (!sel) e.currentTarget.style.borderColor = accent + "55"; }}
              onMouseLeave={function(e) { if (!sel) e.currentTarget.style.borderColor = C.border; }}>
              <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: sel ? accent : C.tx, letterSpacing: -0.2, marginBottom: idea.subtitle ? 6 : 0 }}>{idea.title}</div>
              {idea.subtitle && <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.45 }}>{idea.subtitle}</div>}
            </div>;
          })}
        </div>
      </div>}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Title</div>
        <input
          value={chosenTitle}
          onChange={function(e) { setChosenTitle(e.target.value); }}
          placeholder="The new era of infrastructure"
          style={{ width: "100%", padding: "16px 18px", background: C.card, border: "1px solid " + accent + "40", borderRadius: 10, color: accent, fontFamily: ft, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, outline: "none", boxSizing: "border-box", textTransform: upper ? "uppercase" : "none" }}
          onFocus={function(e) { e.currentTarget.style.borderColor = accent; }}
          onBlur={function(e) { e.currentTarget.style.borderColor = accent + "40"; }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        <div onClick={function() { setUpper(!upper); }} style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer", background: upper ? accent + "15" : C.card, border: "1px solid " + (upper ? accent + "50" : C.border), fontFamily: mn, fontSize: 10, fontWeight: 700, color: upper ? accent : C.txm, letterSpacing: 1 }}>UPPERCASE</div>
        <div onClick={function() { setTight(!tight); }} style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer", background: tight ? accent + "15" : C.card, border: "1px solid " + (tight ? accent + "50" : C.border), fontFamily: mn, fontSize: 10, fontWeight: 700, color: tight ? accent : C.txm, letterSpacing: 1 }}>TIGHT TRACKING</div>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: ft, fontSize: 12, color: C.tx }}>
          <input type="checkbox" checked={includeSubtitle} onChange={function(e) { setIncludeSubtitle(e.target.checked); }} style={{ width: 14, height: 14, accentColor: accent }} />
          Include subtitle
        </label>
      </div>

      {includeSubtitle && <div style={{ padding: "16px 18px", background: C.card, border: "1px solid " + C.border, borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, textTransform: "uppercase", letterSpacing: 1.2 }}>Subtitle{chosenSubtitle ? " · " + chosenSubtitle.length + " chars" : ""}</div>
          <button onClick={fetchSubtitleSuggestion} disabled={subLoading || !chosenTitle.trim()} style={{ padding: "6px 12px", borderRadius: 6, background: subLoading ? C.surface : accent + "12", border: "1px solid " + accent + "30", color: accent, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: subLoading || !chosenTitle.trim() ? "wait" : "pointer", opacity: !chosenTitle.trim() ? 0.5 : 1 }}>{subLoading ? "Thinking..." : subtitleIdeas.length ? "✨ More options" : "✨ Suggest alternatives"}</button>
        </div>
        <input
          value={chosenSubtitle}
          onChange={function(e) { setChosenSubtitle(e.target.value); }}
          placeholder="A short, punchy second line — context for the hook."
          style={{ width: "100%", padding: "12px 14px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box" }}
          onFocus={function(e) { e.currentTarget.style.borderColor = accent + "50"; }}
          onBlur={function(e) { e.currentTarget.style.borderColor = C.border; }}
        />
        {subtitleIdeas.length > 0 && <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Alternatives · click to swap</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {subtitleIdeas.map(function(s, i) {
              var sel = chosenSubtitle === s;
              return <div key={i} onClick={function() { setChosenSubtitle(s); }} style={{ padding: "10px 12px", borderRadius: 6, background: sel ? accent + "15" : C.bg, border: "1px solid " + (sel ? accent + "55" : C.border), color: sel ? C.tx : C.txm, fontFamily: ft, fontSize: 12.5, cursor: "pointer", lineHeight: 1.45 }}>{s}</div>;
            })}
          </div>
        </div>}
      </div>}
    </div>;
  }

  function renderImage() {
    return <div>
      <div style={{ fontFamily: gf, fontSize: 30, fontWeight: 900, color: C.tx, letterSpacing: -0.6, marginBottom: 6 }}>Choose a cover image</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginBottom: 24, maxWidth: 640 }}>Or skip — the cover renders cleanly on the chip-hex pattern.</div>

      <div style={{ display: "flex", gap: 0, marginBottom: 22, borderBottom: "1px solid " + C.border }}>
        {(["ai", "upload", "skip"] as const).map(function(t) {
          var sel = imageTab === t;
          var labels: Record<typeof t, string> = { ai: "AI Generate", upload: "Upload", skip: "Skip" };
          return <div key={t} onClick={function() {
            setImageTab(t);
            if (t === "skip") setChosenImageUrl("");
          }} style={{ padding: "10px 18px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: 700, color: sel ? accent : C.txm, borderBottom: sel ? "2px solid " + accent : "2px solid transparent", marginBottom: -1 }}>{labels[t]}</div>;
        })}
      </div>

      {imageTab === "ai" && <div>
        <div style={{ padding: "16px 18px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, textTransform: "uppercase", letterSpacing: 1.2 }}>Image Prompt {imagePromptLoading ? "· thinking..." : ""}</div>
            <button onClick={fetchImagePromptSuggestion} disabled={imagePromptLoading || !chosenTitle.trim()} style={{ padding: "6px 12px", borderRadius: 6, background: imagePromptLoading ? C.surface : accent + "12", border: "1px solid " + accent + "30", color: accent, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: imagePromptLoading || !chosenTitle.trim() ? "wait" : "pointer", opacity: !chosenTitle.trim() ? 0.5 : 1 }}>{imagePromptLoading ? "..." : imagePrompt.trim() ? "✨ Re-suggest" : "✨ Suggest"}</button>
          </div>
          <textarea
            value={imagePrompt}
            onChange={function(e) { setImagePrompt(e.target.value); }}
            placeholder={chosenTitle.trim() ? "Suggesting a prompt..." : "Set a title first — the prompt will be drafted from it."}
            rows={4}
            style={{ width: "100%", padding: "12px 14px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.55, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            onFocus={function(e) { e.currentTarget.style.borderColor = accent + "50"; }}
            onBlur={function(e) { e.currentTarget.style.borderColor = C.border; }}
          />
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6, letterSpacing: 0.4 }}>Edit the prompt before generating. SA style + brand cues are added automatically.</div>
        </div>
        <button onClick={fetchImageVariants} disabled={imgLoading || !imagePrompt.trim()} style={{ padding: "10px 18px", borderRadius: 8, background: imgLoading || !imagePrompt.trim() ? C.card : accent + "15", border: "1px solid " + accent + "40", color: accent, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: imgLoading ? "wait" : !imagePrompt.trim() ? "not-allowed" : "pointer", marginBottom: 16, opacity: !imagePrompt.trim() ? 0.5 : 1 }}>{imgLoading ? "Generating variations..." : imgVariants.length ? "✨ Regenerate" : "✨ Generate Variations"}</button>
        {imgVariants.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {imgVariants.map(function(url, i) {
            var sel = chosenImageUrl === url;
            return <div key={i} onClick={function() { setChosenImageUrl(url); }} style={{ position: "relative", cursor: "pointer", borderRadius: 10, overflow: "hidden", border: sel ? "3px solid " + accent : "3px solid transparent", aspectRatio: "1080/1350", background: C.card }}>
              <img src={url} alt={"variation " + (i + 1)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {sel && <div style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: accent, color: C.bg, fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{"✓"}</div>}
            </div>;
          })}
        </div>}
      </div>}

      {imageTab === "upload" && <div>
        <label onDragOver={function(e) { e.preventDefault(); setUploadDrag(true); }} onDragLeave={function() { setUploadDrag(false); }} onDrop={function(e) { e.preventDefault(); setUploadDrag(false); if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]); }} style={{ display: "block", padding: "40px 20px", borderRadius: 12, background: uploadDrag ? accent + "08" : C.card, border: "1px dashed " + (uploadDrag ? accent : C.border), textAlign: "center", cursor: "pointer" }}>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Drop an image here</div>
          <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>or click to browse — PNG, JPG, WEBP</div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={function(e) { handleImageFile(e.target.files && e.target.files[0]); }} style={{ display: "none" }} />
        </label>
        {chosenImageUrl && <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Preview</div>
          <div style={{ width: 240, aspectRatio: "1080/1350", borderRadius: 10, overflow: "hidden", border: "1px solid " + C.border }}>
            <img src={chosenImageUrl} alt="cover preview" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        </div>}
      </div>}

      {imageTab === "skip" && <div style={{ padding: "28px 24px", background: C.card, border: "1px solid " + C.border, borderRadius: 12 }}>
        <div style={{ fontFamily: ft, fontSize: 14, color: C.tx, fontWeight: 700, marginBottom: 6 }}>No image</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, lineHeight: 1.5 }}>The chip pattern + dark gradient will show through. The cover still looks intentional.</div>
      </div>}
    </div>;
  }

  var confirmSvg = useMemo(function() {
    if (!selectedTemplateId) return "";
    return renderCoverFullSvg(selectedTemplateId, {
      title: chosenTitle || "Untitled",
      subtitle: includeSubtitle ? chosenSubtitle : undefined,
      accent: accent,
      imageUrl: chosenImageUrl,
      dual: dual,
      logoStyle: "auto",
      showSub: includeSubtitle,
      showLogo: true,
      showMeta: true,
      upper: upper,
      tight: tight,
    });
  }, [selectedTemplateId, chosenTitle, chosenSubtitle, includeSubtitle, accent, chosenImageUrl, dual, upper, tight]);

  function renderConfirm() {
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: gf, fontSize: 30, fontWeight: 900, color: C.tx, letterSpacing: -0.6, marginBottom: 6, alignSelf: "flex-start" }}>Looks good?</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginBottom: 24, alignSelf: "flex-start", maxWidth: 640 }}>This is the cover that ships. The body slides will hold the analyst&apos;s prose, untouched.</div>

      <div style={{ width: 360, aspectRatio: "1080/1350", borderRadius: 16, overflow: "hidden", border: "1px solid " + C.border, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", marginBottom: 22 }} dangerouslySetInnerHTML={{ __html: confirmSvg }} />

      <div style={{ display: "flex", gap: 12, fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 0.5 }}>
        <span>TEMPLATE: {selectedTemplateId || "—"}</span>
        <span style={{ color: C.txd }}>·</span>
        <span>THEME: {THEMES[state.category].label.toUpperCase()}</span>
        <span style={{ color: C.txd }}>·</span>
        <span>IMAGE: {chosenImageUrl ? "YES" : "PATTERN"}</span>
      </div>
    </div>;
  }

  return <div style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
    {/* Top nav: back chevron + step pills */}
    <div style={{ position: "sticky", top: 0, zIndex: 5, background: C.bg, paddingBottom: 18, marginBottom: 22, borderBottom: "1px solid " + C.border }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={goBack} style={{ background: "transparent", border: "1px solid " + C.border, borderRadius: 8, padding: "8px 12px", color: C.tx, fontFamily: ft, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{"← Back"}</button>
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          {SUB_STEPS.map(function(s, i) {
            var active = sub === s.id;
            var done = SUB_STEPS.findIndex(function(x) { return x.id === sub; }) > i;
            return <div key={s.id} style={{ padding: "8px 14px", borderRadius: 999, background: active ? accent + "15" : done ? C.surface : C.card, border: "1px solid " + (active ? accent : done ? C.border : C.border), fontFamily: mn, fontSize: 10, fontWeight: 700, color: active ? accent : done ? C.tx : C.txd, letterSpacing: 0.8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.7 }}>{(i + 1).toString().padStart(2, "0")}</span>
              <span style={{ textTransform: "uppercase" }}>{s.label}</span>
            </div>;
          })}
        </div>
      </div>
    </div>

    {/* Body */}
    <div style={{ flex: 1, paddingBottom: 100 }}>
      {sub === "paste" && renderPaste()}
      {sub === "cover" && renderCover()}
      {sub === "title" && renderTitle()}
      {sub === "image" && renderImage()}
      {sub === "confirm" && renderConfirm()}
    </div>

    {/* Bottom continue bar */}
    <div style={{ position: "sticky", bottom: 0, background: "linear-gradient(to top, " + C.bg + " 70%, transparent)", paddingTop: 20, paddingBottom: 16, marginTop: "auto" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={goBack} style={{ padding: "14px 22px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Back</button>
        <div style={{ flex: 1 }} />
        <button onClick={goNext} disabled={!canContinue()} style={{ padding: "14px 32px", background: canContinue() ? accent : C.surface, border: "none", borderRadius: 10, color: canContinue() ? C.bg : C.txd, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: canContinue() ? "pointer" : "not-allowed", letterSpacing: 0.3, transition: "all 0.15s" }}>{sub === "confirm" ? "Build Slides →" : "Continue →"}</button>
      </div>
    </div>
  </div>;
}
