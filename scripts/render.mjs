import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const props = JSON.parse(process.env.RENDER_PROPS || "{}");
const renderId = process.env.RENDER_ID || "unknown";

async function main() {
  console.log("Rendering video:", renderId);
  console.log("Props:", JSON.stringify(props, null, 2));

  const outputDir = path.resolve("output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // Bundle
  console.log("Bundling...");
  const bundleDir = await bundle({
    entryPoint: path.resolve("src/remotion/index.ts"),
    onProgress: (p) => { if (p % 10 === 0) console.log(`Bundle: ${p}%`); },
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

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleDir,
    id: "SAVideo",
    inputProps: props,
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
    inputProps: props,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 10 === 0) {
        console.log(`Render: ${Math.round(progress * 100)}%`);
      }
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
