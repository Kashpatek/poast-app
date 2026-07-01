// Design-studio · smart snapping + alignment guides (OSS, react-design-editor
// style, self-contained). Snaps the moving object's edges/center to the canvas
// edges/center and to other objects' edges/centers, drawing amber guide lines
// while it snaps.
//
// SOFT policy (matches the Carousel 2.0 "soft snap + export gate" decision):
// snapping only NUDGES within a small threshold — it never clamps, so objects
// can still be dragged off-canvas freely; overflow is flagged at export, not
// blocked here.
//
// Guides are drawn on `contextTop` ONLY while an object is moving. In Fabric v7
// selection controls render on the MAIN/lower canvas (verified in the source),
// and the group-selection rubber-band uses contextTop only when NOT moving an
// object — so touching contextTop mid-move never wipes controls or the
// rubber-band. Guides live purely on contextTop: they are never objects, so
// toJSON / history / export never see them.

/* eslint-disable @typescript-eslint/no-explicit-any */

const THRESHOLD_SCREEN = 6; // px on screen at which a line snaps
const GUIDE_COLOR = "#F7B041";

interface Guide {
  axis: "v" | "h";
  at: number; // canvas coordinate of the guide line
}

export interface SmartGuideOpts {
  getDims: () => { width: number; height: number };
  getZoom: () => number; // the editor's CSS zoom (viewportTransform is identity)
}

// Attach smart guides to a Fabric canvas. Returns a detach() to call before
// canvas.dispose().
export function attachSmartGuides(canvas: any, opts: SmartGuideOpts): () => void {
  let moving = false;
  let guides: Guide[] = [];

  const bounds = (o: any) => {
    if (o.setCoords) o.setCoords();
    return o.getBoundingRect(); // v7: no args → {left, top, width, height} in canvas units
  };

  const onMoving = (e: any) => {
    const t = e && e.target;
    if (!t) return;
    moving = true;
    guides = [];

    const { width: W, height: H } = opts.getDims();
    const thr = THRESHOLD_SCREEN / (opts.getZoom() || 1);
    const b = bounds(t);

    // Candidate target lines: canvas edges + center, then every other object's.
    const vTargets: number[] = [0, W / 2, W];
    const hTargets: number[] = [0, H / 2, H];
    for (const o of canvas.getObjects()) {
      if (o === t || o.visible === false || o.excludeFromExport) continue;
      const ob = bounds(o);
      vTargets.push(ob.left, ob.left + ob.width / 2, ob.left + ob.width);
      hTargets.push(ob.top, ob.top + ob.height / 2, ob.top + ob.height);
    }

    // The moving object's own lines (bbox left/center/right, top/middle/bottom).
    const vLines = [b.left, b.left + b.width / 2, b.left + b.width];
    const hLines = [b.top, b.top + b.height / 2, b.top + b.height];

    // Snap the single closest line per axis (align the bbox line to the target
    // by nudging the object's origin by the same delta).
    let bestV: { delta: number; at: number } | null = null;
    for (const lx of vLines)
      for (const tx of vTargets) {
        const d = tx - lx;
        if (Math.abs(d) <= thr && (!bestV || Math.abs(d) < Math.abs(bestV.delta))) bestV = { delta: d, at: tx };
      }
    let bestH: { delta: number; at: number } | null = null;
    for (const ly of hLines)
      for (const ty of hTargets) {
        const d = ty - ly;
        if (Math.abs(d) <= thr && (!bestH || Math.abs(d) < Math.abs(bestH.delta))) bestH = { delta: d, at: ty };
      }

    if (bestV) {
      t.set({ left: t.left + bestV.delta });
      guides.push({ axis: "v", at: bestV.at });
    }
    if (bestH) {
      t.set({ top: t.top + bestH.delta });
      guides.push({ axis: "h", at: bestH.at });
    }
    if (bestV || bestH) t.setCoords();
  };

  const drawGuides = () => {
    if (!moving) return; // only touch contextTop while moving an object
    const ctx = canvas.contextTop;
    if (!ctx) return;
    canvas.clearContext(ctx);
    if (!guides.length) return;
    const { width: W, height: H } = opts.getDims();
    ctx.save();
    const r = canvas.getRetinaScaling ? canvas.getRetinaScaling() : 1;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    const vt = canvas.viewportTransform;
    if (vt) ctx.transform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]);
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1.25 / (opts.getZoom() || 1);
    ctx.beginPath();
    for (const g of guides) {
      if (g.axis === "v") {
        ctx.moveTo(g.at, 0);
        ctx.lineTo(g.at, H);
      } else {
        ctx.moveTo(0, g.at);
        ctx.lineTo(W, g.at);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  const endMove = () => {
    if (!moving && !guides.length) return;
    moving = false;
    guides = [];
    const ctx = canvas.contextTop;
    if (ctx) canvas.clearContext(ctx);
  };

  canvas.on("object:moving", onMoving);
  canvas.on("after:render", drawGuides);
  canvas.on("mouse:up", endMove);
  canvas.on("object:modified", () => {
    guides = [];
  });
  canvas.on("selection:cleared", endMove);

  return function detach() {
    canvas.off("object:moving", onMoving);
    canvas.off("after:render", drawGuides);
    canvas.off("mouse:up", endMove);
    canvas.off("selection:cleared", endMove);
    const ctx = canvas.contextTop;
    if (ctx) canvas.clearContext(ctx);
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
