/**
 * Compose / reposition badges on static promo & live hunt variants.
 * Shared by web optimizer and extension (preview/save only — pricing locked).
 */
import { compressFramedToKb, compressGownToKb } from "./lib/encoder.js?v=96";
import {
  clampPhotoMarginSide,
  drawPhotoMarginFills,
  drawProductPhotoCoverFit,
  ensureFramePhotoDefaults,
  frameHasProductSlot,
  maxPhotoMarginSide,
  normalizePhotoMargins,
  PHOTO_ZOOM_DEFAULT,
  PHOTO_MARGIN_MAX,
  photoAnchorRect,
  photoContentLayout,
  photoMarginField,
  photoStickerScale,
  photoMarginLockField,
  snapshotPhotoControls,
} from "./lib/productPhotoFit.mjs?v=8";
import { drawTallBadge } from "./tallStaticBadges.mjs?v=95";
import { drawGownBadge } from "./gownStaticBadges.mjs?v=95";
import {
  drawGownStaticFrameBackground,
  ensureGownDrawGeometry,
  GOWN_STATIC_OUTER_H,
  GOWN_STATIC_OUTER_W,
  gownUsesBorderGradient,
} from "./liveGownStatic.mjs?v=110";

export const FREE_SHIPPING_BADGE_VALUE = "free";
export const BORDER_THICKNESS_DEFAULT = 100;
export const BORDER_THICKNESS_MAX = 1000;

export const GRADIENT_PRESETS = [
  { id: "showcase", label: "Orange → Green", top: "#FF9800", bottom: "#4CAF50" },
  { id: "sunset", label: "Sunset", top: "#FF6B6B", bottom: "#FECA57" },
  { id: "ocean", label: "Ocean", top: "#2196F3", bottom: "#00BCD4" },
  { id: "berry", label: "Berry", top: "#9C27B0", bottom: "#E91E63" },
  { id: "forest", label: "Forest", top: "#2E7D32", bottom: "#8BC34A" },
  { id: "royal", label: "Royal", top: "#3F51B5", bottom: "#9C27B0" },
  { id: "fire", label: "Fire", top: "#F44336", bottom: "#FF9800" },
  { id: "mint", label: "Mint", top: "#00BFA5", bottom: "#69F0AE" },
];

/** Quick-pick swatches (Meesho generator + frame defaults). */
export const FRAME_COLOR_SWATCHES = [
  { label: "Orange", hex: "#ff9800" },
  { label: "Red", hex: "#ef4444" },
  { label: "Royal Blue", hex: "#2563eb" },
  { label: "Green", hex: "#22c55e" },
  { label: "Purple", hex: "#7c3aed" },
  { label: "Olive", hex: "#84cc16" },
  { label: "Teal", hex: "#06b6d4" },
  { label: "Navy", hex: "#1e293b" },
  { label: "Gown Teal", hex: "#71cbd3" },
  { label: "Lifestyle Green", hex: "#32d74b" },
  { label: "Tall Blue", hex: "#45a9e5" },
  { label: "White", hex: "#ffffff" },
  { label: "Black", hex: "#000000" },
];

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
}

export function rgbToHex(r, g, b) {
  const rr = clampByte(r).toString(16).padStart(2, "0");
  const gg = clampByte(g).toString(16).padStart(2, "0");
  const bb = clampByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function rgbPartsToColor(r, g, b, hex) {
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), hex: hex.toLowerCase() };
}

export function hexToRgb(hex) {
  const parsed = parseCssColor(hex);
  if (!parsed) return null;
  return { r: parsed.r, g: parsed.g, b: parsed.b, hex: parsed.hex };
}

export function parseCssColor(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const shortHex = /^#([0-9a-f]{3})$/i.exec(raw);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("");
    const hex = `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    const n = parseInt(hex.slice(1), 16);
    return rgbPartsToColor((n >> 16) & 255, (n >> 8) & 255, n & 255, hex);
  }

  const longHex = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(raw);
  if (longHex) {
    const hex = `#${longHex[1]}`.toLowerCase();
    const n = parseInt(longHex[1], 16);
    return rgbPartsToColor((n >> 16) & 255, (n >> 8) & 255, n & 255, hex);
  }

  const bareHex = /^([0-9a-f]{6})$/i.exec(raw);
  if (bareHex) {
    const hex = `#${bareHex[1]}`.toLowerCase();
    const n = parseInt(bareHex[1], 16);
    return rgbPartsToColor((n >> 16) & 255, (n >> 8) & 255, n & 255, hex);
  }

  const rgb = /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/i.exec(
    raw,
  );
  if (rgb) {
    return rgbPartsToColor(rgb[1], rgb[2], rgb[3], rgbToHex(rgb[1], rgb[2], rgb[3]));
  }

  const parts = raw.split(/[\s,;/]+/).filter(Boolean);
  if (parts.length >= 3 && parts.slice(0, 3).every((p) => /^[\d.]+$/.test(p))) {
    return rgbPartsToColor(parts[0], parts[1], parts[2], rgbToHex(parts[0], parts[1], parts[2]));
  }

  return null;
}

export function parseRgbTriplet(input) {
  return parseCssColor(input);
}

export function normalizeFrameColor(input, fallback = null) {
  const parsed = parseCssColor(input);
  if (parsed) return parsed.hex.toLowerCase();
  if (fallback != null) return normalizeFrameColor(fallback);
  return null;
}

export function formatRgbString(input) {
  const parsed = parseCssColor(input);
  if (!parsed) return "";
  return `${parsed.r}, ${parsed.g}, ${parsed.b}`;
}

export const BADGE_ANCHOR_OPTIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "middle-left", label: "Middle left" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "top-center", label: "Top center" },
];

const STYLE_DEFAULTS = {
  showcase: {
    frameType: "gradient",
    gradientTop: "#FF9800",
    gradientBottom: "#4CAF50",
    gradientPreset: "showcase",
  },
  lifestyle_promo: {
    frameType: "solid",
    borderColor: "#32d74b",
    gradientTop: "#32d74b",
    gradientBottom: "#1b9e34",
    gradientPreset: null,
  },
  tall_static: {
    frameType: "tall",
    borderColor: "#45a9e5",
    matColor: "#ffffff",
    gradientTop: "#45a9e5",
    gradientBottom: "#1e88c7",
    gradientPreset: null,
  },
  gown_static: {
    frameType: "tall",
    borderColor: "#71cbd3",
    matColor: "#ffffff",
    gradientTop: "#71cbd3",
    gradientBottom: "#5eb8c4",
    gradientPreset: null,
  },
  live_standard: {
    frameType: "gradient",
    gradientTop: "#3498db",
    gradientBottom: "#2ecc71",
    borderColor: "#3498db",
    gradientPreset: null,
  },
  live_framed: {
    frameType: "tall",
    borderColor: "#add8e6",
    matColor: "#ffffff",
    gradientTop: "#add8e6",
    gradientBottom: "#7ec8e3",
    gradientPreset: null,
  },
};

const DEFAULT_ANCHORS = {
  lifestyle_promo: {
    "lifestyle-hot": "top-right",
    "lifestyle-flash": "middle-left",
    "lifestyle-ship": "bottom-center",
  },
  showcase: {
    "showcase-quality": "top-left",
    "showcase-star": "top-right",
    "showcase-satisfaction": "bottom-left",
  },
  tall_static: {
    "tall-sale": "top-left",
    "tall-arrow": "top-right",
    "tall-ship": "bottom-left",
  },
  gown_static: {
    "gown-best": "top-left",
    "gown-flash": "top-right",
    "gown-popular": "middle-left",
  },
};

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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (typeof url === "string" && /^https?:/i.test(url)) {
      img.crossOrigin = "anonymous";
    }
    img.src = url;
  });
}

function ensurePlacementDefaults(p) {
  if (!p) return p;
  if (p.defaultW == null && p.defaultH == null && p.defaultSize == null) {
    if (p.w != null && p.h != null) {
      p.defaultW = p.w;
      p.defaultH = p.h;
    } else {
      p.defaultSize = p.size || p.w || p.h || 48;
    }
  }
  if (p.sizePct == null) p.sizePct = 100;
  if (p.lockH == null) p.lockH = true;
  if (p.lockV == null) p.lockV = true;
  if (p.lockSize == null) p.lockSize = true;
  return p;
}

export function isFreeShippingSlot(p) {
  return !!(p && (p.kind === "freeShipping" || p._freeShippingSlot));
}

function stickerScalesWithPhotoZoom(p, frame) {
  if (!p || !frame || !frameHasProductSlot(frame)) return false;
  if (p.lockSize === false) return false;
  if (p.kind === "gownArt") return true;
  if (p.kind === "freeShipping") return false;
  if (p.lockH !== false && p.lockV !== false) return true;
  return false;
}

function placementSize(p, frame) {
  ensurePlacementDefaults(p);
  const pct = clamp(p.sizePct ?? 100, 25, 200) / 100;
  let w;
  let h;
  if (p.defaultW != null) {
    w = Math.max(8, Math.round(p.defaultW * pct));
    h = Math.max(8, Math.round((p.defaultH ?? p.defaultW) * pct));
  } else {
    const base = p.defaultSize || p.size || p.w || 48;
    const s = Math.max(8, Math.round(base * pct));
    w = s;
    h = s;
  }
  if (frame && stickerScalesWithPhotoZoom(p, frame)) {
    const z = photoStickerScale(frame);
    w = Math.max(8, Math.round(w * z));
    h = Math.max(8, Math.round(h * z));
  }
  return { w, h };
}

export function isGownArtPlacement(p) {
  return !!(p && p.kind === "gownArt");
}

/** Gown badge x/y — matches liveGownStatic.mjs gownStaticPlacements (no canvas clamp). */
export function gownPlacementPosition(slotId, frame, w, h) {
  const photo = photoAnchorRect(frame);
  const px = photo.x;
  const py = photo.y;
  const dw = photo.w;
  const dh = photo.h;
  const ref = Math.min(dw, dh);
  const inset = Math.max(2, Math.round(ref * 0.015));
  const slot = slotId || "";

  if (slot === "gown-best") {
    return { x: px + inset, y: py + inset };
  }
  if (slot === "gown-flash") {
    return {
      x: px + dw - w - inset,
      y: py + Math.round(dh * 0.03),
    };
  }
  if (slot === "gown-popular") {
    return {
      x: px - Math.round(w * 0.08),
      y: py + Math.round(dh * 0.48) - Math.round(h / 2),
    };
  }
  return { x: px, y: py };
}

/** Gown vector-art slot box — matches liveGownStatic.mjs geometry. */
export function gownArtDimensions(slotId, frame) {
  if (!slotId?.startsWith("gown-") || !frame) return null;
  const ref = Math.min(frame.dw ?? frame.baseDw, frame.dh ?? frame.baseDh);
  if (slotId === "gown-best") {
    const w = Math.round(ref * 0.36);
    return { w, h: Math.round(w * 0.7) };
  }
  if (slotId === "gown-flash") {
    const w = Math.round(ref * 0.32);
    return { w, h: Math.round(w * 0.4) };
  }
  if (slotId === "gown-popular") {
    const w = Math.round(ref * 0.42);
    return { w, h: Math.round(w * 0.26) };
  }
  return null;
}

/** Numbered PNG badges use a square box (tall/showcase pattern) — avoids stretch on wide gown slots. */
function squareBadgeBox(w, h) {
  return Math.max(8, Math.round(Math.min(w, h)));
}

function restoreGownArtSlotSize(p, layers) {
  const pDef = layers._staticDefaults?.placements?.[p.id];
  if (pDef?.slotW != null && pDef?.slotH != null) {
    p.w = pDef.slotW;
    p.h = pDef.slotH;
    return;
  }
  const dims = gownArtDimensions(p.id, layers._staticFrame);
  if (dims) {
    p.w = dims.w;
    p.h = dims.h;
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function layerUrlDiff(a, b) {
  return !!(a && b && a !== b);
}

/** Base sticker/border state from generated layer URLs (before edit flags). */
export function inferBaseLayerCaps(layers) {
  if (!layers) return { hasStickers: true, hasBorder: true };

  if (layers._staticFrame) {
    const frameStyle = layers._staticFrame.style;
    const isStaticPromo =
      frameStyle === "showcase" ||
      frameStyle === "lifestyle_promo" ||
      frameStyle === "tall_static" ||
      frameStyle === "gown_static";
    const hasPlacements = !!(layers._badgePlacements || []).length;
    const stickersFlag = layers._stickersRendered !== false;
    const hasStickers = isStaticPromo ? stickersFlag : stickersFlag && hasPlacements;
    const hasBorder =
      layerUrlDiff(layers.noStickers, layers.productOnly) ||
      layerUrlDiff(layers.full, layers.noBorder);
    return { hasStickers, hasBorder };
  }

  const hasPlacements = !!(layers._badgePlacements || []).length;
  const hasStickers =
    layers._stickersRendered === true
      ? true
      : layers._stickersRendered === false
      ? false
      : hasPlacements ||
        layerUrlDiff(layers.full, layers.noStickers) ||
        layerUrlDiff(layers.noBorder, layers.productOnly);
  const hasBorder =
    layerUrlDiff(layers.noStickers, layers.productOnly) ||
    layerUrlDiff(layers.full, layers.noBorder);
  return { hasStickers, hasBorder };
}

export function getStaticEffectiveFlags(flags = {}, layers = null) {
  const f = flags || {};
  const base = inferBaseLayerCaps(layers);
  let hasStickers = base.hasStickers;
  let hasBorder = base.hasBorder;

  if (f.cleanProduct && !f.stickersAdded && !f.borderAdded && !f.fullDecorationsAdded) {
    return { hasStickers: false, hasBorder: false };
  }

  if (f.cleanProduct) {
    hasStickers = false;
    hasBorder = false;
  } else {
    if (f.stickersRemoved) hasStickers = false;
    if (f.borderOnlyRemoved) hasBorder = false;
  }
  if (f.stickersAdded) hasStickers = true;
  if (f.borderAdded) hasBorder = true;
  if (f.fullDecorationsAdded) {
    hasStickers = true;
    hasBorder = true;
  }
  return { hasStickers, hasBorder };
}

function stickersNeedCompose(flags = {}, options = {}) {
  const f = flags || {};
  return !!(
    options.badgesRepositioned ||
    f.fullDecorationsAdded
  );
}

function decorationsRestoredViaFlags(flags = {}, options = {}) {
  const f = flags || {};
  return !!(
    (f.borderAdded || f.stickersAdded || f.fullDecorationsAdded) &&
    !stickersNeedCompose(f, options) &&
    !options.badgesRepositioned
  );
}

function syncFrameToCanvasSize(frame, imgW, imgH) {
  if (!frame) return frame;
  const oldW = frame.outerW || imgW;
  const oldH = frame.outerH || imgH;
  if (oldW === imgW && oldH === imgH) return frame;
  const sx = imgW / oldW;
  const sy = imgH / oldH;
  const s = Math.min(sx, sy);
  const scale = (v, axis = "both") => {
    if (v == null) return v;
    if (axis === "x") return Math.round(v * sx);
    if (axis === "y") return Math.round(v * sy);
    return Math.round(v * s);
  };
  return {
    ...frame,
    outerW: imgW,
    outerH: imgH,
    px: scale(frame.px, "x"),
    py: scale(frame.py, "y"),
    dw: scale(frame.dw, "x"),
    dh: scale(frame.dh, "y"),
    border: scale(frame.border),
    whitePad: scale(frame.whitePad),
    outerMatPad: scale(frame.outerMatPad),
    innerMatPad: scale(frame.innerMatPad),
    innerStroke: scale(frame.innerStroke),
    whiteW: scale(frame.whiteW, "x"),
    whiteH: scale(frame.whiteH, "y"),
    innerFrameX: scale(frame.innerFrameX, "x"),
    innerFrameY: scale(frame.innerFrameY, "y"),
    innerFrameW: scale(frame.innerFrameW, "x"),
    innerFrameH: scale(frame.innerFrameH, "y"),
  };
}

function rescalePlacementsForFrame(placements, oldW, oldH, newW, newH) {
  if (!placements?.length || !oldW || !oldH) return;
  if (oldW === newW && oldH === newH) return;
  const sx = newW / oldW;
  const sy = newH / oldH;
  const s = Math.min(sx, sy);
  for (const p of placements) {
    if (p.x != null) p.x = Math.round(p.x * sx);
    if (p.y != null) p.y = Math.round(p.y * sy);
    if (p.w != null) p.w = Math.round(p.w * sx);
    if (p.h != null) p.h = Math.round(p.h * sy);
    if (p.size != null) p.size = Math.round(p.size * s);
  }
}

/** Align frame geometry to a baked layer image before sticker compose. */
export async function prepareStickerComposeFrame(layers, flags = {}, options = {}) {
  if (!layers?._staticFrame) return layers;
  const picked = pickStaticBaseLayer(layers, flags, {
    badgesRepositioned: !!options.badgesRepositioned,
  });
  const url =
    options.url ||
    picked.url ||
    layers.noStickers ||
    layers.full ||
    layers.noBorder ||
    "";
  if (!url || picked.isProductCanvas) return layers;
  try {
    const img = await loadImage(url);
    const frame = layers._staticFrame;
    const meta = options.meta || layers._composeMeta || {};
    meta.canvasW = img.width;
    meta.canvasH = img.height;
    if (frame.outerW !== img.width || frame.outerH !== img.height) {
      const oldW = frame.outerW;
      const oldH = frame.outerH;
      const synced = syncFrameToCanvasSize(frame, img.width, img.height);
      Object.assign(frame, synced);
      rescalePlacementsForFrame(layers._badgePlacements, oldW, oldH, img.width, img.height);
    }
  } catch (e) {}
  return layers;
}

function frameForProductCanvas(frame, imgW, imgH) {
  if (!frame) {
    return { outerW: imgW, outerH: imgH, px: 0, py: 0, dw: imgW, dh: imgH };
  }
  return {
    ...frame,
    outerW: imgW,
    outerH: imgH,
    px: 0,
    py: 0,
    dw: imgW,
    dh: imgH,
  };
}

export function isEditableVariant(row) {
  if (!row?.layers) return false;
  return !!(
    row.layers._staticFrame ||
    (row.layers._badgePlacements || []).length
  );
}

export function isStaticPromoVariant(row) {
  if (!row) return false;
  const frameStyle = row.layers?._staticFrame?.style;
  if (frameStyle === "live_standard" || frameStyle === "live_framed") return false;
  const style = row.variantStyle || row.meta?.style || row.meta?.path || "";
  return (
    style === "showcase" ||
    style === "lifestyle_promo" ||
    style === "tall_static" ||
    style === "gown_static" ||
    row.meta?.path === "showcase" ||
    row.meta?.path === "lifestyle_promo" ||
    row.meta?.path === "tall_static" ||
    row.meta?.path === "gown_static" ||
    frameStyle === "showcase" ||
    frameStyle === "lifestyle_promo" ||
    frameStyle === "tall_static" ||
    frameStyle === "gown_static"
  );
}

export function getBadgeSlots(row) {
  const placements = row?.layers?._badgePlacements || [];
  return placements.map((p, i) => ({
    id: p.id || `badge-slot-${i}`,
    label:
      p.label ||
      (p.kind === "freeShipping"
        ? "FREE SHIPPING"
        : `Badge ${p.num || i + 1}`),
    anchor: p.anchor || "top-left",
    num: p.num,
    kind: p.kind,
    freeShippingSlot: isFreeShippingSlot(p),
    hidden: !!p.hidden,
    posH: p.posH ?? 0,
    posV: p.posV ?? 0,
    sizePct: p.sizePct ?? 100,
    lockH: p.lockH !== false,
    lockV: p.lockV !== false,
    lockSize: p.lockSize !== false,
  }));
}

export function slidersToXY(posH, posV, outerW, outerH, w, h) {
  const maxX = Math.max(0, outerW - w);
  const maxY = Math.max(0, outerH - h);
  const x = Math.round((clamp(posH, 0, 100) / 100) * maxX);
  const y = Math.round((clamp(posV, 0, 100) / 100) * maxY);
  return { x, y };
}

export function xyToSliders(x, y, outerW, outerH, w, h) {
  const maxX = Math.max(1, outerW - w);
  const maxY = Math.max(1, outerH - h);
  return {
    posH: Math.round(clamp((x / maxX) * 100, 0, 100)),
    posV: Math.round(clamp((y / maxY) * 100, 0, 100)),
  };
}

export function positionForAnchor(anchor, frame, w, h) {
  const { px, py, dw, dh, outerW, outerH } = frame;

  if (frameHasProductSlot(frame) && frame.px != null) {
    const photo = photoAnchorRect(frame);
    const size = Math.max(56, Math.round(Math.min(photo.w, photo.h) * 0.14));
    const inset = Math.max(6, Math.round(size * 0.06));
    const fx = photo.x;
    const fy = photo.y;
    const fw = photo.w;
    const fh = photo.h;
    let x = fx + inset;
    let y = fy + inset;
    switch (anchor) {
      case "top-left":
        x = fx + inset;
        y = fy + inset;
        break;
      case "top-right":
        x = fx + fw - w - inset;
        y = fy + inset;
        break;
      case "bottom-left":
        x = fx + inset;
        y = fy + fh - h - inset;
        break;
      case "bottom-right":
        x = fx + fw - w - inset;
        y = fy + fh - h - inset;
        break;
      case "middle-left":
        x = fx + inset;
        y = fy + Math.round(fh / 2) - Math.round(h / 2);
        break;
      case "middle-right":
        x = fx + fw - w - inset;
        y = fy + Math.round(fh / 2) - Math.round(h / 2);
        break;
      case "bottom-center":
        x = fx + Math.round(fw / 2) - Math.round(w / 2);
        y = fy + fh - h - inset;
        break;
      case "top-center":
        x = fx + Math.round(fw / 2) - Math.round(w / 2);
        y = fy + inset;
        break;
      default:
        break;
    }
    const edge = 3;
    x = Math.max(edge, Math.min(x, frame.outerW - w - edge));
    y = Math.max(edge, Math.min(y, frame.outerH - h - edge));
    return { x, y };
  }

  let x = px;
  let y = py;
  switch (anchor) {
    case "top-left":
      x = px - Math.round(w * 0.15);
      y = py - Math.round(h * 0.15);
      break;
    case "top-right":
      x = px + dw - w + Math.round(w * 0.1);
      y = py - Math.round(h * 0.1);
      break;
    case "bottom-left":
      x = px - Math.round(w * 0.1);
      y = py + dh - h + Math.round(h * 0.1);
      break;
    case "bottom-right":
      x = px + dw - w - Math.round(dw * 0.02);
      y = py + dh - h - Math.round(dh * 0.04);
      break;
    case "middle-left":
      x = px - Math.round(w * 0.08);
      y = py + Math.round(dh * 0.45) - Math.round(h / 2);
      break;
    case "middle-right":
      x = px + dw - w - Math.round(dw * 0.04);
      y = py + Math.round(dh * 0.45) - Math.round(h / 2);
      break;
    case "bottom-center":
      x = px + Math.round(dw * 0.34) - Math.round(w / 2);
      y = py + Math.round(dh * 0.7) - Math.round(h / 2);
      break;
    case "top-center":
      x = px + Math.round(dw / 2) - Math.round(w / 2);
      y = py + Math.round(dh * 0.02);
      break;
    default:
      break;
  }
  const pad = 3;
  x = Math.max(pad, Math.min(x, outerW - w - pad));
  y = Math.max(pad, Math.min(y, outerH - h - pad));
  return { x, y };
}

export function applyPositionToPlacement(placement, frame) {
  if (!placement || !frame) return placement;
  const { w, h } = placementSize(placement, frame);
  const { outerW, outerH } = frame;

  if (frame.style === "gown_static" && placement.kind === "gownArt") {
    const locksH = placement.lockH !== false;
    const locksV = placement.lockV !== false;
    const slot = placement.gownSlot || placement.id;
    const anchor = gownPlacementPosition(slot, frame, w, h);

    if (locksH && locksV) {
      placement.x = anchor.x;
      placement.y = anchor.y;
      const sliders = xyToSliders(anchor.x, anchor.y, outerW, outerH, w, h);
      placement.posH = sliders.posH;
      placement.posV = sliders.posV;
      return placement;
    }

    const sliderPos =
      placement.posH != null && placement.posV != null
        ? slidersToXY(placement.posH, placement.posV, outerW, outerH, w, h)
        : anchor;
    placement.x = locksH ? anchor.x : sliderPos.x;
    placement.y = locksV ? anchor.y : sliderPos.y;
    const sliders = xyToSliders(placement.x, placement.y, outerW, outerH, w, h);
    placement.posH = sliders.posH;
    placement.posV = sliders.posV;
    return placement;
  }

  const locksH = placement.lockH !== false;
  const locksV = placement.lockV !== false;
  if (placement.anchor && frameHasProductSlot(frame)) {
    const anchored = positionForAnchor(placement.anchor, frame, w, h);
    if (locksH && locksV) {
      placement.x = anchored.x;
      placement.y = anchored.y;
    } else {
      const sliderPos =
        placement.posH != null && placement.posV != null
          ? slidersToXY(placement.posH, placement.posV, outerW, outerH, w, h)
          : anchored;
      placement.x = locksH ? anchored.x : sliderPos.x;
      placement.y = locksV ? anchored.y : sliderPos.y;
    }
    const sliders = xyToSliders(placement.x, placement.y, outerW, outerH, w, h);
    placement.posH = sliders.posH;
    placement.posV = sliders.posV;
    return placement;
  }

  if (placement.posH != null && placement.posV != null) {
    const { x, y } = slidersToXY(placement.posH, placement.posV, outerW, outerH, w, h);
    placement.x = x;
    placement.y = y;
  } else if (placement.anchor) {
    const { x, y } = positionForAnchor(placement.anchor, frame, w, h);
    placement.x = x;
    placement.y = y;
    const sliders = xyToSliders(x, y, outerW, outerH, w, h);
    placement.posH = sliders.posH;
    placement.posV = sliders.posV;
  }
  return placement;
}

export function applyAnchorToPlacement(placement, frame) {
  if (!placement || !frame) return placement;
  const { w, h } = placementSize(placement, frame);
  const anchor = placement.anchor || "top-left";
  const { x, y } = positionForAnchor(anchor, frame, w, h);
  placement.x = x;
  placement.y = y;
  const sliders = xyToSliders(x, y, frame.outerW, frame.outerH, w, h);
  placement.posH = sliders.posH;
  placement.posV = sliders.posV;
  return placement;
}

function ensureFrameDefaults(frame) {
  if (!frame?.style) return frame;
  const defs = STYLE_DEFAULTS[frame.style] || {};
  if (!frame.frameType) frame.frameType = defs.frameType || "solid";
  if (!frame.gradientTop) frame.gradientTop = defs.gradientTop;
  if (!frame.gradientBottom) frame.gradientBottom = defs.gradientBottom;
  if (frame.gradientPreset === undefined) frame.gradientPreset = defs.gradientPreset;
  if (!frame.borderColor) frame.borderColor = defs.borderColor || frame.gradientTop;
  if (!frame.matColor) frame.matColor = defs.matColor || "#ffffff";
  if (frame.style === "gown_static") {
    if (!frame.outerMatColor) frame.outerMatColor = frame.matColor;
    if (!frame.padColor) frame.padColor = frame.matColor;
    if (!frame.fillMatColor) frame.fillMatColor = frame.padColor ?? frame.matColor;
    if (frame.fillMatEnabled == null) frame.fillMatEnabled = true;
  }
  return frame;
}

/** Snapshot base geometry once — default thickness 100 keeps these exact values. */
export function ensureFrameBases(frame) {
  if (!frame) return frame;
  if (frame.borderThicknessPct == null) frame.borderThicknessPct = BORDER_THICKNESS_DEFAULT;
  if (frame.baseBorder == null && frame.border != null) frame.baseBorder = frame.border;
  if (frame.baseWhitePad == null && frame.whitePad != null) frame.baseWhitePad = frame.whitePad;
  if (frame.baseOuterMatPad == null && frame.outerMatPad != null) {
    frame.baseOuterMatPad = frame.outerMatPad;
  }
  if (frame.baseInnerMatPad == null && frame.innerMatPad != null) {
    frame.baseInnerMatPad = frame.innerMatPad;
  }
  if (frame.baseInnerStroke == null && frame.innerStroke != null) {
    frame.baseInnerStroke = frame.innerStroke;
  }
  if (frame.style === "gown_static" && frame.baseInnerStroke == null) {
    frame.baseInnerStroke = 3;
  }
  if (
    frame.baseOuterMatPad == null &&
    frame.style === "gown_static" &&
    frame.baseWhitePad != null
  ) {
    frame.baseInnerMatPad = frame.baseInnerMatPad ?? frame.innerMatPad ?? 12;
    const hairline = frame.baseInnerStroke ?? frame.innerStroke ?? 3;
    frame.baseOuterMatPad = Math.max(
      0,
      frame.baseWhitePad - frame.baseInnerMatPad - hairline,
    );
  }
  if (frame.baseInnerFrameX == null && frame.innerFrameX != null) {
    frame.baseInnerFrameX = frame.innerFrameX;
  }
  if (frame.baseInnerFrameY == null && frame.innerFrameY != null) {
    frame.baseInnerFrameY = frame.innerFrameY;
  }
  if (frame.baseInnerFrameW == null && frame.innerFrameW != null) {
    frame.baseInnerFrameW = frame.innerFrameW;
  }
  if (frame.baseInnerFrameH == null && frame.innerFrameH != null) {
    frame.baseInnerFrameH = frame.innerFrameH;
  }
  if (frame.baseWhitePad == null && frame.px != null && frame.whiteX != null) {
    frame.baseWhitePad = frame.px - frame.whiteX;
  }
  if (frame.basePx == null && frame.px != null) frame.basePx = frame.px;
  if (frame.basePy == null && frame.py != null) frame.basePy = frame.py;
  if (frame.baseDw == null && frame.dw != null) frame.baseDw = frame.dw;
  if (frame.baseDh == null && frame.dh != null) frame.baseDh = frame.dh;
  if (frame.baseWhiteX == null && frame.whiteX != null) frame.baseWhiteX = frame.whiteX;
  if (frame.baseWhiteY == null && frame.whiteY != null) frame.baseWhiteY = frame.whiteY;
  if (frame.baseWhiteW == null && frame.whiteW != null) frame.baseWhiteW = frame.whiteW;
  if (frame.baseWhiteH == null && frame.whiteH != null) frame.baseWhiteH = frame.whiteH;
  if (frame.baseBorder == null && frame.px != null && frame.frameType !== "tall") {
    frame.baseBorder = frame.px;
  }
  if (frame.style === "gown_static" && frame.baseInnerStroke != null) {
    frame.innerStroke = 0;
  }
  return frame;
}

function restoreBaseGeometry(frame) {
  if (frame.baseBorder != null) frame.border = frame.baseBorder;
  if (frame.baseWhitePad != null) frame.whitePad = frame.baseWhitePad;
  if (frame.basePx != null) frame.px = frame.basePx;
  if (frame.basePy != null) frame.py = frame.basePy;
  if (frame.baseDw != null) frame.dw = frame.baseDw;
  if (frame.baseDh != null) frame.dh = frame.baseDh;
  if (frame.baseWhiteX != null) frame.whiteX = frame.baseWhiteX;
  if (frame.baseWhiteY != null) frame.whiteY = frame.baseWhiteY;
  if (frame.baseWhiteW != null) frame.whiteW = frame.baseWhiteW;
  if (frame.baseWhiteH != null) frame.whiteH = frame.baseWhiteH;
  if (frame.baseOuterMatPad != null) frame.outerMatPad = frame.baseOuterMatPad;
  if (frame.baseInnerMatPad != null) frame.innerMatPad = frame.baseInnerMatPad;
  if (frame.baseInnerFrameX != null) frame.innerFrameX = frame.baseInnerFrameX;
  if (frame.baseInnerFrameY != null) frame.innerFrameY = frame.baseInnerFrameY;
  if (frame.baseInnerFrameW != null) frame.innerFrameW = frame.baseInnerFrameW;
  if (frame.baseInnerFrameH != null) frame.innerFrameH = frame.baseInnerFrameH;
  if (frame.baseInnerStroke != null) frame.innerStroke = frame.baseInnerStroke;
  if (frame.style === "gown_static") frame.innerStroke = 0;
}

/** Per-layer gown frame controls (100 = generated default for each band). */
export function defaultGownLayerPct() {
  return {
    border: BORDER_THICKNESS_DEFAULT,
    outerMat: BORDER_THICKNESS_DEFAULT,
    innerMat: BORDER_THICKNESS_DEFAULT,
  };
}

export function normalizeGownLayerPct(pct) {
  const p = pct || {};
  return {
    border: p.border ?? BORDER_THICKNESS_DEFAULT,
    outerMat: p.outerMat ?? BORDER_THICKNESS_DEFAULT,
    innerMat: p.innerMat ?? BORDER_THICKNESS_DEFAULT,
  };
}

export function snapshotGownFrameAppearance(frame) {
  ensureFrameDefaults(frame);
  const defs = STYLE_DEFAULTS.gown_static || {};
  return {
    frameType: frame.frameType || defs.frameType,
    gradientTop: normalizeFrameColor(frame.gradientTop) || defs.gradientTop,
    gradientBottom: normalizeFrameColor(frame.gradientBottom) || defs.gradientBottom,
    borderColor: normalizeFrameColor(frame.borderColor) || defs.borderColor,
    matColor: normalizeFrameColor(frame.matColor) || defs.matColor,
    outerMatColor:
      normalizeFrameColor(frame.outerMatColor ?? frame.matColor) || defs.matColor,
    padColor: normalizeFrameColor(frame.padColor ?? frame.matColor) || defs.matColor,
    fillMatColor:
      normalizeFrameColor(frame.fillMatColor ?? frame.padColor ?? frame.matColor) || defs.matColor,
    fillMatEnabled: frame.fillMatEnabled !== false,
    gradientPreset: frame.gradientPreset ?? null,
    borderThicknessPct: frame.borderThicknessPct ?? BORDER_THICKNESS_DEFAULT,
    borderThicknessLocked: frame.borderThicknessLocked !== false,
    gownLayerPct: normalizeGownLayerPct(frame.gownLayerPct),
    gownFrameLayersLocked: frame.gownFrameLayersLocked !== false,
    ...snapshotPhotoControls(frame),
  };
}

function snapshotFrameAppearance(frame, style) {
  if (style === "gown_static") return snapshotGownFrameAppearance(frame);
  ensureFrameDefaults(frame);
  const defs = STYLE_DEFAULTS[style] || {};
  return {
    frameType: frame.frameType || defs.frameType,
    gradientTop: frame.gradientTop ?? defs.gradientTop,
    gradientBottom: frame.gradientBottom ?? defs.gradientBottom,
    borderColor: frame.borderColor ?? defs.borderColor,
    matColor: frame.matColor ?? defs.matColor,
    gradientPreset: frame.gradientPreset ?? null,
    borderThicknessPct: frame.borderThicknessPct ?? BORDER_THICKNESS_DEFAULT,
    borderThicknessLocked: frame.borderThicknessLocked !== false,
    outerMatColor: frame.outerMatColor,
    innerStrokeColor: frame.innerStrokeColor,
    padColor: frame.padColor,
    gownLayerPct: frame.gownLayerPct ? { ...frame.gownLayerPct } : defaultGownLayerPct(),
    gownFrameLayersLocked: frame.gownFrameLayersLocked !== false,
    ...snapshotPhotoControls(frame),
  };
}

function applyFrameAppearanceDefaults(frame, def, style) {
  if (!frame) return frame;
  const appearance = snapshotFrameAppearance({ ...frame, ...(def || {}) }, style);
  Object.assign(frame, appearance);
  return frame;
}

export function ensureGownLayerPcts(frame) {
  if (!frame) return frame;
  frame.gownLayerPct = normalizeGownLayerPct(frame.gownLayerPct);
  return frame;
}

export function gownFrameLayersEdited(frame) {
  if (!frame || frame.style !== "gown_static") return false;
  ensureGownLayerPcts(frame);
  const p = frame.gownLayerPct;
  return (
    p.border !== BORDER_THICKNESS_DEFAULT ||
    p.outerMat !== BORDER_THICKNESS_DEFAULT ||
    p.innerMat !== BORDER_THICKNESS_DEFAULT
  );
}

function scaleGownLayerPx(base, pct, minPx = 0) {
  const t = clamp(pct, 0, BORDER_THICKNESS_MAX) / BORDER_THICKNESS_DEFAULT;
  if (t <= 0) return 0;
  const scaled = Math.round(base * t);
  return minPx > 0 ? Math.max(minPx, scaled) : scaled;
}

/** Scale a frame band from border-thickness % (100 = generated default). */
function scaleBorderThicknessPx(base, pct, minPx = 0) {
  const t = clamp(pct, 0, BORDER_THICKNESS_MAX) / BORDER_THICKNESS_DEFAULT;
  if (t <= 0) return minPx;
  if (t <= 1) {
    const floor = minPx > 0 ? minPx : 0;
    return Math.max(floor, Math.round(base * t));
  }
  const hi = BORDER_THICKNESS_MAX / BORDER_THICKNESS_DEFAULT;
  const u = (t - 1) / (hi - 1);
  const maxMul = 5;
  return Math.max(minPx, Math.round(base + base * (maxMul - 1) * u));
}

/** Gown: scale frame bands from canvas edge inward; product slot stays fixed. */
function applyGownFrameLayers(frame) {
  const outerW = frame.outerW || 0;
  const outerH = frame.outerH || 0;
  const basePx = frame.basePx ?? frame.px ?? 0;
  const basePy = frame.basePy ?? frame.py ?? 0;
  const baseDw = frame.baseDw ?? frame.dw ?? 0;
  const baseDh = frame.baseDh ?? frame.dh ?? 0;
  const baseBorder = frame.baseBorder ?? frame.border ?? 0;
  const baseInnerMatPad = frame.baseInnerMatPad ?? frame.innerMatPad ?? 0;
  const baseHairline = frame.baseInnerStroke ?? frame.innerStroke ?? 3;

  ensureGownLayerPcts(frame);
  const p = frame.gownLayerPct;

  frame.px = basePx;
  frame.py = basePy;
  frame.dw = baseDw;
  frame.dh = baseDh;

  frame.innerMatPad = scaleGownLayerPx(baseInnerMatPad, p.innerMat, 0);
  const accentInset = frame.baseInnerStroke ?? baseHairline ?? 0;
  frame.innerStroke = 0;

  const slotInset = frame.innerMatPad + accentInset;
  const innerFrameX = basePx - slotInset;
  const innerFrameY = basePy - slotInset;
  const innerFrameW = baseDw + slotInset * 2;
  const innerFrameH = baseDh + slotInset * 2;
  const baseOuterMatPad = frame.baseOuterMatPad ?? frame.outerMatPad ?? 0;

  const maxBorder = Math.max(
    2,
    Math.min(
      innerFrameX,
      innerFrameY,
      outerW - innerFrameX - innerFrameW,
      outerH - innerFrameY - innerFrameH,
    ),
  );

  const borderScaled = scaleGownLayerPx(baseBorder, p.border, 2);
  const outerScaled = scaleGownLayerPx(baseOuterMatPad, p.outerMat, 0);
  let border;
  let outerMatPad;
  if (p.border === p.outerMat) {
    border = Math.min(borderScaled, maxBorder);
    outerMatPad = Math.max(0, innerFrameX - border);
  } else {
    outerMatPad = Math.min(outerScaled, Math.max(0, innerFrameX - 2));
    border = Math.min(Math.max(2, innerFrameX - outerMatPad), maxBorder);
    outerMatPad = Math.max(0, innerFrameX - border);
  }

  frame.border = border;
  frame.outerMatPad = outerMatPad;
  frame.whiteX = border;
  frame.whiteY = border;
  frame.innerFrameX = innerFrameX;
  frame.innerFrameY = innerFrameY;
  frame.innerFrameW = innerFrameW;
  frame.innerFrameH = innerFrameH;
  frame.whiteW = innerFrameW + frame.outerMatPad * 2;
  frame.whiteH = innerFrameH + frame.outerMatPad * 2;
  frame.whitePad = frame.outerMatPad + slotInset;

  return frame;
}

function syncGownLayerPctFromLegacySlider(frame, pct) {
  ensureGownLayerPcts(frame);
  const p = frame.gownLayerPct;
  if (p.innerMat === BORDER_THICKNESS_DEFAULT) {
    p.border = pct;
    p.outerMat = pct;
  }
}

/** @deprecated gown uses applyGownFrameLayers — kept for tests calling borderThicknessPct. */
function applyGownBorderThickness(frame, pct) {
  syncGownLayerPctFromLegacySlider(frame, pct);
  return applyGownFrameLayers(frame);
}

export function staticFrameBorderEdited(frame) {
  if (!frame) return false;
  if (frame.style === "gown_static") return gownFrameLayersEdited(frame);
  return (frame.borderThicknessPct ?? BORDER_THICKNESS_DEFAULT) !== BORDER_THICKNESS_DEFAULT;
}

function restoreGownPhotoSource(layers) {
  if (!layers || layers._gownPhotoSource) return;
  const fromDefaults = layers._staticDefaults?.urls?.gownPhotoSource;
  if (fromDefaults) layers._gownPhotoSource = fromDefaults;
}

function hasStaticRebuildSources(layers) {
  if (!layers) return false;
  restoreGownPhotoSource(layers);
  return !!(
    layers._gownPhotoSource ||
    layers.productOnly ||
    layers.noStickers ||
    layers.full ||
    layers._composeFallbackUrl ||
    layers._staticDefaults?.urls?.gownPhotoSource ||
    layers._staticDefaults?.urls?.productOnly ||
    layers._staticDefaults?.urls?.noStickers ||
    layers._staticDefaults?.urls?.full
  );
}

/** Ensure layer blobs/urls exist so appearance edits can rebuild the frame. */
export function ensureStaticRebuildUrls(layers, fallbackDisplayUrl = "") {
  if (!layers) return layers;
  restoreGownPhotoSource(layers);
  if (hasStaticRebuildSources(layers)) return layers;
  const url = String(fallbackDisplayUrl || layers._composeFallbackUrl || "").trim();
  if (url) layers._composeFallbackUrl = url;
  return layers;
}

/** @deprecated use ensureStaticRebuildUrls */
export const ensureGownRebuildUrls = ensureStaticRebuildUrls;

function resolveGownPhotoSourceUrl(layers) {
  restoreGownPhotoSource(layers);
  return (
    layers._gownPhotoSource ||
    layers._staticDefaults?.urls?.gownPhotoSource ||
    layers.productOnly ||
    layers._staticDefaults?.urls?.productOnly ||
    ""
  );
}

export function shouldRebuildStaticFrame(layers, options = {}) {
  if (options.badgesOnly) return false;
  const frame = layers?._staticFrame;
  if (!frame) return false;
  if (!frame.outerW && frame.style !== "gown_static") return false;
  const needsRebuild =
    staticFrameBorderEdited(frame) ||
    !!options.staticAppearanceEdited ||
    (layers._staticDefaults?.frame &&
      frameAppearanceChanged(frame, layers._staticDefaults.frame));
  if (!needsRebuild) return false;
  if (options.staticAppearanceEdited) return hasStaticRebuildSources(layers);
  return hasStaticRebuildSources(layers);
}

function frozenLayerUrl(layers, key) {
  return layers?._staticDefaults?.urls?.[key] || layers?.[key] || "";
}

/** Badge-only overlay: never bake on top of a layer that already has stickers. */
function badgesOnlyBaseUrl(layers, flags = {}) {
  const { hasStickers, hasBorder } = getStaticEffectiveFlags(flags, layers);
  if (!hasBorder && hasStickers) {
    return (
      frozenLayerUrl(layers, "noBorder") ||
      frozenLayerUrl(layers, "productOnly") ||
      layers.noBorder ||
      layers.productOnly ||
      ""
    );
  }
  return (
    frozenLayerUrl(layers, "noStickers") ||
    layers.noStickers ||
    frozenLayerUrl(layers, "full") ||
    layers.full ||
    ""
  );
}

function canvasFromStaticImage(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

/**
 * Apply border thickness (0–1000). 100 = exact generated frame.
 * Gown keeps product size fixed; other variants scale border/mat around product.
 */
export function applyBorderThickness(frame, options = {}) {
  if (!frame) return frame;
  ensureFrameBases(frame);
  const pct = clamp(frame.borderThicknessPct ?? BORDER_THICKNESS_DEFAULT, 0, BORDER_THICKNESS_MAX);

  if (pct === BORDER_THICKNESS_DEFAULT && !gownFrameLayersEdited(frame)) {
    restoreBaseGeometry(frame);
    return frame;
  }

  if (frame.style === "gown_static") {
    if (!gownFrameLayersEdited(frame)) {
      syncGownLayerPctFromLegacySlider(frame, pct);
    }
    if (options.syncLegacyGownSlider) {
      syncGownLayerPctFromLegacySlider(frame, pct);
    }
    return applyGownFrameLayers(frame);
  }

  const outerW = frame.outerW || 0;
  const outerH = frame.outerH || 0;
  const basePx = frame.basePx ?? frame.px ?? 0;
  const basePy = frame.basePy ?? frame.py ?? 0;
  const baseDw = frame.baseDw ?? frame.dw ?? 0;
  const baseDh = frame.baseDh ?? frame.dh ?? 0;
  const baseBorder = frame.baseBorder ?? frame.border ?? 0;
  const baseWhitePad = frame.baseWhitePad ?? frame.whitePad ?? 0;

  frame.px = basePx;
  frame.py = basePy;
  frame.dw = baseDw;
  frame.dh = baseDh;

  const scaledBorder = scaleBorderThicknessPx(baseBorder, pct, 2);
  const scaledWhitePad = scaleBorderThicknessPx(baseWhitePad, pct, 0);

  const isTall =
    frame.frameType === "tall" ||
    frame.style === "tall_static" ||
    frame.style === "live_framed";

  if (isTall) {
    const slotInset = scaledWhitePad;
    const maxBorder = Math.max(
      2,
      Math.min(
        basePx - slotInset,
        basePy - slotInset,
        outerW - basePx - baseDw - slotInset,
        outerH - basePy - baseDh - slotInset,
      ),
    );
    frame.border = Math.min(scaledBorder, maxBorder);
    frame.whitePad = scaledWhitePad;
    frame.whiteX = frame.border;
    frame.whiteY = frame.border;
    frame.whiteW = Math.max(1, outerW - frame.border * 2);
    frame.whiteH = Math.max(1, outerH - frame.border * 2);
  } else {
    frame.border = scaledBorder;
    if (baseWhitePad > 0) frame.whitePad = scaledWhitePad;
  }

  return frame;
}

export function reanchorPlacements(layers) {
  if (!layers?._badgePlacements?.length || !layers._staticFrame) return false;
  for (const p of layers._badgePlacements) {
    applyPositionToPlacement(p, layers._staticFrame);
  }
  return true;
}

function drawLiveStandardBackground(ctx, frame) {
  const { outerW, outerH } = frame;
  if (frame.frameType === "solid" || frame.gradientAxis === "solid") {
    ctx.fillStyle = frame.gradientTop || frame.borderColor || "#3498db";
    ctx.fillRect(0, 0, outerW, outerH);
    return;
  }
  let grad;
  const axis = frame.gradientAxis || "vertical";
  if (axis === "horizontal") grad = ctx.createLinearGradient(0, 0, outerW, 0);
  else if (axis === "diagonal") grad = ctx.createLinearGradient(0, 0, outerW, outerH);
  else grad = ctx.createLinearGradient(0, 0, 0, outerH);
  grad.addColorStop(0, frame.gradientTop || "#3498db");
  grad.addColorStop(1, frame.gradientBottom || "#2ecc71");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, outerW, outerH);
}

function drawFrameBackground(ctx, frame) {
  const { outerW, outerH, px, py, dw, dh, style } = frame;
  ensureFrameDefaults(frame);

  if (style === "live_standard") {
    drawLiveStandardBackground(ctx, frame);
    return;
  }

  if (frame.frameType === "gradient" || (style === "showcase" && frame.frameType !== "solid")) {
    const grad = ctx.createLinearGradient(0, 0, 0, outerH);
    grad.addColorStop(0, frame.gradientTop || "#FF9800");
    grad.addColorStop(1, frame.gradientBottom || "#4CAF50");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, outerW, outerH);
    if (style === "showcase") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px, py, dw, dh);
    }
  } else if (style === "gown_static") {
    drawGownStaticFrameBackground(ctx, frame);
  } else if (
    frame.frameType === "tall" ||
    style === "tall_static" ||
    style === "live_framed"
  ) {
    ctx.fillStyle = frame.borderColor || "#45a9e5";
    ctx.fillRect(0, 0, outerW, outerH);
    ctx.fillStyle = frame.matColor || "#ffffff";
    const wx = frame.whiteX ?? 0;
    const wy = frame.whiteY ?? 0;
    const ww = frame.whiteW ?? outerW;
    const wh = frame.whiteH ?? outerH;
    ctx.fillRect(wx, wy, ww, wh);
  } else {
    ctx.fillStyle = frame.borderColor || "#32d74b";
    ctx.fillRect(0, 0, outerW, outerH);
  }
}

function cacheGownPhotoSource(layers, productImg) {
  if (!layers || layers._gownPhotoSource || !productImg) return;
  try {
    if (productImg instanceof HTMLCanvasElement) {
      layers._gownPhotoSource = productImg.toDataURL("image/jpeg", 0.92);
      return;
    }
    const c = document.createElement("canvas");
    c.width = productImg.width;
    c.height = productImg.height;
    c.getContext("2d").drawImage(productImg, 0, 0);
    layers._gownPhotoSource = c.toDataURL("image/jpeg", 0.92);
  } catch (e) {
    /* ignore cache failures (e.g. tainted canvas) */
  }
}

async function loadProductForFrame(layers, frame) {
  if (frame.style === "gown_static") {
    const gownSrc = resolveGownPhotoSourceUrl(layers);
    if (gownSrc) {
      try {
        return await loadImage(gownSrc);
      } catch (e) {
        /* fall through to shared crop paths */
      }
    }
  }
  if (layers.productOnly || layers._staticDefaults?.urls?.productOnly) {
    try {
      return await loadImage(layers.productOnly || layers._staticDefaults.urls.productOnly);
    } catch (e) {
      /* fall through */
    }
  }
  const dw = frame.baseDw ?? frame.dw;
  const dh = frame.baseDh ?? frame.dh;
  const px = frame.basePx ?? frame.px;
  const py = frame.basePy ?? frame.py;
  const noStickersUrl =
    layers._composeFallbackUrl ||
    frozenLayerUrl(layers, "noStickers") ||
    frozenLayerUrl(layers, "full") ||
    layers.noStickers ||
    layers.full ||
    "";
  if (!noStickersUrl || !dw || !dh || px == null || py == null) return null;
  try {
    const src = await loadImage(noStickersUrl);
    const c = document.createElement("canvas");
    c.width = dw;
    c.height = dh;
    c.getContext("2d").drawImage(src, px, py, dw, dh, 0, 0, dw, dh);
    return c;
  } catch (e) {
    return null;
  }
}

async function rebuildFrameCanvas(layers) {
  if (!layers?._staticFrame) return null;
  restoreGownPhotoSource(layers);
  const frame = ensureFrameDefaults({ ...layers._staticFrame });
  if (frame.style === "gown_static") {
    if (!frame.outerW) frame.outerW = GOWN_STATIC_OUTER_W;
    if (!frame.outerH) frame.outerH = GOWN_STATIC_OUTER_H;
    ensureGownDrawGeometry(frame);
  }
  ensureFrameBases(frame);
  applyBorderThickness(frame);
  if (frame.style === "gown_static") {
    applyGownFrameLayers(frame);
    ensureGownDrawGeometry(frame);
  }

  let productImg = null;
  try {
    productImg = await loadProductForFrame(layers, frame);
    if (productImg && frame.style === "gown_static") {
      cacheGownPhotoSource(layers, productImg);
    }
  } catch (e) {
    productImg = null;
  }

  const canvas = document.createElement("canvas");
  if (!frame.outerW) return null;
  canvas.width = frame.outerW;
  canvas.height = frame.outerH;
  const ctx = canvas.getContext("2d");

  drawFrameBackground(ctx, frame);

  if (productImg && frameHasProductSlot(frame)) {
    drawPhotoMarginFills(ctx, frame);
  }

  if (productImg) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (frameHasProductSlot(frame)) {
      drawProductPhotoCoverFit(ctx, productImg, frame);
    } else {
      ctx.drawImage(
        productImg,
        0,
        0,
        productImg.width,
        productImg.height,
        frame.px,
        frame.py,
        frame.dw,
        frame.dh,
      );
    }
  }

  Object.assign(layers._staticFrame, frame);
  return { canvas, frame };
}

/** Rebuild gown/static frame canvas for preview (mats + photo + badges). */
export async function rebuildGownPreviewCanvas(layers) {
  return rebuildFrameCanvas(layers);
}

function drawTruckIcon(ctx, cx, cy, size) {
  const w = size * 0.42;
  const h = size * 0.22;
  const x = cx - w / 2;
  const y = cy - h / 2 + size * 0.04;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y + h * 0.35, w * 0.62, h * 0.55);
  ctx.fillRect(x + w * 0.58, y + h * 0.5, w * 0.38, h * 0.4);
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y + h * 0.95, h * 0.18, 0, Math.PI * 2);
  ctx.arc(x + w * 0.78, y + h * 0.95, h * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawFreeShippingCircle(ctx, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.lineWidth = Math.max(2, Math.round(size * 0.04));
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  const fs = Math.max(6, Math.round(size * 0.1));
  ctx.font = `bold ${fs}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FREE", cx, cy - size * 0.14);
  ctx.fillText("SHIPPING", cx, cy - size * 0.02);
  drawTruckIcon(ctx, cx, cy + size * 0.14, size);
  ctx.restore();
}

async function drawPlacementsOnCtx(ctx, placements, frame) {
  for (const p of placements) {
    if (!p || p.drawn === false || p.hidden) continue;
    const { w, h } = placementSize(p, frame);
    try {
      if (p.kind === "freeShipping") {
        drawFreeShippingCircle(ctx, p.x, p.y, w);
      } else if (p.id?.startsWith("tall-")) {
        const copy = { ...p, w, h };
        await drawTallBadge(ctx, loadBadge, copy);
      } else if (p.kind === "gownArt" || (p.id?.startsWith("gown-") && p.kind !== "badge")) {
        const copy = { ...p, w, h };
        await drawGownBadge(ctx, loadBadge, copy);
      } else if (p.num != null) {
        const badge = await loadBadge(p.num);
        if (badge) ctx.drawImage(badge, p.x, p.y, w, h);
      }
    } catch (e) {}
  }
}

function scaleCanvas(src, scale) {
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function encodeJpeg(canvas, quality) {
  const q = Math.max(14, Math.min(92, quality)) / 100;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q);
  });
}

async function compressLifestyleToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let work = canvas;
  let bestBlob = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    let lo = 14;
    let hi = 92;
    let passBest = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodeJpeg(work, mid);
      if (blob.size <= targetBytes) {
        passBest = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (passBest) return passBest;
    bestBlob = passBest || (await encodeJpeg(work, 14));
    if (bestBlob.size <= targetBytes) return bestBlob;
    if (work.width <= 260) break;
    work = scaleCanvas(work, 0.88);
  }
  return bestBlob || (await encodeJpeg(canvas, 14));
}

function applyCustomTextToCanvas(canvas, layers) {
  const text = String(layers?._customText || "").trim();
  if (!text || !canvas) return;
  const IG = typeof ImageGenerator !== "undefined" ? ImageGenerator : null;
  if (!IG?.drawText) return;
  const border = Number(layers?._staticFrame?.border) || 0;
  const saved = {
    customText: IG.settings.customText,
    textBgColor: IG.settings.textBgColor,
  };
  IG.settings.customText = text;
  if (layers._customTextBg) IG.settings.textBgColor = layers._customTextBg;
  IG.drawText(canvas.getContext("2d"), canvas.width, canvas.height, border);
  IG.settings.customText = saved.customText;
  IG.settings.textBgColor = saved.textBgColor;
}

async function compressPreview(canvas, options = {}, layers = null) {
  if (layers) applyCustomTextToCanvas(canvas, layers);
  if (options.preview) {
    const q =
      options.jpegQuality > 0 && options.jpegQuality <= 1 ? options.jpegQuality : 0.92;
    try {
      return canvas.toDataURL("image/jpeg", q);
    } catch (e) {
      try {
        return canvas.toDataURL("image/png");
      } catch (e2) {
        return "";
      }
    }
  }
  const targetKb = options.targetKb ?? options.preserveKb ?? 0;
  const style = options.style || "";
  const jpegQuality = options.jpegQuality;

  if (targetKb > 0) {
    return compressToTargetKb(canvas, targetKb, style);
  }
  if (jpegQuality > 0 && jpegQuality <= 1) {
    return canvas.toDataURL("image/jpeg", jpegQuality);
  }
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function compressToTargetKb(canvas, targetKb, style) {
  if (!targetKb || targetKb <= 0) {
    return canvas.toDataURL("image/jpeg", 0.82);
  }
  const blob =
    style === "lifestyle_promo"
      ? await compressLifestyleToKb(canvas, targetKb)
      : style === "gown_static"
      ? await compressGownToKb(canvas, targetKb)
      : await compressFramedToKb(canvas, targetKb);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function frameAppearanceChanged(frame, defaults) {
  if (!frame || !defaults) return false;
  const keys = [
    "frameType",
    "gradientTop",
    "gradientBottom",
    "borderColor",
    "matColor",
    "outerMatColor",
    "innerStrokeColor",
    "padColor",
    "fillMatColor",
    "fillMatEnabled",
    "gradientPreset",
    "borderThicknessPct",
    "photoZoomPct",
    "photoPanH",
    "photoPanV",
    "photoZoomLocked",
    "photoPanHLocked",
    "photoPanVLocked",
    "photoMarginTop",
    "photoMarginRight",
    "photoMarginBottom",
    "photoMarginLeft",
    "photoMarginTopLocked",
    "photoMarginRightLocked",
    "photoMarginBottomLocked",
    "photoMarginLeftLocked",
    "photoMarginFillEnabled",
    "photoMarginFillColor",
  ];
  return keys.some((k) => frame[k] !== defaults[k]);
}

export function placementChangedFromDefault(p, def) {
  if (!p || !def) return false;
  if (p.hidden !== def.hidden) return true;
  if ((p.kind || "badge") !== (def.kind || "badge")) return true;
  if (p.num !== def.num) return true;
  if (Math.abs((p.sizePct ?? 100) - (def.sizePct ?? 100)) > 0.5) return true;
  if (Math.abs((p.posH ?? 0) - (def.posH ?? 0)) > 0.5) return true;
  if (Math.abs((p.posV ?? 0) - (def.posV ?? 0)) > 0.5) return true;
  return false;
}

export function needsStaticCompose(result) {
  if (!result?.layers) return false;
  const layers = result.layers;
  if (!layers._staticFrame && !(layers._badgePlacements || []).length) return false;
  if (result._badgesRepositioned || result._staticAppearanceEdited) return true;
  if (staticFrameBorderEdited(layers._staticFrame)) return true;
  const flags = result.editFlags || {};
  if (isStaticEdited(flags, false)) return true;

  const frame = layers._staticFrame;
  if (!frame) return false;
  const frameDef = layers._staticDefaults?.frame;
  if (frameDef && frameAppearanceChanged(frame, frameDef)) return true;

  const placements = layers._badgePlacements || [];
  const placementDefs = layers._staticDefaults?.placements || {};
  for (const p of placements) {
    if (placementChangedFromDefault(p, placementDefs[p.id])) return true;
  }
  return false;
}

export function pickStaticBaseLayer(layers, flags = {}, options = {}) {
  const { hasStickers, hasBorder } = getStaticEffectiveFlags(flags, layers);
  const restored = decorationsRestoredViaFlags(flags, options);

  if (!hasBorder && !hasStickers) {
    return { url: layers.productOnly || layers.full, drawBadges: false, rebuild: false };
  }
  if (hasBorder && !hasStickers) {
    const f = flags || {};
    if (layers.noStickers && (f.borderAdded || f.fullDecorationsAdded || restored)) {
      return { url: layers.noStickers, drawBadges: false, rebuild: false };
    }
    return { url: layers.noStickers || layers.full, drawBadges: false, rebuild: true };
  }
  if (!hasBorder && hasStickers) {
    const composeStickers = stickersNeedCompose(flags, options);
    if (layers.noBorder && !composeStickers) {
      return {
        url: layers.noBorder,
        drawBadges: false,
        isProductCanvas: true,
        rebuild: false,
      };
    }
    return {
      url: layers.productOnly || layers.noBorder || layers.full,
      drawBadges: composeStickers,
      isProductCanvas: true,
      rebuild: composeStickers,
    };
  }
  if (restored && layers.full) {
    return { url: layers.full, drawBadges: false, rebuild: false };
  }
  return { url: layers.noStickers || layers.full, drawBadges: true, rebuild: true };
}

export async function composeStaticPreview(layers, flags = {}, options = {}) {
  if (!layers) return "";
  restoreGownPhotoSource(layers);
  if (layers._staticFrame) {
    ensureStaticRebuildUrls(layers, layers._composeFallbackUrl || "");
  }
  const targetKb = options.targetKb ?? 0;
  const preview = !!options.preview;
  const badgesOnly = !!options.badgesOnly;
  const style = layers._staticFrame?.style || "";
  const { hasStickers, hasBorder } = getStaticEffectiveFlags(flags, layers);
  const composeOpts = {
    badgesRepositioned: !!options.badgesRepositioned,
  };
  const pickedEarly = pickStaticBaseLayer(layers, flags, composeOpts);
  if (hasStickers && stickersNeedCompose(flags, options)) {
    await prepareStickerComposeFrame(layers, flags, {
      ...options,
      url: pickedEarly.url,
      badgesRepositioned: !!options.badgesRepositioned,
    });
  }
  if (hasStickers) {
    ensureStickerPlacements(layers, flags, options.meta || layers._composeMeta || {});
    if (layers._staticFrame && (layers._badgePlacements || []).length) {
      ensureStaticPlacementMeta(layers, layers._staticFrame.style);
    }
  }

  if (!hasBorder && !hasStickers) {
    return frozenLayerUrl(layers, "productOnly") || layers.productOnly || layers.full || "";
  }

  const appearanceEdited =
    !!options.staticAppearanceEdited && !!layers._staticFrame;
  const frameEdited =
    appearanceEdited ||
    shouldRebuildStaticFrame(layers, {
      staticAppearanceEdited: !!options.staticAppearanceEdited,
      badgesOnly,
    });

  let canvas = null;
  let frame = layers._staticFrame;
  const picked = pickStaticBaseLayer(layers, flags, {
    badgesRepositioned: !!options.badgesRepositioned,
  });

  if (
    !picked.drawBadges &&
    !picked.rebuild &&
    !appearanceEdited &&
    !options.staticAppearanceEdited
  ) {
    return picked.url || frozenLayerUrl(layers, "full") || layers.full || "";
  }

  if (frameEdited && picked.rebuild && layers._staticFrame) {
    const rebuilt = await rebuildFrameCanvas(layers);
    if (rebuilt) {
      canvas = rebuilt.canvas;
      frame = rebuilt.frame;
    }
  }

  if (!canvas) {
    if (!picked.drawBadges && !frameEdited && !options.staticAppearanceEdited) {
      return picked.url || frozenLayerUrl(layers, "full") || layers.full || "";
    }
    if (appearanceEdited) {
      const retry = await rebuildFrameCanvas(layers);
      if (retry?.canvas) {
        canvas = retry.canvas;
        frame = retry.frame;
      }
    }
    if (!canvas && (frameEdited || options.staticAppearanceEdited)) {
      return "";
    }
    let baseUrl = picked.url;
    if (badgesOnly) {
      baseUrl = badgesOnlyBaseUrl(layers, flags) || baseUrl;
    }
    if (!baseUrl) {
      if (hasBorder && !hasStickers) baseUrl = frozenLayerUrl(layers, "noStickers") || layers.noStickers || layers.full;
      else if (!hasBorder && hasStickers) baseUrl = layers.noBorder || layers.productOnly || layers.full;
      else baseUrl = frozenLayerUrl(layers, "noStickers") || layers.noStickers || layers.full;
    }
    try {
      const img = await loadImage(baseUrl);
      if (picked.isProductCanvas) {
        canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        if (picked.drawBadges && frame) {
          frame = frameForProductCanvas(frame, img.width, img.height);
        }
      } else {
        if (frame && (frame.outerW !== img.width || frame.outerH !== img.height)) {
          const oldW = frame.outerW;
          const oldH = frame.outerH;
          frame = syncFrameToCanvasSize(frame, img.width, img.height);
          if (layers._staticFrame) Object.assign(layers._staticFrame, frame);
          if (picked.drawBadges) {
            rescalePlacementsForFrame(layers._badgePlacements, oldW, oldH, img.width, img.height);
          }
        }
        canvas = canvasFromStaticImage(img);
      }
    } catch (e) {
      return frozenLayerUrl(layers, "full") || layers.full || "";
    }
  }

  if (!canvas) {
    return frozenLayerUrl(layers, "full") || layers.full || "";
  }

  if (!hasStickers) {
    return compressPreview(
      canvas,
      {
        targetKb,
        preserveKb: options.preserveKb,
        jpegQuality: options.jpegQuality,
        style,
        preview,
      },
      layers,
    );
  }

  const placements = visibleStickerPlacements(layers);
  if (!placements.length) {
    return compressPreview(
      canvas,
      {
        targetKb,
        preserveKb: options.preserveKb,
        jpegQuality: options.jpegQuality,
        style,
        preview,
      },
      layers,
    );
  }

  for (const p of placements) {
    applyPositionToPlacement(p, frame);
    const { w, h } = placementSize(p, frame);
    if (p.kind === "freeShipping") p.size = w;
    else {
      p.w = w;
      p.h = h;
      if (!p.defaultW) p.size = w;
    }
  }

  const ctx = canvas.getContext("2d");
  await drawPlacementsOnCtx(ctx, placements, frame);

  return compressPreview(
    canvas,
    {
      targetKb,
      preserveKb: options.preserveKb,
      jpegQuality: options.jpegQuality,
      style,
      preview,
    },
    layers,
  );
}

export function updatePlacementAnchor(layers, placementId, anchor) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  p.anchor = anchor;
  applyAnchorToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementSliders(layers, placementId, posH, posV) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  p.posH = clamp(posH, 0, 100);
  p.posV = clamp(posV, 0, 100);
  applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementSliderAxis(layers, placementId, axis, value, options = {}) {
  if (!layers?._badgePlacements || !layers._staticFrame) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  const v = clamp(value, 0, 100);
  if (axis === "h") {
    if (p.lockH && !options.force) return false;
    p.posH = v;
    if (options.autoLock) p.lockH = true;
  } else if (axis === "v") {
    if (p.lockV && !options.force) return false;
    p.posV = v;
    if (options.autoLock) p.lockV = true;
  } else {
    return false;
  }
  applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function setPlacementAxisLock(layers, placementId, axis, locked) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  if (axis === "h") p.lockH = !!locked;
  else if (axis === "v") p.lockV = !!locked;
  else return false;
  return true;
}

export function setPlacementSizeLock(layers, placementId, locked) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  p.lockSize = !!locked;
  return true;
}

export function updatePlacementSize(layers, placementId, sizePct, options = {}) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);
  if (p.lockSize && !options.force) return false;
  p.sizePct = clamp(sizePct, 25, 200);
  if (options.autoLock) p.lockSize = true;
  if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function updatePlacementBadge(layers, placementId, badgeValue) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  ensurePlacementDefaults(p);

  const raw = String(badgeValue ?? "").trim();
  if (raw === "gown-art") {
    if (!p.id?.startsWith("gown-")) return false;
    p.kind = "gownArt";
    p.gownSlot = p.id;
    p.num = undefined;
    p.defaultW = undefined;
    p.defaultH = undefined;
    p.defaultSize = undefined;
    p.size = undefined;
    restoreGownArtSlotSize(p, layers);
    p.drawn = true;
    if (p.id === "gown-best") p.label = "Best PRICE";
    else if (p.id === "gown-flash") p.label = "FLASH SALE";
    else if (p.id === "gown-popular") p.label = "MOST POPULAR";
    else p.label = "Gown art";
    if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
    return true;
  }
  if (raw === FREE_SHIPPING_BADGE_VALUE) {
    if (!isFreeShippingSlot(p)) return false;
    const { w } = placementSize(p, layers._staticFrame);
    p.kind = "freeShipping";
    p._freeShippingSlot = true;
    p.defaultSize = w;
    p.defaultW = undefined;
    p.defaultH = undefined;
    p.size = w;
    p.num = undefined;
    p.drawn = true;
    p.label = "FREE SHIPPING";
    if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
    return true;
  }

  const num = Math.max(1, Math.min(25, parseInt(raw, 10) || 0));
  if (!num) return false;

  if (p.kind === "freeShipping" || p.kind === "gownArt") {
    const { w, h } = placementSize(p, layers._staticFrame);
    if (!p.gownSlot && p.id?.startsWith("gown-")) p.gownSlot = p.id;
    p.kind = "badge";
    if (p.id?.startsWith("gown-")) {
      const side = squareBadgeBox(w, h);
      p.defaultW = side;
      p.defaultH = side;
      p.w = side;
      p.h = side;
    } else {
      p.defaultW = w;
      p.defaultH = h;
      p.w = w;
      p.h = h;
    }
    p.defaultSize = undefined;
    p.size = undefined;
  }

  p.num = num;
  p.drawn = true;
  p.label = `Badge ${num}`;
  if (layers._staticFrame) applyPositionToPlacement(p, layers._staticFrame);
  return true;
}

export function setPlacementHidden(layers, placementId, hidden) {
  if (!layers?._badgePlacements) return false;
  const p = layers._badgePlacements.find((b) => b.id === placementId);
  if (!p) return false;
  p.hidden = !!hidden;
  return true;
}

export function setAllPlacementsHidden(layers, hidden) {
  if (!layers?._badgePlacements) return false;
  for (const p of layers._badgePlacements) {
    p.hidden = !!hidden;
  }
  return true;
}

export function updateFrameAppearance(layers, patch) {
  if (!layers?._staticFrame) return false;
  const frame = layers._staticFrame;
  if (patch.frameType != null) frame.frameType = patch.frameType;
  if (patch.gradientTop != null) {
    const hex = normalizeFrameColor(patch.gradientTop);
    if (hex) frame.gradientTop = hex;
  }
  if (patch.gradientBottom != null) {
    const hex = normalizeFrameColor(patch.gradientBottom);
    if (hex) frame.gradientBottom = hex;
  }
  if (patch.borderColor != null) {
    const hex = normalizeFrameColor(patch.borderColor);
    if (hex) frame.borderColor = hex;
  }
  if (patch.outerMatColor != null) {
    const hex = normalizeFrameColor(patch.outerMatColor);
    if (hex) frame.outerMatColor = hex;
  }
  if (patch.innerStrokeColor != null) {
    const hex = normalizeFrameColor(patch.innerStrokeColor);
    if (hex) frame.innerStrokeColor = hex;
  }
  if (patch.padColor != null) {
    const hex = normalizeFrameColor(patch.padColor);
    if (hex) frame.padColor = hex;
  }
  if (patch.fillMatColor != null) {
    const hex = normalizeFrameColor(patch.fillMatColor);
    if (hex) frame.fillMatColor = hex;
  }
  if (patch.fillMatEnabled != null) frame.fillMatEnabled = !!patch.fillMatEnabled;
  if (patch.matColor != null) {
    const hex = normalizeFrameColor(patch.matColor);
    if (hex) {
      frame.matColor = hex;
      if (frame.style === "gown_static") {
        if (patch.outerMatColor == null && frame.outerMatColor == null) frame.outerMatColor = hex;
        if (patch.fillMatColor == null && frame.fillMatColor == null) frame.fillMatColor = hex;
        if (patch.padColor == null && frame.padColor == null) frame.padColor = hex;
      }
    }
  }
  if (patch.gradientPreset !== undefined) frame.gradientPreset = patch.gradientPreset || null;
  if (patch.gownLayerPct != null && frame.style === "gown_static") {
    ensureGownLayerPcts(frame);
    Object.assign(frame.gownLayerPct, patch.gownLayerPct);
    applyGownFrameLayers(frame);
  }
  if (patch.photoZoomPct != null && frameHasProductSlot(frame)) {
    frame.photoZoomPct = clamp(patch.photoZoomPct, 50, 200);
  }
  if (patch.photoPanH != null && frameHasProductSlot(frame)) {
    frame.photoPanH = clamp(patch.photoPanH, 0, 100);
  }
  if (patch.photoPanV != null && frameHasProductSlot(frame)) {
    frame.photoPanV = clamp(patch.photoPanV, 0, 100);
  }
  if (patch.photoZoomLocked != null) frame.photoZoomLocked = !!patch.photoZoomLocked;
  if (patch.photoPanHLocked != null) frame.photoPanHLocked = !!patch.photoPanHLocked;
  if (patch.photoPanVLocked != null) frame.photoPanVLocked = !!patch.photoPanVLocked;
  for (const side of ["top", "right", "bottom", "left"]) {
    const field = photoMarginField(side);
    const lockField = photoMarginLockField(side);
    if (patch[field] != null && frameHasProductSlot(frame)) {
      frame[field] = clampPhotoMarginSide(frame, side, patch[field]);
    }
    if (patch[lockField] != null) frame[lockField] = !!patch[lockField];
  }
  if (
    patch.photoMarginTop != null ||
    patch.photoMarginRight != null ||
    patch.photoMarginBottom != null ||
    patch.photoMarginLeft != null
  ) {
    normalizePhotoMargins(frame);
  }
  if (patch.photoMarginFillEnabled != null) {
    frame.photoMarginFillEnabled = !!patch.photoMarginFillEnabled;
  }
  if (patch.photoMarginFillColor != null) {
    const hex = normalizeFrameColor(patch.photoMarginFillColor);
    if (hex) frame.photoMarginFillColor = hex;
  }
  if (patch.borderThicknessPct != null) {
    frame.borderThicknessPct = clamp(patch.borderThicknessPct, 0, BORDER_THICKNESS_MAX);
    applyBorderThickness(frame, { syncLegacyGownSlider: frame.style === "gown_static" });
  }
  if (
    patch.photoMarginTop != null ||
    patch.photoMarginRight != null ||
    patch.photoMarginBottom != null ||
    patch.photoMarginLeft != null ||
    patch.borderThicknessPct != null ||
    patch.photoZoomPct != null ||
    patch.photoPanH != null ||
    patch.photoPanV != null
  ) {
    reanchorPlacements(layers);
  }
  return true;
}

export function applyGradientPreset(layers, presetId) {
  const preset = GRADIENT_PRESETS.find((g) => g.id === presetId);
  if (!preset || !layers?._staticFrame) return false;
  return updateFrameAppearance(layers, {
    frameType: "gradient",
    gradientTop: preset.top,
    gradientBottom: preset.bottom,
    gradientPreset: presetId,
    borderColor: preset.top,
  });
}

export function clearGradientPreset(layers) {
  if (!layers?._staticFrame) return false;
  const frame = layers._staticFrame;
  const style = frame.style;
  const defs = STYLE_DEFAULTS[style];
  frame.gradientPreset = null;
  if (defs?.frameType) frame.frameType = defs.frameType;
  return true;
}

export function staticStyleUsesGradientColors(style, frame) {
  if (style === "showcase" || style === "live_standard") return true;
  if (style === "gown_static") {
    return gownUsesBorderGradient(frame);
  }
  return !!frame?.gradientPreset;
}

function finalizePlacementSnapshot(layers) {
  if (!layers?._staticDefaults?.placements) return;
  for (const p of layers._badgePlacements || []) {
    if (!p.id) continue;
    const existing = layers._staticDefaults.placements[p.id] || {};
    if (existing._finalized) continue;
    layers._staticDefaults.placements[p.id] = {
      ...existing,
      kind: p.kind,
      num: p.num,
      hidden: !!p.hidden,
      posH: p.posH,
      posV: p.posV,
      sizePct: p.sizePct ?? 100,
      slotW: existing.slotW ?? p.w,
      slotH: existing.slotH ?? p.h,
      baseX: p.x,
      baseY: p.y,
      _finalized: true,
    };
  }
}

function snapshotDefaults(layers, style) {
  if (!layers?._staticFrame) return;
  if (!layers._staticDefaults) {
    const frame = layers._staticFrame;
    layers._staticDefaults = {
      frame: snapshotFrameAppearance(frame, style),
      urls: {
        full: layers.full || "",
        noStickers: layers.noStickers || "",
        productOnly: layers.productOnly || "",
        noBorder: layers.noBorder || "",
        gownPhotoSource: layers._gownPhotoSource || "",
      },
      placements: {},
    };
    for (const p of layers._badgePlacements || []) {
      if (!p.id) continue;
      layers._staticDefaults.placements[p.id] = {
        kind: p.kind,
        num: p.num,
        hidden: !!p.hidden,
        posH: p.posH,
        posV: p.posV,
        sizePct: p.sizePct ?? 100,
        freeShippingSlot: isFreeShippingSlot(p),
        slotW: p.w,
        slotH: p.h,
      };
    }
  }
}

export function ensureFrameOuterDimensions(layers, meta = {}) {
  const frame = layers?._staticFrame;
  if (!frame) return false;
  let changed = false;
  const m = meta || {};
  if (!frame.outerW && (m.canvasW || m.outerW)) {
    frame.outerW = m.canvasW || m.outerW;
    changed = true;
  }
  if (!frame.outerH && (m.canvasH || m.outerH)) {
    frame.outerH = m.canvasH || m.outerH;
    changed = true;
  }
  if (!frame.outerW && frame.dw != null && frame.px != null) {
    frame.outerW = Math.round(frame.px * 2 + frame.dw);
    changed = true;
  }
  if (!frame.outerH && frame.dh != null && frame.py != null) {
    frame.outerH = Math.round(frame.py * 2 + frame.dh);
    changed = true;
  }
  if (!frame.outerW && frame.baseDw != null && frame.basePx != null) {
    frame.outerW = Math.round(frame.basePx * 2 + frame.baseDw);
    changed = true;
  }
  if (!frame.outerH && frame.baseDh != null && frame.basePy != null) {
    frame.outerH = Math.round(frame.basePy * 2 + frame.baseDh);
    changed = true;
  }
  return changed;
}

function visibleStickerPlacements(layers) {
  return (layers?._badgePlacements || []).filter((p) => !p.hidden && p.drawn !== false);
}

function defaultStickerCount(meta = {}, style = "") {
  if (meta.badgeCount > 0) return Math.min(meta.badgeCount, 4);
  if (style === "live_framed") return 2;
  return 2;
}

function seedFromMeta(meta = {}) {
  const raw = meta.seed ?? meta.jpegQuality ?? 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.abs(Math.floor(raw * 1000)) || 1;
  return 1;
}

function createDefaultStickerPlacements(frame, meta = {}) {
  const outerW = frame.outerW || meta.canvasW || 800;
  const outerH = frame.outerH || meta.canvasH || 800;
  const border =
    frame.border ??
    meta.borderPx ??
    Math.max(8, Math.round(Math.min(outerW, outerH) * 0.05));
  const count = defaultStickerCount(meta, frame.style);
  const seed = seedFromMeta(meta);
  const cornerSize = Math.max(56, Math.min(120, Math.round(Math.min(outerW, outerH) * 0.12)));
  const positions = [
    { x: border + 5, y: border + 5 },
    { x: outerW - border - cornerSize - 5, y: border + 5 },
    { x: border + 5, y: outerH - border - cornerSize - 5 },
    { x: outerW - border - cornerSize - 5, y: outerH - border - cornerSize - 5 },
  ];
  const used = new Set();
  const placements = [];
  for (let i = 0; i < count && i < positions.length; i++) {
    let num = ((seed + i * 7) % 25) + 1;
    while (used.has(num)) num = (num % 25) + 1;
    used.add(num);
    placements.push({
      id: `live-badge-${i}`,
      label: `Badge ${i + 1}`,
      num,
      size: cornerSize,
      x: positions[i].x,
      y: positions[i].y,
      drawn: true,
    });
  }
  return placements;
}

/** Ensure editable sticker slots exist when preview flags request stickers. */
export function ensureStickerPlacements(layers, flags = {}, meta = {}) {
  if (!layers?._staticFrame) return layers;
  const { hasStickers } = getStaticEffectiveFlags(flags, layers);
  if (!hasStickers) return layers;
  ensureFrameOuterDimensions(layers, meta);
  if (visibleStickerPlacements(layers).length) return layers;
  const frame = layers._staticFrame;
  if (!frame.outerW || !frame.outerH) return layers;
  layers._badgePlacements = createDefaultStickerPlacements(frame, meta);
  layers._placementMetaReady = false;
  return layers;
}

export async function bootstrapLiveFrameAsync(row) {
  const layers = row?.layers;
  if (!layers) return layers;
  if (layers._staticFrame) {
    ensureFrameOuterDimensions(layers, row?.meta || {});
    return layers;
  }
  if (!(layers._badgePlacements || []).length) return layers;

  const meta = row.meta || {};
  if (!meta.canvasW || !meta.canvasH) {
    const url = layers.noStickers || layers.full;
    if (url) {
      try {
        const img = await loadImage(url);
        meta.canvasW = img.width;
        meta.canvasH = img.height;
        if (!meta.borderPx && layers._staticFrame === undefined) {
          const p0 = layers._badgePlacements[0];
          if (p0?.x != null && p0?.y != null) {
            meta.borderPx = Math.max(8, Math.min(p0.x, p0.y));
          }
        }
        row.meta = meta;
      } catch (e) {}
    }
  }
  return bootstrapLiveFrame(row);
}

export function bootstrapLiveFrame(row) {
  const layers = row?.layers;
  const meta = row?.meta || {};
  if (!layers) return layers;
  if (layers._staticFrame) {
    ensureFrameOuterDimensions(layers, meta);
    return layers;
  }
  if (!(layers._badgePlacements || []).length) return layers;

  const outerW = meta.canvasW || meta.outerW;
  const outerH = meta.canvasH || meta.outerH;
  if (!outerW || !outerH) return layers;

  const isFramed = meta.style === "framed_low" || row.variantStyle === "framed";
  const border = meta.borderPx || Math.max(16, Math.round(Math.min(outerW, outerH) * 0.05));
  const dw = meta.productW || outerW - border * 2;
  const dh = meta.productH || outerH - border * 2;
  const px = isFramed ? border : border;
  const py = isFramed ? border : border;

  if (isFramed) {
    const blueOuter = meta.blueOuter || border;
    layers._staticFrame = {
      style: "live_framed",
      frameType: "tall",
      borderColor: meta.borderColor || "#add8e6",
      matColor: "#ffffff",
      gradientTop: meta.borderColor || "#add8e6",
      gradientBottom: "#7ec8e3",
      px,
      py,
      dw,
      dh,
      border: blueOuter,
      outerW,
      outerH,
      whiteX: blueOuter,
      whiteY: blueOuter,
      whiteW: outerW - blueOuter * 2,
      whiteH: outerH - blueOuter * 2,
    };
  } else {
    const gradType = meta.gradType ?? 2;
    layers._staticFrame = {
      style: "live_standard",
      frameType: gradType === 0 ? "solid" : "gradient",
      gradientTop: meta.gradientTop || meta.borderColor || "#3498db",
      gradientBottom: meta.gradientBottom || "#2ecc71",
      gradientAxis:
        gradType === 1 ? "horizontal" : gradType === 3 ? "diagonal" : gradType === 0 ? "solid" : "vertical",
      borderColor: meta.gradientTop || "#3498db",
      px: border,
      py: border,
      dw,
      dh,
      border,
      outerW,
      outerH,
    };
  }

  ensureFramePhotoDefaults(layers._staticFrame);

  layers._badgePlacements.forEach((p, i) => {
    if (!p.id) p.id = `live-badge-${i}`;
    if (!p.label) p.label = p.kind === "freeShipping" ? "FREE SHIPPING" : `Badge ${i + 1}`;
    if (p.drawn == null) p.drawn = true;
    ensurePlacementDefaults(p);
  });

  return layers;
}

export async function ensureVariantPlacementMeta(row) {
  const layers = row?.layers;
  if (!layers) return layers;
  await bootstrapLiveFrameAsync(row);
  ensureStickerPlacements(layers, row?.editFlags || {}, row?.meta || {});
  if (layers._staticFrame && (layers._badgePlacements || []).length) {
    ensureStaticPlacementMeta(layers, layers._staticFrame.style);
  }
  return layers;
}

export function ensureStaticPlacementMeta(layers, style) {
  if (!layers?._badgePlacements?.length) return layers;
  if (!layers._staticFrame) return layers;

  restoreGownPhotoSource(layers);
  ensureFrameDefaults(layers._staticFrame);
  ensureFrameBases(layers._staticFrame);
  ensureFramePhotoDefaults(layers._staticFrame);
  snapshotDefaults(layers, style);

  if (layers._placementMetaReady) return layers;

  const anchorMap = DEFAULT_ANCHORS[style] || {};

  for (let i = 0; i < layers._badgePlacements.length; i++) {
    const p = layers._badgePlacements[i];
    if (!p.id) p.id = `badge-slot-${i}`;
    ensurePlacementDefaults(p);
    if (!p.anchor && anchorMap[p.id]) p.anchor = anchorMap[p.id];
    if (!p.label) {
      if (p.kind === "freeShipping") p.label = "FREE SHIPPING";
      else if (p.id === "showcase-quality") p.label = "100% Quality";
      else if (p.id === "showcase-star") p.label = "Star ribbon";
      else if (p.id === "showcase-satisfaction") p.label = "Satisfaction";
      else if (p.id === "lifestyle-hot") p.label = "HOT SALE";
      else if (p.id === "lifestyle-flash") p.label = "FLASH SALE";
      else if (p.id === "lifestyle-ship") {
        p.label = "FREE SHIPPING";
        p._freeShippingSlot = true;
      }
      else if (p.id === "tall-sale") p.label = "Price tag";
      else if (p.id === "tall-arrow") p.label = "Arrow";
      else if (p.id === "tall-ship") p.label = "Delivery truck";
      else if (p.id === "gown-best") p.label = "Best PRICE";
      else if (p.id === "gown-flash") p.label = "FLASH SALE";
      else if (p.id === "gown-popular") p.label = "MOST POPULAR";
      else if (p.id.startsWith("live-badge-")) p.label = `Badge ${parseInt(p.id.split("-").pop(), 10) + 1}`;
      else p.label = `Badge ${p.num || ""}`.trim();
    }
    if (style === "gown_static" && isGownArtPlacement(p)) {
      applyPositionToPlacement(p, layers._staticFrame);
      const { w, h } = placementSize(p, layers._staticFrame);
      const sliders = xyToSliders(
        p.x || 0,
        p.y || 0,
        layers._staticFrame.outerW,
        layers._staticFrame.outerH,
        w,
        h,
      );
      if (p.posH == null) p.posH = sliders.posH;
      if (p.posV == null) p.posV = sliders.posV;
    } else if (p.posH == null || p.posV == null) {
      const { w, h } = placementSize(p, layers._staticFrame);
      const sliders = xyToSliders(p.x || 0, p.y || 0, layers._staticFrame.outerW, layers._staticFrame.outerH, w, h);
      p.posH = sliders.posH;
      p.posV = sliders.posV;
    } else {
      applyPositionToPlacement(p, layers._staticFrame);
    }
  }
  finalizePlacementSnapshot(layers);
  layers._placementMetaReady = true;
  return layers;
}

export function resetStaticPlacements(layers) {
  if (!layers?._staticFrame) return false;
  restoreGownPhotoSource(layers);
  const style = layers._staticFrame.style;
  const anchorMap = DEFAULT_ANCHORS[style] || {};
  layers._placementMetaReady = false;

  const frameDef = layers._staticDefaults?.frame;
  if (frameDef) {
    applyFrameAppearanceDefaults(layers._staticFrame, frameDef, style);
  } else {
    applyFrameAppearanceDefaults(layers._staticFrame, STYLE_DEFAULTS[style] || {}, style);
  }

  ensureFrameBases(layers._staticFrame);
  if (style === "gown_static") {
    applyGownFrameLayers(layers._staticFrame);
  } else {
    applyBorderThickness(layers._staticFrame);
  }

  for (const p of layers._badgePlacements || []) {
    if (!p.id) continue;
    const pDef = layers._staticDefaults?.placements?.[p.id];
    if (pDef) {
      if (pDef.freeShippingSlot) p._freeShippingSlot = true;
      if (pDef.kind === "freeShipping") {
        p.kind = "freeShipping";
        p.num = undefined;
        p.label = "FREE SHIPPING";
      } else if (pDef.kind === "gownArt") {
        p.kind = "gownArt";
        p.gownSlot = p.id;
        p.num = undefined;
        p.defaultW = undefined;
        p.defaultH = undefined;
        p.defaultSize = undefined;
        p.size = undefined;
        if (pDef.slotW != null && pDef.slotH != null) {
          p.w = pDef.slotW;
          p.h = pDef.slotH;
        } else {
          const dims = gownArtDimensions(p.id, layers._staticFrame);
          if (dims) {
            p.w = dims.w;
            p.h = dims.h;
          }
        }
        if (p.id === "gown-best") p.label = "Best PRICE";
        else if (p.id === "gown-flash") p.label = "FLASH SALE";
        else if (p.id === "gown-popular") p.label = "MOST POPULAR";
      } else {
        p.kind = pDef.kind || "badge";
        p.num = pDef.num;
        if (p.num) p.label = `Badge ${p.num}`;
      }
      p.hidden = !!pDef.hidden;
      p.posH = pDef.posH;
      p.posV = pDef.posV;
      p.sizePct = pDef.sizePct ?? 100;
      p.lockH = true;
      p.lockV = true;
      p.lockSize = true;
    } else if (anchorMap[p.id]) {
      p.anchor = anchorMap[p.id];
      p.hidden = false;
      applyAnchorToPlacement(p, layers._staticFrame);
    }
    applyPositionToPlacement(p, layers._staticFrame);
  }
  layers._placementMetaReady = true;
  return true;
}

export function isStaticEdited(flags, badgesRepositioned, staticAppearanceEdited) {
  if (badgesRepositioned || staticAppearanceEdited) return true;
  const f = flags || {};
  return !!(
    f.stickersRemoved ||
    f.borderOnlyRemoved ||
    f.cleanProduct ||
    f.stickersAdded ||
    f.borderAdded ||
    f.fullDecorationsAdded
  );
}

if (typeof window !== "undefined") {
  window.StaticFrameCompose = {
    frameHasProductSlot,
    ensureFramePhotoDefaults,
    drawProductPhotoCoverFit,
    maxPhotoMarginSide,
    clampPhotoMarginSide,
    PHOTO_MARGIN_MAX,
    snapshotPhotoControls,
    isStaticPromoVariant,
    isEditableVariant,
    getBadgeSlots,
    BADGE_ANCHOR_OPTIONS,
    GRADIENT_PRESETS,
    FRAME_COLOR_SWATCHES,
    getStaticEffectiveFlags,
    inferBaseLayerCaps,
    isGownArtPlacement,
    gownPlacementPosition,
    gownArtDimensions,
    positionForAnchor,
    slidersToXY,
    xyToSliders,
    applyAnchorToPlacement,
    applyPositionToPlacement,
    pickStaticBaseLayer,
    composeStaticPreview,
    rebuildGownPreviewCanvas,
    ensureStaticRebuildUrls,
    ensureGownRebuildUrls,
    updatePlacementAnchor,
    updatePlacementSliders,
    updatePlacementSliderAxis,
    setPlacementAxisLock,
    setPlacementSizeLock,
    updatePlacementSize,
    updatePlacementBadge,
    FREE_SHIPPING_BADGE_VALUE,
    isFreeShippingSlot,
    setPlacementHidden,
    setAllPlacementsHidden,
    updateFrameAppearance,
    applyGradientPreset,
    clearGradientPreset,
    staticStyleUsesGradientColors,
    parseCssColor,
    normalizeFrameColor,
    hexToRgb,
    rgbToHex,
    parseRgbTriplet,
    formatRgbString,
    bootstrapLiveFrame,
    bootstrapLiveFrameAsync,
    ensureFrameOuterDimensions,
    ensureStickerPlacements,
    prepareStickerComposeFrame,
    ensureVariantPlacementMeta,
    ensureStaticPlacementMeta,
    resetStaticPlacements,
    snapshotGownFrameAppearance,
    normalizeGownLayerPct,
    defaultGownLayerPct,
    needsStaticCompose,
    isStaticEdited,
    ensureFrameBases,
    applyBorderThickness,
    ensureGownLayerPcts,
    gownFrameLayersEdited,
    reanchorPlacements,
    staticFrameBorderEdited,
    shouldRebuildStaticFrame,
    ensureGownRebuildUrls,
    BORDER_THICKNESS_DEFAULT,
    BORDER_THICKNESS_MAX,
  };
}
