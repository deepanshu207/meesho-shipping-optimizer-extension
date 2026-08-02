/**
 * Meesho shipping reducer — optimization strategies.
 * Runs in browser; ranks variants by estimated shipping ₹.
 */

import { compressStudioToKb, compressFramedToKb } from "./encoder.js?v=32";
import {
  imageToWhiteCanvas,
  trimMargins,
  fitSquare,
  addFrame,
  tallFrame,
  isWideCollage,
  splitCollagePanel,
  isStudioBackground,
  isTallPortrait,
  measureNearWhiteRatio,
  measureWhiteRatio,
  MEESHO_COMPACT_COVERAGE,
  MEESHO_SQUARE_SIDE,
} from "./canvas-utils.js?v=97";
import { estimateImageShipping } from "./shipping.js?v=32";
import { buildSmartPlan, compareVariants, strategyLabel } from "./smart-plan.js?v=32";

const STUDIO_ULTRA = [14, 16, 18, 20, 22];
const STUDIO_ULTRA_LOW_HUNT = [12, 13, 14, 15, 16, 18, 20, 22, 24];
const STUDIO_BALANCED = [20, 24, 28, 32, 36, 40];
const STUDIO_BALANCED_LOW_HUNT = [18, 20, 22, 24, 28, 32, 36];
const FRAMED_SLABS = [91, 92, 93];
const FRAMED_LOW = [64, 66, 68, 71];
const FRAMED_LOW_HUNT = [58, 60, 62, 64, 66, 68, 71];
const TALL_SLABS = [44, 46, 48, 50, 52];
const TALL_SLABS_LOW_HUNT = [40, 42, 44, 46, 48, 50, 52];
const FLATLAY_SLABS = [38, 40, 42, 44];
const FLATLAY_SLABS_LOW_HUNT = [34, 36, 38, 40, 42, 44, 46];

function yieldMain() {
  return new Promise((r) => setTimeout(r, 0));
}

async function variantFrom(canvas, blob, meta) {
  const v = {
    blob,
    bytes: blob.size,
    width: meta.width ?? canvas.width,
    height: meta.height ?? canvas.height,
    path: meta.path,
    mode: meta.mode,
    label: meta.label,
    recommended: !!meta.recommended,
    lowest: !!meta.lowest,
  };
  v.estInr = estimateImageShipping(v);
  v.kb = Math.ceil(blob.size / 1024);
  return v;
}

async function studioVariants(img, tiers, path, modeName, onProgress, opts = {}) {
  const side = opts.side ?? MEESHO_SQUARE_SIDE;
  const coverage = opts.coverage ?? MEESHO_COMPACT_COVERAGE;
  const trimmed = trimMargins(imageToWhiteCanvas(img), 0.02);
  const canvas = fitSquare(trimmed, side, coverage);
  const wr = Math.max(measureNearWhiteRatio(canvas), measureWhiteRatio(canvas));
  const out = [];
  for (let i = 0; i < tiers.length; i++) {
    const kb = tiers[i];
    if (onProgress) onProgress(`Studio · ${kb}KB`);
    const blob = await compressStudioToKb(canvas, kb, wr);
    out.push(
      await variantFrom(canvas, blob, {
        path,
        mode: modeName,
        label: `${modeName} · ${kb}KB · ${canvas.width}×${canvas.height}`,
        recommended: kb === tiers[1] || kb === tiers[Math.floor(tiers.length / 2)],
        lowest: i === 0,
        width: canvas.width,
        height: canvas.height,
      })
    );
    await yieldMain();
  }
  return out;
}

async function framedVariants(img, tiers, path, modeName, frameOpts, onProgress) {
  const out = [];
  const base = trimMargins(imageToWhiteCanvas(img), 0.02);
  const framed = addFrame(base, frameOpts);
  for (let i = 0; i < tiers.length; i++) {
    const kb = tiers[i];
    if (onProgress) onProgress(`Framed · ${kb}KB`);
    const blob = await compressFramedToKb(framed, kb);
    out.push(
      await variantFrom(framed, blob, {
        path,
        mode: modeName,
        label: `${modeName} · ${kb}KB · ${framed.width}×${framed.height}`,
        recommended: kb === 93 || kb === 66,
        lowest: i === 0,
        width: framed.width,
        height: framed.height,
      })
    );
    await yieldMain();
  }
  return out;
}

async function tallVariants(img, onProgress, tiers = TALL_SLABS) {
  const out = [];
  const framed = tallFrame(img);
  for (const kb of tiers) {
    if (onProgress) onProgress(`Tall ₹50 · ${kb}KB`);
    const blob = await compressFramedToKb(framed, kb);
    out.push(
      await variantFrom(framed, blob, {
        path: "tall",
        mode: "Tall ₹50",
        label: `Tall ₹50 · ${kb}KB · 703×1024`,
        recommended: kb === 48 || kb === 50,
        lowest: kb === tiers[0],
        width: 703,
        height: 1024,
      })
    );
    await yieldMain();
  }
  return out;
}

async function flatlayVariants(img, onProgress, tiers = FLATLAY_SLABS) {
  const out = [];
  const sq = fitSquare(
    trimMargins(imageToWhiteCanvas(img), 0.02),
    1024,
    MEESHO_COMPACT_COVERAGE
  );
  const wr = Math.max(measureNearWhiteRatio(sq), measureWhiteRatio(sq));
  for (const kb of tiers) {
    if (onProgress) onProgress(`Flat-Lay · ${kb}KB`);
    const blob = await compressStudioToKb(sq, kb, wr);
    out.push(
      await variantFrom(sq, blob, {
        path: "flatlay",
        mode: "Flat-Lay",
        label: `Flat-Lay · ${kb}KB · 1024×1024`,
        recommended: kb === 40,
        lowest: kb === tiers[0],
        width: 1024,
        height: 1024,
      })
    );
    await yieldMain();
  }
  return out;
}

async function collageVariants(img, onProgress) {
  const out = [];
  const left = splitCollagePanel(img, "left");
  const right = splitCollagePanel(img, "right");
  const panels = [
    { canvas: fitSquare(left, 1200, 0.68), path: "collage_front", name: "Collage front" },
    { canvas: fitSquare(right, 1200, 0.86), path: "collage_back", name: "Collage back" },
  ];
  const tiers = [44, 48, 55, 58];
  for (const panel of panels) {
    const wr = measureNearWhiteRatio(panel.canvas);
    for (const kb of tiers) {
      if (onProgress) onProgress(`${panel.name} · ${kb}KB`);
      const blob = await compressStudioToKb(panel.canvas, kb, wr);
      out.push(
        await variantFrom(panel.canvas, blob, {
          path: panel.path,
          mode: "Collage",
          label: `${panel.name} · ${kb}KB`,
          recommended: panel.path === "collage_back" && kb === 55,
          lowest: false,
          width: panel.canvas.width,
          height: panel.canvas.height,
        })
      );
      await yieldMain();
    }
  }
  return out;
}

function dedupeAndRank(variants, max = 30) {
  const seen = new Set();
  const unique = [];
  for (const v of variants) {
    const key = `${v.path}-${v.kb}-${v.width}x${v.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(v);
  }
  unique.sort(compareVariants);
  if (unique.length) unique[0].best = true;
  return unique.slice(0, max);
}

function strategiesForImage(img, mode, category, analysis) {
  if (mode === "smart") {
    const plan = buildSmartPlan(category, analysis || {
      studioBg: isStudioBackground(img),
      tall: isTallPortrait(img),
      collage: isWideCollage(img),
    });
    return plan.strategies;
  }

  const map = {
    studio: ["studio"],
    studio_ultra: ["studio_ultra"],
    tall: ["tall"],
    flatlay: ["flatlay"],
    framed: ["framed"],
    framed_low: ["framed_low"],
    collage: ["collage"],
  };
  return map[mode] || ["studio"];
}

export function getSmartPlan(img, category) {
  const analysis = {
    studioBg: isStudioBackground(img),
    tall: isTallPortrait(img),
    collage: isWideCollage(img),
  };
  return {
    ...analysis,
    ...buildSmartPlan(category, analysis),
  };
}

export async function optimizeImage(img, options = {}) {
  const {
    mode = "smart",
    category = "general",
    borderColor = "#ff7900",
    targetInr = null,
    lowHunt = false,
    onProgress = () => {},
  } = options;

  const analysis = {
    studioBg: isStudioBackground(img),
    tall: isTallPortrait(img),
    collage: isWideCollage(img),
  };

  const strategies = strategiesForImage(img, mode, category, analysis);
  const all = [];
  const frameOpts = { borderColor, stickers: true };
  const ultraTiers = lowHunt ? STUDIO_ULTRA_LOW_HUNT : STUDIO_ULTRA;
  const studioTiers = lowHunt ? STUDIO_BALANCED_LOW_HUNT : STUDIO_BALANCED;
  const tallTiers = lowHunt ? TALL_SLABS_LOW_HUNT : TALL_SLABS;
  const flatlayTiers = lowHunt ? FLATLAY_SLABS_LOW_HUNT : FLATLAY_SLABS;
  const framedLowTiers = lowHunt ? FRAMED_LOW_HUNT : FRAMED_LOW;

  for (const s of strategies) {
    onProgress(`Running ${strategyLabel(s)}…`);
    if (s === "studio_ultra") {
      all.push(
        ...(await studioVariants(img, ultraTiers, "studio_ultra", "Studio Ultra", onProgress, {
          side: 1024,
          coverage: lowHunt ? 0.62 : 0.65,
        }))
      );
    } else if (s === "studio") {
      all.push(
        ...(await studioVariants(img, studioTiers, "studio", "Studio White", onProgress, {
          side: MEESHO_SQUARE_SIDE,
          coverage: lowHunt ? 0.66 : MEESHO_COMPACT_COVERAGE,
        }))
      );
    } else if (s === "tall") {
      all.push(...(await tallVariants(img, onProgress, tallTiers)));
    } else if (s === "flatlay") {
      all.push(...(await flatlayVariants(img, onProgress, flatlayTiers)));
    } else if (s === "framed") {
      all.push(...(await framedVariants(img, FRAMED_SLABS, "framed", "Framed", frameOpts, onProgress)));
    } else if (s === "framed_low") {
      all.push(
        ...(await framedVariants(img, framedLowTiers, "framed_low", "Framed Low", frameOpts, onProgress))
      );
    } else if (s === "collage") {
      all.push(...(await collageVariants(img, onProgress)));
    }
  }

  const cap = lowHunt ? 48 : mode === "smart" ? 30 : 24;
  let ranked = dedupeAndRank(all, cap);
  if (targetInr) {
    const filtered = ranked.filter((v) => v.estInr <= targetInr);
    if (filtered.length) ranked = filtered;
  }
  return ranked;
}

/** Generate KB neighbors around a live winner path (Phase 3 refinement). */
export async function generatePathRefinements(img, path, centerKb, options = {}) {
  const { borderColor = "#ff7900", onProgress = () => {} } = options;
  const kb = parseInt(centerKb, 10);
  if (!path || !Number.isFinite(kb)) return [];

  const neighbors = [...new Set([kb - 3, kb - 2, kb - 1, kb + 1, kb + 2, kb + 3])]
    .filter((n) => n >= 12 && n <= 96)
    .sort((a, b) => a - b);
  if (!neighbors.length) return [];

  const frameOpts = { borderColor, stickers: true };
  onProgress(`Refine ${path} near ${kb}KB…`);

  if (path === "studio_ultra") {
    return studioVariants(img, neighbors, "studio_ultra", "Studio Ultra+", onProgress, {
      side: 1024,
      coverage: 0.62,
    });
  }
  if (path === "studio") {
    return studioVariants(img, neighbors, "studio", "Studio White+", onProgress, {
      side: MEESHO_SQUARE_SIDE,
      coverage: 0.66,
    });
  }
  if (path === "tall") {
    return tallVariants(img, onProgress, neighbors);
  }
  if (path === "flatlay") {
    return flatlayVariants(img, onProgress, neighbors);
  }
  if (path === "framed_low") {
    return framedVariants(img, neighbors, "framed_low", "Framed Low+", frameOpts, onProgress);
  }
  return [];
}

export function analyzeImage(img) {
  const studioBg = isStudioBackground(img);
  const tall = isTallPortrait(img);
  const collage = isWideCollage(img);
  const plan = buildSmartPlan("general", { studioBg, tall, collage });

  return {
    width: img.width,
    height: img.height,
    aspect: (img.width / img.height).toFixed(2),
    studioBg,
    tall,
    collage,
    suggested: plan.summary,
    smartTips: plan.tips,
  };
}
