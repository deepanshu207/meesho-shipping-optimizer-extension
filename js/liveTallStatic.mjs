/**
 * Tall portrait promo @ 703×1024 — hunt-exact frame + fixed badges 3/2/1.
 * Frame math from buildScreenshotFramedCanvas (low_48_tall).
 * Badge slots from addLowShippingBadges.
 */
import {
  imageToWhiteCanvas,
  trimMargins,
} from "./lib/canvas-utils.js?v=97";
import { compressFramedToKb, blobToDataUrl } from "./lib/encoder.js?v=59";
import { estimateImageShipping } from "./lib/shipping.js?v=59";
import { drawTallBadge } from "./tallStaticBadges.mjs?v=59";

export const TALL_STATIC_OUTER_W = 703;
export const TALL_STATIC_OUTER_H = 1024;
export const TALL_STATIC_VARIANT_COUNT = 25;

/** Fixed reference badges — same assets as competitor tall promo. */
export const TALL_STATIC_BADGES = {
  tag: 3,
  arrow: 2,
  ship: 1,
};

const TALL_BLUE_PCT = Math.min(0.22, 0.16 * 1.06);
const TALL_WHITE_PCT = 0.05;
const BORDER_BLUE = "#45a9e5";

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

async function preloadTallBadges() {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
    await MeeshoAPI.preloadBadges();
    return;
  }
  await Promise.all(
    Object.values(TALL_STATIC_BADGES).map((n) => loadBadge(n)),
  );
}

function prepareTallProduct(img) {
  const white = imageToWhiteCanvas(img, 2400);
  return trimMargins(white, 0.01);
}

function tallStaticKbTiers(count = TALL_STATIC_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 40;
  const end = 52;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

/**
 * 703×1024 edge-to-edge; border thickness from product minDim (hunt tall profile).
 */
function buildTallStaticFrameCanvas(img) {
  const outerW = TALL_STATIC_OUTER_W;
  const outerH = TALL_STATIC_OUTER_H;
  const white = prepareTallProduct(img);

  let bestScale = 0.01;
  for (let i = 0; i < 64; i++) {
    const scale = 0.01 + (i / 63) * 2;
    const sw = Math.round(white.width * scale);
    const sh = Math.round(white.height * scale);
    const minDim = Math.min(sw, sh);
    const blueOuter = Math.max(24, Math.round(minDim * TALL_BLUE_PCT));
    const whitePad = Math.max(10, Math.round(minDim * TALL_WHITE_PCT));
    const inset = blueOuter + whitePad;
    if (sw + inset * 2 <= outerW && sh + inset * 2 <= outerH) bestScale = scale;
  }

  const sw = Math.round(white.width * bestScale);
  const sh = Math.round(white.height * bestScale);
  const minDim = Math.min(sw, sh);
  const blueOuter = Math.max(24, Math.round(minDim * TALL_BLUE_PCT));
  const whitePad = Math.max(10, Math.round(minDim * TALL_WHITE_PCT));
  const inset = blueOuter + whitePad;

  const innerW = outerW - inset * 2;
  const innerH = outerH - inset * 2;
  const px = inset + Math.round((innerW - sw) / 2);
  const py = inset + Math.round((innerH - sh) / 2);

  const whiteX = blueOuter;
  const whiteY = blueOuter;
  const whiteW = outerW - blueOuter * 2;
  const whiteH = outerH - blueOuter * 2;

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BORDER_BLUE;
  ctx.fillRect(0, 0, outerW, outerH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(whiteX, whiteY, whiteW, whiteH);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(white, 0, 0, white.width, white.height, px, py, sw, sh);

  return {
    canvas,
    px,
    py,
    dw: sw,
    dh: sh,
    border: blueOuter,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    trimmed: white,
    outerW,
    outerH,
  };
}

/**
 * Hunt addLowShippingBadges slots — fixed badge3 / badge2 / badge1.
 */
function tallStaticPlacements(px, py, dw, dh) {
  const size = Math.max(56, Math.round(Math.min(dw, dh) * 0.14));
  const inset = Math.max(6, Math.round(size * 0.06));

  return [
    {
      id: "tall-sale",
      label: "Price tag",
      anchor: "top-left",
      kind: "badge",
      num: TALL_STATIC_BADGES.tag,
      w: size,
      h: size,
      x: px + inset,
      y: py + inset,
      drawn: false,
    },
    {
      id: "tall-arrow",
      label: "Arrow",
      anchor: "top-right",
      kind: "badge",
      num: TALL_STATIC_BADGES.arrow,
      w: size,
      h: size,
      x: px + dw - size - inset,
      y: py + inset,
      drawn: false,
    },
    {
      id: "tall-ship",
      label: "Delivery truck",
      anchor: "bottom-left",
      kind: "badge",
      num: TALL_STATIC_BADGES.ship,
      w: size,
      h: size,
      x: px + inset,
      y: py + dh - size - inset,
      drawn: false,
    },
  ];
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      copy.drawn = await drawTallBadge(ctx, loadBadge, p);
    } catch (e) {
      copy.drawn = false;
    }
    out.push(copy);
  }
  return out;
}

function dataUrlFromCanvas(canvas, quality = 0.82) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildTallStaticLayers(img) {
  await preloadTallBadges();

  const built = buildTallStaticFrameCanvas(img);
  const {
    canvas,
    px,
    py,
    dw,
    dh,
    border,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    trimmed,
    outerW,
    outerH,
  } = built;
  const placements = tallStaticPlacements(px, py, dw, dh);

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
  productOnlyCanvas
    .getContext("2d")
    .drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, dw, dh);
  const shifted = badgePlacements.map((p) => ({
    ...p,
    x: (p.x || 0) - px,
    y: (p.y || 0) - py,
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
        style: "tall_static",
        frameType: "tall",
        borderColor: BORDER_BLUE,
        matColor: "#ffffff",
        gradientTop: BORDER_BLUE,
        gradientBottom: "#1e88c7",
        gradientPreset: null,
        px,
        py,
        dw,
        dh,
        border,
        outerW,
        outerH,
        whiteX,
        whiteY,
        whiteW,
        whiteH,
      },
    },
    meta: {
      style: "tall_static",
      showcasePreset: "tall-blue-promo",
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

export async function buildTallStaticVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = TALL_STATIC_VARIANT_COUNT,
  } = options;

  onProgress("Building tall promo frames…");

  const { canvas, layers, meta } = await buildTallStaticLayers(img);
  const kbTiers = tallStaticKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Tall promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const blob = await compressFramedToKb(canvas, kb);
    const dataUrl = await blobToDataUrl(blob);
    const v = {
      blob,
      dataUrl,
      bytes: blob.size,
      width: meta.outerW,
      height: meta.outerH,
      path: "tall_static",
      mode: "Tall Promo",
      label: `Tall Promo · ${meta.outerW}×${meta.outerH} · ${kb}KB`,
      recommended: kb === 48 || kb === 50,
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
