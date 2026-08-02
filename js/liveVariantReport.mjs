/**
 * Live variant shipping report — standalone analysis (no Meesho API).
 *
 * Pick rules:
 * 1. Sort unique live prices ascending.
 * 2. Find the lowest consecutive pair with exactly ₹1 gap → recommend both.
 * 3. If no ₹1 pair exists → recommend only the single lowest price variant.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells) {
  return cells.map(csvEscape).join(",");
}

/** Rank variants at the same shipping price — higher score wins. */
export function scoreVariant(row) {
  let score = 0;
  if (row.isVerified) score += 100;
  if (row.liveVerified) score += 50;
  if (row.duplicatePid) score += 25;
  if (!row.noPid) score += 10;
  if (row.manualPrice) score += 5;
  return score;
}

export function pickBestAtPrice(variants, price) {
  const atPrice = variants.filter((v) => num(v.shippingCost) === price);
  if (!atPrice.length) return null;
  return [...atPrice].sort((a, b) => scoreVariant(b) - scoreVariant(a))[0];
}

export function uniqueSortedPrices(variants) {
  const priced = variants.filter((v) => num(v.shippingCost) > 0);
  return [...new Set(priced.map((v) => num(v.shippingCost)))].sort(
    (a, b) => a - b,
  );
}

/**
 * Find the lowest ₹1-apart price pair in sorted unique prices.
 * Returns [lowPrice, highPrice] or null.
 */
export function findLowestRupeePair(prices) {
  if (!prices.length) return null;
  const lowest = prices[0];
  if (prices.includes(lowest + 1)) {
    return [lowest, lowest + 1];
  }
  return null;
}

/** List every consecutive ₹1 pair (for pattern notes). */
export function findAllRupeePairs(prices) {
  const pairs = [];
  for (let i = 0; i < prices.length - 1; i++) {
    if (prices[i + 1] - prices[i] === 1) {
      pairs.push([prices[i], prices[i + 1]]);
    }
  }
  return pairs;
}

export function pickRecommendedVariants(variants) {
  const prices = uniqueSortedPrices(variants);
  if (!prices.length) {
    return {
      strategy: "none",
      reason: "No variants have a live shipping price yet.",
      prices: [],
      pair: null,
      picks: [],
    };
  }

  const pair = findLowestRupeePair(prices);
  if (pair) {
    const [low, high] = pair;
    const lowPick = pickBestAtPrice(variants, low);
    const highPick = pickBestAtPrice(variants, high);
    const picks = [lowPick, highPick].filter(Boolean);
    return {
      strategy: "rupee_pair",
      reason: `Lowest ₹1-apart pair found at ₹${low} and ₹${high}. Both are worth testing — Meesho often clusters shipping one rupee apart at the floor.`,
      prices,
      pair,
      picks,
    };
  }

  const lowest = prices[0];
  const pick = pickBestAtPrice(variants, lowest);
  return {
    strategy: "single_lowest",
    reason: `No consecutive ₹1 gap in unique prices (${prices.join(", ")}). Recommend only the lowest tier ₹${lowest}.`,
    prices,
    pair: null,
    picks: pick ? [pick] : [],
  };
}

function variantRowMeta(row) {
  const meta = row.meta || {};
  return {
    path: meta.path || meta.style || row.variantStyle || "",
    mode: meta.mode || "",
    kb: meta.kb || meta.actualKb || meta.targetKb || "",
    width: meta.width || meta.canvasW || meta.productW || "",
    height: meta.height || meta.canvasH || meta.productH || "",
    borderPx: meta.borderPx ?? "",
    badgeCount: meta.badgeCount ?? "",
    jpegQuality: meta.jpegQuality ?? "",
    estInr: meta.estInr || row.estShipping || "",
  };
}

function flattenVariant(row, extra = {}) {
  const m = variantRowMeta(row);
  const shipping = num(row.shippingCost);
  const baseline = num(extra.baseline);
  const savings =
    baseline > 0 && shipping > 0
      ? baseline - shipping
      : num(row.savings);
  return {
    variantId: row.variantId || "",
    name: row.name || "",
    shippingCost: shipping,
    estShipping: num(row.estShipping || m.estInr),
    isVerified: !!row.isVerified,
    liveVerified: !!row.liveVerified,
    duplicatePid: row.duplicatePid || "",
    hasDuplicatePid: !!row.duplicatePid,
    noPid: !!row.noPid,
    manualPrice: !!row.manualPrice,
    variantStyle: row.variantStyle || "",
    path: m.path,
    mode: m.mode,
    kb: m.kb,
    width: m.width,
    height: m.height,
    borderPx: m.borderPx,
    badgeCount: m.badgeCount,
    jpegQuality: m.jpegQuality,
    liveTotalPrice: row.liveTotalPrice ?? "",
    savings,
    meeshoPriceUsed: row.meeshoPriceUsed ?? "",
    source: extra.source || "primary",
    recommended: !!extra.recommended,
    pickRank: extra.pickRank ?? "",
    score: scoreVariant(row),
  };
}

function buildPriceTiers(variants, prices) {
  return prices.map((price, idx) => {
    const atTier = variants.filter((v) => num(v.shippingCost) === price);
    const next = prices[idx + 1];
    const gap = next != null ? next - price : "";
    const verified = atTier.filter((v) => v.isVerified).length;
    const noPidCount = atTier.filter((v) => v.noPid).length;
    const dupPidCount = atTier.filter((v) => v.duplicatePid).length;
    const best = pickBestAtPrice(variants, price);
    return {
      price,
      count: atTier.length,
      gapToNext: gap,
      verifiedCount: verified,
      noPidCount,
      duplicatePidCount: dupPidCount,
      bestVariantId: best?.variantId || "",
      bestVariantName: best?.name || "",
      isRupeePairLow:
        idx < prices.length - 1 && prices[idx + 1] - price === 1,
      isRupeePairHigh: idx > 0 && price - prices[idx - 1] === 1,
    };
  });
}

function buildPatternNotes(analysis, context) {
  const notes = [];
  const { recommendation, priceTiers, stats } = analysis;

  notes.push(
    "FLOW: Generate live variants → Meesho returns customer shipping ₹ per image → sort by price → apply pick rules.",
  );
  notes.push(
    `PICK RULE: If lowest unique prices include a ₹1 gap (e.g. 60 & 61), recommend BOTH. Otherwise recommend ONLY the lowest price (e.g. 46 from 46,50).`,
  );

  if (recommendation.strategy === "rupee_pair") {
    notes.push(
      `RESULT: Pair strategy — test ₹${recommendation.pair[0]} and ₹${recommendation.pair[1]} variants on Meesho.`,
    );
  } else if (recommendation.strategy === "single_lowest") {
    notes.push(
      `RESULT: Single strategy — lowest tier is ₹${recommendation.prices[0]}; larger gaps mean no adjacent floor pair.`,
    );
  } else {
    notes.push("RESULT: No priced variants — enter or fetch live prices first.");
  }

  const allPairs = findAllRupeePairs(recommendation.prices);
  if (allPairs.length > 1) {
    notes.push(
      `OTHER ₹1 PAIRS (not picked): ${allPairs
        .slice(1)
        .map(([a, b]) => `${a}-${b}`)
        .join(", ")} — lowest pair wins.`,
    );
  } else if (allPairs.length === 1 && recommendation.strategy === "rupee_pair") {
    notes.push(`Only one ₹1 pair in this run: ${allPairs[0].join("-")}.`);
  }

  if (stats.unpricedCount > 0) {
    notes.push(
      `${stats.unpricedCount} variant(s) still unpriced — excluded from pick but listed in detail rows.`,
    );
  }

  if (context?.categoryName || context?.categoryId) {
    notes.push(
      `Category: ${context.categoryName || "?"} (sscat_id ${context.categoryId || "?"}) — shipping slabs vary by category.`,
    );
  }

  if (context?.baselineShipping > 0 && recommendation.picks.length) {
    const best = Math.min(...recommendation.picks.map((p) => num(p.shippingCost)));
    const save = context.baselineShipping - best;
    if (save > 0) {
      notes.push(
        `Savings vs baseline ₹${context.baselineShipping}: up to ₹${save} if you apply the recommended variant.`,
      );
    }
  }

  const bigGaps = priceTiers.filter((t) => t.gapToNext > 3);
  if (bigGaps.length) {
    notes.push(
      `Large tier jumps: ${bigGaps.map((t) => `₹${t.price}→₹${t.price + t.gapToNext} (+${t.gapToNext})`).join("; ")} — images likely crossed a Meesho size/weight slab.`,
    );
  }

  return notes;
}

/**
 * Full analysis for a live variant run.
 * @param {object[]} variants — primary + optional framed extras
 * @param {object} context — baseline, category, source labels
 */
export function analyzeLiveVariants(variants, context = {}) {
  const all = Array.isArray(variants) ? variants : [];
  const primary = context.primaryResults || all;
  const framed = context.framedExtras || [];
  const combined = [...primary, ...framed];
  const priced = combined.filter((v) => num(v.shippingCost) > 0);
  const prices = uniqueSortedPrices(combined);
  const recommendation = pickRecommendedVariants(combined);
  const pickIds = new Set(recommendation.picks.map((p) => p.variantId));

  const stats = {
    totalVariants: combined.length,
    primaryCount: primary.length,
    framedCount: framed.length,
    pricedCount: priced.length,
    unpricedCount: combined.length - priced.length,
    uniquePriceCount: prices.length,
    lowestPrice: prices[0] ?? 0,
    highestPrice: prices[prices.length - 1] ?? 0,
    verifiedCount: priced.filter((v) => v.isVerified).length,
    noPidCount: combined.filter((v) => v.noPid).length,
    duplicatePidCount: combined.filter((v) => v.duplicatePid).length,
  };

  const priceTiers = buildPriceTiers(combined, prices);
  const variantRows = combined.map((row) => {
    const source = framed.some((f) => f.variantId === row.variantId)
      ? "framed_extra"
      : "primary";
    const pickIdx = recommendation.picks.findIndex(
      (p) => p.variantId === row.variantId,
    );
    return flattenVariant(row, {
      source,
      recommended: pickIds.has(row.variantId),
      pickRank: pickIdx >= 0 ? pickIdx + 1 : "",
      baseline: num(context.baselineShipping),
    });
  });

  const analysis = {
    generatedAt: context.generatedAt || new Date().toISOString(),
    context: {
      baselineShipping: num(context.baselineShipping),
      categoryId: context.categoryId ?? "",
      categoryName: context.categoryName ?? "",
      categoryPath: context.categoryPath ?? "",
      categorySource: context.categorySource ?? "",
      manualMode: !!context.manualMode,
      productLabel: context.productLabel ?? "",
    },
    stats,
    recommendation,
    priceTiers,
    variantRows,
    allRupeePairs: findAllRupeePairs(prices),
  };

  analysis.patternNotes = buildPatternNotes(analysis, {
    ...analysis.context,
    baselineShipping: analysis.context.baselineShipping,
  });

  return analysis;
}

export function exportReportCsv(analysis) {
  const lines = [];
  const ctx = analysis.context || {};
  const rec = analysis.recommendation || {};
  const stats = analysis.stats || {};

  lines.push(
    csvRow([
      "record_type",
      "key",
      "value",
      "variant_id",
      "name",
      "shipping_inr",
      "est_inr",
      "verified",
      "live_verified",
      "duplicate_pid",
      "no_pid",
      "variant_style",
      "path",
      "kb",
      "width",
      "height",
      "source",
      "recommended",
      "pick_rank",
      "score",
      "gap_to_next",
      "tier_count",
      "notes",
      "savings_vs_baseline",
      "border_px",
      "badge_count",
      "jpeg_quality",
      "live_total_price",
      "meesho_price_used",
    ]),
  );

  const metaRows = [
    ["generated_at", analysis.generatedAt],
    ["baseline_shipping_inr", ctx.baselineShipping],
    ["category_id", ctx.categoryId],
    ["category_name", ctx.categoryName],
    ["category_path", ctx.categoryPath],
    ["category_source", ctx.categorySource],
    ["manual_mode", ctx.manualMode],
    ["strategy", rec.strategy],
    ["strategy_reason", rec.reason],
    ["total_variants", stats.totalVariants],
    ["priced_count", stats.pricedCount],
    ["unpriced_count", stats.unpricedCount],
    ["unique_prices", (rec.prices || []).join("|")],
    ["lowest_price", stats.lowestPrice],
    ["highest_price", stats.highestPrice],
    ["recommended_prices", (rec.picks || []).map((p) => p.shippingCost).join("|")],
    ["recommended_variant_ids", (rec.picks || []).map((p) => p.variantId).join("|")],
    ["all_rupee_pairs", (analysis.allRupeePairs || []).map((p) => p.join("-")).join("|")],
  ];

  const emptyTail = ["", "", "", "", "", ""];
  for (const [key, value] of metaRows) {
    lines.push(csvRow(["META", key, value, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ...emptyTail]));
  }

  for (const note of analysis.patternNotes || []) {
    lines.push(csvRow(["PATTERN", "", note, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ...emptyTail]));
  }

  for (const tier of analysis.priceTiers || []) {
    lines.push(
      csvRow([
        "PRICE_TIER",
        "",
        "",
        tier.bestVariantId,
        tier.bestVariantName,
        tier.price,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        tier.gapToNext,
        tier.count,
        `verified=${tier.verifiedCount};no_pid=${tier.noPidCount};dup_pid=${tier.duplicatePidCount}`,
        ...emptyTail,
      ]),
    );
  }

  for (const v of analysis.variantRows || []) {
    lines.push(
      csvRow([
        "VARIANT",
        "",
        "",
        v.variantId,
        v.name,
        v.shippingCost,
        v.estShipping,
        v.isVerified,
        v.liveVerified,
        v.duplicatePid,
        v.noPid,
        v.variantStyle,
        v.path,
        v.kb,
        v.width,
        v.height,
        v.source,
        v.recommended,
        v.pickRank,
        v.score,
        "",
        "",
        "",
        v.savings,
        v.borderPx,
        v.badgeCount,
        v.jpegQuality,
        v.liveTotalPrice,
        v.meeshoPriceUsed,
      ]),
    );
  }

  for (const pick of rec.picks || []) {
    const flat = flattenVariant(pick, {
      recommended: true,
      baseline: num(ctx.baselineShipping),
    });
    lines.push(
      csvRow([
        "RECOMMENDATION",
        "",
        "",
        flat.variantId,
        flat.name,
        flat.shippingCost,
        "",
        flat.isVerified,
        flat.liveVerified,
        flat.duplicatePid,
        flat.noPid,
        flat.variantStyle,
        flat.path,
        flat.kb,
        flat.width,
        flat.height,
        "",
        true,
        "",
        flat.score,
        "",
        "",
        rec.reason,
        flat.savings,
        flat.borderPx,
        flat.badgeCount,
        flat.jpegQuality,
        flat.liveTotalPrice,
        flat.meeshoPriceUsed,
      ]),
    );
  }

  return lines.join("\n");
}

export function exportReportTxt(analysis) {
  const ctx = analysis.context || {};
  const rec = analysis.recommendation || {};
  const stats = analysis.stats || {};
  const lines = [];

  lines.push("=".repeat(72));
  lines.push("MEESHO LIVE VARIANT SHIPPING REPORT");
  lines.push("=".repeat(72));
  lines.push(`Generated: ${analysis.generatedAt}`);
  if (ctx.productLabel) lines.push(`Product: ${ctx.productLabel}`);
  lines.push(
    `Category: ${ctx.categoryName || "—"} (sscat_id ${ctx.categoryId || "—"}) [${ctx.categorySource || "—"}]`,
  );
  lines.push(`Baseline shipping: ₹${ctx.baselineShipping || 0}`);
  lines.push(`Manual price mode: ${ctx.manualMode ? "yes" : "no"}`);
  lines.push("");

  lines.push("-".repeat(72));
  lines.push("SUMMARY");
  lines.push("-".repeat(72));
  lines.push(`Total variants: ${stats.totalVariants} (${stats.primaryCount} primary + ${stats.framedCount} framed extras)`);
  lines.push(`Priced: ${stats.pricedCount} | Unpriced: ${stats.unpricedCount}`);
  lines.push(`Unique price tiers: ${stats.uniquePriceCount} (₹${stats.lowestPrice} – ₹${stats.highestPrice})`);
  lines.push(`Verified live: ${stats.verifiedCount} | No PID kept: ${stats.noPidCount} | Duplicate PID: ${stats.duplicatePidCount}`);
  lines.push("");

  lines.push("-".repeat(72));
  lines.push("RECOMMENDATION");
  lines.push("-".repeat(72));
  lines.push(`Strategy: ${rec.strategy}`);
  lines.push(`Reason: ${rec.reason}`);
  if (rec.picks?.length) {
    lines.push("");
    rec.picks.forEach((p, i) => {
      lines.push(
        `  ${i + 1}. ${p.name} [${p.variantId}] → ₹${p.shippingCost}` +
          `${p.isVerified ? " ✓verified" : ""}` +
          `${p.duplicatePid ? " dupPID" : ""}` +
          `${p.noPid ? " noPID" : ""}`,
      );
    });
  } else {
    lines.push("  (none — add live prices first)");
  }
  lines.push("");

  lines.push("-".repeat(72));
  lines.push("PRICE TIERS (unique shipping ₹)");
  lines.push("-".repeat(72));
  lines.push(
    "Price | Count | Gap→Next | Verified | Best variant",
  );
  for (const t of analysis.priceTiers || []) {
    const pairFlag =
      t.isRupeePairLow && t.isRupeePairHigh
        ? " ₹1↔"
        : t.isRupeePairLow
        ? " ₹1→"
        : t.isRupeePairHigh
        ? " ←₹1"
        : "";
    lines.push(
      `₹${String(t.price).padStart(3)} | ${String(t.count).padStart(5)} | ${t.gapToNext !== "" ? "+" + t.gapToNext : "  —"} | ${t.verifiedCount} | ${t.bestVariantName}${pairFlag}`,
    );
  }
  lines.push("");

  if (analysis.allRupeePairs?.length) {
    lines.push(`All ₹1-apart pairs in this run: ${analysis.allRupeePairs.map((p) => p.join("-")).join(", ")}`);
    lines.push("");
  }

  lines.push("-".repeat(72));
  lines.push("PATTERN NOTES");
  lines.push("-".repeat(72));
  for (const note of analysis.patternNotes || []) {
    lines.push(`• ${note}`);
  }
  lines.push("");

  lines.push("-".repeat(72));
  lines.push("ALL VARIANTS");
  lines.push("-".repeat(72));
  for (const v of analysis.variantRows || []) {
    const dim =
      v.width && v.height ? `${v.width}×${v.height}px` : "—";
    const kb = v.kb ? `${v.kb}KB` : "—";
    const flag = v.recommended ? " ★ RECOMMENDED" : "";
    const pid = v.duplicatePid ? ` pid=${v.duplicatePid}` : "";
    lines.push(
      `${v.name} | ₹${v.shippingCost || "—"} | ${dim} | border ${v.borderPx || "—"}px | badges ${v.badgeCount ?? "—"} | ${kb} | ${v.path || v.variantStyle}${pid}${flag}`,
    );
  }
  lines.push("");
  lines.push("=".repeat(72));
  lines.push("End of report — re-import CSV VARIANT rows to re-analyze without extension.");
  lines.push("=".repeat(72));

  return lines.join("\n");
}

/** Parse exported CSV back into minimal variant rows for standalone re-analysis. */
export function parseReportCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return { variants: [], meta: {} };

  const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
  const idx = (name) => header.indexOf(name);

  const variants = [];
  const meta = {};

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const type = row[idx("record_type")];
    if (type === "META") {
      meta[row[idx("key")]] = row[idx("value")];
    } else if (type === "VARIANT") {
      variants.push({
        variantId: row[idx("variant_id")],
        name: row[idx("name")],
        shippingCost: num(row[idx("shipping_inr")]),
        estShipping: num(row[idx("est_inr")]),
        isVerified: row[idx("verified")] === "true",
        liveVerified: row[idx("live_verified")] === "true",
        duplicatePid: row[idx("duplicate_pid")] || "",
        noPid: row[idx("no_pid")] === "true",
        variantStyle: row[idx("variant_style")],
        meta: {
          path: row[idx("path")],
          kb: row[idx("kb")],
          width: row[idx("width")],
          height: row[idx("height")],
        },
      });
    }
  }

  return { variants, meta };
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function buildReportFilename(analysis, ext) {
  const ts = (analysis.generatedAt || new Date().toISOString())
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const low = analysis.stats?.lowestPrice;
  const suffix = low ? `-from-${low}` : "";
  return `meesho-live-report${suffix}-${ts}.${ext}`;
}

export function downloadReportBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 250);
}

/**
 * Build analysis and download a single CSV report (Excel-friendly).
 */
export function createAndDownloadReport(variants, context = {}) {
  const analysis = analyzeLiveVariants(variants, context);
  const csv = exportReportCsv(analysis);
  downloadReportBlob(
    csv,
    buildReportFilename(analysis, "csv"),
    "text/csv;charset=utf-8",
  );
  return analysis;
}

const LiveVariantReport = {
  scoreVariant,
  pickBestAtPrice,
  uniqueSortedPrices,
  findLowestRupeePair,
  findAllRupeePairs,
  pickRecommendedVariants,
  analyzeLiveVariants,
  exportReportCsv,
  exportReportTxt,
  parseReportCsv,
  buildReportFilename,
  downloadReportBlob,
  createAndDownloadReport,
};

if (typeof window !== "undefined") {
  window.LiveVariantReport = LiveVariantReport;
}

export default LiveVariantReport;
