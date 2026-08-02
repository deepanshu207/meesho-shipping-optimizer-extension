/**
 * Live tab — static showcase promo frames (no Meesho API).
 * Portrait 3:4 canvas, uniform orange→green gradient border, 3 corner badges.
 */
import {
  imageToWhiteCanvas,
  trimMargins,
} from "./lib/canvas-utils.js?v=97";
import { compressFramedToKb } from "./lib/encoder.js?v=59";
import { estimateImageShipping } from "./lib/shipping.js?v=59";

/** Fixed badge assets matching the reference screenshot. */
export const SHOWCASE_BADGES = {
  topLeft: 4, // 100% QUALITY gold seal
  topRight: 5, // orange star ribbon
  bottomLeft: 18, // 100% SATISFACTION GUARANTEED
};

/** Portrait outer canvas — 3:4 like the reference. */
export const SHOWCASE_OUTER_W = 900;
export const SHOWCASE_OUTER_H = 1200;

/** Uniform border ~6% of width (screenshot: 5–7%). */
export const SHOWCASE_BORDER_RATIO = 0.06;

/** Default variant count for independent generate. */
export const SHOWCASE_VARIANT_COUNT = 25;

const GRADIENT_TOP = "#FF9800";
const GRADIENT_BOTTOM = "#4CAF50";

const badgeCache = {};

function assetUrl(relative) {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.assetUrl) {
    return MeeshoAPI.assetUrl(relative);
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relative);
  }
  return relative;
}

async function loadBadge(num) {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.loadBadge) {
    return MeeshoAPI.loadBadge(num);
  }
  if (badgeCache[num]) return badgeCache[num];
  const src = assetUrl("Badge/badge" + num + ".png");
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      badgeCache[num] = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function preloadShowcaseBadges() {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
    await MeeshoAPI.preloadBadges();
    return;
  }
  await Promise.all(
    Object.values(SHOWCASE_BADGES).map((n) => loadBadge(n)),
  );
}

function showcaseKbTiers(count = SHOWCASE_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 50;
  const end = 74;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

/**
 * Draw portrait showcase frame: tight gradient border around product (no letterbox).
 * Outer size follows product aspect — capped at 900×1200 to avoid shipping inflation.
 */
function buildShowcaseFrameCanvas(img) {
  const MAX_OUTER_W = SHOWCASE_OUTER_W;
  const MAX_OUTER_H = SHOWCASE_OUTER_H;

  const trimmed = trimMargins(imageToWhiteCanvas(img), 0.045);
  let dw = trimmed.width;
  let dh = trimmed.height;

  const borderGuess = Math.max(
    24,
    Math.round(Math.min(dw, dh) * SHOWCASE_BORDER_RATIO),
  );
  const maxDw = MAX_OUTER_W - borderGuess * 2;
  const maxDh = MAX_OUTER_H - borderGuess * 2;
  const fitScale = Math.min(maxDw / dw, maxDh / dh, 1);
  if (fitScale < 1) {
    dw = Math.round(dw * fitScale);
    dh = Math.round(dh * fitScale);
  }

  const border = Math.max(24, Math.round(Math.min(dw, dh) * SHOWCASE_BORDER_RATIO));
  const outerW = dw + border * 2;
  const outerH = dh + border * 2;
  const px = border;
  const py = border;

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, outerH);
  grad.addColorStop(0, GRADIENT_TOP);
  grad.addColorStop(1, GRADIENT_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, outerW, outerH);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px, py, dw, dh);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, px, py, dw, dh);

  return { canvas, px, py, dw, dh, border, trimmed, outerW, outerH };
}

/**
 * Corner badges sit on the gradient border strip, barely overlapping the
 * product corners — keeps face/body clear (reference screenshot layout).
 */
function showcasePlacements(px, py, dw, dh, border, outerW, outerH) {
  const largeSize = Math.min(
    Math.max(42, Math.round(border * 1.08)),
    Math.round(outerW / 8),
  );
  const smallSize = Math.max(24, Math.round(largeSize * 0.46));
  /** How far the badge extends from border onto the product corner. */
  const overlapLg = Math.round(largeSize * 0.32);
  const overlapSm = Math.round(smallSize * 0.28);

  const placements = [
    {
      id: "showcase-quality",
      label: "100% Quality",
      anchor: "top-left",
      num: SHOWCASE_BADGES.topLeft,
      size: largeSize,
      x: px - overlapLg,
      y: py - overlapLg,
      drawn: false,
    },
    {
      id: "showcase-star",
      label: "Star ribbon",
      anchor: "top-right",
      num: SHOWCASE_BADGES.topRight,
      size: largeSize,
      x: px + dw - largeSize + overlapLg,
      y: py - overlapLg,
      drawn: false,
    },
    {
      id: "showcase-satisfaction",
      label: "Satisfaction",
      anchor: "bottom-left",
      num: SHOWCASE_BADGES.bottomLeft,
      size: smallSize,
      x: px - overlapSm,
      y: py + dh - smallSize + overlapSm,
      drawn: false,
    },
  ];

  const pad = 3;
  for (const p of placements) {
    p.x = Math.max(pad, Math.min(p.x, outerW - p.size - pad));
    p.y = Math.max(pad, Math.min(p.y, outerH - p.size - pad));
  }
  return placements;
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      const badge = await loadBadge(p.num);
      if (badge) {
        ctx.drawImage(badge, p.x, p.y, p.size, p.size);
        copy.drawn = true;
      }
    } catch (e) {}
    out.push(copy);
  }
  return out;
}

function dataUrlFromCanvas(canvas, quality = 0.82) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildShowcaseLayers(img) {
  const built = buildShowcaseFrameCanvas(img);
  const { canvas, px, py, dw, dh, border, trimmed, outerW, outerH } = built;
  const placements = showcasePlacements(
    px,
    py,
    dw,
    dh,
    border,
    outerW,
    outerH,
  );

  const noStickersCanvas = document.createElement("canvas");
  noStickersCanvas.width = canvas.width;
  noStickersCanvas.height = canvas.height;
  noStickersCanvas.getContext("2d").drawImage(canvas, 0, 0);
  const noStickers = dataUrlFromCanvas(noStickersCanvas);

  const fullCtx = canvas.getContext("2d");
  const badgePlacements = await drawPlacements(fullCtx, placements);
  const full = dataUrlFromCanvas(canvas);

  const productOnlyCanvas = document.createElement("canvas");
  productOnlyCanvas.width = dw;
  productOnlyCanvas.height = dh;
  const pCtx = productOnlyCanvas.getContext("2d");
  pCtx.drawImage(
    trimmed,
    0,
    0,
    trimmed.width,
    trimmed.height,
    0,
    0,
    dw,
    dh,
  );
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(
    trimmed,
    0,
    0,
    trimmed.width,
    trimmed.height,
    0,
    0,
    dw,
    dh,
  );
  const shifted = badgePlacements.map((p) => ({
    num: p.num,
    size: p.size,
    x: p.x - px,
    y: p.y - py,
    drawn: p.drawn,
  }));
  await drawPlacements(nbCtx, shifted);
  const noBorder = dataUrlFromCanvas(noBorderCanvas);

  return {
    canvas,
    layers: {
      full,
      noStickers,
      noBorder,
      productOnly,
      _stickersRendered: badgePlacements.some((p) => p.drawn),
      _badgePlacements: badgePlacements,
      _staticFrame: {
        style: "showcase",
        frameType: "gradient",
        gradientTop: GRADIENT_TOP,
        gradientBottom: GRADIENT_BOTTOM,
        gradientPreset: "showcase",
        px,
        py,
        dw,
        dh,
        border,
        outerW,
        outerH,
      },
    },
    meta: {
      style: "showcase",
      showcasePreset: "promo-gradient-frame",
      canvasW: outerW,
      canvasH: outerH,
      productW: dw,
      productH: dh,
      borderPx: border,
      outerW,
      outerH,
    },
  };
}

/**
 * Generate static showcase variants (20–30 KB-compressed copies of same layout).
 */
export async function buildShowcaseVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = SHOWCASE_VARIANT_COUNT,
  } = options;

  await preloadShowcaseBadges();
  onProgress("Building showcase promo frames…");

  const { canvas, layers, meta } = await buildShowcaseLayers(img);
  const kbTiers = showcaseKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Showcase frame · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const blob = await compressFramedToKb(canvas, kb);
    const v = {
      blob,
      bytes: blob.size,
      width: meta.outerW,
      height: meta.outerH,
      path: "showcase",
      mode: "Showcase",
      label: `Showcase · ${meta.outerW}×${meta.outerH} · ${kb}KB`,
      recommended: kb === kbTiers[Math.floor(kbTiers.length / 2)],
      lowest: i === 0,
      layers,
      meta: { ...meta, targetKb: kb },
    };
    v.kb = Math.ceil(blob.size / 1024);
    v.estInr = estimateImageShipping(v);
    variants.push(v);
    await new Promise((r) => setTimeout(r, 0));
  }

  return variants;
}
