/**
 * TEST LAB ONLY — isolated from Live mode (MeeshoAPI.generateLocalVariations / smartSearch).
 * Phase 1: local strategies ranked by est ₹ (expanded grid when live hunt on).
 * Phase 2: ₹49 framed candidates + diverse live Meesho verify.
 * Phase 3: KB/profile refinement around best live result.
 */
import {
  optimizeImage,
  analyzeImage,
  getSmartPlan,
  generatePathRefinements,
} from "./lib/strategies.js?v=32";
import { loadImage } from "./lib/canvas-utils.js?v=97";
import { blobToDataUrl } from "./lib/encoder.js?v=32";
import {
  CATEGORIES,
  MODES,
  TARGET_SHIPPING,
  formatInr,
  estimateImageShipping,
} from "./lib/shipping.js?v=32";
import { getSessionGuidance, PATH_PRIORITY } from "./lib/smart-plan.js?v=32";

const APPAREL_RE =
  /kurti|saree|dress|suit|gown|babydoll|jumpsuit|western gown/i;
const TOPS_RE = /tshirt|shirt|jean|jegging|top wear/i;
const JEWELLERY_RE =
  /jewel|ring|necklace|pendant|anklet|bracelet|bangle|locket/i;
const FOOTWEAR_RE =
  /shoe|sandal|boot|slipper|bellies|flip.?flop|slider|jutti/i;
const HOME_RE = /bed|bath|towel|rug|bean bag|bedding|kitchen|cookware|container/i;
const LINGERIE_RE = /babydoll|nightdress|nightsuit|bra|lingerie/i;
const ELECTRONICS_RE =
  /phone|mobile|charger|cable|earphone|electronic|gadget|usb|power.?bank|adapter|bluetooth|speaker|watch|trimmer/i;

const PHASE2_PROFILE_LIMIT = 16;
const PHASE2_FRAMED_LIVE_PICK = 5;
const LIVE_VERIFY_DELAY_MS = 120;
const DEFAULT_MAX_VERIFY = 32;

const PATH_PICK_ORDER = [
  "studio_ultra",
  "studio",
  "tall",
  "flatlay",
  "framed_low",
  "collage_back",
  "collage_front",
  "framed_live",
];

function estOf(row) {
  return row.estShipping ?? row.meta?.estInr ?? 999;
}

function pathOf(row) {
  if (row.phase2 || row.meta?.path === "framed_live") return "framed_live";
  return row.meta?.path || "unknown";
}

/** Map Meesho sscat id/name → strategy category id used by strategies.js */
export function categoryGroupFromSelection(sscatId, categoryName) {
  const name = String(categoryName || "");
  if (JEWELLERY_RE.test(name)) return "jewellery";
  if (FOOTWEAR_RE.test(name)) return "footwear";
  if (ELECTRONICS_RE.test(name)) return "electronics";
  if (HOME_RE.test(name)) return "home";
  if (LINGERIE_RE.test(name)) return "lingerie";
  if (APPAREL_RE.test(name)) return "apparel";
  if (TOPS_RE.test(name)) return "apparel";
  return "general";
}

function variantToResult(v, index) {
  const kb = v.kb || Math.ceil((v.bytes || 0) / 1024);
  return {
    variantId: `test-${v.path}-${kb}-${index}`,
    name: v.label || v.mode || `Test-${index + 1}`,
    blob: v.blob || null,
    dataUrl: v.dataUrl,
    pricingImageUrl: v.dataUrl,
    imageUrl: v.dataUrl,
    layers: v.layers || null,
    variantStyle: v.variantStyle || "testlab",
    meta: {
      path: v.path,
      mode: v.mode,
      estInr: v.estInr,
      kb,
      width: v.width,
      height: v.height,
      recommended: !!v.recommended,
      best: !!v.best,
      lowest: !!v.lowest,
      profileId: v.profileId,
      refine: !!v.refine,
    },
    shippingCost: 0,
    estShipping: v.estInr,
    isVerified: false,
    localOnly: true,
    testLab: true,
    phase2: !!v.phase2,
    phase3: !!v.phase3,
  };
}

function sortByBestPrice(results) {
  return [...results].sort((a, b) => {
    const aLive = a.shippingCost > 0 ? a.shippingCost : null;
    const bLive = b.shippingCost > 0 ? b.shippingCost : null;
    if (aLive != null && bLive != null) return aLive - bLive;
    if (aLive != null) return -1;
    if (bLive != null) return 1;
    return estOf(a) - estOf(b);
  });
}

function syncMeeshoSession(sscatId) {
  if (typeof MeeshoAPI === "undefined") return false;
  MeeshoAPI.syncFromSession?.();
  MeeshoAPI.syncCatalogPricing?.();
  MeeshoAPI.detectAllValues?.();
  if (sscatId) MeeshoAPI.setCategory(sscatId);
  return !!MeeshoAPI.isReady?.();
}

/**
 * Path-diverse live verify selection — one best per strategy path, not all 16 frames first.
 */
export function pickLiveVerifyCandidates(results, maxCount = DEFAULT_MAX_VERIFY) {
  const byPath = new Map();
  for (const row of results) {
    const p = pathOf(row);
    if (!byPath.has(p)) byPath.set(p, []);
    byPath.get(p).push(row);
  }
  for (const rows of byPath.values()) {
    rows.sort((a, b) => estOf(a) - estOf(b));
  }

  const picked = [];
  const seen = new Set();
  let framedPicked = 0;
  const add = (row) => {
    if (!row || seen.has(row.variantId)) return;
    if (pathOf(row) === "framed_live" && framedPicked >= PHASE2_FRAMED_LIVE_PICK) return;
    seen.add(row.variantId);
    picked.push(row);
    if (pathOf(row) === "framed_live") framedPicked++;
  };

  for (const path of PATH_PICK_ORDER) {
    const rows = byPath.get(path);
    if (!rows?.length) continue;
    if (path === "framed_live") {
      for (const row of rows.slice(0, PHASE2_FRAMED_LIVE_PICK)) add(row);
    } else {
      add(rows[0]);
      if (rows.length > 1 && picked.length < maxCount) add(rows[1]);
    }
    if (picked.length >= maxCount) break;
  }

  const rest = [...results]
    .filter((r) => !seen.has(r.variantId))
    .sort((a, b) => {
      const estDiff = estOf(a) - estOf(b);
      if (estDiff !== 0) return estDiff;
      const pa = PATH_PRIORITY[pathOf(a)] ?? 50;
      const pb = PATH_PRIORITY[pathOf(b)] ?? 50;
      return pa - pb;
    });

  for (const row of rest) {
    if (picked.length >= maxCount) break;
    add(row);
  }

  return picked.slice(0, maxCount);
}

function phase2Profiles() {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.LOW_SHIPPING_FRAMED_PROFILES) {
    return [];
  }
  const all = MeeshoAPI.LOW_SHIPPING_FRAMED_PROFILES;
  const lowTier = all.filter((p) => p.id.startsWith("low_"));
  const midTier = all.filter(
    (p) => !p.id.startsWith("low_") && p.targetKb && p.targetKb <= 50
  );
  const picked = [...lowTier, ...midTier];
  return (picked.length ? picked : all).slice(0, PHASE2_PROFILE_LIMIT);
}

/**
 * Generate ranked test-lab variants. Does not call MeeshoAPI.
 */
export async function runTestLab(file, options = {}) {
  const {
    mode = "smart",
    category = "auto",
    categoryName = "",
    sscatId = null,
    targetInr = null,
    borderColor = "#ff7900",
    phase2Live = false,
    onProgress = () => {},
  } = options;

  const img = await loadImage(file);
  const analysis = analyzeImage(img);

  let resolvedCategory = category;
  if (category === "auto") {
    resolvedCategory = categoryGroupFromSelection(sscatId, categoryName);
    if (resolvedCategory === "general" && analysis.tall) {
      resolvedCategory = "apparel";
    }
    if (resolvedCategory === "general" && analysis.collage) {
      resolvedCategory = "lingerie";
    }
  }

  onProgress("Phase 1: analyzing image…");
  const smartPlan = mode === "smart" ? getSmartPlan(img, resolvedCategory) : null;
  if (smartPlan?.summary) {
    onProgress(`Smart Auto: ${smartPlan.summary}`);
  }

  const ranked = await optimizeImage(img, {
    mode,
    category: resolvedCategory,
    borderColor,
    targetInr: targetInr ? Number(targetInr) : null,
    lowHunt: !!phase2Live,
    onProgress,
  });

  onProgress("Phase 1: encoding previews…");
  const results = [];
  for (let i = 0; i < ranked.length; i++) {
    const v = ranked[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    results.push(variantToResult(v, i));
  }

  return {
    success: results.length > 0,
    results,
    analysis: {
      ...analysis,
      resolvedCategory,
      category,
      smartPlan,
    },
    localOnly: true,
    testLab: true,
  };
}

/** Build Live-mode ₹49 framed candidates for Phase 2. */
export async function generatePhase2Framed(file, onProgress = () => {}) {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.generateFramedVariation) {
    return [];
  }

  const blob = file instanceof Blob ? file : file;
  const profiles = phase2Profiles();
  const out = [];

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    onProgress(`Phase 2: ${profile.id} (${profile.targetKb}KB)…`);
    try {
      const variation = await MeeshoAPI.generateFramedVariation(
        blob,
        50000 + i,
        profile
      );
      if (!variation?.dataUrl) continue;

      const kb =
        variation.meta?.actualKb ||
        Math.max(1, Math.ceil((variation.blob?.size || 0) / 1024));
      const estInr = estimateImageShipping({
        bytes: variation.blob?.size || kb * 1024,
        width: variation.meta?.canvasW,
        height: variation.meta?.canvasH,
        path: "framed_live",
      });

      out.push(
        variantToResult(
          {
            blob: variation.blob,
            dataUrl: variation.dataUrl,
            path: "framed_live",
            mode: "Low ₹49 frame",
            label: `${profile.id} · ${kb}KB`,
            estInr,
            kb,
            width: variation.meta?.canvasW,
            height: variation.meta?.canvasH,
            layers: variation.layers,
            variantStyle: "framed",
            profileId: profile.id,
            phase2: true,
          },
          1000 + i
        )
      );
    } catch (e) {
      console.warn("Phase 2 framed failed:", profile.id, e);
    }
  }

  return out;
}

/** Phase 3 — neighbors around best live winner (KB tiers or framed profiles). */
export async function generateRefinementVariants(file, bestRow, options = {}) {
  const { borderColor = "#ff7900", onProgress = () => {} } = options;
  if (!bestRow || !file) return [];

  const path = pathOf(bestRow);
  const centerKb = bestRow.meta?.kb;
  const out = [];

  if (path === "framed_live" && bestRow.meta?.profileId) {
    const profiles = phase2Profiles();
    const idx = profiles.findIndex((p) => p.id === bestRow.meta.profileId);
    const neighbors = profiles.slice(Math.max(0, idx - 2), idx + 3);
    const blob = file instanceof Blob ? file : file;
    for (let i = 0; i < neighbors.length; i++) {
      const profile = neighbors[i];
      if (profile.id === bestRow.meta.profileId) continue;
      onProgress(`Phase 3: refine frame ${profile.id}…`);
      try {
        const variation = await MeeshoAPI.generateFramedVariation(
          blob,
          60000 + i,
          profile
        );
        if (!variation?.blob) continue;
        const kb =
          variation.meta?.actualKb ||
          Math.max(1, Math.ceil(variation.blob.size / 1024));
        out.push(
          variantToResult(
            {
              blob: variation.blob,
              dataUrl: variation.dataUrl,
              path: "framed_live",
              mode: "Refine ₹49",
              label: `Refine ${profile.id} · ${kb}KB`,
              estInr: estimateImageShipping({
                bytes: variation.blob.size,
                width: variation.meta?.canvasW,
                height: variation.meta?.canvasH,
                path: "framed_live",
              }),
              kb,
              width: variation.meta?.canvasW,
              height: variation.meta?.canvasH,
              layers: variation.layers,
              profileId: profile.id,
              phase2: true,
              phase3: true,
              refine: true,
            },
            2000 + i
          )
        );
      } catch (e) {
        console.warn("Phase 3 framed refine failed:", profile.id, e);
      }
    }
    return out;
  }

  const img = await loadImage(file);
  const raw = await generatePathRefinements(img, path, centerKb, {
    borderColor,
    onProgress,
  });
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    v.dataUrl = await blobToDataUrl(v.blob);
    v.phase3 = true;
    v.refine = true;
    out.push(variantToResult(v, 3000 + i));
  }
  return out;
}

function isUnverified(row) {
  return !row.liveChecked && row.shippingCost <= 0;
}

/** Live Meesho upload + getTransferPrice for candidates. */
export async function verifyTestLabLive(
  results,
  maxCount = 10,
  onProgress = () => {},
  options = {}
) {
  if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.uploadImage) {
    return { verified: [], errors: ["MeeshoAPI not available"] };
  }

  if (!syncMeeshoSession(options.sscatId)) {
    return { verified: [], errors: ["Meesho session not ready"] };
  }

  const targetInr = options.targetInr ? Number(options.targetInr) : null;
  const onlyUnverified = !!options.onlyUnverified;
  let pool = onlyUnverified ? results.filter(isUnverified) : results;
  const slice = options.pickDiverse
    ? pickLiveVerifyCandidates(pool, maxCount)
    : pool.slice(0, maxCount);

  const verified = [];
  const errors = [];
  let bestLive = Infinity;

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    if (onlyUnverified && !isUnverified(row)) continue;

    const label = row.name || row.meta?.path || `variant ${i + 1}`;
    onProgress(`Live ₹ check ${i + 1}/${slice.length}: ${label}…`);

    try {
      let blob = row.blob instanceof Blob ? row.blob : null;
      if (!blob) {
        const url = row.pricingImageUrl || row.dataUrl || row.imageUrl;
        if (!url) {
          errors.push(`${label}: no image data`);
          continue;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("fetch failed");
        blob = await resp.blob();
      }

      const imageUrl = await MeeshoAPI.uploadImage(
        blob,
        `testlab-p2-${Date.now()}-${i}.jpg`
      );
      let uploaded = imageUrl;
      if (!uploaded) {
        await new Promise((r) => setTimeout(r, 300));
        uploaded = await MeeshoAPI.uploadImage(
          blob,
          `testlab-retry-${Date.now()}-${i}.jpg`
        );
      }
      if (!uploaded) {
        errors.push(`${label}: upload failed`);
        continue;
      }

      const priceData = await MeeshoAPI.getShippingCharges(uploaded, {
        sscatId: options.sscatId,
      });
      if (!priceData || priceData.shippingCharges == null) {
        errors.push(`${label}: price API failed`);
        continue;
      }

      row.shippingCost = priceData.shippingCharges;
      row.duplicatePid = priceData.duplicatePid;
      row.isVerified = !!priceData.duplicatePid;
      row.uploadedUrl = uploaded;
      row.liveChecked = true;
      row.liveVerified = true;
      row.liveTotalPrice = priceData.totalPrice;
      row.meeshoPriceUsed = priceData.priceUsed;
      if (!row.dataUrl && row.pricingImageUrl) row.dataUrl = row.pricingImageUrl;
      verified.push(row);

      if (row.shippingCost > 0 && row.shippingCost < bestLive) {
        bestLive = row.shippingCost;
      }

      if (
        targetInr &&
        row.shippingCost > 0 &&
        row.shippingCost <= targetInr &&
        !options.huntLowest
      ) {
        onProgress(`Target ≤₹${targetInr} found (₹${row.shippingCost}) — stopping hunt`);
        break;
      }
    } catch (e) {
      console.warn("Test lab live verify failed:", e);
      errors.push(`${label}: ${e.message || "error"}`);
    }

    if (i < slice.length - 1) {
      await new Promise((r) => setTimeout(r, LIVE_VERIFY_DELAY_MS));
    }
  }

  verified.sort((a, b) => (a.shippingCost || 999) - (b.shippingCost || 999));
  return { verified, errors, bestLive: bestLive < Infinity ? bestLive : null };
}

/**
 * Phase 2+3 — framed variants, diverse live hunt, refine around best live ₹.
 */
export async function runPhase2LiveHunt(file, phase1Results, options = {}) {
  const {
    sscatId = null,
    onProgress = () => {},
    maxVerify = DEFAULT_MAX_VERIFY,
    targetInr = null,
    borderColor = "#ff7900",
  } = options;

  if (!syncMeeshoSession(sscatId)) {
    return {
      results: phase1Results,
      phase2: false,
      error: "Meesho session not ready — add Supplier ID + Browser ID",
    };
  }

  onProgress("Phase 2: building ₹49 framed candidates…");
  const framed = await generatePhase2Framed(file, onProgress);

  const merged = [...phase1Results];
  const seen = new Set(merged.map((r) => r.variantId));
  for (const row of framed) {
    if (!seen.has(row.variantId)) {
      merged.push(row);
      seen.add(row.variantId);
    }
  }

  const round1Budget = Math.max(12, Math.floor(maxVerify * 0.65));
  onProgress(
    `Phase 2: live hunt round 1 (${round1Budget} diverse paths)…`
  );
  const verify1 = await verifyTestLabLive(merged, round1Budget, onProgress, {
    sscatId,
    targetInr,
    pickDiverse: true,
    huntLowest: !targetInr,
  });

  let bestLive = sortByBestPrice(merged).find((r) => r.shippingCost > 0);
  let refineCount = 0;
  let verify2Count = 0;

  if (bestLive) {
    onProgress(
      `Phase 3: refining around best live ₹${bestLive.shippingCost} (${pathOf(bestLive)})…`
    );
    const refinements = await generateRefinementVariants(file, bestLive, {
      borderColor,
      onProgress,
    });
    refineCount = refinements.length;
    for (const row of refinements) {
      if (!seen.has(row.variantId)) {
        merged.push(row);
        seen.add(row.variantId);
      }
    }

    const round2Budget = Math.max(6, maxVerify - verify1.verified.length);
    if (round2Budget > 0 && refinements.length) {
      onProgress(`Phase 3: live verify ${refinements.length} refinements…`);
      const verify2 = await verifyTestLabLive(merged, round2Budget, onProgress, {
        sscatId,
        targetInr,
        pickDiverse: false,
        onlyUnverified: true,
        huntLowest: !targetInr,
      });
      verify2Count = verify2.verified.length;
    }
  }

  const remaining = maxVerify - verify1.verified.length - verify2Count;
  if (remaining > 0) {
    const unverified = merged.filter(isUnverified);
    if (unverified.length) {
      onProgress(`Phase 2: extra live checks (${remaining} slots)…`);
      const verify3 = await verifyTestLabLive(merged, remaining, onProgress, {
        sscatId,
        targetInr,
        pickDiverse: true,
        onlyUnverified: true,
        huntLowest: !targetInr,
      });
      verify2Count += verify3.verified.length;
    }
  }

  const sorted = sortByBestPrice(merged);
  bestLive = sorted.find((r) => r.shippingCost > 0);
  const totalVerified = merged.filter((r) => r.liveChecked).length;

  return {
    results: sorted,
    phase2: true,
    framedCount: framed.length,
    refineCount,
    verifiedCount: totalVerified,
    errors: verify1.errors,
    bestLive: bestLive
      ? { name: bestLive.name, shippingCost: bestLive.shippingCost, path: pathOf(bestLive) }
      : null,
    targetReached:
      targetInr && bestLive?.shippingCost != null && bestLive.shippingCost <= targetInr,
  };
}

if (typeof window !== "undefined") {
  window.TestLabOptimizer = {
    ready: true,
    runTestLab,
    runPhase2LiveHunt,
    generatePhase2Framed,
    generateRefinementVariants,
    verifyTestLabLive,
    pickLiveVerifyCandidates,
    getSessionGuidance,
    getSmartPlan,
    analyzeImage,
    categoryGroupFromSelection,
    CATEGORIES,
    MODES,
    TARGET_SHIPPING,
    formatInr,
    estimateImageShipping,
  };

  window.__testLabReady = true;
  window.__testLabLoadError = null;
  window.dispatchEvent(new Event("testlab-ready"));
}
