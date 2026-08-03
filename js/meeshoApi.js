// Meesho API Integration v7.0.0 - Enhanced Variation & Shipping Logic

function staticComposeModuleUrls() {
  const versioned =
    typeof window !== "undefined" && window.WEB_OPTIMIZER_MODE
      ? "/js/staticFrameCompose.mjs?v=129"
      : typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("js/staticFrameCompose.mjs?v=129")
      : "/js/staticFrameCompose.mjs?v=129";
  const plain = versioned.replace(/\?.*$/, "");
  return versioned === plain ? [versioned] : [versioned, plain];
}

async function ensureStaticComposeLoaded() {
  if (typeof window === "undefined") return false;
  if (window.StaticFrameCompose?.composeStaticPreview) return true;
  for (const url of staticComposeModuleUrls()) {
    try {
      await import(url);
      if (window.StaticFrameCompose?.composeStaticPreview) return true;
    } catch (e) {
      console.warn("Static compose import:", e);
    }
  }
  return false;
}

const MeeshoAPI = {
  MAX_RESULT_VARIANTS: 200,
  // Borders outward around full-size product — profiles tuned toward ₹49 (38–48KB slabs)
  LOW_SHIPPING_FRAMED_PROFILES: [
    // Original set (often lands ₹63–65 — kept for comparison)
    { id: "framed_48a", bluePct: 0.12, whitePct: 0.04, targetKb: 48, maxSide: 1200 },
    { id: "framed_48b", bluePct: 0.14, whitePct: 0.05, targetKb: 48, maxSide: 1200 },
    { id: "framed_50a", bluePct: 0.11, whitePct: 0.035, targetKb: 50, maxSide: 1200 },
    { id: "framed_50b", bluePct: 0.13, whitePct: 0.045, targetKb: 50, maxSide: 1200 },
    { id: "framed_46a", bluePct: 0.15, whitePct: 0.05, targetKb: 46, maxSide: 1200 },
    { id: "framed_46b", bluePct: 0.1, whitePct: 0.03, targetKb: 46, maxSide: 1200 },
    // ₹49-tier candidates: thick blue outer (screenshot), lower KB, maxSide 1024
    { id: "low_44_thick", bluePct: 0.18, whitePct: 0.05, targetKb: 44, maxSide: 1024 },
    { id: "low_42_thick", bluePct: 0.2, whitePct: 0.05, targetKb: 42, maxSide: 1024 },
    { id: "low_40_thick", bluePct: 0.17, whitePct: 0.045, targetKb: 40, maxSide: 1024 },
    { id: "low_38_thick", bluePct: 0.19, whitePct: 0.05, targetKb: 38, maxSide: 1024 },
    { id: "low_46_med", bluePct: 0.15, whitePct: 0.04, targetKb: 46, maxSide: 1024 },
    { id: "low_44_med", bluePct: 0.14, whitePct: 0.035, targetKb: 44, maxSide: 1024 },
    { id: "low_48_tall", layout: "tall", bluePct: 0.16, whitePct: 0.05, targetKb: 48, maxSide: 1024 },
    { id: "low_46_tall", layout: "tall", bluePct: 0.18, whitePct: 0.05, targetKb: 46, maxSide: 1024 },
    { id: "low_44_tall", layout: "tall", bluePct: 0.2, whitePct: 0.045, targetKb: 44, maxSide: 1024 },
    { id: "low_42_tall", layout: "tall", bluePct: 0.17, whitePct: 0.04, targetKb: 42, maxSide: 1024 },
  ],
  // Test Lab adaptive hunt — try lowest-KB framed profiles first
  ADAPTIVE_FRAMED_PRIORITY: [
    "low_38_thick",
    "low_40_thick",
    "low_42_thick",
    "low_44_thick",
    "low_46_med",
    "low_44_med",
    "low_48_tall",
    "low_46_tall",
    "low_44_tall",
    "low_42_tall",
    "framed_46a",
    "framed_48a",
  ],
  _initialized: false,
  endpoints: {
    // Meesho routes are in flux: prefer /api/cataloging/* and fallback to older /catalogingapi/api/*
    uploadImage:
      "https://supplier.meesho.com/api/cataloging/singleCatalogUpload/uploadSingleCatalogImages",
    uploadImageFallback:
      "https://supplier.meesho.com/catalogingapi/api/singleCatalogUpload/uploadSingleCatalogImages",
    fetchDuplicatePid:
      "https://supplier.meesho.com/api/cataloging/priceRecommendation/fetchDuplicatePid",
    getTransferPrice:
      "https://supplier.meesho.com/api/cataloging/singleCatalogUpload/getTransferPrice",
    // Meesho currently serves this endpoint under /api/cataloging (the /catalogingapi/* path often returns 463)
    fetchCategories:
      "https://supplier.meesho.com/api/cataloging/bulkCatalogUpload/fetchCategoryTreeOld",
  },

  cache: {
    supplierId: null,
    supplierTag: null,
    categoryId: null,
    catalogImageUrl: null,
    browserId: null,
    price: 100,
    categories: null,
  },

  syncFromSession: function () {
    if (!window.WEB_OPTIMIZER_MODE) return;
    let s = {};
    try {
      if (window.WebSession) s = WebSession.get();
      else s = JSON.parse(localStorage.getItem("meesho_web_session_v1") || "{}");
    } catch (e) {}
    if (s.supplierId) this.cache.supplierId = parseInt(s.supplierId, 10) || s.supplierId;
    if (s.browserId) {
      try {
        this.cache.browserId = decodeURIComponent(s.browserId);
      } catch (e) {
        this.cache.browserId = s.browserId;
      }
    }
    if (s.identifier) this.cache.supplierTag = s.identifier;
    if (s.price) this.cache.price = parseInt(s.price, 10) || 100;
  },

  apiUrl: function (path) {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/api/meesho-proxy" + path;
    }
    return "https://supplier.meesho.com" + path;
  },

  requestHeaders: function (extra) {
    this.syncFromSession();
    const headers = { ...this.getHeaders(), ...(extra || {}) };
    if (window.WEB_OPTIMIZER_MODE) {
      let cookie = "";
      try {
        if (window.WebSession) cookie = WebSession.get().cookie || "";
        else {
          cookie =
            JSON.parse(localStorage.getItem("meesho_web_session_v1") || "{}")
              .cookie || "";
        }
        if (cookie && window.WebSession?.normalizeCookie) {
          cookie = WebSession.normalizeCookie(cookie);
        }
      } catch (e) {}
      if (cookie) headers["x-meesho-cookie"] = cookie;
    }
    return headers;
  },

  assetUrl: function (path) {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
    return "/" + String(path).replace(/^\//, "");
  },

  badgeCache: {},

  // Track shipping results
  shippingHistory: new Map(),

  // Keep generateVariation for fallback but use minimal by default
  generateVariation: async function (originalBlob, seed, strategy, bestParams) {
    return this.generateVariationFull(originalBlob, seed, bestParams);
  },

  init: function () {
    if (this._initialized) return;
    this._initialized = true;
    this.syncFromSession();
    this.detectAllValues();
    // Avoid API calls when user is not authenticated yet.
    // Categories load on demand in the optimizer UI (full static tree for extension).
    if (this.cache.supplierId && window.WEB_OPTIMIZER_MODE) {
      this.fetchCategories();
    }
    console.log("fetchCategories endpoint:", this.endpoints.fetchCategories);
    console.log("📦 MeeshoAPI v7.0 initialized");
  },

  detectAllValues: function () {
    const cookieBrowser = this.getCookie("browser_id") || "";
    if (cookieBrowser) {
      this.cache.browserId = cookieBrowser;
    } else if (window.WEB_OPTIMIZER_MODE) {
      this.syncFromSession();
    }

    const urlMatch = window.location.href.match(/\/cataloging\/([^\/]+)/);
    if (urlMatch) {
      this.cache.supplierTag = urlMatch[1];
    } else if (window.WEB_OPTIMIZER_MODE) {
      this.syncFromSession();
    }

    const detectedSupplier = this.detectSupplierId();
    if (detectedSupplier) this.cache.supplierId = detectedSupplier;

    if (!window.WEB_OPTIMIZER_MODE || !this.cache.price) {
      const detectedPrice = this.detectPrice();
      if (detectedPrice) this.cache.price = detectedPrice;
    }
    if (!window.WEB_OPTIMIZER_MODE) {
      const catalog = this.detectCatalogPricing();
      if (catalog.meeshoPrice) this.cache.price = catalog.meeshoPrice;
      if (catalog.customerShipping) this.cache.panelShipping = catalog.customerShipping;
    }

    if (!this.cache.categoryId) {
      this.cache.categoryId = this.detectCategoryId();
    }

    console.log("🔍 Auto-detected:", this.cache);
  },

  getCookie: function (name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)"),
    );
    return match ? decodeURIComponent(match[2]) : "";
  },

  detectSupplierId: function () {
    if (window.WEB_OPTIMIZER_MODE && window.WebSession) {
      const s = WebSession.get();
      if (s.supplierId) return parseInt(s.supplierId, 10) || s.supplierId;
    }
    try {
      const mpCookie = this.getCookie(
        "mp_a66867feba42257f4b46689d52d48f86_mixpanel",
      );
      if (mpCookie) {
        const decoded = JSON.parse(mpCookie);
        if (decoded.Supplier_id) {
          console.log("✅ Supplier ID from cookie:", decoded.Supplier_id);
          return decoded.Supplier_id;
        }
      }
    } catch (e) {}
    return null;
  },

  parseCategoryId: function (raw) {
    if (raw == null || raw === "") return null;
    const id = parseInt(String(raw).trim(), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  },

  /** Read sscat_id from the open Meesho catalog form (edit/add listing). */
  detectCategoryIdFromDom: function () {
    const pick = (raw) => this.parseCategoryId(raw);

    const selectors = [
      'input[name="sscat_id"]',
      'input[name*="sscat"]',
      'select[name*="sscat"]',
      'select[name*="category"]',
      'input[name*="sub_sub_category"]',
      'input[name*="subSubCategory"]',
      'input[id*="sscat"]',
      '[data-sscat-id]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const fromVal = el.value ?? el.getAttribute?.("value");
      const id = pick(fromVal);
      if (id) return id;
      const dataId = pick(
        el.dataset?.sscatId ?? el.getAttribute?.("data-sscat-id"),
      );
      if (dataId) return dataId;
    }

    try {
      const u = new URL(location.href);
      for (const key of ["sscat_id", "sscat", "category_id", "categoryId"]) {
        const id = pick(u.searchParams.get(key));
        if (id) return id;
      }
    } catch (e) {}

    for (const inp of document.querySelectorAll('input[type="hidden"]')) {
      const name = (inp.name || "").toLowerCase();
      if (
        name.includes("sscat") ||
        name.includes("sub_sub") ||
        (name.includes("category") && name.includes("id"))
      ) {
        const id = pick(inp.value);
        if (id) return id;
      }
    }

    for (const inp of document.querySelectorAll("input, textarea")) {
      const val = (inp.value || "").trim();
      if (/^\d{4,6}$/.test(val)) {
        const id = pick(val);
        if (id && typeof MeeshoCategories !== "undefined" && MeeshoCategories.findById) {
          if (MeeshoCategories.findById(id)) return id;
        }
      }
    }

    return null;
  },

  detectCategoryIdFromLabels: function () {
    if (typeof MeeshoCategories === "undefined" || !MeeshoCategories.findByLabel) {
      return null;
    }

    const inputs = Array.from(
      document.querySelectorAll(
        'input[role="combobox"], input.MuiInputBase-input, input.MuiOutlinedInput-input, input[type="text"]',
      ),
    );

    const categoryInputs = inputs.filter((inp) => {
      const block =
        inp.closest("form, section, div")?.textContent?.slice(0, 400) || "";
      const hint = `${inp.getAttribute("aria-label") || ""} ${inp.placeholder || ""} ${inp.name || ""} ${block}`.toLowerCase();
      return (
        hint.includes("categor") ||
        hint.includes("sscat") ||
        hint.includes("sub sub") ||
        hint.includes("sub-sub")
      );
    });

    for (let i = categoryInputs.length - 1; i >= 0; i--) {
      const val = (categoryInputs[i].value || "").trim();
      if (val.length < 2 || val.length > 80) continue;
      if (/^\d{4,6}$/.test(val)) {
        const id = this.parseCategoryId(val);
        if (id) return id;
      }
      const id = MeeshoCategories.findByLabel(val);
      if (id) return id;
    }

    for (let i = inputs.length - 1; i >= 0; i--) {
      const val = (inputs[i].value || "").trim();
      if (val.length < 2 || val.length > 60 || val.includes("₹")) continue;
      if (/^\d{4,6}$/.test(val)) {
        const id = this.parseCategoryId(val);
        if (id && MeeshoCategories.findById(id)) return id;
        continue;
      }
      const id = MeeshoCategories.findByLabel(val);
      if (id) return id;
    }

    return null;
  },

  detectCategoryIdFromScripts: function () {
    const pick = (raw) => this.parseCategoryId(raw);
    const patterns = [
      /"sscat_id"\s*:\s*"?(\d+)"?/g,
      /"sub_sub_category_id"\s*:\s*"?(\d+)"?/g,
      /sscat_id["']?\s*[:=]\s*"?(\d+)"?/g,
    ];

    for (const script of document.querySelectorAll("script:not([src])")) {
      const text = script.textContent || "";
      if (!text.includes("sscat") && !text.includes("sub_sub")) continue;
      for (const re of patterns) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(text))) {
          const id = pick(match[1]);
          if (id) return id;
        }
      }
    }
    return null;
  },

  detectCategoryId: function () {
    const methods = [
      () => this.detectCategoryIdFromDom(),
      () => this.detectCategoryIdFromLabels(),
      () => this.detectCategoryIdFromScripts(),
    ];

    for (const fn of methods) {
      try {
        const id = fn();
        if (id) {
          console.log("📁 Detected Meesho page category:", id);
          return id;
        }
      } catch (e) {}
    }
    return null;
  },

  /**
   * Category priority: explicit user pick → Meesho page form → Kurtis/default.
   */
  resolveCategoryId: function (options = {}) {
    const userId = this.parseCategoryId(options.userCategoryId);
    if (userId) return userId;

    if (!options.skipPageDetect) {
      const pageId = this.detectCategoryId();
      if (pageId) return pageId;
      if (this.cache.categoryId) return this.cache.categoryId;
    }

    if (options.allowDefault !== false) {
      if (typeof MeeshoCategories !== "undefined") {
        const def = MeeshoCategories.getDefaultCategoryId();
        if (def) return def;
      }
      return 10004;
    }

    return null;
  },

  isMeeshoHostedImageUrl: function (url) {
    if (!url || typeof url !== "string") return false;
    const raw = url.trim();
    if (!raw || raw.startsWith("blob:") || raw.startsWith("data:")) return false;
    try {
      const host = new URL(raw, location.origin).hostname.toLowerCase();
      return host.includes("meesho") || host.includes("cdnmeesho");
    } catch (e) {
      return false;
    }
  },

  normalizeCatalogImageUrl: function (url) {
    if (!url || typeof url !== "string") return null;
    const raw = url.trim();
    if (!this.isMeeshoHostedImageUrl(raw)) return null;
    try {
      const u = new URL(raw, location.origin);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.href;
    } catch (e) {
      return null;
    }
  },

  /** Existing product image already on the Meesho catalog page (skip re-upload when unchanged). */
  detectCatalogImageUrl: function () {
    const candidates = [];
    const add = (url) => {
      const normalized = this.normalizeCatalogImageUrl(url);
      if (normalized) candidates.push(normalized);
    };

    for (const inp of document.querySelectorAll(
      'input[type="hidden"], input[type="text"]',
    )) {
      const name = (inp.name || "").toLowerCase();
      if (
        (name.includes("image") || name.includes("photo") || name.includes("catalog")) &&
        inp.value
      ) {
        add(inp.value);
      }
    }

    const front = document.querySelector("#changeFrontImage");
    const scope =
      front?.closest(
        'form, section, [class*="catalog"], [class*="upload"], [class*="image"]',
      ) || document;

    for (const img of scope.querySelectorAll("img[src], img[srcset]")) {
      add(img.currentSrc || img.src);
      const srcset = img.getAttribute("srcset");
      if (srcset) {
        for (const part of srcset.split(",")) {
          const piece = part.trim().split(/\s+/)[0];
          if (piece) add(piece);
        }
      }
    }

    for (const el of scope.querySelectorAll(
      "[data-src], [data-image], [data-original], [style*='background-image']",
    )) {
      add(el.getAttribute("data-src"));
      add(el.getAttribute("data-image"));
      add(el.getAttribute("data-original"));
      const bg = el.style?.backgroundImage || "";
      const bgMatch = bg.match(/url\(["']?([^"')]+)/i);
      if (bgMatch) add(bgMatch[1]);
    }

    if (!candidates.length) {
      for (const img of document.querySelectorAll(
        'img[src*="meesho"], img[src*="cdnmeesho"]',
      )) {
        add(img.currentSrc || img.src);
      }
    }

    const scored = candidates.map((url) => {
      const low = url.toLowerCase();
      let score = 0;
      if (low.includes("thumbnail") || low.includes("_thumb") || low.includes("/thumb")) {
        score -= 10;
      }
      if (low.includes("icon") || low.includes("logo") || low.includes("badge")) {
        score -= 20;
      }
      if (/\d{3,4}x\d{3,4}/.test(low)) score += 4;
      return { url, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0]?.url || null;
    if (best) this.cache.catalogImageUrl = best;
    return best || this.cache.catalogImageUrl || null;
  },

  blobImageSize: async function (blob) {
    if (!blob) return { w: 0, h: 0 };
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(blob);
      const size = { w: bmp.width, h: bmp.height };
      bmp.close?.();
      return size;
    }
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ w: 0, h: 0 });
      };
      img.src = url;
    });
  },

  blobMatchesRemoteImage: async function (blob, remoteUrl, options = {}) {
    if (!blob || !remoteUrl) return false;
    try {
      const remoteBlob =
        options._cachedRemoteBlob ||
        (await fetch(remoteUrl, { credentials: "include" }).then((r) => r.blob()));
      if (!remoteBlob?.size || !blob.size) return false;

      const sizeRatio = blob.size / remoteBlob.size;
      if (sizeRatio < 0.97 || sizeRatio > 1.03) return false;

      const [local, remote] = await Promise.all([
        this.blobImageSize(blob),
        this.blobImageSize(remoteBlob),
      ]);
      if (!local.w || !remote.w) return false;
      return local.w === remote.w && local.h === remote.h;
    } catch (e) {
      return false;
    }
  },

  prepareCatalogImageReuse: async function (originalBlob) {
    const catalogImageUrl = this.detectCatalogImageUrl();
    if (!catalogImageUrl || !originalBlob) {
      return { catalogImageUrl: null, sourceMatchesPage: false, cachedRemoteBlob: null };
    }

    let cachedRemoteBlob = null;
    try {
      cachedRemoteBlob = await fetch(catalogImageUrl, {
        credentials: "include",
      }).then((r) => r.blob());
    } catch (e) {
      console.warn("Could not fetch Meesho page image for reuse check:", e.message);
    }

    const sourceMatchesPage = cachedRemoteBlob
      ? await this.blobMatchesRemoteImage(originalBlob, catalogImageUrl, {
          _cachedRemoteBlob: cachedRemoteBlob,
        })
      : false;

    if (sourceMatchesPage) {
      console.log("♻️ Source image matches Meesho page — will reuse page URL when unchanged");
    }

    return { catalogImageUrl, sourceMatchesPage, cachedRemoteBlob };
  },

  uploadImageForPricing: async function (blob, filename, options = {}) {
    const pageUrl = options.catalogImageUrl || this.detectCatalogImageUrl();
    if (
      options.preferPageImage &&
      pageUrl &&
      options.compareBlob !== false
    ) {
      const same = await this.blobMatchesRemoteImage(blob, pageUrl, options);
      if (same) {
        console.log("♻️ Reusing Meesho page image URL (skip upload)");
        return pageUrl;
      }
    }
    return this.uploadImage(blob, filename);
  },

  /** Parse ₹ from Meesho catalog pricing card (supplier panel). */
  detectCatalogPricing: function () {
    const out = {
      meeshoPrice: null,
      customerShipping: null,
      customerPrice: null,
      settlement: null,
    };
    const parseRupee = (text) => {
      const m = String(text || "").match(/₹\s*([\d,]+(?:\.\d+)?)/);
      if (!m) return null;
      const n = parseInt(String(m[1]).replace(/,/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const nodes = document.querySelectorAll("p, span, div, td, th, label, h6");
    for (const el of nodes) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || t.length > 120) continue;
      const low = t.toLowerCase();
      const val = parseRupee(t);
      if (!val) continue;
      if (low.includes("meesho price") && out.meeshoPrice == null) {
        out.meeshoPrice = val;
      } else if (
        (low.includes("shipping") && low.includes("customer")) ||
        low.includes("shipping (paid")
      ) {
        out.customerShipping = val;
      } else if (low.includes("customer price") && out.customerPrice == null) {
        out.customerPrice = val;
      } else if (
        (low.includes("settlement") || low.includes("bank settlement")) &&
        out.settlement == null
      ) {
        out.settlement = val;
      }
    }

    if (out.meeshoPrice && out.customerPrice && !out.customerShipping) {
      out.customerShipping = out.customerPrice - out.meeshoPrice;
    }
    if (out.meeshoPrice && out.customerShipping && !out.customerPrice) {
      out.customerPrice = out.meeshoPrice + out.customerShipping;
    }
    return out;
  },

  /** Sync selling price + category from the open Meesho catalog form. */
  syncCatalogPricing: function () {
    this.detectAllValues();
    const catalog = this.detectCatalogPricing();
    if (catalog.meeshoPrice) {
      this.cache.price = catalog.meeshoPrice;
      this.cache.catalogPrice = catalog.meeshoPrice;
    }
    if (catalog.customerShipping) {
      this.cache.panelShipping = catalog.customerShipping;
    }
    const formPrice = this.detectPrice();
    if (formPrice && !catalog.meeshoPrice) {
      this.cache.price = formPrice;
    }
    const pageCategoryId = this.detectCategoryId();
    if (pageCategoryId && !this.cache.categoryId) {
      this.cache.categoryId = pageCategoryId;
    }
    this.detectCatalogImageUrl();
    return { ...catalog, priceUsed: this.cache.price || 100 };
  },

  detectPrice: function () {
    const catalog = this.detectCatalogPricing();
    if (catalog.meeshoPrice) return catalog.meeshoPrice;

    const preferNames = [
      "transfer_price",
      "supplier_price",
      "selling_price",
      "meesho_price",
      "price",
    ];
    const inputs = document.querySelectorAll("input");
    for (const key of preferNames) {
      for (const inp of inputs) {
        const name = (inp.name || "").toLowerCase();
        const id = (inp.id || "").toLowerCase();
        const aria = (inp.getAttribute("aria-label") || "").toLowerCase();
        if (
          (name.includes(key) || id.includes(key) || aria.includes("meesho")) &&
          inp.value
        ) {
          const v = parseInt(String(inp.value).replace(/,/g, ""), 10);
          if (v > 0 && v < 30000) return v;
        }
      }
    }
    for (const inp of inputs) {
      const name = (inp.name || "").toLowerCase();
      if (
        (name.includes("price") || name === "mrp") &&
        inp.value &&
        !name.includes("mrp")
      ) {
        const v = parseInt(String(inp.value).replace(/,/g, ""), 10);
        if (v > 0 && v < 30000) return v;
      }
    }
    return this.cache.price || 100;
  },

  setCategory: function (id) {
    if (id == null || id === "" || id === false) {
      this.cache.categoryId = null;
      console.log("📁 Category cleared");
      return;
    }
    const parsed = this.parseCategoryId(id);
    if (parsed) {
      this.cache.categoryId = parsed;
      console.log("📁 Category set to:", parsed);
    }
  },

  getHeaders: function () {
    return {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
      "client-type": "d-web",
      "client-package-version": "1.0.1",
      "browser-id": this.cache.browserId || "",
      identifier: this.cache.supplierTag || "",
      "supplier-id": this.cache.supplierId ? String(this.cache.supplierId) : "",
    };
  },

  fetchCategories: async function (forceLive) {
    if (this.cache.categories?.length && !forceLive) {
      if (
        !window.WEB_OPTIMIZER_MODE ||
        this.cache.categories.length >= (MeeshoCategories?.FULL_CATEGORY_MIN || 3000)
      ) {
        return this.cache.categories;
      }
    }
    this._lastCategoryFetchWasFallback = false;
    this._lastCategoryFetchWasEmbedded = false;

    const minFull = MeeshoCategories?.FULL_CATEGORY_MIN || 3000;

    // Embedded LIST (extension bundle) — no network; reliable on Kiwi after browser restart.
    const embedded = this.getEmbeddedCategories();
    if (embedded?.length >= minFull && !forceLive) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      console.log("✅ Using embedded categories:", embedded.length);
      return embedded;
    }

    // Extension lite path: JSON fetch + storage cache (fallback if lite script is used).
    if (!window.WEB_OPTIMIZER_MODE && !forceLive) {
      if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.ensureLoaded) {
        try {
          const fromLite = await MeeshoCategories.ensureLoaded();
          if (fromLite?.length) {
            this.cache.categories = fromLite;
            this._lastCategoryFetchWasEmbedded = true;
            return fromLite;
          }
        } catch (e) {
          console.warn("Extension ensureLoaded failed:", e.message);
        }
      }
      const fromJson = await this.loadEmbeddedCategoriesFromJson();
      if (fromJson?.length) return fromJson;
    }

    const imported = this.getImportedCategories();
    if (imported?.length && !forceLive) {
      this.cache.categories = imported;
      return imported;
    }

    // Live Meesho API — only when user clicks Refresh (never default for extension).
    if (forceLive) {
      try {
        const resp = await fetch(
          this.apiUrl(
            "/api/cataloging/bulkCatalogUpload/fetchCategoryTreeOld",
          ),
          {
          method: "POST",
          headers: this.requestHeaders(),
          body: JSON.stringify({
            bulk_upload_enabled: false,
            supplier_id: this.cache.supplierId,
            identifier: this.cache.supplierTag,
          }),
          credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.warn(
            "⚠️ fetchCategories failed:",
            resp.status,
            resp.statusText,
            errText.slice(0, 200),
          );
        } else {
          const result = await resp.json();
          if (result.items?.length > 0) {
            const subCat = result.items.find((i) => i.type === "sub-sub-category");
            if (subCat?.data) {
              this.cache.categories = subCat.data.map((c) => ({
                id: parseInt(c.id),
                name: c.name,
                parentName: c.parent_name,
              }));
              console.log("✅ Categories loaded:", this.cache.categories.length);
              return this.cache.categories;
            }
          }
        }
      } catch (e) {
        console.error("Categories error:", e);
      }
    }

    if (embedded?.length) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      return this.cache.categories;
    }

    if (window.WEB_OPTIMIZER_MODE) {
      const fromJson = await this.loadEmbeddedCategoriesFromJson();
      if (fromJson?.length) return fromJson;
    } else {
      const fromJson = await this.loadEmbeddedCategoriesFromJson();
      if (fromJson?.length) return fromJson;
    }

    return null;
  },

  ensureFullCategories: async function () {
    const minFull = MeeshoCategories?.FULL_CATEGORY_MIN || 3000;
    if (this.cache.categories?.length >= minFull) return this.cache.categories;

    const list = await this.fetchCategories(false);
    if (list?.length) return list;

    return this.cache.categories || [];
  },

  getEmbeddedCategories: function () {
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.getList) {
      const list = MeeshoCategories.getList();
      if (list.length) return list;
    }
    if (window.MEESHO_EMBEDDED_CATEGORIES?.length) {
      return window.MEESHO_EMBEDDED_CATEGORIES;
    }
    if (window.FALLBACK_CATEGORIES?.length) {
      return window.FALLBACK_CATEGORIES;
    }
    return null;
  },

  ensureEmbeddedCategories: function () {
    const embedded = this.getEmbeddedCategories();
    if (embedded?.length) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      this._lastCategoryFetchWasFallback = false;
      return embedded;
    }
    return null;
  },

  loadEmbeddedCategoriesFromJson: async function () {
    const minFull = MeeshoCategories?.FULL_CATEGORY_MIN || 3000;
    const already = this.getEmbeddedCategories();
    if (already?.length >= minFull) {
      this.cache.categories = already;
      this._lastCategoryFetchWasEmbedded = true;
      return already;
    }

    try {
      const urls = [];
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        urls.push(chrome.runtime.getURL("data/meesho-category-tree.json"));
      }
      if (window.WEB_OPTIMIZER_MODE) {
        urls.push("/data/meesho-category-tree.json");
      }
      for (const url of urls) {
        try {
          const resp = await fetch(url, { cache: "force-cache" });
          if (!resp.ok) continue;
          const tree = await resp.json();
          const list =
            typeof MeeshoCategories !== "undefined" && MeeshoCategories.parseTree
              ? MeeshoCategories.parseTree(tree)
              : null;
          if (list?.length) {
            this.cache.categories = list;
            this._lastCategoryFetchWasEmbedded = true;
            if (typeof MeeshoCategories !== "undefined") {
              MeeshoCategories._list = list;
            }
            console.log("✅ Categories loaded from JSON:", list.length);
            return list;
          }
        } catch (e) {
          console.warn("Could not load category JSON:", url, e);
        }
      }
    } catch (e) {
      console.warn("Could not load category tree JSON", e);
    }
    return null;
  },

  getCategories: function () {
    return this.cache.categories || [];
  },

  getImportedCategories: function () {
    if (!window.WEB_OPTIMIZER_MODE) return null;
    try {
      const raw = localStorage.getItem("meesho_imported_categories_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch (e) {
      return null;
    }
  },

  importCategoryTreeJson: function (raw) {
    let data = raw;
    if (typeof raw === "string") {
      const text = raw.trim();
      if (!text) throw new Error("Paste Meesho category JSON first");
      data = JSON.parse(text);
    }

    const categories =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.parseTree(data)
        : [];

    if (!categories.length) {
      throw new Error("Could not find sub-sub-category list in JSON");
    }

    localStorage.setItem(
      "meesho_imported_categories_v1",
      JSON.stringify(categories),
    );
    this.cache.categories = categories;
    this._lastCategoryFetchWasFallback = false;
    this._lastCategoryFetchWasEmbedded = false;
    return categories;
  },

  uploadImage: async function (blob, filename) {
    const formData = new FormData();
    formData.append("file", blob, filename || "img-" + Date.now() + ".jpg");
    formData.append("data", "undefined");
    try {
      const resp = await fetch(
        this.apiUrl(
          "/api/cataloging/singleCatalogUpload/uploadSingleCatalogImages",
        ),
        {
        method: "POST",
        headers: {
          accept: "application/json, text/plain, */*",
          "browser-id": this.cache.browserId || "",
          "client-type": "d-web",
          "client-package-version": "1.0.1",
          identifier: this.cache.supplierTag || "",
          "supplier-id": this.cache.supplierId
            ? String(this.cache.supplierId)
            : "",
          ...(window.WEB_OPTIMIZER_MODE &&
          (() => {
            try {
              let c = window.WebSession
                ? WebSession.get().cookie
                : JSON.parse(localStorage.getItem("meesho_web_session_v1") || "{}").cookie;
              if (c && window.WebSession?.normalizeCookie) {
                c = WebSession.normalizeCookie(c);
              }
              return c ? { "x-meesho-cookie": c } : {};
            } catch (e) {
              return {};
            }
          })()),
        },
        body: formData,
        credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) {
        const fallback = await fetch(
          this.apiUrl(
            "/catalogingapi/api/singleCatalogUpload/uploadSingleCatalogImages",
          ),
          {
            method: "POST",
            headers: {
              accept: "application/json, text/plain, */*",
              "browser-id": this.cache.browserId || "",
              "client-type": "d-web",
              "client-package-version": "1.0.1",
              identifier: this.cache.supplierTag || "",
              "supplier-id": this.cache.supplierId
                ? String(this.cache.supplierId)
                : "",
              ...(window.WEB_OPTIMIZER_MODE &&
              (() => {
                try {
                  let c = window.WebSession
                    ? WebSession.get().cookie
                    : JSON.parse(
                        localStorage.getItem("meesho_web_session_v1") || "{}"
                      ).cookie;
                  if (c && window.WebSession?.normalizeCookie) {
                    c = WebSession.normalizeCookie(c);
                  }
                  return c ? { "x-meesho-cookie": c } : {};
                } catch (e) {
                  return {};
                }
              })()),
            },
            body: formData,
            credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
            signal: AbortSignal.timeout(20000),
          }
        );
        if (!fallback.ok) return null;
        const fb = await fallback.json();
        return fb.image || null;
      }
      const result = await resp.json();
      console.log("📤 Image uploaded:", result.image);
      return result.image;
    } catch (e) {
      console.error("Upload error:", e);
      return null;
    }
  },

  fetchDuplicatePid: async function (imageUrl, categoryId) {
    const sscatId = categoryId || this.cache.categoryId || 18044;
    try {
      const resp = await fetch(
        this.apiUrl(
          "/api/cataloging/priceRecommendation/fetchDuplicatePid",
        ),
        {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify({
          is_old_image_match_enabled: true,
          sscat_id: sscatId,
          image_url: imageUrl,
        }),
        credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
      });
      if (!resp.ok) return null;
      const result = await resp.json();
      const pid =
        result.data?.duplicate_pid ??
        result.duplicate_pid ??
        result.data?.duplicatePid ??
        null;
      console.log("🔍 Duplicate PID:", pid);
      return pid || null;
    } catch (e) {
      return null;
    }
  },

  /** Normalize getTransferPrice JSON */
  parseTransferPriceResponse: function (raw, duplicatePidFromFetch) {
    const data = raw?.data;
    const payload =
      data && typeof data === "object" &&
      (data.shipping_charges != null ||
        data.shippingCharges != null ||
        data.total_price != null ||
        data.totalPrice != null ||
        data.transfer_price != null)
        ? data
        : raw;
    const shippingRaw =
      payload?.shipping_charges ?? payload?.shippingCharges ?? null;
    const shippingNum = Number(shippingRaw);
    const duplicatePid =
      duplicatePidFromFetch ??
      payload?.duplicate_pid ??
      payload?.duplicatePid ??
      raw?.data?.duplicate_pid ??
      null;
    return {
      shippingCharges: Number.isFinite(shippingNum)
        ? Math.round(shippingNum)
        : null,
      duplicatePid: duplicatePid || null,
      price: payload?.price != null ? Number(payload.price) : null,
      totalPrice:
        payload?.total_price != null
          ? Number(payload.total_price)
          : payload?.totalPrice != null
          ? Number(payload.totalPrice)
          : null,
      transferPrice:
        payload?.transfer_price != null ? Number(payload.transfer_price) : null,
      customerShipping: null,
    };
  },

  /** Customer shipping = Customer Price − Meesho Price (same at ₹100 or ₹200 for one image). */
  deriveCustomerShipping: function (totalPrice, sellingPrice) {
    if (totalPrice == null || sellingPrice == null) return null;
    const n = Math.round(Number(totalPrice) - Number(sellingPrice));
    if (Number.isFinite(n) && n > 0 && n < 500) return n;
    return null;
  },

  /**
   * Customer shipping from getTransferPrice.
   * Prefer total_price − selling_price (matches panel at any Meesho Price).
   * shipping_charges alone often under-reports (e.g. ₹64 vs panel ₹79).
   */
  resolveLiveShippingCost: function (parsed, priceUsed) {
    if (!parsed) return null;
    const derived = this.deriveCustomerShipping(parsed.totalPrice, priceUsed);
    if (derived != null) return derived;
    const apiShip = parsed.shippingCharges;
    return apiShip != null && apiShip > 0 ? apiShip : null;
  },

  /** Selling prices to cross-check when API fields disagree (shipping is image-based, not price-tier). */
  buildShippingProbePrices: function (primaryPrice) {
    const nums = [primaryPrice, this.cache.catalogPrice, this.cache.price, 100, 200]
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n < 30000);
    return [...new Set(nums)].slice(0, 3);
  },

  consensusCustomerShipping: function (quotes) {
    if (!quotes?.length) return null;
    const withTotal = quotes.filter((q) => q.hasTotal && q.customer != null);
    if (withTotal.length) {
      const vals = withTotal.map((q) => q.customer);
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      if (max - min <= 2) return Math.round((max + min) / 2);
      return max;
    }
    const fallback = quotes.map((q) => q.customer).filter((v) => v != null);
    return fallback.length ? Math.max(...fallback) : null;
  },

  _requestTransferPrice: async function ({
    imageUrl,
    price,
    duplicatePid,
    sscatId,
    supplierId,
    gstPct,
  }) {
    const body = {
      sscat_id: sscatId,
      gst_percentage: gstPct,
      price: price,
      supplier_id: supplierId,
      gst_type: "GSTIN",
      image_url: imageUrl,
    };
    if (duplicatePid) body.duplicate_pid = duplicatePid;

    console.log(
      "getTransferPrice:",
      duplicatePid ? `pid=${duplicatePid}` : "no pid",
      `sscat=${sscatId}`,
      `price=${price}`,
    );

    const resp = await fetch(
      this.apiUrl("/api/cataloging/singleCatalogUpload/getTransferPrice"),
      {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify(body),
        credentials: window.WEB_OPTIMIZER_MODE ? "same-origin" : "include",
      },
    );
    if (!resp.ok) return null;
    const result = await resp.json();
    return this.parseTransferPriceResponse(result, duplicatePid);
  },

  getShippingCharges: async function (imageUrl, options = {}) {
    this.syncCatalogPricing();
    const sscatId = options.sscatId || this.cache.categoryId || 18044;
    const supplierId = this.cache.supplierId;
    const primaryPrice =
      options.price ||
      this.detectPrice() ||
      this.cache.catalogPrice ||
      this.cache.price ||
      100;
    const gstPct = options.gstPercentage ?? 0;

    let duplicatePid = null;
    if (imageUrl)
      duplicatePid = await this.fetchDuplicatePid(imageUrl, sscatId);

    try {
      const runProbe = async (price) => {
        const parsed = await this._requestTransferPrice({
          imageUrl,
          price,
          duplicatePid,
          sscatId,
          supplierId,
          gstPct,
        });
        if (!parsed) return null;
        if (!duplicatePid && parsed.duplicatePid) duplicatePid = parsed.duplicatePid;
        const customer = this.resolveLiveShippingCost(parsed, price);
        return {
          price,
          parsed,
          customer,
          hasTotal: parsed.totalPrice != null,
          apiRaw: parsed.shippingCharges,
        };
      };

      const quotes = [];
      const first = await runProbe(primaryPrice);
      if (!first) return null;
      quotes.push(first);

      const needsCrossCheck =
        !options.skipCrossCheck &&
        (first.customer == null ||
          !first.hasTotal ||
          (first.apiRaw != null &&
            first.customer != null &&
            Math.abs(first.apiRaw - first.customer) > 3));

      if (needsCrossCheck) {
        const alternates = this.buildShippingProbePrices(primaryPrice).filter(
          (p) => p !== primaryPrice,
        );
        for (const alt of alternates.slice(0, 2)) {
          await new Promise((r) => setTimeout(r, 30));
          const q = await runProbe(alt);
          if (q) quotes.push(q);
          const derived = quotes.filter((x) => x.hasTotal && x.customer != null);
          if (derived.length >= 2) {
            const vals = derived.map((x) => x.customer);
            if (Math.max(...vals) - Math.min(...vals) <= 2) break;
          }
        }
      }

      const customer = this.consensusCustomerShipping(quotes);
      const anchor = quotes.find((q) => q.customer === customer) || first;
      const parsed = { ...anchor.parsed };
      parsed.priceUsed = anchor.price;
      parsed.customerShipping = customer;
      parsed.shippingCharges = customer;
      parsed.probePrices = quotes.map((q) => q.price);

      console.log(
        "Live customer shipping:",
        parsed.shippingCharges,
        `(probed ₹${quotes.map((q) => q.price).join(", ₹")})`,
        duplicatePid ? `(pid: ${duplicatePid})` : "(no pid)",
        parsed.totalPrice != null ? `total=${parsed.totalPrice}` : "",
        anchor.apiRaw != null && anchor.apiRaw !== customer
          ? `api shipping_charges=${anchor.apiRaw}`
          : "",
      );
      return parsed;
    } catch (e) {
      console.warn("getShippingCharges failed:", e);
      return null;
    }
  },

  /** Re-fetch getTransferPrice so UI ₹ matches live API */
  confirmLiveShippingForResults: async function (results, onProgress, shouldStopFn) {
    if (!results?.length) return results;
    for (let i = 0; i < results.length; i++) {
      if (shouldStopFn && shouldStopFn()) break;
      const row = results[i];
      const url = row.uploadedUrl || row.pricingImageUrl;
      if (!url || String(url).startsWith("data:")) continue;
      if (onProgress) onProgress(i + 1, results.length, row.name);
      const priceData = await this.getShippingCharges(url);
      if (priceData?.shippingCharges == null) continue;
      row.shippingCost = priceData.shippingCharges;
      row.duplicatePid = priceData.duplicatePid || row.duplicatePid;
      row.isVerified = !!row.duplicatePid;
      row.liveVerified = true;
      row.liveTotalPrice = priceData.totalPrice;
      row.meeshoPriceUsed = priceData.priceUsed;
      if (i < results.length - 1) {
        await new Promise((r) => setTimeout(r, 40));
      }
    }
    results.sort((a, b) => (a.shippingCost || 999) - (b.shippingCost || 999));
    return results;
  },

  // Smart Search — keep every generated image; rank verified PID first
  smartSearch: async function (
    originalBlob,
    targetShipping,
    maxAttempts,
    onProgress,
    onFound,
    shouldStopFn,
    options = {},
  ) {
    const maxShippingCap =
      options.maxShippingCap != null ? Number(options.maxShippingCap) : null;
    console.log(
      `🎯 Smart Search: Target ≤ ₹${targetShipping}, Max: ${maxAttempts}${maxShippingCap ? `, cap ≤₹${maxShippingCap}` : ""}`,
    );
    this.syncCatalogPricing();

    if (typeof ImageGenerator !== "undefined" && ImageGenerator.preloadBadges) {
      await ImageGenerator.preloadBadges();
    }
    if (shouldStopFn && shouldStopFn()) {
      return {
        success: false,
        results: [],
        bestResult: null,
        targetReached: false,
        attempts: 0,
        noPidCount: 0,
        verifiedCount: 0,
      };
    }
    if (this.preloadBadges) {
      await this.preloadBadges();
    }
    if (shouldStopFn && shouldStopFn()) {
      return {
        success: false,
        results: [],
        bestResult: null,
        targetReached: false,
        attempts: 0,
        noPidCount: 0,
        verifiedCount: 0,
      };
    }

    const imageReuse = await this.prepareCatalogImageReuse(originalBlob);
    if (shouldStopFn && shouldStopFn()) {
      return {
        success: false,
        results: [],
        bestResult: null,
        targetReached: false,
        attempts: 0,
        noPidCount: 0,
        verifiedCount: 0,
      };
    }

    const results = [];
    let bestResult = null;
    let attempt = 0;
    let noPidCount = 0;
    let uploadFailures = 0;
    const liveReady = this.isReady();
    const noSessionFailLimit = 5;

    while (attempt < maxAttempts) {
      if (shouldStopFn && shouldStopFn()) {
        console.log("⏹️ Stopped");
        break;
      }
      attempt++;
      if (onProgress)
        onProgress(attempt, maxAttempts, bestResult?.shippingCost, noPidCount);

      try {
        const variation = await this.generateVariation(originalBlob, attempt);
        if (shouldStopFn && shouldStopFn()) break;
        if (!variation?.blob) continue;

        const imageUrl = await this.uploadImageForPricing(
          variation.blob,
          `v${attempt}.jpg`,
          {
            catalogImageUrl: imageReuse.catalogImageUrl,
            preferPageImage: imageReuse.sourceMatchesPage,
            compareBlob: true,
            _cachedRemoteBlob: imageReuse.cachedRemoteBlob,
          },
        );
        if (shouldStopFn && shouldStopFn()) break;
        if (!imageUrl) {
          uploadFailures++;
          const localResult = this.buildLocalSearchResult(variation, attempt, {
            uploadFailed: true,
          });
          results.push(localResult);
          console.log(`📷 [${attempt}] saved locally (upload failed)`);
          if (!liveReady && uploadFailures >= noSessionFailLimit) {
            console.log(
              `⚠️ No Meesho session — stopping live API after ${noSessionFailLimit} failed uploads`,
            );
            break;
          }
          continue;
        }
        uploadFailures = 0;

        const priceData = await this.getShippingCharges(imageUrl);
        if (shouldStopFn && shouldStopFn()) break;
        if (!priceData || priceData.shippingCharges == null) {
          const localResult = this.buildLocalSearchResult(variation, attempt, {
            pricingImageUrl: imageUrl,
            uploadedUrl: imageUrl,
            priceFailed: true,
          });
          results.push(localResult);
          noPidCount++;
          console.log(`📷 [${attempt}] saved (no API price)`);
          continue;
        }

        const pid = priceData.duplicatePid;
        const shipping = priceData.shippingCharges;

        if (
          maxShippingCap != null &&
          Number.isFinite(maxShippingCap) &&
          shipping > maxShippingCap
        ) {
          console.log(
            `⏭️ [${attempt}] ₹${shipping} > category cap ₹${maxShippingCap} — skipped`,
          );
          continue;
        }

        const result = {
          name: `Var-${attempt}`,
          dataUrl: variation.dataUrl,
          layers: variation.layers,
          pricingImageUrl: imageUrl,
          uploadedUrl: imageUrl,
          shippingCost: shipping,
          duplicatePid: pid || null,
          isVerified: !!pid,
          liveVerified: true,
          liveTotalPrice: priceData.totalPrice,
          meeshoPriceUsed: priceData.priceUsed,
          noPid: !pid,
        };
        results.push(result);

        if (pid) {
          console.log(`✅ [${attempt}] ₹${shipping} PID:${pid}`);
        } else {
          noPidCount++;
          console.log(`⚠️ [${attempt}] ₹${shipping} (no PID — still kept)`);
        }

        if (!bestResult || shipping < (bestResult.shippingCost || 999)) {
          bestResult = result;
          console.log(`⭐ Best: ₹${shipping}`);
        }

        if (shipping <= targetShipping) {
          console.log(`🎉 TARGET! ₹${shipping}`);
          if (onFound) onFound(result);
        }

        if (shouldStopFn && shouldStopFn()) break;
        await new Promise((r) => setTimeout(r, 20));
      } catch (e) {
        console.error(`[${attempt}]`, e.message);
      }
    }

    results.sort((a, b) => {
      const av = a.isVerified ? 0 : a.shippingCost > 0 ? 1 : 2;
      const bv = b.isVerified ? 0 : b.shippingCost > 0 ? 1 : 2;
      if (av !== bv) return av - bv;
      const aPrice = a.shippingCost > 0 ? a.shippingCost : a.estShipping || 999;
      const bPrice = b.shippingCost > 0 ? b.shippingCost : b.estShipping || 999;
      return aPrice - bPrice;
    });

    // Final live re-check so displayed ₹ matches getTransferPrice API
    if (results.length && !(shouldStopFn && shouldStopFn())) {
      await this.confirmLiveShippingForResults(results, null, shouldStopFn);
    }

    const resultLimit = Math.min(
      Math.max(parseInt(maxAttempts, 10) || this.MAX_RESULT_VARIANTS, 1),
      this.MAX_RESULT_VARIANTS,
    );

    return {
      success: results.length > 0,
      results: results.slice(0, resultLimit),
      bestResult: results[0] || null,
      targetReached: results[0]?.shippingCost > 0 && results[0]?.shippingCost <= targetShipping,
      attempts: attempt,
      noPidCount,
      verifiedCount: results.filter((r) => r.isVerified).length,
    };
  },

  /**
   * Test Lab only — phased hunt: probe low strategies first, recovery if baseline very high,
   * then refine. Skips higher ₹ only when baseline is reasonable.
   */
  pickAdaptiveStrategy: function (state) {
    const phase = state.phase || "probe";
    const attempt = state.attempt || 1;
    const framedIdx = state.framedIdx || 0;
    const framed = (i) => ({ mode: "framed", profileIdx: i });

    if (phase === "probe") {
      const probeSeq = [
        framed(0),
        { mode: "productOnly" },
        framed(1),
        { mode: "ultraLow" },
        framed(2),
        { mode: "productOnly" },
        { mode: "lowBias" },
        framed(3),
      ];
      return probeSeq[(attempt - 1) % probeSeq.length];
    }

    if (phase === "recovery") {
      const cycle = [
        framed(framedIdx % 10),
        { mode: "productOnly" },
        framed((framedIdx + 1) % 10),
        { mode: "ultraLow" },
        framed((framedIdx + 2) % 10),
        { mode: "productOnly" },
        { mode: "ultraLow" },
        framed((framedIdx + 3) % 10),
      ];
      return cycle[(attempt - 1) % cycle.length];
    }

    const tight = [
      { mode: "ultraLow" },
      { mode: "productOnly" },
      framed(framedIdx % 6),
      { mode: "lowBias" },
    ];
    return tight[(attempt - 1) % tight.length];
  },

  generateProductOnlyVariation: async function (originalBlob, seed, options = {}) {
    const maxSide = options.maxSide || 1024;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(originalBlob);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const sized = this.normalizeProductSize(img, maxSide);
          const w = sized.w;
          const h = sized.h;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          const scale = 0.66 + (seed % 5) * 0.01;
          const dw = Math.round(w * scale);
          const dh = Math.round(h * scale);
          const px = Math.round((w - dw) / 2);
          const py = Math.round((h - dh) / 2);
          ctx.drawImage(img, px, py, dw, dh);
          const q = 0.5 + (seed % 8) * 0.015;
          const dataUrl = canvas.toDataURL("image/jpeg", q);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Encode failed"));
                return;
              }
              resolve({
                blob,
                dataUrl,
                pricingImageUrl: dataUrl,
                variantStyle: "product_only",
                meta: {
                  style: "product_only",
                  maxSide,
                  kb: Math.ceil(blob.size / 1024),
                },
                layers: {
                  full: dataUrl,
                  productOnly: dataUrl,
                  noStickers: dataUrl,
                  noBorder: dataUrl,
                },
              });
            },
            "image/jpeg",
            q,
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Load failed"));
      };
      img.src = objectUrl;
    });
  },

  generateAdaptiveVariation: async function (originalBlob, seed, spec) {
    const mode = spec?.mode || "lowBias";
    if (mode === "framed") {
      const priority = this.ADAPTIVE_FRAMED_PRIORITY || [];
      const profiles = this.LOW_SHIPPING_FRAMED_PROFILES;
      const pickId = priority[spec.profileIdx % priority.length];
      const profile =
        profiles.find((p) => p.id === pickId) ||
        profiles[spec.profileIdx % profiles.length];
      return this.generateFramedVariation(originalBlob, seed, profile);
    }
    if (mode === "productOnly") {
      return this.generateProductOnlyVariation(originalBlob, seed, spec);
    }
    if (mode === "ultraLow") {
      return this.generateVariationFull(originalBlob, seed, { ultraLow: true });
    }
    if (mode === "lowBias") {
      return this.generateVariationFull(originalBlob, seed, { lowBias: true });
    }
    return this.generateVariationFull(originalBlob, seed, null);
  },

  smartSearchAdaptive: async function (
    originalBlob,
    targetShipping,
    maxAttempts,
    onProgress,
    onFound,
    shouldStopFn,
  ) {
    console.log(
      `🧪 Adaptive Search: Target ≤ ₹${targetShipping}, Max: ${maxAttempts}`,
    );
    this.syncCatalogPricing();

    if (typeof ImageGenerator !== "undefined" && ImageGenerator.preloadBadges) {
      await ImageGenerator.preloadBadges();
    }
    if (this.preloadBadges) {
      await this.preloadBadges();
    }

    const imageReuse = await this.prepareCatalogImageReuse(originalBlob);

    const highLine = Math.max(targetShipping + 25, 80);
    const EXPLORE_PRICED_MIN = 4;

    const results = [];
    let bestResult = null;
    let minPriced = null;
    let attempt = 0;
    let pricedCount = 0;
    let noPidCount = 0;
    let skipHigherCount = 0;
    let uploadFailures = 0;
    let framedIdx = 0;
    let phase = "probe";
    let recoveryTriggered = false;
    let lowBiasMode = false;
    const liveReady = this.isReady();
    const noSessionFailLimit = 5;

    const phaseLabel = () => {
      if (phase === "probe") return "Probe — trying low-KB strategies first";
      if (phase === "recovery") {
        return `Recovery — baseline high, hunting below ₹${highLine}`;
      }
      return "Refine — keeping only ≤ best ₹";
    };

    const updatePhase = () => {
      if (phase !== "probe" || pricedCount < EXPLORE_PRICED_MIN) return;
      if (minPriced != null && minPriced > highLine) {
        phase = "recovery";
        recoveryTriggered = true;
        console.log(
          `🔻 Recovery: baseline ₹${minPriced} is above ₹${highLine} — aggressive low hunt`,
        );
      } else {
        phase = "refine";
        lowBiasMode = true;
        console.log(`✅ Probe done — refine from ₹${minPriced}`);
      }
    };

    const shouldSkipRoughEst = (roughEst) => {
      if (phase === "probe" || phase === "recovery" || minPriced == null) {
        return false;
      }
      if (minPriced > highLine) return false;
      return roughEst > minPriced + 6;
    };

    const shouldSkipLivePrice = (shipping) => {
      if (minPriced == null || phase === "probe") return false;
      if (phase === "recovery") {
        if (minPriced > highLine) return shipping > minPriced + 20;
        return shipping > minPriced + 8;
      }
      return shipping > minPriced;
    };

    const reportProgress = () => {
      if (onProgress) {
        onProgress(
          attempt,
          maxAttempts,
          minPriced,
          noPidCount,
          skipHigherCount,
          phaseLabel(),
        );
      }
    };

    while (attempt < maxAttempts) {
      if (shouldStopFn && shouldStopFn()) {
        console.log("⏹️ Stopped");
        break;
      }
      attempt++;
      reportProgress();

      try {
        const spec = this.pickAdaptiveStrategy({
          phase,
          attempt,
          framedIdx,
          targetShipping,
          minPriced,
          lowBiasMode,
        });
        const variation = await this.generateAdaptiveVariation(
          originalBlob,
          attempt,
          spec,
        );
        if (!variation?.blob) continue;

        const roughEst = this.roughEstShippingFromBlob(variation.blob);
        if (shouldSkipRoughEst(roughEst)) {
          skipHigherCount++;
          console.log(
            `⏭️ [${attempt}] est ₹${roughEst} > best ₹${minPriced} — skip gen`,
          );
          continue;
        }

        const imageUrl = await this.uploadImageForPricing(
          variation.blob,
          `tv${attempt}.jpg`,
          {
            catalogImageUrl: imageReuse.catalogImageUrl,
            preferPageImage: imageReuse.sourceMatchesPage,
            compareBlob: true,
            _cachedRemoteBlob: imageReuse.cachedRemoteBlob,
          },
        );
        if (!imageUrl) {
          uploadFailures++;
          const localResult = this.buildLocalSearchResult(variation, attempt, {
            uploadFailed: true,
          });
          results.push(localResult);
          if (!liveReady && uploadFailures >= noSessionFailLimit) break;
          continue;
        }
        uploadFailures = 0;

        const priceData = await this.getShippingCharges(imageUrl);
        if (!priceData || priceData.shippingCharges == null) {
          const localResult = this.buildLocalSearchResult(variation, attempt, {
            pricingImageUrl: imageUrl,
            uploadedUrl: imageUrl,
            priceFailed: true,
          });
          results.push(localResult);
          noPidCount++;
          continue;
        }

        const pid = priceData.duplicatePid;
        const shipping = priceData.shippingCharges;

        if (shouldSkipLivePrice(shipping)) {
          skipHigherCount++;
          console.log(
            `⏭️ [${attempt}] ₹${shipping} > best ₹${minPriced} (${phase}) — skipped`,
          );
          continue;
        }

        const result = {
          name: `Var-${attempt}`,
          dataUrl: variation.dataUrl,
          layers: variation.layers,
          pricingImageUrl: imageUrl,
          uploadedUrl: imageUrl,
          shippingCost: shipping,
          duplicatePid: pid || null,
          isVerified: !!pid,
          liveVerified: true,
          liveTotalPrice: priceData.totalPrice,
          meeshoPriceUsed: priceData.priceUsed,
          noPid: !pid,
          variantStyle: variation.variantStyle || "standard",
          meta: variation.meta || null,
        };
        results.push(result);
        pricedCount++;
        if (!pid) noPidCount++;

        if (spec.mode === "framed") framedIdx++;

        if (minPriced == null || shipping < minPriced) {
          const improved = minPriced != null && shipping < minPriced;
          minPriced = shipping;
          bestResult = result;
          lowBiasMode = true;
          console.log(
            `${improved ? "⭐" : "📍"} Adaptive best: ₹${shipping} (${spec.mode || "std"})`,
          );
          if (
            phase === "recovery" &&
            minPriced <= highLine
          ) {
            phase = "refine";
            console.log(`✅ Broke below ₹${highLine} — switching to refine`);
          }
        }

        updatePhase();

        if (shipping <= targetShipping && onFound) onFound(result);

        await new Promise((r) => setTimeout(r, 20));
      } catch (e) {
        console.error(`[${attempt}]`, e.message);
      }
    }

    results.sort((a, b) => {
      const av = a.isVerified ? 0 : a.shippingCost > 0 ? 1 : 2;
      const bv = b.isVerified ? 0 : b.shippingCost > 0 ? 1 : 2;
      if (av !== bv) return av - bv;
      const aPrice = a.shippingCost > 0 ? a.shippingCost : a.estShipping || 999;
      const bPrice = b.shippingCost > 0 ? b.shippingCost : b.estShipping || 999;
      return aPrice - bPrice;
    });

    if (results.length) {
      await this.confirmLiveShippingForResults(results);
    }

    const resultLimit = Math.min(
      Math.max(parseInt(maxAttempts, 10) || this.MAX_RESULT_VARIANTS, 1),
      this.MAX_RESULT_VARIANTS,
    );

    return {
      success: results.length > 0,
      results: results.slice(0, resultLimit),
      bestResult: results[0] || bestResult,
      targetReached:
        results[0]?.shippingCost > 0 &&
        results[0]?.shippingCost <= targetShipping,
      attempts: attempt,
      noPidCount,
      skipHigherCount,
      recoveryTriggered,
      verifiedCount: results.filter((r) => r.isVerified).length,
    };
  },

  // Generate variation with random border 20-80px and badges 50-200px
  generateVariationFull: async function (originalBlob, seed, options) {
    const opts = options && typeof options === "object" ? options : {};
    const ultraLow = !!opts.ultraLow;
    const lowBias = !!opts.lowBias && !ultraLow;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(originalBlob);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const w = img.width;
          const h = img.height;
          const quality = ultraLow
            ? 0.42 + Math.random() * 0.08
            : lowBias
            ? 0.6 + Math.random() * 0.12
            : 0.75 + Math.random() * 0.15;

          const productCanvas = document.createElement("canvas");
          productCanvas.width = w;
          productCanvas.height = h;
          const productCtx = productCanvas.getContext("2d");
          productCtx.drawImage(img, 0, 0);
          const productOnly = productCanvas.toDataURL("image/jpeg", quality);

          const border = (() => {
            const minB =
              opts.borderMin != null && Number(opts.borderMin) > 0
                ? Number(opts.borderMin)
                : null;
            const maxB =
              opts.borderMax != null && Number(opts.borderMax) > 0
                ? Number(opts.borderMax)
                : null;
            if (minB != null && maxB != null && maxB >= minB) {
              return minB + Math.floor(Math.random() * (maxB - minB + 1));
            }
            if (maxB != null) {
              if (ultraLow) {
                return 8 + Math.floor(Math.random() * Math.max(4, maxB - 8));
              }
              if (lowBias) {
                return Math.min(maxB, 16 + Math.floor(Math.random() * 20));
              }
              return Math.min(maxB, 20 + Math.floor(Math.random() * 60));
            }
            if (ultraLow) return 8 + Math.floor(Math.random() * 12);
            if (lowBias) return 16 + Math.floor(Math.random() * 20);
            return 20 + Math.floor(Math.random() * 60);
          })();
          const finalW = w + border * 2;
          const finalH = h + border * 2;

          const canvas = document.createElement("canvas");
          canvas.width = finalW;
          canvas.height = finalH;
          const ctx = canvas.getContext("2d");

          const colors = [
            "#e74c3c",
            "#3498db",
            "#2ecc71",
            "#f39c12",
            "#9b59b6",
            "#1abc9c",
            "#e67e22",
            "#16a085",
            "#ff5722",
            "#673ab7",
            "#4caf50",
            "#03a9f4",
            "#e91e63",
            "#8bc34a",
            "#ff9800",
            "#00bcd4",
          ];
          const c1 = colors[Math.floor(Math.random() * colors.length)];
          const c2 = colors[Math.floor(Math.random() * colors.length)];
          const gradType = Math.floor(Math.random() * 4);

          if (gradType === 0) {
            ctx.fillStyle = c1;
          } else {
            let grad;
            if (gradType === 1) grad = ctx.createLinearGradient(0, 0, finalW, 0);
            else if (gradType === 2)
              grad = ctx.createLinearGradient(0, 0, 0, finalH);
            else grad = ctx.createLinearGradient(0, 0, finalW, finalH);
            grad.addColorStop(0, c1);
            grad.addColorStop(1, c2);
            ctx.fillStyle = grad;
          }
          ctx.fillRect(0, 0, finalW, finalH);
          ctx.drawImage(img, border, border, w, h);

          const noStickersCanvas = document.createElement("canvas");
          noStickersCanvas.width = finalW;
          noStickersCanvas.height = finalH;
          const noStickersCtx = noStickersCanvas.getContext("2d");
          noStickersCtx.drawImage(canvas, 0, 0);

          if (typeof ImageGenerator !== "undefined" && ImageGenerator.drawText) {
            ImageGenerator.drawText(noStickersCtx, finalW, finalH, border);
          }
          this.addNoise(noStickersCtx, finalW, finalH, seed);
          const noStickers = noStickersCanvas.toDataURL("image/jpeg", quality);

          const badgeCount =
            opts.badgeCount != null && Number.isFinite(Number(opts.badgeCount))
              ? Math.max(0, Math.min(4, Number(opts.badgeCount)))
              : ultraLow
              ? 0
              : lowBias
              ? 1 + Math.floor(Math.random() * 2)
              : 2 + Math.floor(Math.random() * 2);
          if (badgeCount > 0 && this.preloadBadges) {
            await this.preloadBadges();
          }
          const badgePlacements = await this.addBadges(
            ctx,
            finalW,
            finalH,
            border,
            badgeCount,
          );
          badgePlacements.forEach((p, i) => {
            p.id = "live-badge-" + i;
            p.label = "Badge " + (i + 1);
          });

          const gradAxis =
            gradType === 0
              ? "solid"
              : gradType === 1
              ? "horizontal"
              : gradType === 3
              ? "diagonal"
              : "vertical";

          if (typeof ImageGenerator !== "undefined" && ImageGenerator.drawText) {
            ImageGenerator.drawText(ctx, finalW, finalH, border);
          }
          this.addNoise(ctx, finalW, finalH, seed);
          const full = canvas.toDataURL("image/jpeg", quality);

          const noBorderCanvas = document.createElement("canvas");
          noBorderCanvas.width = w;
          noBorderCanvas.height = h;
          const noBorderCtx = noBorderCanvas.getContext("2d");
          noBorderCtx.drawImage(img, 0, 0);
          if (badgePlacements.length) {
            const shiftedPlacements = badgePlacements.map((p) => ({
              num: p.num,
              size: p.size,
              x: Math.max(0, p.x - border),
              y: Math.max(0, p.y - border),
            }));
            await this.addBadges(noBorderCtx, w, h, 0, 0, shiftedPlacements);
          }
          if (typeof ImageGenerator !== "undefined" && ImageGenerator.drawText) {
            ImageGenerator.drawText(noBorderCtx, w, h, 0);
          }
          this.addNoise(noBorderCtx, w, h, seed + 1);
          const noBorder = noBorderCanvas.toDataURL("image/jpeg", quality);
          const stickersRendered = badgePlacements.some((p) => p.drawn);
          const customTextStamp = (() => {
            if (typeof ImageGenerator === "undefined") return {};
            const fromGlobal = String(ImageGenerator.settings?.customText || "").trim();
            const overlays = fromGlobal
              ? [
                  ImageGenerator.createTextOverlay({
                    id: "text-1",
                    text: fromGlobal,
                    position: ImageGenerator.settings.textPosition || "bottom",
                    textColor: ImageGenerator.settings.textColor || "#ffffff",
                    bgColor: ImageGenerator.settings.textBgColor || "#e67e22",
                    fontSizePct: 100,
                    enabled: true,
                  }),
                ]
              : [];
            if (!overlays.length) return {};
            const stamp = {
              _textOverlays: overlays,
              _textOverlaysDefaults: JSON.parse(JSON.stringify(overlays)),
            };
            ImageGenerator.syncLegacyTextFields(stamp, overlays);
            return stamp;
          })();

          canvas.toBlob(
            (blob) =>
              resolve({
                blob,
                dataUrl: full,
                pricingImageUrl: full,
                variantStyle: "standard",
                meta: {
                  borderPx: border,
                  badgeCount,
                  stickersRendered,
                  style: "standard",
                  canvasW: finalW,
                  canvasH: finalH,
                  productW: w,
                  productH: h,
                  gradientTop: c1,
                  gradientBottom: c2,
                  gradType,
                  gradAxis,
                  jpegQuality: quality,
                },
                layers: {
                  full,
                  noStickers,
                  noBorder,
                  productOnly,
                  _stickersRendered: stickersRendered,
                  _badgePlacements: badgePlacements,
                  ...customTextStamp,
                  _staticFrame: {
                    style: "live_standard",
                    frameType: gradType === 0 ? "solid" : "gradient",
                    gradientTop: c1,
                    gradientBottom: c2,
                    gradientAxis: gradAxis,
                    borderColor: c1,
                    px: border,
                    py: border,
                    dw: w,
                    dh: h,
                    border,
                    outerW: finalW,
                    outerH: finalH,
                  },
                },
              }),
            "image/jpeg",
            quality,
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Load failed"));
      };
      img.src = objectUrl;
    });
  },

  // Low-shipping framed: thick blue outer + white mat + full-size product (screenshot style)
  compressCanvasToKb: async function (canvas, targetKb) {
    const targetBytes = targetKb * 1024;

    const encodeAt = (q) =>
      new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", q);
      });

    let lo = 0.18;
    let hi = 0.9;
    let best = null;
    for (let i = 0; i < 18; i++) {
      const q = (lo + hi) / 2;
      const blob = await encodeAt(q);
      if (!blob) break;
      if (blob.size <= targetBytes) {
        best = { blob, q };
        lo = q;
      } else {
        hi = q;
      }
    }

    if (!best || best.blob.size > targetBytes) {
      let q = best ? best.q : 0.45;
      for (; q >= 0.12; q -= 0.025) {
        const blob = await encodeAt(q);
        if (!blob) break;
        if (!best || blob.size < best.blob.size) best = { blob, q };
        if (blob.size <= targetBytes) break;
      }
    }

    if (!best) {
      const blob = await encodeAt(0.35);
      best = { blob, q: 0.35 };
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(best.blob);
    });
    return {
      blob: best.blob,
      dataUrl,
      quality: best.q,
      kb: Math.ceil(best.blob.size / 1024),
    };
  },

  isTallPortrait: function (img) {
    return img.height / img.width >= 1.2;
  },

  dataUrlFromCanvas: function (canvas, quality) {
    return canvas.toDataURL("image/jpeg", quality ?? 0.82);
  },

  normalizeProductSize: function (img, maxSide) {
    let w = img.width;
    let h = img.height;
    const cap = maxSide || 1200;
    if (Math.max(w, h) > cap) {
      const s = cap / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    return { w, h };
  },

  drawBlueProductFrame: function (ctx, px, py, dw, dh, lineRef) {
    const blues = ["#9ec5e8", "#add8e6", "#b8d4e8", "#a8cce8", "#7ec8e3"];
    ctx.strokeStyle = blues[Math.floor(Math.random() * blues.length)];
    ctx.lineWidth = Math.max(2, Math.round((lineRef || Math.min(dw, dh)) * 0.006));
    ctx.strokeRect(px - 1, py - 1, dw + 2, dh + 2);
  },

  addLowShippingBadges: async function (ctx, px, py, dw, dh, seed) {
    const badgeNums = [3, 7, 12, 15, 18, 22];
    const size = Math.max(56, Math.round(Math.min(dw, dh) * 0.14));
    const inset = Math.max(6, Math.round(size * 0.06));
    const slots = [
      { x: px + inset, y: py + inset },
      { x: px + dw - size - inset, y: py + inset },
      { x: px + inset, y: py + dh - size - inset },
    ];
    const placements = [];
    const used = new Set();
    for (let i = 0; i < 3; i++) {
      let num = badgeNums[(seed + i * 2) % badgeNums.length];
      while (used.has(num)) num = badgeNums[(num + 1) % badgeNums.length];
      used.add(num);
      const p = { num, size, x: slots[i].x, y: slots[i].y };
      placements.push(p);
      try {
        const badge = await this.loadBadge(num);
        if (badge) ctx.drawImage(badge, p.x, p.y, size, size);
      } catch (e) {}
    }
    return placements;
  },

  // Screenshot layout: [thick blue outer] → [white mat] → [full-size product + stickers]
  buildScreenshotFramedCanvas: function (img, profile, seed) {
    const isTallProfile =
      profile.layout === "tall" && this.isTallPortrait(img);
    let bluePct = profile.bluePct || 0.12;
    let whitePct = profile.whitePct || 0.04;
    if (isTallProfile) {
      bluePct = Math.min(0.22, bluePct * 1.06);
    }

    const { w, h } = this.normalizeProductSize(img, profile.maxSide || 1200);
    const minDim = Math.min(w, h);
    const blueOuter = Math.max(24, Math.round(minDim * bluePct));
    const whitePad = Math.max(10, Math.round(minDim * whitePct));
    const inset = blueOuter + whitePad;

    const finalW = w + inset * 2;
    const finalH = h + inset * 2;
    const canvas = document.createElement("canvas");
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext("2d");

    const blues = ["#9ec5e8", "#add8e6", "#b8d4e8", "#a8cce8", "#7ec8e3"];
    const borderColor = blues[Math.abs(seed || 0) % blues.length];
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, finalW, finalH);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(blueOuter, blueOuter, finalW - blueOuter * 2, finalH - blueOuter * 2);

    const px = inset;
    const py = inset;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, img.width, img.height, px, py, w, h);
    this.drawBlueProductFrame(ctx, px, py, w, h, minDim);

    return {
      canvas,
      px,
      py,
      dw: w,
      dh: h,
      layout: isTallProfile ? "tall" : "screenshot",
      blueOuter,
      whitePad,
      borderColor,
    };
  },

  buildLowShippingFramedLayers: async function (img, profile, seed) {
    const built = this.buildScreenshotFramedCanvas(img, profile, seed);

    const { canvas, px, py, dw, dh, blueOuter, borderColor } = built;
    const noStickersCanvas = document.createElement("canvas");
    noStickersCanvas.width = canvas.width;
    noStickersCanvas.height = canvas.height;
    noStickersCanvas.getContext("2d").drawImage(canvas, 0, 0);
    const noStickers = this.dataUrlFromCanvas(noStickersCanvas);

    const fullCtx = canvas.getContext("2d");
    const badgePlacements = await this.addLowShippingBadges(
      fullCtx,
      px,
      py,
      dw,
      dh,
      seed,
    );
    badgePlacements.forEach((p, i) => {
      p.id = "live-framed-" + i;
      p.label = "Badge " + (i + 1);
      p.drawn = true;
    });
    const full = this.dataUrlFromCanvas(canvas);

    const productOnlyCanvas = document.createElement("canvas");
    productOnlyCanvas.width = dw;
    productOnlyCanvas.height = dh;
    const pCtx = productOnlyCanvas.getContext("2d");
    pCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
    const productOnly = this.dataUrlFromCanvas(productOnlyCanvas);

    const noBorderCanvas = document.createElement("canvas");
    noBorderCanvas.width = dw;
    noBorderCanvas.height = dh;
    const nbCtx = noBorderCanvas.getContext("2d");
    nbCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
    if (badgePlacements.length) {
      const shifted = badgePlacements.map((p) => ({
        num: p.num,
        size: p.size,
        x: p.x - px,
        y: p.y - py,
      }));
      await this.addBadges(nbCtx, dw, dh, 0, 0, shifted);
    }
    const noBorder = this.dataUrlFromCanvas(noBorderCanvas);

    return {
      canvas,
      layers: {
        full,
        noStickers,
        noBorder,
        productOnly,
        _stickersRendered: badgePlacements.length > 0,
        _badgePlacements: badgePlacements,
        _staticFrame: {
          style: "live_framed",
          frameType: "tall",
          borderColor: borderColor || "#add8e6",
          matColor: "#ffffff",
          gradientTop: borderColor || "#add8e6",
          gradientBottom: "#7ec8e3",
          px,
          py,
          dw,
          dh,
          border: blueOuter,
          outerW: canvas.width,
          outerH: canvas.height,
          whiteX: blueOuter,
          whiteY: blueOuter,
          whiteW: canvas.width - blueOuter * 2,
          whiteH: canvas.height - blueOuter * 2,
        },
      },
      meta: {
        layout: built.layout,
        profileId: profile.id,
        targetKb: profile.targetKb,
        bluePct: profile.bluePct,
        whitePct: profile.whitePct,
        maxSide: profile.maxSide,
        canvasW: canvas.width,
        canvasH: canvas.height,
        productW: dw,
        productH: dh,
        borderPx: blueOuter,
        blueOuter,
        borderColor: borderColor || "#add8e6",
        style: "framed_low",
      },
    };
  },

  generateFramedVariation: async function (originalBlob, seed, profile) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(originalBlob);
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const profiles = this.LOW_SHIPPING_FRAMED_PROFILES;
          const chosen =
            profile ||
            profiles[Math.abs(seed) % profiles.length] ||
            profiles[0];

          const built = await this.buildLowShippingFramedLayers(
            img,
            chosen,
            seed,
          );
          const compressed = await this.compressCanvasToKb(
            built.canvas,
            chosen.targetKb,
          );
          built.layers.full = compressed.dataUrl;

          resolve({
            blob: compressed.blob,
            dataUrl: compressed.dataUrl,
            pricingImageUrl: compressed.dataUrl,
            variantStyle: "framed",
            meta: {
              ...built.meta,
              actualKb: compressed.kb,
              jpegQuality: compressed.quality,
            },
            layers: built.layers,
          });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Load failed"));
      };
      img.src = objectUrl;
    });
  },

  resolveDisplayUrl: function (result) {
    if (!result) return "";
    const layers = result.layers;
    const flags = result.editFlags || {};
    if (!layers) {
      return (
        result.imageUrl ||
        result.dataUrl ||
        result.pricingImageUrl ||
        result.uploadedUrl ||
        ""
      );
    }

    const caps = this.getEffectiveLayerCapabilities(layers, flags);
    const cleanProduct = !!(flags.cleanProduct || flags.borderRemoved);
    const strippedProduct =
      cleanProduct &&
      !flags.stickersAdded &&
      !flags.borderAdded &&
      !flags.fullDecorationsAdded;
    const fullDecorations = !!(
      flags.fullDecorationsAdded || flags.decorationsAdded
    );

    if (layers._staticFrame) {
      const eff =
        typeof window !== "undefined" &&
        window.StaticFrameCompose?.getStaticEffectiveFlags
          ? window.StaticFrameCompose.getStaticEffectiveFlags(flags, layers)
          : null;
      if (eff) {
        if (!eff.hasBorder && !eff.hasStickers) {
          return layers.productOnly || layers.full || result.pricingImageUrl || "";
        }
        if (eff.hasBorder && !eff.hasStickers) {
          return layers.noStickers || layers.full || result.pricingImageUrl || "";
        }
        if (!eff.hasBorder && eff.hasStickers) {
          return layers.noBorder || layers.full || result.pricingImageUrl || "";
        }
        return layers.full || result.pricingImageUrl || result.dataUrl || "";
      }
      if (flags.borderAdded && !flags.stickersAdded && !flags.fullDecorationsAdded) {
        return layers.noStickers || layers.full || result.pricingImageUrl || "";
      }
      if (flags.stickersAdded && !flags.borderAdded && !flags.fullDecorationsAdded) {
        const effCaps = this.getEffectiveLayerCapabilities(layers, flags);
        if (effCaps.hasBorder) {
          return layers.full || layers.noStickers || result.pricingImageUrl || "";
        }
        return layers.noBorder || layers.productOnly || layers.full || result.pricingImageUrl || "";
      }
      if (strippedProduct) {
        return layers.productOnly || layers.full || result.pricingImageUrl || "";
      }
      if (flags.stickersRemoved) {
        return layers.noStickers || layers.full || result.pricingImageUrl || "";
      }
      if (flags.borderOnlyRemoved) {
        return layers.noBorder || layers.noStickers || layers.full || "";
      }
      if (flags.stickersAdded || flags.borderAdded || flags.fullDecorationsAdded) {
        return layers.full || result.pricingImageUrl || "";
      }
      return (
        result.imageUrl ||
        layers.full ||
        result.pricingImageUrl ||
        result.dataUrl ||
        ""
      );
    }

    if (strippedProduct) {
      return layers.productOnly || layers.full || result.pricingImageUrl || "";
    }
    if (fullDecorations || (flags.stickersAdded && flags.borderAdded)) {
      return layers.full || result.pricingImageUrl || "";
    }

    let wantStickers = caps.hasStickers;
    let wantBorder = caps.hasBorder;

    if (wantBorder && wantStickers) {
      return layers.full || layers.noStickers || layers.noBorder || "";
    }
    if (wantBorder && !wantStickers) {
      return layers.noStickers || layers.full || "";
    }
    if (!wantBorder && wantStickers) {
      return layers.noBorder || layers.full || "";
    }
    return layers.productOnly || layers.noBorder || layers.noStickers || "";
  },

  getLayerCapabilities: function (layers) {
    const empty = {
      hasStickers: false,
      hasBorder: false,
      canRemoveStickers: false,
      canRemoveBorder: false,
      canRemoveBoth: false,
      canAddStickers: false,
      canAddBorder: false,
      canAddBoth: false,
      isStaticPromo: false,
      canAdjustBadges: false,
    };
    if (!layers) return empty;

    if (layers._staticFrame) {
      const frameStyle = layers._staticFrame.style;
      const isStaticPromo =
        frameStyle === "showcase" ||
        frameStyle === "lifestyle_promo" ||
        frameStyle === "tall_static" ||
        frameStyle === "gown_static";
      const hasStickers = layers._stickersRendered !== false;
      const hasPlacements = !!(layers._badgePlacements || []).length;

      if (isStaticPromo) {
        return {
          hasStickers,
          hasBorder: true,
          canRemoveStickers: hasStickers,
          canRemoveBorder: !!layers.noBorder,
          canRemoveBoth: !!layers.productOnly,
          canAddStickers: false,
          canAddBorder: false,
          canAddBoth: false,
          isStaticPromo: true,
          canAdjustBadges: hasStickers && hasPlacements,
        };
      }

      const diff = (a, b) => !!(a && b && a !== b);
      const hasBorder =
        diff(layers.noStickers, layers.productOnly) ||
        diff(layers.full, layers.noBorder);
      return {
        hasStickers: hasStickers && hasPlacements,
        hasBorder,
        canRemoveStickers: hasStickers && hasPlacements,
        canRemoveBorder: hasBorder && !!layers.noBorder,
        canRemoveBoth: (hasStickers || hasBorder) && !!layers.productOnly,
        canAddStickers: !hasStickers && !!(layers.full || layers.noBorder),
        canAddBorder: !hasBorder && !!(layers.full || layers.noStickers),
        canAddBoth: !(hasStickers && hasBorder) && !!layers.full,
        isStaticPromo: false,
        canAdjustBadges: hasPlacements,
      };
    }

    const diff = (a, b) => !!(a && b && a !== b);
    const hasPlacements = !!(layers._badgePlacements || []).length;
    const hasStickers =
      layers._stickersRendered === true
        ? true
        : layers._stickersRendered === false
        ? false
        : hasPlacements ||
          diff(layers.full, layers.noStickers) ||
          diff(layers.noBorder, layers.productOnly);
    const hasBorder =
      diff(layers.noStickers, layers.productOnly) ||
      diff(layers.full, layers.noBorder);

    return {
      hasStickers,
      hasBorder,
      canRemoveStickers: hasStickers,
      canRemoveBorder: hasBorder && !!layers.noBorder,
      canRemoveBoth: (hasStickers || hasBorder) && !!layers.productOnly,
      canAddStickers: !hasStickers && !!(layers.full || layers.noBorder),
      canAddBorder: !hasBorder && !!(layers.full || layers.noStickers),
      canAddBoth: !(hasStickers && hasBorder) && !!layers.full,
      isStaticPromo: false,
      canAdjustBadges: hasPlacements,
    };
  },

  getEffectiveLayerCapabilities: function (layers, editFlags) {
    const base = this.getLayerCapabilities(layers);
    const flags = editFlags || {};
    if (!layers) return base;

    if (layers._staticFrame) {
      const frameStyle = layers._staticFrame.style;
      const isStaticPromo =
        frameStyle === "showcase" ||
        frameStyle === "lifestyle_promo" ||
        frameStyle === "tall_static" ||
        frameStyle === "gown_static";
      let hasStickers = base.hasStickers;
      let hasBorder = base.hasBorder;
      if (flags.cleanProduct) {
        hasStickers = false;
        hasBorder = false;
      } else {
        if (flags.stickersRemoved) hasStickers = false;
        if (flags.borderOnlyRemoved) hasBorder = false;
        if (flags.stickersAdded) hasStickers = true;
        if (flags.borderAdded) hasBorder = true;
        if (flags.fullDecorationsAdded) {
          hasStickers = true;
          hasBorder = true;
        }
      }
      const hasFull = !!layers.full;
      const hasNoStickersLayer = !!layers.noStickers;
      const hasNoBorderLayer = !!layers.noBorder;
      const hasProductOnly = !!layers.productOnly;

      return {
        hasStickers,
        hasBorder,
        canRemoveStickers: base.hasStickers && !flags.cleanProduct,
        canRemoveBorder:
          base.hasBorder && hasNoBorderLayer && !flags.cleanProduct,
        canRemoveBoth:
          (base.hasStickers || base.hasBorder) && hasProductOnly,
        canAddStickers:
          !hasStickers &&
          !!(hasFull || hasNoBorderLayer || hasNoStickersLayer),
        canAddBorder:
          !hasBorder && !!(hasFull || hasNoStickersLayer),
        canAddBoth: !(hasStickers && hasBorder) && hasFull,
        isStaticPromo,
        canAdjustBadges:
          (base.canAdjustBadges ||
            !!flags.stickersAdded ||
            !!flags.fullDecorationsAdded) &&
          hasStickers,
      };
    }

    let hasStickers = base.hasStickers;
    let hasBorder = base.hasBorder;

    if (flags.cleanProduct) {
      hasStickers = false;
      hasBorder = false;
    } else {
      if (flags.stickersRemoved) hasStickers = false;
      if (flags.borderOnlyRemoved) hasBorder = false;
      if (flags.stickersAdded) hasStickers = true;
      if (flags.borderAdded) hasBorder = true;
      if (flags.fullDecorationsAdded) {
        hasStickers = true;
        hasBorder = true;
      }
    }

    const hasFull = !!layers.full;
    const hasNoStickersLayer = !!layers.noStickers;
    const hasNoBorderLayer = !!layers.noBorder;

    return {
      hasStickers,
      hasBorder,
      canRemoveStickers: base.hasStickers && !flags.cleanProduct,
      canRemoveBorder:
        base.hasBorder && hasNoBorderLayer && !flags.cleanProduct,
      canRemoveBoth: base.canRemoveBoth && !flags.cleanProduct,
      canAddStickers:
        !hasStickers && !!(hasFull || hasNoBorderLayer || hasNoStickersLayer),
      canAddBorder:
        !hasBorder && !!(hasFull || hasNoStickersLayer),
      canAddBoth: !(hasStickers && hasBorder) && hasFull,
      isStaticPromo: false,
      canAdjustBadges:
        (base.canAdjustBadges ||
          !!flags.stickersAdded ||
          !!flags.fullDecorationsAdded) &&
        hasStickers,
    };
  },

  preloadBadges: async function () {
    const promises = [];
    for (let i = 1; i <= 25; i++) promises.push(this.loadBadge(i));
    await Promise.all(promises);
    const loaded = Object.keys(this.badgeCache).filter(
      (k) => this.badgeCache[k],
    ).length;
    console.log(`📦 Badges pre-loaded (${loaded}/25)`);
    return loaded;
  },

  resolveDisplayUrlAsync: async function (result) {
    if (!result?.layers) return this.resolveDisplayUrl(result);

    const staticFrame = result.layers._staticFrame;
    const borderEdited =
      staticFrame &&
      (staticFrame.borderThicknessPct ?? 100) !==
        (window.StaticFrameCompose?.BORDER_THICKNESS_DEFAULT ?? 100);

    if (staticFrame) {
      const flags = result.editFlags || {};
      const picked =
        typeof window !== "undefined" &&
        window.StaticFrameCompose?.pickStaticBaseLayer
          ? window.StaticFrameCompose.pickStaticBaseLayer(result.layers, flags, {
              badgesRepositioned: !!result._badgesRepositioned,
            })
          : null;
      const canUseBakedLayer =
        !!picked && !picked.rebuild && !picked.drawBadges;
      if (canUseBakedLayer && picked.url) {
        return picked.url;
      }
      const mayNeedCompose =
        borderEdited ||
        result._staticAppearanceEdited ||
        result._badgesRepositioned ||
        (typeof window !== "undefined" &&
          window.StaticFrameCompose?.needsStaticCompose?.(result)) ||
        !!picked?.rebuild ||
        !!picked?.drawBadges;
      if (mayNeedCompose) {
        await ensureStaticComposeLoaded();
      }
      const needsCompose =
        borderEdited ||
        result._staticAppearanceEdited ||
        result._badgesRepositioned ||
        (typeof window !== "undefined" &&
          window.StaticFrameCompose?.needsStaticCompose?.(result)) ||
        !!picked?.rebuild ||
        !!picked?.drawBadges;
      if (
        needsCompose &&
        typeof window !== "undefined" &&
        window.StaticFrameCompose?.composeStaticPreview
      ) {
        try {
          if (staticFrame) {
            window.StaticFrameCompose.ensureStaticRebuildUrls?.(
              result.layers,
              result.pricingImageUrl || result.dataUrl || result.imageUrl || "",
            );
          }
          return await window.StaticFrameCompose.composeStaticPreview(
            result.layers,
            result.editFlags || {},
            {
              targetKb: 0,
              preserveKb: 0,
              preview: true,
              jpegQuality: result.meta?.jpegQuality || 0.92,
              style: staticFrame?.style,
              staticAppearanceEdited: !!result._staticAppearanceEdited,
              badgesOnly:
                !!result._badgesRepositioned && !result._staticAppearanceEdited,
              badgesRepositioned: !!result._badgesRepositioned,
              meta: result.meta,
            },
          );
        } catch (e) {
          console.warn("Static compose preview failed:", e);
        }
      }
      return this.resolveDisplayUrl(result);
    }

    const needsLiveCompose =
      typeof window !== "undefined" &&
      window.StaticFrameCompose?.needsStaticCompose?.(result);
    if (needsLiveCompose) {
      await ensureStaticComposeLoaded();
    }
    if (
      needsLiveCompose &&
      typeof window !== "undefined" &&
      window.StaticFrameCompose?.composeStaticPreview
    ) {
      try {
        return await window.StaticFrameCompose.composeStaticPreview(
          result.layers,
          result.editFlags || {},
          {
            targetKb: 0,
            preserveKb: 0,
            preview: true,
            jpegQuality: result.meta?.jpegQuality || 0.92,
            meta: result.meta,
          },
        );
      } catch (e) {}
    }

    const flags = result.editFlags || {};
    const syncUrl = this.resolveDisplayUrl(result);
    const needsCompose =
      (flags.stickersAdded ||
        flags.fullDecorationsAdded ||
        flags.borderAdded) &&
      result.layers._stickersRendered === false;

    if (!needsCompose) return syncUrl;

    await this.preloadBadges();
    const caps = this.getEffectiveLayerCapabilities(result.layers, flags);
    let base =
      flags.fullDecorationsAdded || (caps.hasBorder && caps.hasStickers)
        ? result.layers.noStickers || result.layers.productOnly
        : flags.stickersAdded
        ? result.layers.noStickers || result.layers.productOnly
        : result.layers.noStickers || result.layers.productOnly;

    if (flags.borderAdded && !flags.stickersAdded) {
      base = result.layers.noStickers || result.layers.productOnly;
    }

    const placements = (result.layers._badgePlacements || []).filter(
      (p) => p.drawn,
    );
    let usePlacements = placements;
    if (
      !usePlacements.length &&
      (flags.stickersAdded || flags.fullDecorationsAdded)
    ) {
      const imgProbe = await new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = base || syncUrl;
      });
      if (imgProbe) {
        const scratch = document.createElement("canvas");
        scratch.width = imgProbe.width;
        scratch.height = imgProbe.height;
        usePlacements = await this.addBadges(
          scratch.getContext("2d"),
          imgProbe.width,
          imgProbe.height,
          result.meta?.borderPx || 24,
          2 + (String(result.variantId || "").length % 2),
        );
      }
    }

    if (!usePlacements.length) return syncUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          await this.addBadges(
            ctx,
            img.width,
            img.height,
            result.meta?.borderPx || 20,
            0,
            usePlacements,
          );
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (e) {
          resolve(syncUrl);
        }
      };
      img.onerror = () => resolve(syncUrl);
      img.src = base || syncUrl;
    });
  },

  roughEstShippingFromBlob: function (blob) {
    if (!blob?.size) return 0;
    const kb = Math.max(1, Math.ceil(blob.size / 1024));
    return Math.min(93, Math.max(30, kb));
  },

  buildLocalSearchResult: function (variation, attempt, extra = {}) {
    const kb = variation?.blob?.size
      ? Math.max(1, Math.ceil(variation.blob.size / 1024))
      : 0;
    return {
      name: `Var-${attempt}`,
      dataUrl: variation.dataUrl,
      layers: variation.layers,
      pricingImageUrl: variation.dataUrl,
      blob: variation.blob,
      shippingCost: 0,
      estShipping: this.roughEstShippingFromBlob(variation.blob),
      meta: { kb, estInr: this.roughEstShippingFromBlob(variation.blob) },
      duplicatePid: null,
      isVerified: false,
      liveVerified: false,
      noPid: true,
      localGenerated: true,
      ...extra,
    };
  },

  // Add badges 50-200px; pass placements to replay the same badges on another canvas
  addBadges: async function (ctx, w, h, border, count, placements) {
    if (placements?.length) {
      for (const p of placements) {
        try {
          const badge = await this.loadBadge(p.num);
          if (badge) {
            ctx.drawImage(badge, p.x, p.y, p.size, p.size);
            if (p.drawn !== false) p.drawn = true;
          }
        } catch (e) {}
      }
      return placements;
    }

    const positions = [
      { x: border + 5, y: border + 5 },
      { x: w - border - 150, y: border + 5 },
      { x: border + 5, y: h - border - 150 },
      { x: w - border - 150, y: h - border - 150 },
    ];

    const drawn = [];
    const used = new Set();
    for (let i = 0; i < count && i < positions.length; i++) {
      let num;
      do {
        num = 1 + Math.floor(Math.random() * 25);
      } while (used.has(num));
      used.add(num);

      const size = 50 + Math.floor(Math.random() * 150);
      const x = positions[i].x;
      const y = positions[i].y;
      const placement = { num, size, x, y, drawn: false };
      drawn.push(placement);
      try {
        const badge = await this.loadBadge(num);
        if (badge) {
          ctx.drawImage(badge, x, y, size, size);
          placement.drawn = true;
        }
      } catch (e) {}
    }
    return drawn;
  },

  // Add noise
  addNoise: function (ctx, w, h, seed) {
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < 50; i++) {
      const px = Math.floor(Math.random() * (d.length / 4)) * 4;
      d[px] = Math.min(
        255,
        Math.max(0, d[px] + Math.floor(Math.random() * 6) - 3),
      );
    }
    d[((Date.now() + seed) % (d.length / 4)) * 4] = seed % 256;
    ctx.putImageData(data, 0, 0);
  },

  loadBadge: async function (num) {
    if (this.badgeCache[num]) return this.badgeCache[num];
    const src = this.assetUrl("Badge/badge" + num + ".png");
    const tryLoad = (crossOrigin) =>
      new Promise((resolve) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = "anonymous";
        img.onload = () => {
          this.badgeCache[num] = img;
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    let img = await tryLoad(false);
    if (!img) img = await tryLoad(true);
    return img;
  },

  isReady: function () {
    this.detectAllValues();
    return this.cache.supplierId !== null;
  },

  // Web fallback: generate variants locally (no live API) using same canvas logic
  generateLocalVariations: async function (
    originalBlob,
    maxCount,
    onProgress,
    shouldStopFn,
    options = {},
  ) {
    const livePatternOnly = !!options.livePatternOnly;
    const count = Math.min(
      Math.max(parseInt(maxCount, 10) || 20, 1),
      this.MAX_RESULT_VARIANTS,
    );

    if (typeof ImageGenerator !== "undefined" && ImageGenerator.preloadBadges) {
      await ImageGenerator.preloadBadges();
    }
    if (this.preloadBadges) {
      await this.preloadBadges();
    }

    const results = [];
    const maxKb =
      options.maxKb != null && Number(options.maxKb) > 0
        ? Number(options.maxKb)
        : null;
    const targetPool = count;
    const maxAttempts = Math.max(targetPool * 5, targetPool);
    let attempts = 0;

    while (results.length < targetPool && attempts < maxAttempts) {
      attempts++;
      if (shouldStopFn && shouldStopFn()) break;
      if (onProgress) onProgress(results.length, targetPool, null, 0);

      try {
        const genOpts =
          typeof options.variantOptions === "function"
            ? options.variantOptions(attempts)
            : options.variantOptions || null;
        const variation = await this.generateVariation(
          originalBlob,
          attempts,
          null,
          genOpts,
        );
        if (!variation?.dataUrl) continue;
        const kb = variation.blob?.size
          ? Math.max(1, Math.ceil(variation.blob.size / 1024))
          : 0;
        if (maxKb && kb > maxKb) continue;
        const est = this.roughEstShippingFromBlob(variation.blob);
        const rank = results.length + 1;
        results.push({
          name: "Var-" + rank,
          dataUrl: variation.dataUrl,
          layers: variation.layers,
          pricingImageUrl: variation.pricingImageUrl || variation.dataUrl,
          variantStyle: variation.variantStyle || "standard",
          blob: variation.blob || null,
          meta: {
            ...(variation.meta || {}),
            path: "standard",
            style: "standard",
            kb,
            staticEst: est,
            estInr: 0,
            rank,
            attempt: attempts,
          },
          estShipping: 0,
          shippingCost: 0,
          isVerified: false,
          localOnly: true,
        });
      } catch (e) {
        console.error("Variation", attempts, "failed:", e);
      }
    }

    // KB cap too tight — fill pool with standard variants (no untested ultra modes).
    if (results.length < targetPool && maxKb && livePatternOnly) {
      let relaxAttempts = 0;
      const relaxMax = Math.max(targetPool * 4, 12);
      while (results.length < targetPool && relaxAttempts < relaxMax) {
        relaxAttempts++;
        if (shouldStopFn && shouldStopFn()) break;
        if (onProgress) onProgress(results.length, targetPool, null, 0);
        try {
          const genOpts =
            typeof options.variantOptions === "function"
              ? options.variantOptions(relaxAttempts + attempts)
              : options.variantOptions || null;
          const variation = await this.generateVariation(
            originalBlob,
            attempts + relaxAttempts,
            null,
            genOpts,
          );
          if (!variation?.dataUrl) continue;
          const kb = variation.blob?.size
            ? Math.max(1, Math.ceil(variation.blob.size / 1024))
            : 0;
          const est = this.roughEstShippingFromBlob(variation.blob);
          const rank = results.length + 1;
          results.push({
            name: "Var-" + rank,
            dataUrl: variation.dataUrl,
            layers: variation.layers,
            pricingImageUrl: variation.pricingImageUrl || variation.dataUrl,
            variantStyle: variation.variantStyle || "standard",
            blob: variation.blob || null,
            meta: {
              ...(variation.meta || {}),
              path: "standard",
              style: "standard",
              kb,
              staticEst: est,
              estInr: 0,
              rank,
              attempt: attempts + relaxAttempts,
              kbRelaxed: true,
            },
            estShipping: 0,
            shippingCost: 0,
            isVerified: false,
            localOnly: true,
          });
        } catch (e) {
          console.error("Relaxed variation", relaxAttempts, "failed:", e);
        }
      }
    }

    const framedExtras = [];
    if (
      !livePatternOnly &&
      typeof window !== "undefined" &&
      window.WEB_OPTIMIZER_MODE
    ) {
      const profiles = this.LOW_SHIPPING_FRAMED_PROFILES;
      for (let i = 0; i < profiles.length; i++) {
        if (shouldStopFn && shouldStopFn()) break;
        try {
          const profile = profiles[i];
          const variation = await this.generateFramedVariation(
            originalBlob,
            30000 + i,
            profile,
          );
          if (!variation?.dataUrl) continue;
          framedExtras.push({
            name: profile.id.replace(/_/g, "-"),
            dataUrl: variation.dataUrl,
            layers: variation.layers,
            pricingImageUrl: variation.pricingImageUrl || variation.dataUrl,
            variantStyle: "framed",
            meta: variation.meta || null,
            shippingCost: 0,
            isVerified: false,
            localOnly: true,
          });
        } catch (e) {
          console.error("Framed variation", profiles[i]?.id, "failed:", e);
        }
      }
    }

    if (
      !livePatternOnly &&
      !results.length &&
      typeof ImageGenerator !== "undefined" &&
      ImageGenerator.generateVariations
    ) {
      try {
        const file = new File([originalBlob], "upload.jpg", {
          type: originalBlob.type || "image/jpeg",
        });
        const vars = await ImageGenerator.generateVariations(file, count);
        vars.forEach((v, idx) => {
          if (v?.dataUrl) {
            results.push({
              name: v.name || "Var-" + (idx + 1),
              dataUrl: v.dataUrl,
              shippingCost: 0,
              isVerified: false,
              localOnly: true,
            });
          }
        });
      } catch (e) {
        console.error("ImageGenerator fallback failed:", e);
      }
    }

    return {
      success: results.length > 0,
      results: results.slice(0, count),
      framedExtras,
      bestResult: results[0] || null,
      targetReached: false,
      attempts: results.length,
      verifiedCount: 0,
      localOnly: true,
    };
  },

  isValidCatalogPage: function () {
    return (
      window.location.href.includes("supplier.meesho.com") &&
      window.location.href.includes("/cataloging/")
    );
  },
};

window.MeeshoAPI = MeeshoAPI;

if (typeof MeeshoAPI.ensureEmbeddedCategories !== "function") {
  MeeshoAPI.ensureEmbeddedCategories = function () {
    const embedded = this.getEmbeddedCategories
      ? this.getEmbeddedCategories()
      : null;
    if (embedded?.length) {
      this.cache.categories = embedded;
      this._lastCategoryFetchWasEmbedded = true;
      return embedded;
    }
    return null;
  };
}
