/**
 * Meesho shipping slab calculator + image-based ₹ estimation.
 * Weight slabs are approximate — always verify in Meesho Supplier panel.
 */

export const WEIGHT_SLABS = [
  { maxGrams: 500, forward: 40, label: "0–500g" },
  { maxGrams: 1000, forward: 55, label: "500g–1kg" },
  { maxGrams: 1500, forward: 70, label: "1–1.5kg" },
  { maxGrams: 2000, forward: 85, label: "1.5–2kg" },
  { maxGrams: 3000, forward: 110, label: "2–3kg" },
  { maxGrams: 5000, forward: 140, label: "3–5kg" },
  { maxGrams: Infinity, forward: 180, label: "5kg+" },
];

export function volumetricGrams(lengthCm, breadthCm, heightCm, divisor = 5000) {
  return Math.ceil((lengthCm * breadthCm * heightCm * 1000) / divisor);
}

export function chargeableGrams(deadGrams, lengthCm, breadthCm, heightCm, divisor = 5000) {
  const vol = Math.ceil((lengthCm * breadthCm * heightCm * 1000) / divisor);
  return Math.max(deadGrams, vol);
}

export function slabForGrams(grams) {
  for (const s of WEIGHT_SLABS) {
    if (grams <= s.maxGrams) return s;
  }
  return WEIGHT_SLABS[WEIGHT_SLABS.length - 1];
}

export function nextCheaperSlab(grams) {
  const idx = WEIGHT_SLABS.findIndex((s) => grams <= s.maxGrams);
  if (idx <= 0) return null;
  return WEIGHT_SLABS[idx - 1];
}

export function calcWeightShipping({ deadGrams, length, breadth, height, divisor = 5000 }) {
  const vol = Math.ceil((length * breadth * height * 1000) / divisor);
  const chargeable = Math.max(deadGrams, vol);
  const slab = slabForGrams(chargeable);
  const cheaper = nextCheaperSlab(chargeable);
  const savings = cheaper ? slab.forward - cheaper.forward : 0;
  const targetGrams = cheaper ? cheaper.maxGrams : chargeable;
  return {
    deadGrams,
    volumetricGrams: vol,
    chargeableGrams: chargeable,
    slab,
    cheaper,
    savingsPerOrder: savings,
    drivenBy: vol > deadGrams ? "volumetric" : "dead weight",
    tip:
      vol > deadGrams
        ? `Reduce box size to ${Math.ceil(targetGrams / 1000 * divisor / (length * breadth) * 10) / 10}cm height or use a tighter mailer.`
        : `Use lighter packaging or verify dead weight entry in Meesho.`,
  };
}

/** Empirical image → estimated Meesho shipping ₹ from file KB + dimensions. */
export function estimateImageShipping(variant) {
  const kb = Math.max(1, Math.ceil(variant.bytes / 1024));
  const w = variant.width || 0;
  const h = variant.height || 0;
  const maxSide = Math.max(w, h);
  const path = variant.path || "";

  if (path === "tall") {
    if (maxSide <= 1024 && kb >= 37 && kb <= 55) return Math.min(kb, 50);
    return 50;
  }
  if (path === "studio_ultra") {
    if (kb <= 22) return kb;
    if (kb <= 26) return 24;
    return 28;
  }
  if (path === "framed_live") {
    if (kb >= 38 && kb <= 52) return Math.min(kb + 1, 50);
    return Math.min(kb, 65);
  }
  if (path === "studio") {
    if (kb <= 26) return kb;
    if (kb <= 40) return Math.min(kb, 36);
    return Math.min(kb, 45);
  }
  if (path === "flatlay") {
    if (kb >= 37 && kb <= 44) return kb <= 40 ? 39 : 41;
    if (kb <= 65) return kb;
    return 66;
  }
  if (path === "framed_low") {
    if (kb >= 64 && kb <= 71) return kb;
    return Math.min(kb, 71);
  }
  if (path === "framed") {
    if (maxSide <= 1024 && kb >= 85 && kb <= 94) return 93;
    if (kb <= 71) return kb;
    return Math.min(kb, 93);
  }
  if (path === "showcase") {
    if (kb >= 64 && kb <= 71) return kb;
    return Math.min(kb, 71);
  }
  if (path === "lifestyle_promo") {
    if (kb >= 48 && kb <= 54) return kb;
    return Math.min(kb, 54);
  }
  if (path === "tall_static") {
    if (maxSide <= 1024 && kb >= 37 && kb <= 55) return Math.min(kb, 50);
    return 50;
  }
  if (path === "gown_static") {
    if (maxSide <= 1094 && kb >= 38 && kb <= 50) return Math.min(kb, 49);
    if (kb > 50 && kb <= 72) return 79;
    return 49;
  }
  if (path === "collage_back") {
    if (kb >= 54 && kb <= 58) return 41;
    if (kb >= 48 && kb <= 52) return 71;
    return Math.min(kb, 93);
  }
  if (path === "collage_front") {
    if (kb === 44 && maxSide <= 1320) return 66;
    if (kb === 48) return 71;
    if (kb >= 54 && kb <= 58) return 41;
    return Math.min(kb, 93);
  }
  return Math.min(kb, 93);
}

export function formatInr(n) {
  return `₹${Math.round(n)}`;
}

export const CATEGORIES = [
  { id: "auto", name: "Auto detect", icon: "✨" },
  { id: "apparel", name: "Apparel / Kurti", icon: "👕" },
  { id: "lingerie", name: "Lingerie / Bra", icon: "👙" },
  { id: "footwear", name: "Footwear", icon: "👟" },
  { id: "home", name: "Home & Kitchen", icon: "🏠" },
  { id: "electronics", name: "Electronics", icon: "📱" },
  { id: "jewellery", name: "Jewellery", icon: "💍" },
  { id: "general", name: "General", icon: "📦" },
];

export const MODES = [
  { id: "smart", name: "Smart Auto", desc: "Meesho-aligned: compact studio + live verify", featured: true },
  { id: "studio", name: "Studio White", desc: "1200² white · ~68% product coverage", featured: true },
  { id: "tall", name: "Tall ₹50", desc: "703×1024 frame · long kurtis/dresses", featured: true },
  { id: "flatlay", name: "Flat-Lay", desc: "1024² compact · tops/footwear only", featured: true },
  { id: "framed", name: "Framed", desc: "Orange promo frame · ₹93 band" },
  { id: "framed_low", name: "Framed Low", desc: "Compact frame · ₹64–71 band" },
  { id: "collage", name: "Collage Split", desc: "Wide image → smaller panels" },
  { id: "studio_ultra", name: "Studio Ultra", desc: "Tightest crop + smallest KB" },
];

export const TARGET_SHIPPING = [30, 40, 50, 70, 93];
