/**
 * Web-only lifestyle promo frames — competitor-style solid green border @ 48–54 KB.
 * Keeps original scene (no white flatten); isolated from tall ₹50 and showcase paths.
 */
import { imageToCanvas } from "./lib/canvas-utils.js?v=97";
import { estimateImageShipping } from "./lib/shipping.js?v=59";

/** HOT SALE, FLASH SALE — match competitor listing stickers. */
export const PROMO_LIFESTYLE_BADGES = {
  hotSale: 19,
  flashSale: 22,
};

/** Outer cap tuned so lifestyle JPEGs land in Meesho ₹48–54 band. */
export const PROMO_LIFESTYLE_MAX_W = 560;
export const PROMO_LIFESTYLE_MAX_H = 747;
export const PROMO_LIFESTYLE_BORDER_RATIO = 0.05;
export const PROMO_LIFESTYLE_VARIANT_COUNT = 25;

const BORDER_COLOR = "#32d74b";

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

async function preloadPromoBadges() {
  if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
    await MeeshoAPI.preloadBadges();
    return;
  }
  await Promise.all(
    Object.values(PROMO_LIFESTYLE_BADGES).map((n) => loadBadge(n)),
  );
}

function promoKbTiers(count = PROMO_LIFESTYLE_VARIANT_COUNT) {
  const n = Math.max(20, Math.min(30, count));
  const start = 48;
  const end = 54;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    tiers.push(Math.round(start + ((end - start) * i) / Math.max(1, n - 1)));
  }
  return tiers;
}

/**
 * Solid neon-green border around full lifestyle photo — no crop / white mat.
 */
function buildPromoLifestyleCanvas(img) {
  const base = imageToCanvas(img, 800);
  let dw = base.width;
  let dh = base.height;

  let border = Math.max(16, Math.round(Math.min(dw, dh) * PROMO_LIFESTYLE_BORDER_RATIO));
  let outerW = dw + border * 2;
  let outerH = dh + border * 2;

  const fitScale = Math.min(
    PROMO_LIFESTYLE_MAX_W / outerW,
    PROMO_LIFESTYLE_MAX_H / outerH,
    1,
  );
  if (fitScale < 1) {
    dw = Math.round(dw * fitScale);
    dh = Math.round(dh * fitScale);
    border = Math.max(14, Math.round(border * fitScale));
    outerW = dw + border * 2;
    outerH = dh + border * 2;
  }

  const px = border;
  const py = border;

  const canvas = document.createElement("canvas");
  canvas.width = outerW;
  canvas.height = outerH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BORDER_COLOR;
  ctx.fillRect(0, 0, outerW, outerH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(base, 0, 0, base.width, base.height, px, py, dw, dh);

  return { canvas, px, py, dw, dh, border, base, outerW, outerH };
}

/**
 * Reference layout (image 3): badges on the photo.
 * HOT SALE top-right · FLASH SALE left waist · FREE SHIPPING bottom-center-left on kurti.
 */
function promoPlacements(px, py, dw, dh) {
  const ref = Math.min(dw, dh);
  const hotSize = Math.round(ref * 0.21);
  const flashW = Math.round(ref * 0.26);
  const flashH = Math.round(flashW * 0.75);
  const shipSize = Math.round(ref * 0.19);

  return [
    {
      id: "lifestyle-hot",
      label: "HOT SALE",
      anchor: "top-right",
      kind: "badge",
      num: PROMO_LIFESTYLE_BADGES.hotSale,
      w: hotSize,
      h: hotSize,
      x: px + dw - hotSize - Math.round(dw * 0.01),
      y: py + Math.round(dh * 0.02),
      drawn: false,
    },
    {
      id: "lifestyle-flash",
      label: "FLASH SALE",
      anchor: "middle-left",
      kind: "badge",
      num: PROMO_LIFESTYLE_BADGES.flashSale,
      w: flashW,
      h: flashH,
      x: px - Math.round(flashW * 0.08),
      y: py + Math.round(dh * 0.45) - Math.round(flashH / 2),
      drawn: false,
    },
    {
      id: "lifestyle-ship",
      label: "FREE SHIPPING",
      anchor: "bottom-center",
      kind: "freeShipping",
      _freeShippingSlot: true,
      size: shipSize,
      x: px + Math.round(dw * 0.34) - Math.round(shipSize / 2),
      y: py + Math.round(dh * 0.7) - Math.round(shipSize / 2),
      drawn: false,
    },
  ];
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

/** Red circular FREE SHIPPING + truck — matches reference frame 3. */
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

async function drawPlacements(ctx, placements) {
  const out = [];
  for (const p of placements) {
    const copy = { ...p };
    try {
      if (p.kind === "freeShipping") {
        drawFreeShippingCircle(ctx, p.x, p.y, p.size);
        copy.drawn = true;
      } else if (p.kind === "badge") {
        const badge = await loadBadge(p.num);
        if (badge) {
          ctx.drawImage(badge, p.x, p.y, p.w, p.h);
          copy.drawn = true;
        }
      }
    } catch (e) {}
    out.push(copy);
  }
  return out;
}

function dataUrlFromCanvas(canvas, quality = 0.76) {
  return canvas.toDataURL("image/jpeg", quality);
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

function encodePromoJpeg(canvas, quality) {
  const q = Math.max(14, Math.min(92, quality)) / 100;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q);
  });
}

/** Promo-only encoder — shrinks canvas until bytes ≤ target (real ₹48–54 band). */
async function compressPromoToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let work = canvas;
  let bestBlob = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    let lo = 14;
    let hi = 92;
    let passBest = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodePromoJpeg(work, mid);
      if (blob.size <= targetBytes) {
        passBest = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (passBest) return { blob: passBest, canvas: work };
    bestBlob = passBest || (await encodePromoJpeg(work, 14));
    if (bestBlob.size <= targetBytes) return { blob: bestBlob, canvas: work };
    if (work.width <= 260) break;
    work = scaleCanvas(work, 0.88);
  }

  return { blob: bestBlob || (await encodePromoJpeg(work, 14)), canvas: work };
}

async function buildPromoLayers(img) {
  const built = buildPromoLifestyleCanvas(img);
  const { canvas, px, py, dw, dh, border, base, outerW, outerH } = built;
  const placements = promoPlacements(px, py, dw, dh);

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
    .drawImage(base, 0, 0, base.width, base.height, 0, 0, dw, dh);
  const productOnly = dataUrlFromCanvas(productOnlyCanvas);

  return {
    canvas,
    layers: {
      full,
      noStickers,
      noBorder: productOnly,
      productOnly,
      _stickersRendered: badgePlacements.some((p) => p.drawn),
      _badgePlacements: badgePlacements,
      _staticFrame: {
        style: "lifestyle_promo",
        frameType: "solid",
        borderColor: BORDER_COLOR,
        gradientTop: BORDER_COLOR,
        gradientBottom: "#1b9e34",
        gradientPreset: null,
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
      style: "lifestyle_promo",
      showcasePreset: "lifestyle-green-promo",
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
 * Generate lifestyle promo variants (48–54 KB) — competitor ₹54 band.
 */
export async function buildPromoLifestyleVariants(img, options = {}) {
  const {
    onProgress = () => {},
    count = PROMO_LIFESTYLE_VARIANT_COUNT,
  } = options;

  await preloadPromoBadges();
  onProgress("Building lifestyle promo frames…");

  const { canvas: sourceCanvas, layers, meta } = await buildPromoLayers(img);
  const kbTiers = promoKbTiers(count);
  const variants = [];

  for (let i = 0; i < kbTiers.length; i++) {
    const kb = kbTiers[i];
    onProgress(`Lifestyle promo · ${kb}KB (${i + 1}/${kbTiers.length})`);
    const { blob, canvas: outCanvas } = await compressPromoToKb(sourceCanvas, kb);
    const v = {
      blob,
      bytes: blob.size,
      width: outCanvas.width,
      height: outCanvas.height,
      path: "lifestyle_promo",
      mode: "Lifestyle Promo",
      label: `Lifestyle Promo · ${outCanvas.width}×${outCanvas.height} · ${kb}KB`,
      recommended: kb === 50 || kb === 52,
      lowest: i === 0,
      layers,
      meta: {
        ...meta,
        targetKb: kb,
        outerW: outCanvas.width,
        outerH: outCanvas.height,
        canvasW: outCanvas.width,
        canvasH: outCanvas.height,
      },
    };
    v.kb = Math.ceil(blob.size / 1024);
    v.estInr = estimateImageShipping(v);
    variants.push(v);
    await new Promise((r) => setTimeout(r, 0));
  }

  return variants;
}
