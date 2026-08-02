/**
 * Gown portrait promo @ 773×1094 — competitor-matched teal frame for ~₹49 band.
 * Isolated from tall_static (do not share max-fill / white-flatten logic).
 */
import { imageToCanvas } from "./lib/canvas-utils.js?v=97";
import { blobToDataUrl, compressGownToKb } from "./lib/encoder.js?v=96";
import { estimateImageShipping } from "./lib/shipping.js?v=95";
import {
  clampPhotoZoom,
  drawProductPhotoCoverFit,
  productPhotoRect,
} from "./lib/productPhotoFit.mjs?v=4";
import { drawGownBadge } from "./gownStaticBadges.mjs?v=95";

export const GOWN_STATIC_OUTER_W = 773;
export const GOWN_STATIC_OUTER_H = 1094;
export const GOWN_STATIC_VARIANT_COUNT = 25;

/**
 * Reference frame stack (outside → in):
 * teal border → white mat (similar weight) → teal inner accent → white pad → photo.
 */
export const BORDER_TEAL = "#71cbd3";
const BORDER_TEAL_DARK = "#5eb8c4";
export const GOWN_TEAL_RATIO = 0.025;
/** Primary white mat — similar thickness to outer teal ring. */
export const GOWN_OUTER_MAT_RATIO = 0.025;
export const GOWN_OUTER_MAT_MIN = 18;
/** White padding between inner teal accent and lifestyle photo. */
export const GOWN_INNER_MAT_RATIO = 0.022;
export const GOWN_INNER_MAT_MIN = 14;
/** Thin teal inner accent line (visible third layer on reference listing). */
export const GOWN_INNER_STROKE = 3;
export const GOWN_INNER_STROKE_COLOR = BORDER_TEAL;
export const GOWN_PHOTO_ZOOM_DEFAULT = 100;
export const GOWN_PHOTO_ZOOM_MIN = 50;
export const GOWN_PHOTO_ZOOM_MAX = 200;

function clampGownZoom(pct) {
  return clampPhotoZoom(pct);
}

function gownStaticKbTiers(count = GOWN_STATIC_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 38;
  const end = 48;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

async function compressGownVariant(canvas, targetKb) {
  const blob = await compressGownToKb(canvas, targetKb);
  return { blob, canvas };
}

export function computeGownFrameGeometry(outerW, outerH, overrides = {}) {
  const ref = Math.min(outerW, outerH);
  const border = overrides.border ?? Math.max(14, Math.round(ref * GOWN_TEAL_RATIO));
  const outerMatPad =
    overrides.outerMatPad ??
    Math.max(GOWN_OUTER_MAT_MIN, Math.round(ref * GOWN_OUTER_MAT_RATIO));
  const innerMatPad =
    overrides.innerMatPad ??
    Math.max(GOWN_INNER_MAT_MIN, Math.round(ref * GOWN_INNER_MAT_RATIO));
  const innerStroke = overrides.innerStroke ?? GOWN_INNER_STROKE;

  const whiteX = border;
  const whiteY = border;
  const whiteW = outerW - border * 2;
  const whiteH = outerH - border * 2;

  const innerFrameX = whiteX + outerMatPad;
  const innerFrameY = whiteY + outerMatPad;
  const innerFrameW = whiteW - outerMatPad * 2;
  const innerFrameH = whiteH - outerMatPad * 2;

  const slotInset = innerMatPad + innerStroke;
  const slotX = innerFrameX + slotInset;
  const slotY = innerFrameY + slotInset;
  const maxProdW = innerFrameW - slotInset * 2;
  const maxProdH = innerFrameH - slotInset * 2;

  return {
    border,
    outerMatPad,
    innerMatPad,
    innerStroke,
    innerStrokeColor: overrides.innerStrokeColor ?? GOWN_INNER_STROKE_COLOR,
    whitePad: outerMatPad + innerMatPad + innerStroke,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    innerFrameX,
    innerFrameY,
    innerFrameW,
    innerFrameH,
    px: slotX,
    py: slotY,
    dw: maxProdW,
    dh: maxProdH,
    outerW,
    outerH,
  };
}

function drawGownInnerAccent(ctx, x, y, w, h, thickness, color) {
  const t = Math.max(2, Math.round(thickness));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

/** Gown outer border uses a vertical gradient when frameType is gradient or a preset is set. */
export function gownUsesBorderGradient(frame) {
  return frame?.frameType === "gradient" || !!frame?.gradientPreset;
}

function gownBorderFillStyle(ctx, frame, outerW, outerH) {
  if (!gownUsesBorderGradient(frame)) {
    return frame.borderColor || BORDER_TEAL;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, outerH);
  grad.addColorStop(0, frame.gradientTop || frame.borderColor || BORDER_TEAL);
  grad.addColorStop(1, frame.gradientBottom || BORDER_TEAL_DARK);
  return grad;
}

function drawGownPhotoPadRing(ctx, frame, padColor) {
  const pad = Math.max(0, frame.innerMatPad ?? 0);
  if (pad <= 0) return;
  const { x: px, y: py, w: dw, h: dh } = productPhotoRect(frame);
  if (dw <= 0 || dh <= 0) return;
  ctx.fillStyle = padColor;
  ctx.fillRect(px, py - pad, dw, pad);
  ctx.fillRect(px, py + dh, dw, pad);
  ctx.fillRect(px - pad, py, pad, dh);
  ctx.fillRect(px + dw, py, pad, dh);
}

/** Fill mat board inside inner frame (full inner board; photo draws on top later). */
export function gownInnerBoardRect(frame) {
  ensureGownDrawGeometry(frame);
  const border = frame.border ?? 0;
  const wx = frame.whiteX ?? border;
  const wy = frame.whiteY ?? border;
  const ww = frame.whiteW ?? (frame.outerW || 0) - border * 2;
  const wh = frame.whiteH ?? (frame.outerH || 0) - border * 2;
  const omp = frame.outerMatPad ?? 0;
  return {
    ifx: frame.innerFrameX ?? wx + omp,
    ify: frame.innerFrameY ?? wy + omp,
    ifw: frame.innerFrameW ?? ww - omp * 2,
    ifh: frame.innerFrameH ?? wh - omp * 2,
  };
}

/** Ensure inner board geometry is valid before drawing gown mats. */
export function ensureGownDrawGeometry(frame) {
  if (!frame) return frame;
  const outerW = frame.outerW || GOWN_STATIC_OUTER_W;
  const outerH = frame.outerH || GOWN_STATIC_OUTER_H;
  frame.outerW = outerW;
  frame.outerH = outerH;

  const basePx = frame.basePx ?? frame.px;
  const basePy = frame.basePy ?? frame.py;
  const baseDw = frame.baseDw ?? frame.dw;
  const baseDh = frame.baseDh ?? frame.dh;

  if (basePx == null || basePy == null || !baseDw || !baseDh) {
    Object.assign(frame, computeGownFrameGeometry(outerW, outerH));
    return frame;
  }

  const innerMatPad =
    frame.innerMatPad ??
    frame.baseInnerMatPad ??
    Math.max(GOWN_INNER_MAT_MIN, Math.round(Math.min(outerW, outerH) * GOWN_INNER_MAT_RATIO));
  const accentInset = frame.baseInnerStroke ?? frame.innerStroke ?? GOWN_INNER_STROKE;
  const slotInset = innerMatPad + Math.max(accentInset, 0);

  const ifx = basePx - slotInset;
  const ify = basePy - slotInset;
  const ifw = baseDw + slotInset * 2;
  const ifh = baseDh + slotInset * 2;

  frame.basePx = basePx;
  frame.basePy = basePy;
  frame.baseDw = baseDw;
  frame.baseDh = baseDh;
  frame.innerMatPad = innerMatPad;
  frame.innerFrameX = ifx;
  frame.innerFrameY = ify;
  frame.innerFrameW = ifw;
  frame.innerFrameH = ifh;

  if (frame.baseInnerMatPad == null) frame.baseInnerMatPad = innerMatPad;
  if (frame.baseInnerStroke == null) frame.baseInnerStroke = accentInset || GOWN_INNER_STROKE;
  if (frame.baseInnerFrameX == null || frame.baseInnerFrameX >= basePx) {
    frame.baseInnerFrameX = ifx;
  }
  if (frame.baseInnerFrameY == null || frame.baseInnerFrameY >= basePy) {
    frame.baseInnerFrameY = ify;
  }
  if (frame.baseInnerFrameW == null || frame.baseInnerFrameW <= baseDw) {
    frame.baseInnerFrameW = ifw;
  }
  if (frame.baseInnerFrameH == null || frame.baseInnerFrameH <= baseDh) {
    frame.baseInnerFrameH = ifh;
  }

  const omp =
    frame.outerMatPad ??
    frame.baseOuterMatPad ??
    Math.max(GOWN_OUTER_MAT_MIN, Math.round(Math.min(outerW, outerH) * GOWN_OUTER_MAT_RATIO));
  const border =
    frame.border ??
    frame.baseBorder ??
    Math.max(14, Math.round(Math.min(outerW, outerH) * GOWN_TEAL_RATIO));

  frame.outerMatPad = omp;
  frame.border = border;
  frame.whiteX = border;
  frame.whiteY = border;
  frame.whiteW = ifw + omp * 2;
  frame.whiteH = ifh + omp * 2;

  return frame;
}

export function drawGownFillMatBoard(ctx, frame, fillMatColor) {
  const { ifx, ify, ifw, ifh } = gownInnerBoardRect(frame);
  if (ifw <= 0 || ifh <= 0) return;
  ctx.fillStyle = fillMatColor;
  ctx.fillRect(ifx, ify, ifw, ifh);
}

/** Resolve gown mat colors with legacy fallbacks (padColor used when fillMatColor unset). */
export function resolveGownMatColors(frame) {
  const mat = frame?.matColor ?? "#ffffff";
  const pad = frame?.padColor ?? frame?.innerMatColor ?? mat;
  return {
    outerMatColor: frame?.outerMatColor ?? mat,
    fillMatColor: frame?.fillMatColor ?? pad,
    padColor: pad,
    fillMatEnabled: frame?.fillMatEnabled !== false,
  };
}

/** Teal border + white mat + optional fill mat board + photo pad ring (no photo). */
export function drawGownStaticFrameBackground(ctx, frame) {
  ensureGownDrawGeometry(frame);
  const outerW = frame.outerW || 0;
  const outerH = frame.outerH || 0;
  const border = frame.border ?? 0;
  const wx = frame.whiteX ?? border;
  const wy = frame.whiteY ?? border;
  const ww = frame.whiteW ?? outerW - border * 2;
  const wh = frame.whiteH ?? outerH - border * 2;
  const omp = frame.outerMatPad ?? 0;
  const ifx = frame.innerFrameX ?? wx + omp;
  const ify = frame.innerFrameY ?? wy + omp;
  const ifw = frame.innerFrameW ?? ww - omp * 2;
  const ifh = frame.innerFrameH ?? wh - omp * 2;
  const { outerMatColor, fillMatColor, padColor, fillMatEnabled } = resolveGownMatColors(frame);

  ctx.fillStyle = gownBorderFillStyle(ctx, frame, outerW, outerH);
  ctx.fillRect(0, 0, outerW, outerH);

  if (omp > 0 && ww > 0 && wh > 0) {
    ctx.fillStyle = outerMatColor;
    ctx.fillRect(wx, wy, ww, omp);
    ctx.fillRect(wx, wy + wh - omp, ww, omp);
    ctx.fillRect(wx, wy + omp, omp, wh - 2 * omp);
    ctx.fillRect(wx + ww - omp, wy + omp, omp, wh - 2 * omp);
  }

  if (fillMatEnabled && ifw > 0 && ifh > 0) {
    drawGownFillMatBoard(ctx, frame, fillMatColor);
  } else {
    drawGownPhotoPadRing(ctx, frame, padColor);
  }
}

/** Fixed lifestyle photo box — size stays at baseDw×baseDh; frame layers only move it. */
export function gownFixedPhotoRect(frame) {
  return productPhotoRect(frame);
}

/** Cover-fit into fixed photo rect; zoom scales inside clip without resizing the box. */
export function drawGownPhotoInFixedRect(ctx, productImg, frame) {
  drawProductPhotoCoverFit(ctx, productImg, frame);
}

/** Cover-fit lifestyle photo clipped to the fixed gown photo pad. */
export function drawGownProductInSlot(ctx, productImg, frame) {
  drawGownPhotoInFixedRect(ctx, productImg, frame);
}

/** Cover-fit source photo — accepts frame object or generation geometry. */
export function drawGownPhotoCoverFit(ctx, base, geom) {
  const frame =
    geom && (geom.baseDw != null || geom.basePx != null || geom.innerFrameW != null)
      ? geom
      : { px: geom.px, py: geom.py, baseDw: geom.dw, baseDh: geom.dh, dw: geom.dw, dh: geom.dh };
  drawGownPhotoInFixedRect(ctx, base, frame);
}

function buildGownStaticFrameCanvas(img) {
  const outerW = GOWN_STATIC_OUTER_W;
  const outerH = GOWN_STATIC_OUTER_H;
  const base = imageToCanvas(img, 1200);
  const geom = computeGownFrameGeometry(outerW, outerH);

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");

  drawGownStaticFrameBackground(ctx, {
    ...geom,
    borderColor: BORDER_TEAL,
    matColor: "#ffffff",
    fillMatColor: "#ffffff",
    fillMatEnabled: true,
    padColor: "#ffffff",
    innerStroke: GOWN_INNER_STROKE,
    innerStrokeColor: GOWN_INNER_STROKE_COLOR,
  });
  drawGownPhotoCoverFit(ctx, base, geom);

  return {
    canvas,
    ...geom,
    source: base,
  };
}

function gownStaticPlacements(px, py, dw, dh) {
  const ref = Math.min(dw, dh);
  const bestW = Math.round(ref * 0.36);
  const bestH = Math.round(bestW * 0.7);
  const flashW = Math.round(ref * 0.32);
  const flashH = Math.round(flashW * 0.4);
  const popW = Math.round(ref * 0.42);
  const popH = Math.round(popW * 0.26);
  const inset = Math.max(2, Math.round(ref * 0.015));

  return [
    {
      id: "gown-best",
      label: "Best PRICE",
      anchor: "top-left",
      kind: "gownArt",
      gownSlot: "gown-best",
      w: bestW,
      h: bestH,
      x: px + inset,
      y: py + inset,
      drawn: false,
    },
    {
      id: "gown-flash",
      label: "FLASH SALE",
      anchor: "top-right",
      kind: "gownArt",
      gownSlot: "gown-flash",
      w: flashW,
      h: flashH,
      x: px + dw - flashW - inset,
      y: py + Math.round(dh * 0.03),
      drawn: false,
    },
    {
      id: "gown-popular",
      label: "MOST POPULAR",
      anchor: "middle-left",
      kind: "gownArt",
      gownSlot: "gown-popular",
      w: popW,
      h: popH,
      x: px - Math.round(popW * 0.08),
      y: py + Math.round(dh * 0.48) - Math.round(popH / 2),
      drawn: false,
    },
  ];
}

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      copy.drawn = await drawGownBadge(ctx, null, p);
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

async function buildGownStaticLayers(img) {
  const built = buildGownStaticFrameCanvas(img);
  const {
    canvas,
    px,
    py,
    dw,
    dh,
    border,
    whitePad,
    outerMatPad,
    innerMatPad,
    innerStroke,
    innerStrokeColor,
    innerFrameX,
    innerFrameY,
    innerFrameW,
    innerFrameH,
    whiteX,
    whiteY,
    whiteW,
    whiteH,
    source,
    outerW,
    outerH,
  } = built;
  const placements = gownStaticPlacements(px, py, dw, dh);

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
  // Crop pre-badge frame (like tall_static uses trimmed, not post-sticker canvas).
  productOnlyCanvas
    .getContext("2d")
    .drawImage(noStickersCanvas, px, py, dw, dh, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  const noBorderCanvas = document.createElement("canvas");
  noBorderCanvas.width = dw;
  noBorderCanvas.height = dh;
  const nbCtx = noBorderCanvas.getContext("2d");
  nbCtx.drawImage(noStickersCanvas, px, py, dw, dh, 0, 0, dw, dh);
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
      _gownPhotoSource: dataUrlFromCanvas(source),
      _stickersRendered: badgePlacements.some((p) => p.drawn),
      _badgePlacements: badgePlacements,
      _staticFrame: {
        style: "gown_static",
        frameType: "tall",
        borderColor: BORDER_TEAL,
        matColor: "#ffffff",
        outerMatColor: "#ffffff",
        fillMatColor: "#ffffff",
        fillMatEnabled: true,
        padColor: "#ffffff",
        innerStrokeColor: GOWN_INNER_STROKE_COLOR,
        gradientTop: BORDER_TEAL,
        gradientBottom: BORDER_TEAL_DARK,
        gradientPreset: null,
        px,
        py,
        dw,
        dh,
        border,
        whitePad,
        outerMatPad,
        innerMatPad,
        innerFrameX,
        innerFrameY,
        innerFrameW,
        innerFrameH,
        innerStroke,
        baseBorder: border,
        baseOuterMatPad: outerMatPad,
        baseInnerMatPad: innerMatPad,
        baseInnerStroke: innerStroke,
        baseWhitePad: whitePad,
        basePx: px,
        basePy: py,
        baseDw: dw,
        baseDh: dh,
        baseWhiteX: whiteX,
        baseWhiteY: whiteY,
        baseWhiteW: whiteW,
        baseWhiteH: whiteH,
        baseInnerFrameX: innerFrameX,
        baseInnerFrameY: innerFrameY,
        baseInnerFrameW: innerFrameW,
        baseInnerFrameH: innerFrameH,
        borderThicknessPct: 100,
        borderThicknessLocked: true,
        gownLayerPct: {
          border: 100,
          outerMat: 100,
          innerAccent: 100,
          innerMat: 100,
        },
        photoZoomPct: GOWN_PHOTO_ZOOM_DEFAULT,
        photoZoomLocked: true,
        photoPanH: 50,
        photoPanV: 50,
        photoPanHLocked: true,
        photoPanVLocked: true,
        photoMarginTop: 0,
        photoMarginRight: 0,
        photoMarginBottom: 0,
        photoMarginLeft: 0,
        photoMarginTopLocked: true,
        photoMarginRightLocked: true,
        photoMarginBottomLocked: true,
        photoMarginLeftLocked: true,
        gownFrameLayersLocked: true,
        outerW,
        outerH,
        whiteX,
        whiteY,
        whiteW,
        whiteH,
      },
    },
    meta: {
      style: "gown_static",
      showcasePreset: "gown-teal-promo",
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

export async function buildGownStaticVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = GOWN_STATIC_VARIANT_COUNT,
  } = options;

  onProgress("Building gown promo frames…");

  const { canvas: sourceCanvas, layers, meta } = await buildGownStaticLayers(img);
  const kbTiers = gownStaticKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Gown promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const { blob, canvas: outCanvas } = await compressGownVariant(sourceCanvas, kb);
    const dataUrl = await blobToDataUrl(blob);
    const v = {
      blob,
      dataUrl,
      bytes: blob.size,
      width: outCanvas.width,
      height: outCanvas.height,
      path: "gown_static",
      mode: "Gown Promo",
      label: `Gown Promo · ${outCanvas.width}×${outCanvas.height} · ${kb}KB`,
      recommended: kb === 44 || kb === 46 || kb === 48,
      lowest: i === 0,
      layers,
      meta: { ...meta, targetKb: kb, outerW: outCanvas.width, outerH: outCanvas.height },
    };
    v.kb = Math.ceil(blob.size / 1024);
    v.estInr = estimateImageShipping(v);
    variants.push(v);
    await new Promise((r) => setTimeout(r, 0));
  }

  return variants;
}
