/** Cover-fit lifestyle photo in a fixed rect with optional zoom, pan, and per-side margins. */

export const PHOTO_ZOOM_DEFAULT = 100;
export const PHOTO_ZOOM_MIN = 50;
export const PHOTO_ZOOM_MAX = 200;
export const PHOTO_MARGIN_MAX = 200;
export const PHOTO_MIN_SIZE = 48;

const PHOTO_MARGIN_SIDES = ["top", "right", "bottom", "left"];

export function clampPhotoZoom(pct) {
  return Math.max(PHOTO_ZOOM_MIN, Math.min(PHOTO_ZOOM_MAX, pct ?? PHOTO_ZOOM_DEFAULT));
}

export function photoMarginField(side) {
  return `photoMargin${side.charAt(0).toUpperCase()}${side.slice(1)}`;
}

export function photoMarginLockField(side) {
  return `${photoMarginField(side)}Locked`;
}

export function effectivePhotoMargins(frame) {
  return {
    top: Math.max(0, frame?.photoMarginTop ?? 0),
    right: Math.max(0, frame?.photoMarginRight ?? 0),
    bottom: Math.max(0, frame?.photoMarginBottom ?? 0),
    left: Math.max(0, frame?.photoMarginLeft ?? 0),
  };
}

export function hasPhotoMarginGaps(frame) {
  const m = effectivePhotoMargins(frame);
  return m.top > 0 || m.right > 0 || m.bottom > 0 || m.left > 0;
}

/** Color for margin fill bands (explicit color, else mat / fill mat). */
export function resolvePhotoMarginFillColor(frame) {
  if (!frame) return "#ffffff";
  if (frame.photoMarginFillColor) return frame.photoMarginFillColor;
  if (frame.style === "gown_static") {
    if (frame.fillMatEnabled !== false && frame.fillMatColor) return frame.fillMatColor;
    return frame.padColor ?? frame.matColor ?? "#ffffff";
  }
  return frame.matColor ?? "#ffffff";
}

/** Paint per-side photo margin bands inside the base photo slot. */
export function drawPhotoMarginFills(ctx, frame) {
  if (!ctx || !frame || frame.photoMarginFillEnabled === false) return;
  const m = effectivePhotoMargins(frame);
  if (!m.top && !m.right && !m.bottom && !m.left) return;

  const baseX = frame.basePx ?? frame.px ?? 0;
  const baseY = frame.basePy ?? frame.py ?? 0;
  const baseW = frame.baseDw ?? frame.dw ?? 0;
  const baseH = frame.baseDh ?? frame.dh ?? 0;
  if (!baseW || !baseH) return;

  const fill = resolvePhotoMarginFillColor(frame);
  ctx.fillStyle = fill;
  if (m.top > 0) ctx.fillRect(baseX, baseY, baseW, m.top);
  if (m.bottom > 0) ctx.fillRect(baseX, baseY + baseH - m.bottom, baseW, m.bottom);
  if (m.left > 0) {
    ctx.fillRect(baseX, baseY + m.top, m.left, baseH - m.top - m.bottom);
  }
  if (m.right > 0) {
    ctx.fillRect(
      baseX + baseW - m.right,
      baseY + m.top,
      m.right,
      baseH - m.top - m.bottom,
    );
  }
}

export function maxPhotoMarginSide(frame, side) {
  const baseW = frame?.baseDw ?? frame?.dw ?? 0;
  const baseH = frame?.baseDh ?? frame?.dh ?? 0;
  const m = effectivePhotoMargins(frame);
  let max = PHOTO_MARGIN_MAX;
  if (side === "top") max = Math.min(max, Math.max(0, baseH - PHOTO_MIN_SIZE - m.bottom));
  else if (side === "bottom") max = Math.min(max, Math.max(0, baseH - PHOTO_MIN_SIZE - m.top));
  else if (side === "left") max = Math.min(max, Math.max(0, baseW - PHOTO_MIN_SIZE - m.right));
  else if (side === "right") max = Math.min(max, Math.max(0, baseW - PHOTO_MIN_SIZE - m.left));
  return max;
}

export function clampPhotoMarginSide(frame, side, value) {
  return Math.max(0, Math.min(maxPhotoMarginSide(frame, side), Math.round(value ?? 0)));
}

export function normalizePhotoMargins(frame) {
  if (!frame) return frame;
  for (const side of PHOTO_MARGIN_SIDES) {
    frame[photoMarginField(side)] = clampPhotoMarginSide(frame, side, frame[photoMarginField(side)]);
  }
  return frame;
}

/** Base photo slot inset by per-side margins (frame bands stay on base geometry). */
export function productPhotoRect(frame) {
  const baseX = frame?.basePx ?? frame?.px ?? 0;
  const baseY = frame?.basePy ?? frame?.py ?? 0;
  const baseW = frame?.baseDw ?? frame?.dw ?? 0;
  const baseH = frame?.baseDh ?? frame?.dh ?? 0;
  const m = effectivePhotoMargins(frame);
  const w = Math.max(1, baseW - m.left - m.right);
  const h = Math.max(1, baseH - m.top - m.bottom);
  return {
    x: baseX + m.left,
    y: baseY + m.top,
    w,
    h,
  };
}

/** Cover-fit draw rect: zooms from center; pan 50 = centered in each axis. */
export function computeProductPhotoDrawRect(productImg, frame) {
  const { x, y, w, h } = productPhotoRect(frame);
  if (w <= 0 || h <= 0 || !productImg?.width) return null;

  const zoom = clampPhotoZoom(frame?.photoZoomPct) / 100;
  const fitScale = Math.max(w / productImg.width, h / productImg.height) * zoom;
  const sw = Math.round(productImg.width * fitScale);
  const sh = Math.round(productImg.height * fitScale);
  const panH = Math.max(0, Math.min(100, frame?.photoPanH ?? 50));
  const panV = Math.max(0, Math.min(100, frame?.photoPanV ?? 50));

  let imgX;
  if (sw >= w) {
    const maxPanX = sw - w;
    imgX = x - Math.round(maxPanX * (panH / 100));
  } else {
    const slackX = w - sw;
    imgX = x + Math.round(slackX * (panH / 100));
  }

  let imgY;
  if (sh >= h) {
    const maxPanY = sh - h;
    imgY = y - Math.round(maxPanY * (panV / 100));
  } else {
    const slackY = h - sh;
    imgY = y + Math.round(slackY * (panV / 100));
  }

  return { x, y, w, h, imgX, imgY, sw, sh };
}

/** Anchor rect + uniform scale for photo-linked stickers (100% zoom = scale 1). */
export function photoContentLayout(frame) {
  const slot = productPhotoRect(frame);
  const fallback = { anchor: slot, scale: 1 };
  if (!frame) return fallback;
  const iw = frame.baseDw ?? frame.dw ?? slot.w;
  const ih = frame.baseDh ?? frame.dh ?? slot.h;
  if (!iw || !ih || !slot.w || !slot.h) return fallback;
  const rect = computeProductPhotoDrawRect({ width: iw, height: ih }, frame);
  if (!rect) return fallback;
  const zoom = clampPhotoZoom(frame.photoZoomPct) / 100;
  if (rect.sw >= rect.w && rect.sh >= rect.h) {
    return { anchor: slot, scale: zoom };
  }
  const scale = Math.min(rect.sw / rect.w, rect.sh / rect.h);
  return {
    anchor: { x: rect.imgX, y: rect.imgY, w: rect.sw, h: rect.sh },
    scale,
  };
}

/** Visible lifestyle photo bounds for sticker anchoring. */
export function photoAnchorRect(frame) {
  return photoContentLayout(frame).anchor;
}

/** Uniform shrink of photo slot vs base geometry (margins inset the slot). */
export function photoSlotScale(frame) {
  const baseW = frame?.baseDw ?? frame?.dw ?? 0;
  const baseH = frame?.baseDh ?? frame?.dh ?? 0;
  if (!baseW || !baseH) return 1;
  const slot = productPhotoRect(frame);
  return Math.min(slot.w / baseW, slot.h / baseH);
}

/** Scale stickers with zoom: below 100% shrinks, above 100% grows, 100% = 1. */
export function photoStickerScale(frame) {
  const layout = photoContentLayout(frame);
  const slotScale = photoSlotScale(frame);
  return layout.scale * slotScale;
}

export function drawProductPhotoCoverFit(ctx, productImg, frame) {
  const rect = computeProductPhotoDrawRect(productImg, frame);
  if (!rect) return;
  const { x, y, w, h, imgX, imgY, sw, sh } = rect;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(productImg, 0, 0, productImg.width, productImg.height, imgX, imgY, sw, sh);
  ctx.restore();
}

export function frameHasProductSlot(frame) {
  const baseW = frame?.baseDw ?? frame?.dw ?? 0;
  const baseH = frame?.baseDh ?? frame?.dh ?? 0;
  return baseW > 0 && baseH > 0;
}

function ensurePhotoMarginDefaults(frame) {
  for (const side of PHOTO_MARGIN_SIDES) {
    const field = photoMarginField(side);
    const lockField = photoMarginLockField(side);
    if (frame[field] == null) frame[field] = 0;
    if (frame[lockField] == null) frame[lockField] = true;
  }
  normalizePhotoMargins(frame);
}

/** Default locked photo zoom/pan/margins on any frame with a product slot. */
export function ensureFramePhotoDefaults(frame) {
  if (!frameHasProductSlot(frame)) return frame;
  if (frame.photoZoomPct == null) frame.photoZoomPct = PHOTO_ZOOM_DEFAULT;
  if (frame.photoPanH == null) frame.photoPanH = 50;
  if (frame.photoPanV == null) frame.photoPanV = 50;
  if (frame.photoZoomLocked == null) frame.photoZoomLocked = true;
  if (frame.photoPanHLocked == null) frame.photoPanHLocked = true;
  if (frame.photoPanVLocked == null) frame.photoPanVLocked = true;
  ensurePhotoMarginDefaults(frame);
  if (frame.photoMarginFillEnabled == null) frame.photoMarginFillEnabled = true;
  return frame;
}

export function snapshotPhotoControls(frame) {
  ensureFramePhotoDefaults(frame);
  return {
    photoZoomPct: frame.photoZoomPct ?? PHOTO_ZOOM_DEFAULT,
    photoZoomLocked: frame.photoZoomLocked !== false,
    photoPanH: frame.photoPanH ?? 50,
    photoPanV: frame.photoPanV ?? 50,
    photoPanHLocked: frame.photoPanHLocked !== false,
    photoPanVLocked: frame.photoPanVLocked !== false,
    photoMarginTop: frame.photoMarginTop ?? 0,
    photoMarginRight: frame.photoMarginRight ?? 0,
    photoMarginBottom: frame.photoMarginBottom ?? 0,
    photoMarginLeft: frame.photoMarginLeft ?? 0,
    photoMarginTopLocked: frame.photoMarginTopLocked !== false,
    photoMarginRightLocked: frame.photoMarginRightLocked !== false,
    photoMarginBottomLocked: frame.photoMarginBottomLocked !== false,
    photoMarginLeftLocked: frame.photoMarginLeftLocked !== false,
    photoMarginFillEnabled: frame.photoMarginFillEnabled !== false,
    photoMarginFillColor: frame.photoMarginFillColor ?? null,
  };
}
