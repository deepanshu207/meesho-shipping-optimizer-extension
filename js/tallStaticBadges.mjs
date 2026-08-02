/**
 * Tall promo badge helpers — hunt-exact slots + black-bg PNG compositing.
 */

/** Strip near-pure-black pixels (keeps red seal, gray arrow, dark truck). */
export function drawBadgeOnWhite(ctx, img, x, y, w, h) {
  const tw = Math.max(1, Math.round(w));
  const th = Math.max(1, Math.round(h));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const tc = tmp.getContext("2d");
  tc.drawImage(img, 0, 0, tw, th);
  try {
    const id = tc.getImageData(0, 0, tw, th);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] <= 18 && d[i + 1] <= 18 && d[i + 2] <= 18) d[i + 3] = 0;
    }
    tc.putImageData(id, 0, 0);
    ctx.drawImage(tmp, x, y);
  } catch (e) {
    ctx.drawImage(img, x, y, tw, th);
  }
}

export function drawCurvedArrow(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.4, w * 0.028);
  ctx.lineCap = "round";
  const x0 = x + w * 0.9;
  const y0 = y + h * 0.1;
  const x1 = x + w * 0.18;
  const y1 = y + h * 0.7;
  const cx = x + w * 0.72;
  const cy = y + h * 0.4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  const angle = Math.atan2(y1 - cy, x1 - cx);
  const ah = Math.max(4, w * 0.11);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ah * Math.cos(angle - 0.55), y1 - ah * Math.sin(angle - 0.55));
  ctx.lineTo(x1 - ah * Math.cos(angle + 0.55), y1 - ah * Math.sin(angle + 0.55));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPriceTag(ctx, x, y, size) {
  const cx = x + size * 0.5;
  const cy = y + size * 0.58;
  const r = size * 0.32;
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, y + size * 0.02);
  ctx.lineTo(cx, cy - r - size * 0.02);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const scallop = r + (i % 2 === 0 ? r * 0.1 : 0);
    const px = cx + Math.cos(a) * scallop;
    const py = cy + Math.sin(a) * scallop;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.stroke();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.stroke();
  ctx.restore();
}

export function drawDeliveryTruck(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.lineWidth = Math.max(1.2, size * 0.04);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const ly = y + size * (0.38 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.04, ly);
    ctx.lineTo(x + size * (0.22 - i * 0.04), ly);
    ctx.stroke();
  }
  const bx = x + size * 0.22;
  const by = y + size * 0.34;
  const bw = size * 0.68;
  const bh = size * 0.36;
  ctx.fillRect(bx, by + bh * 0.42, bw * 0.5, bh * 0.46);
  ctx.fillRect(bx + bw * 0.46, by + bh * 0.52, bw * 0.46, bh * 0.36);
  ctx.fillRect(bx + bw * 0.48, by + bh * 0.08, bw * 0.2, bh * 0.4);
  const wr = bh * 0.11;
  ctx.beginPath();
  ctx.arc(bx + bw * 0.16, by + bh * 0.94, wr, 0, Math.PI * 2);
  ctx.arc(bx + bw * 0.72, by + bh * 0.94, wr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw one tall badge — badge3 direct, badge1/2 strip black bg. */
export async function drawTallBadge(ctx, loadBadge, p) {
  if (!p) return false;
  const w = p.w || p.size;
  const h = p.h || p.size;

  if (p.num != null && loadBadge) {
    const badge = await loadBadge(p.num);
    if (badge) {
      if (p.num === 3) {
        ctx.drawImage(badge, p.x, p.y, w, h);
      } else {
        drawBadgeOnWhite(ctx, badge, p.x, p.y, w, h);
      }
      return true;
    }
  }

  if (p.id === "tall-sale" || p.num === 3) {
    drawPriceTag(ctx, p.x, p.y, w);
    return true;
  }
  if (p.id === "tall-arrow" || p.num === 2) {
    drawCurvedArrow(ctx, p.x, p.y, w, h);
    return true;
  }
  if (p.id === "tall-ship" || p.num === 1) {
    drawDeliveryTruck(ctx, p.x, p.y, w);
    return true;
  }
  return false;
}
