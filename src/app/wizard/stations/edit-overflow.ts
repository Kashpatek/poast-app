"use client";
// ═══════════════════════════════════════════════════════════════════════════
// EDIT station · overflow bench helpers (shared by EditStation + EditInspector)
//
// V1 divided FULL-space (1080px) overflow pixels by a DISPLAY-space line
// height (carousel.tsx:1780), inflating the lines-over readout by 1/SCALE
// (~2.4x). Fix per docs/ARCHITECTURE.md EDIT: measure and divide in the SAME
// space. Both the hidden ruler and the line height here live in DISPLAY
// space (450x562), mirroring SlideCanvas's rendered body geometry exactly
// (10%/8% padding fractions, image reservation, line heights 1.55/1.5).
// Words = floor(linesOver x avgWordsPerLine): deliberately conservative so a
// push never strips more than the clipped tail; push again if it still clips.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { gf } from "../../shared-constants";
import { showToast } from "../../toast-context";
import { useWizard } from "../store";
import { FULL_W, FULL_H, SCALE, MARGIN_X, getSlidePositions, type Slide } from "../engine/types";

/** Two-digit slide ordinal for labels ("01".."99"). */
export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

/** Slide types whose bodyText can visually clip (V1 measured exactly these:
 *  body + image_text; other types either flex their images or clamp). */
export function canOverflow(slide: Slide | undefined): boolean {
  return !!slide && (slide.type === "body" || slide.type === "image_text");
}

export interface OverflowEstimate {
  overflowing: boolean;
  lines: number; // display lines clipped off the bottom
  words: number; // conservative word estimate of the clipped tail
}

const FITS: OverflowEstimate = { overflowing: false, lines: 0, words: 0 };

/** Measures the active slide's rendered body text against the space the
 *  canvas actually gives it, via a detached ruler div that replicates
 *  SlideCanvas's body font metrics in DISPLAY space. */
export function useBodyOverflow(slide: Slide | undefined): OverflowEstimate {
  const [est, setEst] = useState<OverflowEstimate>(FITS);
  const [fontTick, setFontTick] = useState(0);

  // Re-measure once webfonts land: Grift metrics differ from the fallback.
  useEffect(function () {
    let alive = true;
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (alive) setFontTick(1);
      });
    }
    return function () {
      alive = false;
    };
  }, []);

  const measurable = canOverflow(slide);
  const text = (slide && slide.bodyText) || "";
  const type = (slide && slide.type) || "";
  const size = (slide && slide.bodySize) || 28;
  const hasImg = !!(slide && slide.imageUrl);
  const imgH = slide ? slide.imageHeight : undefined;

  useEffect(
    function () {
      if (!measurable || !text.trim()) {
        setEst(function (p) {
          return p.overflowing ? FITS : p;
        });
        return;
      }
      // DISPLAY-space geometry, mirroring SlideCanvas's body branches.
      const lh = type === "body" ? 1.55 : 1.5;
      const avail = FULL_H * 0.82 * SCALE; // minus top 10% + bottom 8% pads
      // image_text always reserves its ImageFrame; body only when an image is set
      const reserves = type === "image_text" ? true : hasImg;
      const frac = (typeof imgH === "number" && imgH > 0 ? imgH : type === "image_text" ? 50 : 45) / 100;
      const bodyAvail = Math.max(0, avail - (reserves ? avail * frac + 12 : 0));
      const contentW = (FULL_W - MARGIN_X * 2) * SCALE;
      const lineHeightPx = size * SCALE * lh;

      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.top = "-99999px";
      el.style.left = "-99999px";
      el.style.width = contentW + "px";
      el.style.height = bodyAvail + "px";
      el.style.fontFamily = gf;
      el.style.fontSize = size * SCALE + "px";
      el.style.fontWeight = "400";
      el.style.lineHeight = String(lh);
      el.style.whiteSpace = "pre-wrap";
      el.style.wordBreak = "break-word";
      el.style.overflow = "hidden";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      el.textContent = text;
      document.body.appendChild(el);
      const overflowPx = el.scrollHeight - el.clientHeight;
      const scrollH = el.scrollHeight;
      document.body.removeChild(el);

      if (overflowPx <= 1 || lineHeightPx <= 0) {
        setEst(function (p) {
          return p.overflowing ? FITS : p;
        });
        return;
      }
      const wordCount = text.trim().split(/\s+/).length;
      const linesOver = Math.max(1, Math.ceil(overflowPx / lineHeightPx));
      const totalLines = Math.max(1, Math.round(scrollH / lineHeightPx));
      const words = Math.max(
        1,
        Math.min(Math.max(1, wordCount - 1), Math.floor(linesOver * (wordCount / totalLines)))
      );
      setEst(function (p) {
        return p.overflowing && p.lines === linesOver && p.words === words
          ? p
          : { overflowing: true, lines: linesOver, words: words };
      });
    },
    [measurable, text, type, size, hasImg, imgH, fontTick]
  );

  return est;
}

// ═══ TAIL SPLIT ═══
// Cut roughly overflowWords off the end, preferring the nearest sentence or
// line boundary just before the target cut so both slides keep reading
// naturally (V1's computeSplit idea, retargeted at the measured word count).
function splitTail(text: string, overflowWords: number): { head: string; tail: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return null;
  const n = Math.min(Math.max(1, Math.round(overflowWords)), words.length - 1);
  const targetWordIdx = words.length - n;
  // char offset of the first pushed word, walked over the ORIGINAL string so
  // newlines and spacing survive in both halves
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  let seen = 0;
  let target = -1;
  while ((m = re.exec(text)) !== null) {
    if (seen === targetWordIdx) {
      target = m.index;
      break;
    }
    seen++;
  }
  if (target <= 0) return null;
  let cut = target;
  const windowLo = Math.max(0, target - Math.floor(text.length * 0.15));
  for (let j = target - 1; j >= windowLo; j--) {
    const ch = text.charAt(j);
    if (ch === "\n") {
      cut = j + 1;
      break;
    }
    if ((ch === "." || ch === "!" || ch === "?") && /\s/.test(text.charAt(j + 1) || " ")) {
      cut = j + 1;
      break;
    }
  }
  const head = text.slice(0, cut).replace(/\s+$/, "");
  const tail = text.slice(cut).trim();
  if (!head || !tail) return null;
  return { head: head, tail: tail };
}

// Position recompute mirroring store.ts (its helper is module-private).
const KEEP_TYPES = ["image_text", "large_image", "dual_image", "large_with_title", "body_dual"];

function recomputePositions(slides: Slide[]): Slide[] {
  const positions = getSlidePositions(slides.length);
  return slides.map(function (sl, i) {
    const pos = positions[i] || (i === slides.length - 1 ? 4 : 2);
    return {
      ...sl,
      position: pos,
      type:
        pos === 1
          ? sl.type === "cover_image"
            ? "cover_image"
            : "cover"
          : KEEP_TYPES.indexOf(sl.type) !== -1
            ? sl.type
            : "body",
    };
  });
}

let overflowSeq = 0;

function tailSlide(tail: string, bodySize: number): Slide {
  overflowSeq++;
  return {
    id: "slide-push-" + Date.now() + "-" + overflowSeq,
    position: 2, // recomputePositions reassigns after insertion
    type: "body",
    title: "",
    titleSize: 74,
    subtitle: "",
    subtitleSize: 34,
    bodyText: tail,
    bodySize: bodySize,
    imageUrl: "",
    caption: "",
    captionSize: 18,
    titleAnchor: "top",
    titleMarginTop: 80,
    bodyAnchor: "top",
  };
}

// Body-text types the tail can merge into; the closer (position 4) always
// gets a fresh slide inserted before it instead.
const MERGE_TYPES = ["body", "image_text", "body_dual"];

/** Shared tail-move core: commit head to the active slide, land tail on the
 *  next slide (merge when allowed) or a fresh slide. Snapshots undo BEFORE
 *  mutating. `alwaysNew` forces a fresh slide even when the neighbor could
 *  merge; `follow` moves the selection onto the slide that received the tail. */
function applyTailMove(
  split: { head: string; tail: string },
  opts: { alwaysNew: boolean; follow: boolean; verb: string }
): void {
  const st = useWizard.getState();
  const i = st.activeIdx;
  const active = st.slides[i];
  if (!active) return;
  const next = st.slides.slice();
  next[i] = { ...active, bodyText: split.head };
  const neighbor = next[i + 1];
  const mergeable =
    !opts.alwaysNew && !!neighbor && MERGE_TYPES.indexOf(neighbor.type) !== -1 && neighbor.position !== 4;
  if (mergeable && neighbor) {
    next[i + 1] = { ...neighbor, bodyText: (split.tail + "\n\n" + (neighbor.bodyText || "")).trim() };
  } else {
    next.splice(i + 1, 0, tailSlide(split.tail, active.bodySize || 28));
  }
  st.pushUndo(); // snapshot the pre-move deck
  st.setSlides(recomputePositions(next));
  if (opts.follow) st.setActiveIdx(i + 1);
  const moved = split.tail.trim().split(/\s+/).length;
  showToast(opts.verb + " ~" + moved + " WORDS TO SLIDE " + pad2(i + 2));
}

/** One-click overflow push. Moves the measured tail of the active slide's
 *  bodyText onto the next body slide (or a new slide when the neighbor is
 *  the closer or an image-only frame). */
export function pushOverflowToNext(estimatedWords: number): void {
  const st = useWizard.getState();
  const active = st.slides[st.activeIdx];
  if (!active || !canOverflow(active)) return;
  const split = splitTail(active.bodyText || "", estimatedWords);
  if (!split) {
    showToast("Nothing to push yet.", "error");
    return;
  }
  applyTailMove(split, { alwaysNew: false, follow: false, verb: "PUSHED" });
}

// ═══ MANUAL TEXT FLOW ═══
// Overflow is automatic; these are the author's tools — shift the last block
// of developed/parsed text to the next page, or break it into a new one,
// regardless of whether anything clips.

/** Cut at the LAST paragraph break; if the text is a single paragraph, at the
 *  last sentence boundary instead. Null when there is nothing to move. */
export function cutLastBlock(text: string): { head: string; tail: string } | null {
  const t = text || "";
  if (!t.trim()) return null;
  const para = t.replace(/\s+$/, "").lastIndexOf("\n\n");
  if (para > 0) {
    const head = t.slice(0, para).replace(/\s+$/, "");
    const tail = t.slice(para).trim();
    if (head && tail) return { head: head, tail: tail };
  }
  // single paragraph: walk back from the end to the previous sentence end
  const trimmed = t.replace(/\s+$/, "");
  for (let j = trimmed.length - 2; j > 0; j--) {
    const ch = trimmed.charAt(j);
    if ((ch === "." || ch === "!" || ch === "?") && /\s/.test(trimmed.charAt(j + 1))) {
      const head = trimmed.slice(0, j + 1);
      const tail = trimmed.slice(j + 1).trim();
      if (head.trim() && tail) return { head: head, tail: tail };
      return null;
    }
  }
  return null;
}

/** True when the active slide has a movable last block. */
export function canShiftBlock(slide: Slide | undefined): boolean {
  return canOverflow(slide) && !!cutLastBlock((slide && slide.bodyText) || "");
}

/** Shift the last paragraph/sentence onto the next page (merge when it can). */
export function shiftLastBlockToNext(): void {
  const st = useWizard.getState();
  const active = st.slides[st.activeIdx];
  if (!active || !canOverflow(active)) return;
  const split = cutLastBlock(active.bodyText || "");
  if (!split) {
    showToast("Nothing to shift — need a second sentence or paragraph.", "error");
    return;
  }
  applyTailMove(split, { alwaysNew: false, follow: false, verb: "SHIFTED" });
}

/** Break the last paragraph/sentence out into a brand-new page and follow it. */
export function splitLastBlockToNew(): void {
  const st = useWizard.getState();
  const active = st.slides[st.activeIdx];
  if (!active || !canOverflow(active)) return;
  const split = cutLastBlock(active.bodyText || "");
  if (!split) {
    showToast("Nothing to split — need a second sentence or paragraph.", "error");
    return;
  }
  applyTailMove(split, { alwaysNew: true, follow: true, verb: "SPLIT" });
}

/** Split the active slide's body at an explicit character offset (the canvas
 *  caret) into a new page. `fullText` is the live contentEditable text, which
 *  may be ahead of the store (blur has not committed yet). */
export function splitBodyAtOffset(offset: number, fullText: string): void {
  const st = useWizard.getState();
  const active = st.slides[st.activeIdx];
  if (!active || !canOverflow(active)) return;
  const head = fullText.slice(0, offset).replace(/\s+$/, "");
  const tail = fullText.slice(offset).trim();
  if (!head || !tail) {
    showToast("Place the cursor where the new page should start.", "error");
    return;
  }
  applyTailMove({ head: head, tail: tail }, { alwaysNew: true, follow: true, verb: "SPLIT" });
}
