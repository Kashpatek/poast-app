import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

const props = JSON.parse(process.env.RENDER_PROPS || "{}");
const renderId = process.env.RENDER_ID || "unknown";

// Download a URL to a local file
function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const mod = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(dest); });
    }).on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function main() {
  console.log("Rendering video:", renderId);

  const outputDir = path.resolve("output");
  const assetsDir = path.resolve("assets");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

  // Download audio assets
  let localAudioUrl = "";
  let localMusicUrl = "";

  if (props.audioUrl) {
    console.log("Downloading voiceover...");
    const dest = path.join(assetsDir, "voiceover.mp3");
    await download(props.audioUrl, dest);
    localAudioUrl = dest;
    console.log("Voiceover downloaded:", fs.statSync(dest).size, "bytes");
  }

  if (props.musicUrl) {
    console.log("Downloading music...");
    const dest = path.join(assetsDir, "music.mp3");
    await download(props.musicUrl, dest);
    localMusicUrl = dest;
    console.log("Music downloaded:", fs.statSync(dest).size, "bytes");
  }

  // Download clip videos
  const localClipUrls = [];
  for (let i = 0; i < (props.clipUrls || []).length; i++) {
    const url = props.clipUrls[i];
    if (url) {
      console.log(`Downloading clip ${i + 1}...`);
      const dest = path.join(assetsDir, `clip-${i + 1}.mp4`);
      await download(url, dest);
      localClipUrls.push(dest);
      console.log(`Clip ${i + 1} downloaded:`, fs.statSync(dest).size, "bytes");
    }
  }

  // Bundle
  console.log("Bundling Remotion project...");
  const bundleDir = await bundle({
    entryPoint: path.resolve("src/remotion/index.tsx"),
    onProgress: (p) => { if (p % 20 === 0) console.log(`Bundle: ${p}%`); },
  });

  // Determine dimensions
  const dims = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
  };
  const aspect = props.aspectRatio || "16:9";
  const dim = dims[aspect] || dims["16:9"];
  const fps = 30;
  const duration = props.duration || 60;

  const inputProps = {
    hook: props.hook || "",
    scriptSections: props.scriptSections || [],
    dataPoints: props.dataPoints || [],
    thumbnailHeadline: props.thumbnailHeadline || "",
    audioUrl: localAudioUrl ? "file://" + path.resolve(localAudioUrl) : "",
    clipUrls: localClipUrls.map(c => "file://" + path.resolve(c)),
    musicUrl: localMusicUrl ? "file://" + path.resolve(localMusicUrl) : "",
    duration: duration,
  };

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleDir,
    id: "SAVideo",
    inputProps,
  });

  composition.width = dim.width;
  composition.height = dim.height;
  composition.fps = fps;
  composition.durationInFrames = duration * fps;

  // Render
  const outputPath = path.join(outputDir, `sa-${renderId}-${aspect.replace(":", "x")}.mp4`);
  console.log("Rendering to:", outputPath);

  await renderMedia({
    composition,
    serveUrl: bundleDir,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) console.log(`Render: ${pct}%`);
    },
  });

  console.log("Done! Output:", outputPath);
  const stats = fs.statSync(outputPath);
  console.log("Size:", Math.round(stats.size / 1024 / 1024 * 100) / 100, "MB");
}

main().catch((e) => {
  console.error("Render failed:", e);
  process.exit(1);
});
