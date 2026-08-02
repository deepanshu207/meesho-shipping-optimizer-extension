/**
 * Browser JPEG encoder — canvas fallback (no mozjpeg dependency).
 * Used only by Test Lab; Live mode does not import this module.
 */

export async function encodeStudio(canvas, quality, minQ = 18) {
  const q = Math.max(minQ, Math.min(92, Math.round(quality))) / 100;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q);
  });
}

export async function encodeFramed(canvas, quality, minQ = 28) {
  const q = Math.max(minQ, Math.min(98, Math.round(quality))) / 100;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q);
  });
}

export async function compressStudioToKb(canvas, targetKb, whiteRatio = 0.7) {
  const targetBytes = targetKb * 1024;
  const minQ = whiteRatio >= 0.72 ? 18 : whiteRatio >= 0.55 ? 22 : 26;
  let lo = minQ;
  let hi = 92;
  let best = await encodeStudio(canvas, minQ, minQ);
  if (best.size <= targetBytes) {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodeStudio(canvas, mid, minQ);
      if (blob.size <= targetBytes) {
        best = blob;
        lo = mid;
      } else hi = mid;
    }
    const top = await encodeStudio(canvas, lo, minQ);
    if (top.size <= targetBytes) return top;
  }
  for (let q = minQ - 1; q >= 14 && best.size > targetBytes; q--) {
    const blob = await encodeStudio(canvas, q, 14);
    if (blob.size <= targetBytes) return blob;
    if (blob.size < best.size) best = blob;
  }
  return best;
}

export async function compressFramedToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let lo = 28;
  let hi = 98;
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const blob = await encodeFramed(canvas, mid);
    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best) return best;
  return encodeFramed(canvas, 28);
}

function scaleCanvasForGown(src, scale) {
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

/** Gown 773×1094 — quality + downscale loop (matches liveGownStatic generation). */
export async function compressGownToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let work = canvas;
  let bestBlob = null;

  for (let attempt = 0; attempt < 14; attempt++) {
    let lo = 14;
    let hi = 92;
    let passBest = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodeFramed(work, mid, 14);
      if (blob.size <= targetBytes) {
        passBest = blob;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (passBest) return passBest;
    bestBlob = passBest || (await encodeFramed(work, 14, 14));
    if (bestBlob.size <= targetBytes) return bestBlob;
    if (work.width <= 240) break;
    work = scaleCanvasForGown(work, 0.88);
  }

  return bestBlob || (await encodeFramed(work, 14, 14));
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
