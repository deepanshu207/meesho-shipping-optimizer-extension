/**
 * Gown promo badges — Best PRICE, FLASH SALE, MOST POPULAR (reference layout).
 */
import { drawBadgeOnWhite } from "./tallStaticBadges.mjs?v=87";

function drawLightning(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.55, y);
  ctx.lineTo(x + w * 0.2, y + h * 0.55);
  ctx.lineTo(x + w * 0.48, y + h * 0.55);
  ctx.lineTo(x + w * 0.35, y + h);
  ctx.lineTo(x + w * 0.85, y + h * 0.38);
  ctx.lineTo(x + w * 0.52, y + h * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGownBestPrice(ctx, x, y, w, h) {
  ctx.save();
  const cx = x + w * 0.2;
  const cy = y + h * 0.2;
  ctx.translate(cx, cy);
  ctx.rotate(-0.1);
  ctx.translate(-cx, -cy);

  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = Math.max(2, w * 0.05);
  ctx.shadowOffsetY = Math.max(1, h * 0.04);

  const bestFs = Math.max(10, Math.round(h * 0.24));
  ctx.font = `italic bold ${bestFs}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(1.5, bestFs * 0.14);
  ctx.strokeStyle = "#c62828";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText("Best", x, y);
  ctx.fillText("Best", x, y);

  const priceFs = Math.max(12, Math.round(h * 0.36));
  ctx.font = `900 ${priceFs}px Impact, "Arial Black", sans-serif`;
  const priceY = y + bestFs * 0.82;
  ctx.lineWidth = Math.max(2, priceFs * 0.12);
  ctx.strokeStyle = "#c62828";
  ctx.fillStyle = "#ffeb3b";
  ctx.strokeText("PRICE", x, priceY);
  ctx.fillText("PRICE", x, priceY);
  ctx.restore();
}

export function drawGownFlashSale(ctx, x, y, w, h) {
  ctx.save();
  const pad = Math.max(2, w * 0.04);
  const r = Math.max(3, h * 0.12);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = "#ffeb3b";
  ctx.fill();
  ctx.strokeStyle = "#f9a825";
  ctx.lineWidth = Math.max(1, h * 0.04);
  ctx.stroke();

  const boltW = w * 0.18;
  drawLightning(ctx, x + pad, y + pad, boltW, h - pad * 2);

  const fs = Math.max(7, Math.round(h * 0.28));
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = "#c62828";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FLASH", x + pad + boltW + pad * 0.5, y + h * 0.38);
  ctx.fillText("SALE", x + pad + boltW + pad * 0.5, y + h * 0.68);
  ctx.restore();
}

function drawThumbsUp(ctx, cx, cy, size) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.rect(cx - size * 0.22, cy - size * 0.28, size * 0.28, size * 0.22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.02, cy - size * 0.32);
  ctx.lineTo(cx + size * 0.02, cy + size * 0.22);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.22);
  ctx.lineTo(cx + size * 0.22, cy - size * 0.12);
  ctx.lineTo(cx + size * 0.12, cy - size * 0.12);
  ctx.lineTo(cx + size * 0.12, cy - size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGownMostPopular(ctx, x, y, w, h) {
  ctx.save();
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = "#e53935";
  ctx.fill();

  drawThumbsUp(ctx, x + h * 0.42, y + h / 2, h * 0.55);

  const fs = Math.max(6, Math.round(h * 0.22));
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("MOST", x + h * 0.72, y + h * 0.38);
  ctx.fillText("POPULAR", x + h * 0.72, y + h * 0.64);
  ctx.restore();
}

export async function drawGownBadge(ctx, loadBadge, p) {
  if (!p) return false;
  const w = p.w || p.size;
  const h = p.h || p.size;
  if (!w || !h) return false;

  if (p.kind === "badge" && p.num != null && loadBadge) {
    try {
      const badge = await loadBadge(p.num);
      if (badge) {
        if (p.num === 3) {
          ctx.drawImage(badge, p.x, p.y, w, h);
        } else {
          drawBadgeOnWhite(ctx, badge, p.x, p.y, w, h);
        }
        return true;
      }
    } catch (e) {}
  }

  const slot = p.id || p.gownSlot || "";
  if (slot === "gown-best" || slot === "gown-best-price") {
    drawGownBestPrice(ctx, p.x, p.y, w, h);
    return true;
  }
  if (slot === "gown-flash") {
    drawGownFlashSale(ctx, p.x, p.y, w, h);
    return true;
  }
  if (slot === "gown-popular") {
    drawGownMostPopular(ctx, p.x, p.y, w, h);
    return true;
  }
  return false;
}
