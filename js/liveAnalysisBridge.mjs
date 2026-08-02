/**
 * Live tab static analysis — no Meesho API.
 * Ranks local strategy variants by estimated shipping ₹ from image shape/type.
 */
import { optimizeImage, analyzeImage, getSmartPlan } from "./lib/strategies.js?v=67";
import { loadImage } from "./lib/canvas-utils.js?v=97";
import { blobToDataUrl } from "./lib/encoder.js?v=67";
import {
  buildShowcaseVariants,
  SHOWCASE_VARIANT_COUNT,
} from "./liveShowcaseVariants.mjs?v=67";
import {
  buildPromoLifestyleVariants,
  PROMO_LIFESTYLE_VARIANT_COUNT,
} from "./livePromoLifestyle.mjs?v=67";
import {
  buildTallStaticVariants,
  TALL_STATIC_VARIANT_COUNT,
} from "./liveTallStatic.mjs?v=67";
import {
  buildGownStaticVariants,
  GOWN_STATIC_VARIANT_COUNT,
} from "./liveGownStatic.mjs?v=96";

const PRIMARY_COUNT = 6;
const SEE_MORE_CAP = 30;

function categoryFromAnalysis(analysis) {
  if (analysis.tall) return "apparel";
  if (analysis.collage) return "lingerie";
  if (analysis.studioBg) return "general";
  return "general";
}

function variantToAnalysisResult(v, index, extra = {}) {
  const kb = v.kb || Math.ceil((v.bytes || 0) / 1024);
  return {
    variantId: extra.variantId || `${v.path || "analysis"}-${kb}-${index}`,
    name: v.label || v.mode || `Analysis-${index + 1}`,
    blob: v.blob || null,
    dataUrl: v.dataUrl,
    pricingImageUrl: v.dataUrl,
    imageUrl: v.dataUrl,
    layers: v.layers || null,
    variantStyle: extra.variantStyle || "analysis",
    meta: {
      path: v.path,
      mode: v.mode,
      estInr: v.estInr,
      kb,
      width: v.width,
      height: v.height,
      recommended: !!v.recommended,
      lowest: !!v.lowest,
      showcase: !!(v.meta?.showcasePreset || extra.showcase),
      showcasePreset: v.meta?.showcasePreset || extra.showcasePreset || null,
    },
    shippingCost: 0,
    estShipping: v.estInr,
    isVerified: false,
    localOnly: true,
    analysisMode: true,
    ...extra,
  };
}

/** Pick up to 6 — one best est per strategy path, then fill by est ₹. */
function pickPrimary(ranked) {
  const byPath = new Map();
  for (const v of ranked) {
    const p = v.path || "unknown";
    if (!byPath.has(p)) byPath.set(p, v);
  }
  const pathOrder = [
    "studio_ultra",
    "studio",
    "tall",
    "flatlay",
    "framed_low",
    "framed",
    "collage_back",
    "collage_front",
  ];
  const picked = [];
  const seen = new Set();
  for (const p of pathOrder) {
    const v = byPath.get(p);
    if (v && !seen.has(v)) {
      picked.push(v);
      seen.add(v);
    }
    if (picked.length >= PRIMARY_COUNT) break;
  }
  for (const v of ranked) {
    if (picked.length >= PRIMARY_COUNT) break;
    if (!seen.has(v)) {
      picked.push(v);
      seen.add(v);
    }
  }
  return picked;
}

/**
 * Independent static showcase generate — portrait promo frames only.
 */
export async function runShowcaseGeneration(file, options = {}) {
  const { onProgress = () => {}, count = SHOWCASE_VARIANT_COUNT } = options;
  const img = await loadImage(file);
  const raw = await buildShowcaseVariants(img, { onProgress, count });
  const results = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    results.push(
      variantToAnalysisResult(v, i + 60000, {
        variantStyle: "showcase",
        showcase: true,
        showcasePreset: v.meta?.showcasePreset,
        variantId: `showcase-${v.kb}-${i + 60000}`,
      }),
    );
  }
  return { success: results.length > 0, results };
}

/**
 * Competitor-style lifestyle promo — solid green frame @ 48–54 KB (web only).
 */
export async function runPromoLifestyleGeneration(file, options = {}) {
  const { onProgress = () => {}, count = PROMO_LIFESTYLE_VARIANT_COUNT } = options;
  const img = await loadImage(file);
  const raw = await buildPromoLifestyleVariants(img, { onProgress, count });
  const results = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    results.push(
      variantToAnalysisResult(v, i + 70000, {
        variantStyle: "lifestyle_promo",
        showcase: true,
        showcasePreset: v.meta?.showcasePreset,
        variantId: `lifestyle-promo-${v.kb}-${i + 70000}`,
      }),
    );
  }
  return { success: results.length > 0, results };
}

/**
 * Tall portrait promo — 703×1024 blue frame + corner badges @ ₹50 band (web only).
 */
export async function runTallStaticGeneration(file, options = {}) {
  const { onProgress = () => {}, count = TALL_STATIC_VARIANT_COUNT } = options;
  const img = await loadImage(file);
  const raw = await buildTallStaticVariants(img, { onProgress, count });
  const results = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    results.push(
      variantToAnalysisResult(v, i + 80000, {
        variantStyle: "tall_static",
        showcase: true,
        showcasePreset: v.meta?.showcasePreset,
        variantId: `tall-static-${v.kb}-${i + 80000}`,
      }),
    );
  }
  return { success: results.length > 0, results };
}

/**
 * Gown portrait promo — 773×1094 teal frame + gown badges @ ~₹49 band (web only).
 */
export async function runGownStaticGeneration(file, options = {}) {
  const { onProgress = () => {}, count = GOWN_STATIC_VARIANT_COUNT } = options;
  const img = await loadImage(file);
  const raw = await buildGownStaticVariants(img, { onProgress, count });
  const results = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    results.push(
      variantToAnalysisResult(v, i + 90000, {
        variantStyle: "gown_static",
        showcase: true,
        showcasePreset: v.meta?.showcasePreset,
        variantId: `gown-static-${v.kb}-${i + 90000}`,
      }),
    );
  }
  return { success: results.length > 0, results };
}

/**
 * Run static image analysis + ranked local variants (est ₹ only).
 */
export async function runLiveAnalysis(file, options = {}) {
  const { onProgress = () => {}, category = "auto" } = options;
  const img = await loadImage(file);
  const analysis = analyzeImage(img);
  const resolvedCategory =
    category === "auto" ? categoryFromAnalysis(analysis) : category;
  const smartPlan = getSmartPlan(img, resolvedCategory);

  onProgress("Analyzing image shape & background…");
  const ranked = await optimizeImage(img, {
    mode: "smart",
    category: resolvedCategory,
    borderColor: "#2980b9",
    lowHunt: true,
    onProgress,
  });

  const primaryRaw = pickPrimary(ranked);
  const primarySet = new Set(primaryRaw);
  const seeMoreRaw = ranked
    .filter((v) => !primarySet.has(v))
    .slice(0, SEE_MORE_CAP);

  onProgress("Encoding analysis previews…");
  const primary = [];
  for (let i = 0; i < primaryRaw.length; i++) {
    const v = primaryRaw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    primary.push(variantToAnalysisResult(v, i, { analysisPrimary: true }));
  }

  const seeMore = [];
  for (let i = 0; i < seeMoreRaw.length; i++) {
    const v = seeMoreRaw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    seeMore.push(variantToAnalysisResult(v, i + PRIMARY_COUNT));
  }

  return {
    success: primary.length > 0,
    analysis: {
      ...analysis,
      resolvedCategory,
      smartPlan,
      variantCount: ranked.length,
    },
    primary,
    seeMore,
    rankedCount: ranked.length,
  };
}

if (typeof window !== "undefined") {
  window.LiveAnalysis = {
    runLiveAnalysis,
    runShowcaseGeneration,
    runPromoLifestyleGeneration,
    runTallStaticGeneration,
    runGownStaticGeneration,
  };
  window.dispatchEvent(new Event("live-analysis-ready"));
}
