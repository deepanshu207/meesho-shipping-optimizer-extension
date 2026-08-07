// Meesho Shipping Optimizer v6.0.0 - Main Entry Point

// ─── Live Smart helpers (recommend ★ from current run only) ─────────────────
function pickLiveStrategy(prices) {
  const sorted = [...new Set(prices.filter((p) => p > 0))].sort((a, b) => a - b);
  if (!sorted.length) {
    return { strategy: "none", recommendedPrices: [], reason: "No price data." };
  }
  const lowest = sorted[0];
  if (sorted.includes(lowest + 1)) {
    return {
      strategy: "rupee_pair",
      recommendedPrices: [lowest, lowest + 1],
      reason: `₹1 pair at floor — ₹${lowest} & ₹${lowest + 1}.`,
    };
  }
  return {
    strategy: "single_lowest",
    recommendedPrices: [lowest],
    reason: `Recommend only ₹${lowest}.`,
  };
}

const LIVE_SMART_DEFAULTS = {
  targetShipping: 100,
  maxAttempts: 20,
  maxVariantsCap: 200,
};

const STOP_FORCE_MS = 1200;
const STOP_ESCALATE_MS = 600;

const LiveSmart = {
  readMainSmartModeSettings() {
    const maxAttempts = Math.min(
      Math.max(
        parseInt(document.getElementById("max-attempts")?.value, 10) ||
          LIVE_SMART_DEFAULTS.maxAttempts,
        1,
      ),
      LIVE_SMART_DEFAULTS.maxVariantsCap,
    );
    return {
      purpose: "main",
      targetShipping: LIVE_SMART_DEFAULTS.targetShipping,
      maxAttempts,
      maxShippingCap: LIVE_SMART_DEFAULTS.targetShipping,
    };
  },

  /** Internal cap for recommendations — not shown in UI. */
  getShippingCap() {
    return LIVE_SMART_DEFAULTS.targetShipping;
  },

  scoreLiveVariant(v) {
    let score = 0;
    if (v.isVerified) score += 100;
    if (v.liveVerified) score += 50;
    if (v.duplicatePid) score += 25;
    if (!v.noPid) score += 10;
    if (v.manualPrice) score += 5;
    return score;
  },

  pickBestAtShippingPrice(variants, price) {
    const tier = Number(price);
    const at = (variants || []).filter((v) => Number(v.shippingCost) === tier);
    if (!at.length) return null;
    return [...at].sort(
      (a, b) => this.scoreLiveVariant(b) - this.scoreLiveVariant(a),
    )[0];
  },

  pickRecommendedFromPool(variants) {
    const priced = (variants || []).filter((v) => Number(v.shippingCost) > 0);
    const prices = [...new Set(priced.map((v) => Number(v.shippingCost)))]
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    const strategy = pickLiveStrategy(prices);
    const picks = [];
    const targets = strategy.recommendedPrices?.length
      ? strategy.recommendedPrices
      : prices.length
        ? [prices[0]]
        : [];
    targets.forEach((price) => {
      const pick = this.pickBestAtShippingPrice(priced, price);
      if (pick) picks.push(pick);
    });
    return { picks, strategy, prices };
  },

  /**
   * Mark recommended picks (within target cap) but keep every generated variant visible.
   */
  applyLiveResultPolicy(variants) {
    const cap = this.getShippingCap();
    const all = variants || [];
    const priced = all.filter((v) => Number(v.shippingCost) > 0);
    const withinCap = cap
      ? priced.filter((v) => Number(v.shippingCost) <= cap)
      : priced;
    const recommendationPool = withinCap.length ? withinCap : priced;
    const { picks, strategy, prices } = this.pickRecommendedFromPool(
      recommendationPool,
    );
    const pickIds = new Set(picks.map((p) => String(p.variantId || "")));

    const display = [...all]
      .sort((a, b) => {
        const aPrice =
          Number(a.shippingCost) > 0 ? Number(a.shippingCost) : 9999;
        const bPrice =
          Number(b.shippingCost) > 0 ? Number(b.shippingCost) : 9999;
        if (aPrice !== bPrice) return aPrice - bPrice;
        const aRec =
          pickIds.has(String(a.variantId)) && aPrice < 9999 ? 0 : 1;
        const bRec =
          pickIds.has(String(b.variantId)) && bPrice < 9999 ? 0 : 1;
        if (aRec !== bRec) return aRec - bRec;
        const aVer = a.isVerified ? 0 : 1;
        const bVer = b.isVerified ? 0 : 1;
        if (aVer !== bVer) return aVer - bVer;
        return Number(a.meta?.rank ?? a.meta?.attempt ?? 0) -
          Number(b.meta?.rank ?? b.meta?.attempt ?? 0);
      })
      .map((v) => {
        const recommended =
          Number(v.shippingCost) > 0 &&
          pickIds.has(String(v.variantId || ""));
        return {
          ...v,
          recommended,
          meta: { ...(v.meta || {}), recommended },
        };
      });

    return {
      display,
      withinCap,
      allPriced: priced,
      recommendation: { picks, strategy, prices, cap },
      hiddenHighCount: cap
        ? priced.filter((v) => Number(v.shippingCost) > cap).length
        : 0,
    };
  },
};



class MeeshoShippingOptimizer {
  constructor() {
    this.currentShippingCost = null;
    this.lastDetectedCost = null;
    this.isProcessing = false;
    this.shouldStop = false;
    this.selectedVariantId = null;
    this._runPreviousResults = null;
    this._runFinalizedEarly = false;
    this._stopFinalizeTimer = null;
    this._stopEscalateTimer = null;
    this._generationSeq = 0;
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    this.liveAnalysis = null;
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showAnalysisExtras = false;
    this.lastLivePricedResults = [];
    this.lastProcessedFile = null;
    this.variationCount = 6;
    this.isLicensed = false;
    this.originalImageUrl = null;
    this.modal = null;
    this.autoPopupShown = false;
    this._borderThicknessTimer = null;
    this._gownLayerTimer = null;
    this._gownPhotoZoomTimer = null;
    this._gownPhotoPanTimer = null;
    this._gownPhotoMarginTimer = null;
    this._colorPickerHexTimer = null;
    this._textOverlayPreviewTimer = null;
    this._textControlsVariantId = null;
    this._editingVariantId = null;
    this._activeRunMeta = null;
    this._imageGenGate = null;
    this._imageGenRecorded = false;
    this._imageGenRunStarted = false;
    this._imageGenCreditsCharged = false;
    this._navigationGuardWired = false;
    this._borderComposeGen = 0;
    this._staticControlsVariantId = null;
    this._categoryUserPicked = false;
    this._categoryUserEditing = false;
    this._categoryEditingTimer = null;
    this._categorySearchCommittedValue = "";
    this._categoryAcActiveIndex = -1;
    this._categoryAcResults = [];
    this._categoryAcDebounce = null;
    this._categoryAcIgnoreCloseUntil = 0;
    this._categoryAcPointerInWrap = false;
    this._categoryAcOpenTimer = null;
    this._categoryAcModalClickHandler = null;
    this._categoryAcPinned = false;
    this._categoryPageSyncedThisModal = false;
    this._categoryQuickPicksCache = null;
    this._inertedPageNodes = null;
    this._uploadUserPicked = false;
    this._uploadUserCleared = false;
    this.init();
  }

  /** True when generate is manual (button) instead of auto-start on file pick. */
  isTabbedOptimizerUI() {
    return !!window.WEB_OPTIMIZER_MODE || !!document.getElementById("generate-btn");
  }




  getStaticComposeModuleUrl() {
    if (window.WEB_OPTIMIZER_MODE) {
      return "/js/staticFrameCompose.mjs?v=129";
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("js/staticFrameCompose.mjs?v=129");
    }
    return "/js/staticFrameCompose.mjs?v=129";
  }

  waitForStaticComposeReady(timeoutMs = 10000) {
    if (window.StaticFrameCompose?.composeStaticPreview) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (ok) => {
        clearTimeout(timer);
        window.removeEventListener("static-compose-ready", onReady);
        resolve(ok);
      };
      const onReady = () =>
        done(!!window.StaticFrameCompose?.composeStaticPreview);
      const timer = setTimeout(
        () => done(!!window.StaticFrameCompose?.composeStaticPreview),
        timeoutMs,
      );
      window.addEventListener("static-compose-ready", onReady, { once: true });
    });
  }

  async importOptimizerModule(getUrl, isReady, cacheKey) {
    if (isReady()) return true;
    if (window[cacheKey]) {
      try {
        return await window[cacheKey];
      } catch (e) {
        window[cacheKey] = null;
      }
    }
    if (!window[cacheKey]) {
      window[cacheKey] = this._loadOptimizerModule(getUrl, isReady, cacheKey);
    }
    return window[cacheKey];
  }

  async _loadOptimizerModule(getUrl, isReady, cacheKey) {
    const primary = getUrl();
    const fallback = primary.replace(/\?.*$/, "");
    const urls = primary === fallback ? [primary] : [primary, fallback];
    for (const url of urls) {
      try {
        await import(url);
        if (isReady()) return true;
      } catch (e) {
        console.warn("Module preload failed:", url, e);
      }
    }
    window[cacheKey] = null;
    return false;
  }

  async preloadStaticComposeModule() {
    if (window.StaticFrameCompose?.composeStaticPreview) return true;
    const loaded = await this.importOptimizerModule(
      () => this.getStaticComposeModuleUrl(),
      () => !!window.StaticFrameCompose?.composeStaticPreview,
      "__staticComposePromise",
    );
    if (loaded) return true;
    return await this.waitForStaticComposeReady();
  }

  /** Best URL for variant card / editor preview (layers, upload, or data URL). */
  resolveVariantPreviewSrc(row) {
    if (!row) return "";
    if (typeof OptimizerUI !== "undefined" && OptimizerUI.pickResultImageSrc) {
      const picked = OptimizerUI.pickResultImageSrc(row);
      if (picked) return picked;
    }
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl) {
      const resolved = MeeshoAPI.resolveDisplayUrl(row);
      if (resolved) return resolved;
    }
    const layers = row.layers;
    if (layers) {
      return (
        layers.full ||
        layers.noStickers ||
        layers.productOnly ||
        layers.noBorder ||
        ""
      );
    }
    return (
      row.imageUrl ||
      row.dataUrl ||
      row.pricingImageUrl ||
      row.uploadedUrl ||
      ""
    );
  }



  isStaticPromoRow(row) {
    if (row?.layers?._staticFrame) return true;
    if (typeof window.StaticFrameCompose !== "undefined") {
      return window.StaticFrameCompose.isStaticPromoVariant(row);
    }
    const style = row?.variantStyle || row?.meta?.path || "";
    return style === "showcase" || style === "lifestyle_promo" || style === "tall_static" || style === "gown_static";
  }











  displayLiveResultsPanel(options = {}) {
    this.refreshLiveResultsPanel(options);
  }




  refreshLiveResultsPanel(options = {}) {
    const resultsArea = document.getElementById("results-area");
    if (!resultsArea) return;

    const hasLiveContent =
      this.currentResults.length > 0 || this.analysisPrimaryResults.length > 0;
    if (!hasLiveContent) return;

    resultsArea.style.display = "block";
    delete resultsArea.dataset.view;
    resultsArea.innerHTML = OptimizerUI.getResultsHTML(
      this.currentResults,
      this.getResultsViewOptions(),
    );
    this.setupResultsEvents();

    if (options.scroll !== false && window.WEB_OPTIMIZER_MODE) {
      resultsArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }



  init() {
    console.log("Initializing optimizer...");

    if (!window.WEB_OPTIMIZER_MODE) {
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Message received:", message);
        if (message.action === "openOptimizer") {
          if (document.getElementById("opt-modal")) {
            sendResponse({ success: true, alreadyOpen: true });
            return true;
          }
          this.openModal();
          sendResponse({ success: true });
        } else if (message.type === "LICENSE_UPDATED") {
          void this.checkLicense().then((valid) => {
            if (!valid && this.modal && !this.isProcessing) {
              OptimizerUtils.showNotification(
                "License expired — please activate again",
                "error",
              );
              this.closeModal();
              setTimeout(() => this.openModal(), 400);
            }
          });
          sendResponse({ success: true });
        }
        return true;
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }

    // Also listen for URL changes (SPA navigation)
    this.observeUrlChanges();
  }

  // Observe URL changes for SPA
  observeUrlChanges() {
    let lastUrl = location.href;
    let setupTimer = null;
    new MutationObserver(() => {
      const url = location.href;
      if (url === lastUrl) return;
      lastUrl = url;
      console.log("URL changed:", url);
      this.autoPopupShown = false;
      clearTimeout(setupTimer);
      setupTimer = setTimeout(() => this.setup(), 800);
    }).observe(document, { subtree: true, childList: true });
  }

  async setup() {
    console.log("Setup called, URL:", window.location.href);

    // Only run on Meesho cataloging pages (avoid login/session flows)
    if (!this.isMeeshoPage() || !this.isCatalogPage()) return;

    console.log("Meesho catalog page detected");
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI && typeof MeeshoAPI.init === "function") {
      MeeshoAPI.init();
    }

    this.addFloatingOptimizerButton();

    void this.ensureFullCategories().then((list) => {
      if (list?.length) {
        this.allCategories = list;
        this.syncCategoryListToMeeshoCategories(list);
        this.warmCategoryCaches();
      }
    });

    void this.checkLicense().then(() => {
      this.waitForMeeshoImageInput(() => {
        console.log("Meesho image input found, adding button");
        this.addOptimizerButton();
        this.detectShipping();
        if (!document.getElementById("opt-modal")) {
          this.scheduleMeeshoPageSync();
        }
      });
    });
  }

  waitForMeeshoImageInput(callback, maxAttempts = 40) {
    let attempts = 0;
    const check = () => {
      const input = this.findMeeshoCatalogImageInput();
      if (input) {
        callback(input);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 500);
      } else {
        console.log("Meesho catalog file input not found after polling");
      }
    };
    check();
  }

  /** Find Meesho product image file input (legacy #changeFrontImage or new panel). */
  findMeeshoCatalogImageInput() {
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.findCatalogFileInput) {
      const input = MeeshoAPI.findCatalogFileInput();
      if (input && !input.closest("#opt-modal, #optimizer-app, .opt-modal")) {
        return input;
      }
    }

    const scoreInput = (input) => {
      if (!input || input.type !== "file") return -1;
      if (input.closest("#opt-modal, #optimizer-app, .opt-modal")) return -1;

      let score = 0;
      const id = String(input.id || "").toLowerCase();
      const name = String(input.name || "").toLowerCase();
      const accept = String(input.accept || "").toLowerCase();
      const aria = String(input.getAttribute("aria-label") || "").toLowerCase();

      if (id === "changefrontimage") score += 120;
      if (id.includes("frontimage") || id.includes("front_image")) score += 90;
      if (name.includes("front") && name.includes("image")) score += 85;
      if (id.includes("catalog") && id.includes("image")) score += 70;
      if (name.includes("catalog") && name.includes("image")) score += 65;
      if (id.includes("product") && id.includes("image")) score += 60;
      if (name.includes("product") && name.includes("image")) score += 55;
      if (id.includes("image") || name.includes("image")) score += 35;
      if (accept.includes("image")) score += 25;
      if (aria.includes("image") || aria.includes("photo") || aria.includes("upload")) {
        score += 20;
      }
      try {
        const rect = input.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) score += 10;
      } catch (e) {}
      if (input.offsetParent != null) score += 8;
      return score;
    };

    const inputs = new Set();
    const collectFrom = (root) => {
      if (!root?.querySelectorAll) return;
      try {
        root.querySelectorAll('input[type="file"]').forEach((el) => inputs.add(el));
        root.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) collectFrom(el.shadowRoot);
        });
      } catch (e) {}
    };

    collectFrom(document);
    document.querySelectorAll("iframe").forEach((frame) => {
      try {
        if (frame.contentDocument) collectFrom(frame.contentDocument);
      } catch (e) {}
    });

    const ranked = [...inputs].sort((a, b) => scoreInput(b) - scoreInput(a));
    const best = ranked[0];
    return best && scoreInput(best) > 0 ? best : null;
  }

  canApplyToMeeshoPage() {
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.canApplyCatalogImage) {
      return MeeshoAPI.canApplyCatalogImage();
    }
    return !!this.findMeeshoCatalogImageInput();
  }

  // Wait for element to appear
  waitForElement(selector, callback, maxAttempts = 20) {
    let attempts = 0;
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 500);
      } else {
        console.log(
          "Element not found after",
          maxAttempts,
          "attempts:",
          selector
        );
      }
    };
    check();
  }

  // Check if current page is Meesho
  isMeeshoPage() {
    return window.location.href.includes("supplier.meesho.com");
  }

  // Check if current page is a catalog/product page
  isCatalogPage() {
    const url = window.location.href;
    return (
      url.includes("/catalogs/single") ||
      url.includes("/cataloging/") ||
      url.includes("/catalog/") ||
      url.includes("/catalogs/single/add") ||
      document.querySelector("#changeFrontImage") !== null ||
      !!this.findMeeshoCatalogImageInput?.() ||
      !!this.canApplyToMeeshoPage?.()
    );
  }

  addFloatingOptimizerButton() {
    if (document.getElementById("meesho-optimizer-fab")) return;

    const fab = document.createElement("button");
    fab.id = "meesho-optimizer-fab";
    fab.type = "button";
    fab.title = "Shipping Optimizer";
    fab.setAttribute("aria-label", "Shipping Optimizer");

    const iconUrl =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("icons/icon48.png")
        : "";

    fab.innerHTML = iconUrl
      ? `<img src="${iconUrl}" alt="" width="32" height="32" style="display:block;border-radius:9px;">`
      : `<span style="font-size:22px;line-height:1;">📦</span>`;

    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    const bottomOffset = isNarrow ? "88px" : "22px";
    const size = isNarrow ? "52px" : "56px";

    fab.style.cssText = `
      position: fixed;
      right: ${isNarrow ? "14px" : "18px"};
      bottom: ${bottomOffset};
      z-index: 2147483646;
      width: ${size};
      height: ${size};
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);
      color: #3d2914;
      border: 2px solid rgba(255,255,255,0.85);
      border-radius: 50%;
      box-shadow: 0 8px 22px rgba(196,95,18,0.38);
      cursor: pointer;
      touch-action: manipulation;
    `;

    fab.onclick = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      this.openModal();
    };

    document.documentElement.appendChild(fab);
    this._optimizerFab = fab;
  }

  setOptimizerFabVisible(visible) {
    const fab = this._optimizerFab || document.getElementById("meesho-optimizer-fab");
    if (!fab) return;
    fab.style.display = visible ? "flex" : "none";
  }

  async checkLicense() {
    if (window.WEB_OPTIMIZER_MODE) {
      this.isLicensed = true;
      return true;
    }

    try {
      if (typeof LicenseManager !== "undefined") {
        this.isLicensed = await LicenseManager.checkLicense();
        return this.isLicensed;
      }

      const result = await chrome.storage.sync.get([
        "licenseKey",
        "licenseStatus",
        "licenseInfo",
      ]);

      if (result.licenseStatus === "active" && result.licenseKey) {
        this.isLicensed = true;
        return true;
      }

      this.isLicensed = false;
      return false;
    } catch (error) {
      console.error("License check error:", error);
      this.isLicensed = false;
      return false;
    }
  }

  requiresLicense() {
    return !window.WEB_OPTIMIZER_MODE;
  }

  async ensureLicensed(actionLabel) {
    if (!this.requiresLicense()) return true;
    const gate = await LicenseManager.ensureCanOperate(actionLabel);
    if (gate.ok) {
      this.isLicensed = true;
      return true;
    }
    OptimizerUtils.showNotification(
      gate.reason ||
        (actionLabel
          ? `${actionLabel} requires an active license`
          : "License required — activate in extension popup"),
      "error",
    );
    this.openModal();
    return false;
  }

  /** Charge credits when a generation run starts (1 per run, even if stopped). */
  async chargeImageGenerationForRun() {
    if (this._imageGenCreditsCharged) return true;
    if (!this._imageGenRunStarted) return false;
    if (!this.requiresLicense()) return true;
    const gate = this._imageGenGate;
    if (!gate) return false;

    const expectedCost = await LicenseManager.getImageGenRunCost(gate);
    const result = await LicenseManager.chargeImageGenerationRun(gate);
    const charged = LicenseManager.isImageGenCreditChargeSuccess(
      result,
      expectedCost,
    );
    if (charged) {
      this._imageGenCreditsCharged = true;
      this.isLicensed = LicenseManager.isLicensed;
      void this.refreshImageGenQuotaUi();
      return true;
    }

    OptimizerUtils.showNotification(
      result.reason || "Could not charge credits for this run.",
      "error",
      6000,
    );
    return false;
  }

  /** Record one generation run (upload → variants), even if stopped or zero results. */
  async recordImageGenerationForRun() {
    if (this._imageGenRecorded) return;
    if (!this._imageGenRunStarted) return;
    if (!this.requiresLicense()) return;
    const gate = this._imageGenGate;
    if (!gate) return;
    this._imageGenRecorded = true;
    try {
      if (!this._imageGenCreditsCharged) {
        const expectedCost = await LicenseManager.getImageGenRunCost(gate);
        const charge = await LicenseManager.chargeImageGenerationRun(gate);
        if (LicenseManager.isImageGenCreditChargeSuccess(charge, expectedCost)) {
          this._imageGenCreditsCharged = true;
        }
      }
      if (gate.config?.configured) {
        await LicenseManager.recordImageGeneration(1, gate);
      }
      this.isLicensed = LicenseManager.isLicensed;
      void this.refreshImageGenQuotaUi();
    } catch (e) {
      console.warn("Image-gen record failed:", e);
    }
  }

  isClickOnVisibleImage(img, event) {
    if (!img || !event) return false;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return true;

    const boxRatio = rect.width / rect.height;
    const imgRatio = nw / nh;
    let paintedW;
    let paintedH;
    let offsetX;
    let offsetY;

    if (imgRatio > boxRatio) {
      paintedW = rect.width;
      paintedH = rect.width / imgRatio;
      offsetX = 0;
      offsetY = (rect.height - paintedH) / 2;
    } else {
      paintedH = rect.height;
      paintedW = rect.height * imgRatio;
      offsetY = 0;
      offsetX = (rect.width - paintedW) / 2;
    }

    const left = rect.left + offsetX;
    const top = rect.top + offsetY;
    const right = left + paintedW;
    const bottom = top + paintedH;
    const x = event.clientX;
    const y = event.clientY;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  handleResultImagePreviewClick(img, event) {
    if (!this.isClickOnVisibleImage(img, event)) return;
    event.preventDefault();
    event.stopPropagation();
    const variantId = img.dataset.variantId;
    if (!variantId) return;
    this.selectResultVariant(variantId);
    const row = this.findResultRow(variantId);
    if (this.canEditResultRow(row)) {
      void this.openVariantEditor(variantId);
    } else if (row) {
      this.openVariantFullPreview(row);
    }
  }

  addOptimizerButton() {
    if (document.querySelector(".shipping-optimizer-btn")) {
      console.log("Button already exists");
      return;
    }

    const imageInput = this.findMeeshoCatalogImageInput();
    const frontCtx =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.findFrontImageUploadContext
        ? MeeshoAPI.findFrontImageUploadContext()
        : null;
    if (!imageInput && !this.canApplyToMeeshoPage()) {
      console.log("Image input not found on page yet");
      return;
    }

    console.log("Adding optimizer button");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shipping-optimizer-btn";
    const iconUrl =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("icons/icon32.png")
        : "";

    btn.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                ${
                  iconUrl
                    ? `<img src="${iconUrl}" alt="" width="30" height="30" style="display:block;border-radius:9px;box-shadow:0 2px 6px rgba(61,41,20,0.15);">`
                    : `<span style="font-size:22px;">📦</span>`
                }
                <div>
                    <div style="font-weight:800;font-size:15px;color:#3d2914;">Shipping Optimizer</div>
                    <div style="font-size:11px;color:#3d2914;opacity:0.85;">${
                      this.isLicensed
                        ? "Generate · Preview · Apply"
                        : "Activate license to start"
                    }</div>
                </div>
            </div>
        `;
    btn.style.cssText = `
            background: linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);
            color: #3d2914;
            border: none;
            padding: 15px 25px;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            max-width: 350px;
            box-shadow: 0 6px 20px rgba(230,126,34,0.35);
            font-family: "Trebuchet MS", "Lucida Grande", "Segoe UI", sans-serif;
            margin: 10px 0;
            transition: transform 0.2s, box-shadow 0.2s;
        `;
    btn.onmouseenter = () => {
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 8px 25px rgba(230,126,34,0.45)";
    };
    btn.onmouseleave = () => {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 6px 20px rgba(230,126,34,0.35)";
    };
    btn.onclick = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      this.openModal();
    };

    const wrapper = document.createElement("div");
    wrapper.style.margin = "10px 0";
    wrapper.appendChild(btn);

    const parent =
      imageInput?.closest("div") ||
      imageInput?.parentElement ||
      frontCtx?.section ||
      frontCtx?.uploadButton?.closest("div") ||
      document.querySelector('[data-testid="removeImage"]')?.closest(".MuiBox-root")
        ?.parentElement;
    if (parent) {
      parent.appendChild(wrapper);
      console.log("Button added successfully");
    }
  }

  detectShipping() {
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.syncCatalogPricing) {
      MeeshoAPI.syncCatalogPricing();
      const catalog = MeeshoAPI.detectCatalogPricing?.();
      if (
        catalog?.customerShipping >= 25 &&
        catalog.customerShipping <= 150
      ) {
        console.log("Shipping from Meesho panel:", catalog.customerShipping);
        this.currentShippingCost = catalog.customerShipping;
        return catalog.customerShipping;
      }
    }

    const parseCost = (txt) => {
      const m = String(txt || "").match(/₹\s*(\d+)/);
      if (!m) return null;
      const cost = parseInt(m[1], 10);
      if (cost >= 25 && cost <= 150) return cost;
      return null;
    };

    const labelPatterns = [
      /shipping\s*charge[s]?/i,
      /delivery\s*charge[s]?/i,
      /logistics\s*charge[s]?/i,
    ];

    const tryElement = (el) => {
      const txt = el?.textContent || "";
      if (!txt.includes("₹")) return null;
      const self = parseCost(txt);
      if (self) return self;
      const parentText = el.parentElement?.textContent || "";
      if (labelPatterns.some((re) => re.test(parentText))) {
        return parseCost(txt) || parseCost(parentText);
      }
      return null;
    };

    const selectors = [
      "p.MuiTypography-root.MuiTypography-body1.css-v40lxd",
      '[class*="css-v40lxd"]',
      '[class*="shipping"]',
      '[class*="Shipping"]',
      ".MuiTypography-body1",
      ".MuiTypography-root",
    ];

    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const cost = tryElement(el);
          if (cost) {
            console.log("Shipping found:", cost, "via", sel);
            this.currentShippingCost = cost;
            return cost;
          }
        }
      } catch (e) {}
    }

    return this.currentShippingCost;
  }

  mountEmbedded(root) {
    this.embeddedRoot = root || document.getElementById("optimizer-app");
    this.isLicensed = true;

    // Keep static HTML from index.html if upload input already exists
    if (!document.getElementById("image-input") && typeof OptimizerUI !== "undefined") {
      this.embeddedRoot.innerHTML = OptimizerUI.createModalHTML(true);
    }

    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const generateBtn = document.getElementById("generate-btn");
    const uploadArea = document.getElementById("upload-area");
    if (processingArea) processingArea.style.display = "none";
    if (resultsArea) resultsArea.style.display = "none";
    if (uploadArea) uploadArea.style.display = "block";
    if (generateBtn) {
      generateBtn.style.display = "block";
      const hasFile =
        this._pendingFile ||
        window.__webPendingFile ||
        document.getElementById("image-input")?.files?.[0];
      if (hasFile) generateBtn.disabled = false;
    }
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });

    this.setupMainEvents();
    this.setupNavigationGuards();
    this.enableAllGenerateButtons();

    try {
      if (typeof MeeshoAPI !== "undefined") {
        this.safeEnsureEmbeddedCategories();
        MeeshoAPI.init();
      }
    } catch (e) {
      console.warn("Category init skipped:", e);
    }

    if (typeof WebSession !== "undefined") {
      WebSession.updateStatus();
    }

    const bootMsg = document.getElementById("boot-msg");
    if (bootMsg) {
      bootMsg.textContent = this._pendingFile || document.getElementById("image-input")?.files?.[0]
        ? "Image ready — tap Generate Variants"
        : "Ready — choose an image";
    }
  }

  async openModal() {
    if (window.WEB_OPTIMIZER_MODE) {
      const root = document.getElementById("optimizer-app");
      if (root) {
        this.mountEmbedded(root);
        return;
      }
    }

    await this.checkLicense();

    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.init();
    } else if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.init?.();
      MeeshoAPI.detectAllValues?.();
    }

    const existing = document.getElementById("opt-modal");
    if (existing) existing.remove();

    this.modal = document.createElement("div");
    this.modal.id = "opt-modal";
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 2147483646;
            isolation: isolate;
            display: flex;
            justify-content: ${isNarrow ? "stretch" : "center"};
            align-items: ${isNarrow ? "stretch" : "center"};
            backdrop-filter: blur(5px);
        `;

    const content = document.createElement("div");
    content.style.cssText = isNarrow
      ? "width:100%;height:100%;max-width:100%;max-height:100%;overflow-y:auto;"
      : "max-width:480px;width:95%;max-height:90vh;overflow-y:auto;";
    content.innerHTML = OptimizerUI.createModalHTML(this.isLicensed);

    this.modal.appendChild(content);
    document.documentElement.appendChild(this.modal);
    this.setOptimizerFabVisible(false);

    this._categoryPageSyncedThisModal = false;
    this._categoryAcPinned = false;
    this.inertMeeshoPageBehindModal();

    if (this.isLicensed) {
      this.setupMainEvents();
      this.attachCategoryAutocompleteModalHandlers();
    } else {
      this.setupLicenseEvents();
    }

    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.closeModal();
    };

    setTimeout(() => {
      this.syncFromMeeshoPageOnce();
    }, 150);
  }

  inertMeeshoPageBehindModal() {
    this.restoreMeeshoPageInert();
    this._inertedPageNodes = [];
    document.querySelectorAll("body > *").forEach((el) => {
      if (el.id === "opt-modal") return;
      el.setAttribute("inert", "");
      this._inertedPageNodes.push(el);
    });
  }

  restoreMeeshoPageInert() {
    if (this._inertedPageNodes?.length) {
      this._inertedPageNodes.forEach((el) => el.removeAttribute("inert"));
    }
    this._inertedPageNodes = null;
  }

  syncFromMeeshoPageOnce() {
    if (window.WEB_OPTIMIZER_MODE || !this.isCatalogPage?.()) return;
    if (this.isCategoryAutocompleteActive()) return;
    if (!this._categoryUserPicked) {
      this.applyPageCategoryIfAvailable({ modalSession: true });
    }
    void this.importPageImageIfNeeded();
  }

  /** Clear all short-lived debounce/editor timers so stray callbacks never
   *  fire against DOM that has been torn down (modal closed / results reset). */
  clearTransientTimers() {
    const timers = [
      "_borderThicknessTimer",
      "_gownLayerTimer",
      "_gownPhotoZoomTimer",
      "_gownPhotoPanTimer",
      "_gownPhotoMarginTimer",
      "_colorPickerHexTimer",
      "_textOverlayPreviewTimer",
      "_categoryEditingTimer",
      "_categoryAcDebounce",
      "_categoryAcOpenTimer",
    ];
    for (const key of timers) {
      if (this[key]) {
        clearTimeout(this[key]);
        this[key] = null;
      }
    }
  }

  /** Release cached blob object URLs held on result rows to avoid leaks. */
  revokeResultObjectUrls(rows) {
    (rows || []).forEach((row) => {
      if (row && row._previewObjectUrl) {
        try {
          URL.revokeObjectURL(row._previewObjectUrl);
        } catch (e) {
          /* ignore */
        }
        row._previewObjectUrl = null;
        row._previewObjectUrlBlob = null;
      }
      if (row?.layers?._composeFallbackUrl) {
        try {
          URL.revokeObjectURL(row.layers._composeFallbackUrl);
        } catch (e) {
          /* ignore */
        }
        row.layers._composeFallbackUrl = null;
      }
    });
  }

  closeModal() {
    if (window.WEB_OPTIMIZER_MODE && this.embeddedRoot) {
      this.mountEmbedded(this.embeddedRoot);
      return;
    }
    this.restoreMeeshoPageInert();
    this.detachCategoryAutocompleteModalHandlers();
    this.clearTransientTimers();
    this._categoryUserEditing = false;
    this._categoryAcPinned = false;
    this._categoryPageSyncedThisModal = false;
    this.hideCategoryAutocomplete({ force: true });
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.setOptimizerFabVisible(true);
  }

  isCategoryAutocompleteActive() {
    const listEl = document.getElementById("category-ac-list");
    const search = document.getElementById("category-search");
    return (
      this._categoryAcPinned ||
      listEl?.classList.contains("open") ||
      (this._categoryUserEditing &&
        search &&
        document.activeElement === search)
    );
  }

  attachCategoryAutocompleteModalHandlers() {
    if (!this.modal) return;
    this.detachCategoryAutocompleteModalHandlers();
    this._categoryAcModalClickHandler = (e) => {
      if (e.target.closest("#category-ac-wrap")) return;
      if (Date.now() < this._categoryAcIgnoreCloseUntil) return;
      this.hideCategoryAutocomplete({ force: true });
    };
    this.modal.addEventListener("click", this._categoryAcModalClickHandler);
  }

  detachCategoryAutocompleteModalHandlers() {
    if (this.modal && this._categoryAcModalClickHandler) {
      this.modal.removeEventListener("click", this._categoryAcModalClickHandler);
    }
    this._categoryAcModalClickHandler = null;
  }

  setupLicenseEvents() {
    const closeBtn = document.getElementById("close-modal");
    if (closeBtn) closeBtn.onclick = () => this.closeModal();

    const activateBtn = document.getElementById("activate-license-btn");
    const keyInput = document.getElementById("license-key-input");

    const bindPlanButtons = () => {
      if (
        typeof FirebaseLicense !== "undefined" &&
        FirebaseLicense.wirePlanAddonSelection
      ) {
        FirebaseLicense.wirePlanAddonSelection(this.modal || document);
      }
      const productName = CONFIG?.EXTENSION_NAME || "Shipping Optimizer";
      const plansView = document.getElementById("license-plans-view");
      const detailView = document.getElementById("license-plan-detail-view");
      const detailBody = document.getElementById("license-plan-detail-body");
      const backBtn = document.getElementById("license-plan-back-btn");

      const creditsSection = document.getElementById("license-credits-section");
      const creditDetailView = document.getElementById("license-credit-detail-view");
      const creditDetailBody = document.getElementById("license-credit-detail-body");
      const creditBackBtn = document.getElementById("license-credit-back-btn");

      const openWhatsAppChat = (message, number) => {
        const defaultPhone = CONFIG?.DEFAULT_WHATSAPP || "919654414891";
        const openWithPhone = (phone) => {
          if (typeof WhatsAppLink !== "undefined") {
            if (WhatsAppLink.isMobile()) {
              WhatsAppLink.openMobileSync(phone, message);
            } else {
              void WhatsAppLink.open(phone, message);
            }
            return;
          }
          window.open(
            `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
            "_blank",
          );
        };

        if (number) {
          openWithPhone(number);
          return;
        }

        if (typeof WhatsAppLink !== "undefined" && WhatsAppLink.isMobile()) {
          openWithPhone(defaultPhone);
          return;
        }

        LicenseManager.getWhatsAppSettings()
          .then((settings) => openWithPhone(settings.number || defaultPhone))
          .catch(() => openWithPhone(defaultPhone));
      };

      const showPlanDetail = async (planId) => {
        if (!detailView || !detailBody) return;
        let plan = null;
        if (typeof FirebaseLicense !== "undefined") {
          plan = await FirebaseLicense.getPlanById(planId);
        }
        if (!plan) return;
        if (plansView) plansView.style.display = "none";
        if (creditsSection) creditsSection.style.display = "none";
        if (creditDetailView) creditDetailView.style.display = "none";
        detailView.style.display = "block";
        detailBody.innerHTML = FirebaseLicense.renderPlanDetailHtml(plan, {
          productName,
        });
        FirebaseLicense.wirePlanAddonSelection(detailBody);
        const buyBtn = detailBody.querySelector(".plan-detail-buy-btn");
        if (buyBtn) {
          buyBtn.onclick = () => {
            const msg = FirebaseLicense.buildPlanPurchaseMessage(
              plan.id,
              productName,
              this.modal || document,
            );
            openWhatsAppChat(msg);
          };
        }
      };

      const showCreditPackDetail = async (packId) => {
        if (!creditDetailView || !creditDetailBody) return;
        let pack = null;
        if (typeof FirebaseLicense !== "undefined") {
          pack = await FirebaseLicense.getCreditPackById(packId);
        }
        if (!pack) return;
        if (plansView) plansView.style.display = "none";
        if (detailView) detailView.style.display = "none";
        if (creditsSection) creditsSection.style.display = "none";
        creditDetailView.style.display = "block";
        creditDetailBody.innerHTML = FirebaseLicense.renderCreditPackDetailHtml(
          pack,
          { productName },
        );
        const buyBtn = creditDetailBody.querySelector(
          ".credit-pack-detail-buy-btn",
        );
        if (buyBtn) {
          buyBtn.onclick = () => {
            const msg = FirebaseLicense.buildCreditPackPurchaseMessage(
              pack,
              productName,
            );
            openWhatsAppChat(msg);
          };
        }
      };

      if (backBtn) {
        backBtn.onclick = () => {
          if (detailView) detailView.style.display = "none";
          if (plansView) plansView.style.display = "block";
          if (creditsSection) creditsSection.style.display = "block";
        };
      }

      if (creditBackBtn) {
        creditBackBtn.onclick = () => {
          if (creditDetailView) creditDetailView.style.display = "none";
          if (creditsSection) creditsSection.style.display = "block";
          if (plansView) plansView.style.display = "block";
        };
      }

      document.querySelectorAll(".plan-buy-btn.plan-card-main, .plan-buy-btn").forEach((btn) => {
        btn.onclick = async (e) => {
          if (e?.target?.closest?.(".plan-detail-corner, .plan-detail-corner-btn")) {
            return;
          }
          const planId = btn.dataset.plan;
          if (!planId) return;
          const msg = FirebaseLicense.buildPlanPurchaseMessage(
            planId,
            productName,
            this.modal || document,
          );
          openWhatsAppChat(msg);
        };

        btn.onmouseenter = () => {
          btn.style.transform = "scale(1.03)";
          btn.style.boxShadow = "0 4px 15px rgba(230,126,34,0.35)";
        };
        btn.onmouseleave = () => {
          btn.style.transform = "scale(1)";
          btn.style.boxShadow = "none";
        };
      });

      document.querySelectorAll(".plan-detail-corner-btn").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const planId = btn.dataset.plan;
          if (planId) void showPlanDetail(planId);
        };
      });

      document.querySelectorAll(".credit-pack-open-btn").forEach((btn) => {
        btn.onclick = async (e) => {
          if (
            e?.target?.closest?.(
              ".plan-detail-corner, .credit-pack-detail-corner-btn",
            )
          ) {
            return;
          }
          const packId = btn.dataset.pack;
          if (!packId) return;
          const pack = await FirebaseLicense.getCreditPackById(packId);
          const msg = FirebaseLicense.buildCreditPackPurchaseMessage(
            pack || {
              id: packId,
              credits: btn.dataset.credits,
              price: btn.dataset.price,
              label: btn.dataset.label,
            },
            productName,
          );
          openWhatsAppChat(msg);
        };
      });

      document.querySelectorAll(".credit-pack-detail-corner-btn").forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const packId = btn.dataset.pack;
          if (packId) await showCreditPackDetail(packId);
        };
      });
    };

    bindPlanButtons();

    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      FirebaseLicense.hydrateLicenseUi(this.modal)
        .then(() => bindPlanButtons())
        .catch((e) => console.warn("Firebase license UI hydrate failed:", e));
    }

    // License activation
    if (activateBtn && keyInput) {
      activateBtn.onclick = async () => {
        const key = keyInput.value.trim();
        if (!key) {
          OptimizerUtils.showNotification(
            "Please enter a license key",
            "error"
          );
          return;
        }

        if (key.length < 10) {
          OptimizerUtils.showNotification("License key is too short", "error");
          return;
        }

        activateBtn.textContent = "Verifying...";
        activateBtn.disabled = true;

        try {
          const result = await LicenseManager.verifyLicenseKey(key);

          if (result.success) {
            this.isLicensed = true;
            OptimizerUtils.showNotification(
              "License activated successfully!",
              "success"
            );
            this.closeModal();
            setTimeout(() => this.openModal(), 300);
          } else {
            OptimizerUtils.showNotification(
              result.message || "License verification failed",
              "error"
            );
            activateBtn.textContent = "Activate License";
            activateBtn.disabled = false;
          }
        } catch (error) {
          console.error("Activation error:", error);
          OptimizerUtils.showNotification("Error: " + error.message, "error");
          activateBtn.textContent = "Activate License";
          activateBtn.disabled = false;
        }
      };

      keyInput.onkeypress = (e) => {
        if (e.key === "Enter") activateBtn.click();
      };
    }
  }

  async ensureFullCategories() {
    const minFull =
      (typeof MeeshoCategories !== "undefined" && MeeshoCategories.FULL_CATEGORY_MIN) ||
      3000;

    try {
      if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.ensureFullCategories) {
        const list = await MeeshoAPI.ensureFullCategories();
        if (list?.length >= minFull) return list;
      }
    } catch (e) {
      console.warn("ensureFullCategories failed:", e);
    }

    const embedded = this.safeEnsureEmbeddedCategories();
    if (embedded?.length >= minFull) return embedded;

    if (typeof MeeshoAPI !== "undefined") {
      const list = await MeeshoAPI.fetchCategories(false);
      if (list?.length) return list;
    }

    return embedded || [];
  }

  safeEnsureEmbeddedCategories() {
    try {
      if (typeof MeeshoAPI === "undefined") return null;
      if (typeof MeeshoAPI.ensureEmbeddedCategories === "function") {
        return MeeshoAPI.ensureEmbeddedCategories();
      }
      if (typeof MeeshoAPI.getEmbeddedCategories === "function") {
        const embedded = MeeshoAPI.getEmbeddedCategories();
        if (embedded?.length) {
          MeeshoAPI.cache.categories = embedded;
          MeeshoAPI._lastCategoryFetchWasEmbedded = true;
          return embedded;
        }
      }
      if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.getList) {
        const list = MeeshoCategories.getList();
        if (list?.length) {
          MeeshoAPI.cache.categories = list;
          MeeshoAPI._lastCategoryFetchWasEmbedded = true;
          return list;
        }
      }
    } catch (e) {
      console.warn("Could not load embedded categories:", e);
    }
    return null;
  }

  setupMainEvents() {
    const closeBtn = document.getElementById("close-modal");
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (window.WEB_OPTIMIZER_MODE) {
          this.mountEmbedded(this.embeddedRoot || document.getElementById("optimizer-app"));
        } else {
          this.closeModal();
        }
      };
    }

    // File input + generate — wire FIRST so upload always works
    const fileInput = document.getElementById("image-input");
    const uploadArea = document.getElementById("upload-area");
    const generateBtn = document.getElementById("generate-btn");
    const tabbedGenerateMode = this.isTabbedOptimizerUI() && generateBtn;

    const showFilePreview = (file) => {
      const previewBox = document.getElementById("preview-box");
      const previewImg = document.getElementById("preview-img");
      if (!previewBox || !previewImg) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        this.originalImageUrl = ev.target.result;
        previewBox.style.display = "block";
        const label = previewBox.querySelector(".preview-label");
        if (label) label.textContent = file.name;
        if (uploadArea) uploadArea.style.display = "none";
        this.wireClearUploadButton();
      };
      reader.readAsDataURL(file);
    };

    const getUploadFile = () => {
      if (fileInput?.files?.[0]) return fileInput.files[0];
      if (this._pendingFile) return this._pendingFile;
      if (window.__webPendingFile) {
        this._pendingFile = window.__webPendingFile;
        return window.__webPendingFile;
      }
      return null;
    };

    const isImageFile = (file) => {
      if (!file) return false;
      if (file.type && file.type.startsWith("image/")) return true;
      return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name || "");
    };

    const onFilePicked = (file) => {
      if (!file) return;
      if (!isImageFile(file)) {
        OptimizerUtils.showNotification("Please choose a JPG, PNG, or WebP image", "error");
        return;
      }

      console.log("File selected:", file.name);
      this.setOptimizerUploadFile(file, { source: "user" });

      const bootMsg = document.getElementById("boot-msg");
      if (tabbedGenerateMode) {
        generateBtn.disabled = false;
        if (bootMsg) bootMsg.textContent = "Image ready — tap Generate Variants";
        this.refreshLiveResultsPanel({ scroll: false });
        return;
      }

      setTimeout(() => this.processImage(file), 500);
    };

    if (fileInput) {
      fileInput.onclick = () => {
        fileInput.value = "";
      };
      fileInput.onchange = (e) => onFilePicked(e.target.files?.[0]);
    }

    const pending =
      window.__webPendingFile ||
      fileInput?.files?.[0] ||
      this._pendingFile;
    if (pending && tabbedGenerateMode) {
      onFilePicked(pending);
    } else if (pending) {
      this._pendingFile = pending;
    }

    if (tabbedGenerateMode) {
      const runGenerate = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const file = getUploadFile();
        if (!file) {
          OptimizerUtils.showNotification("Choose an image first", "error");
          return;
        }
        if (this.isProcessing) {
          this.requestStopGeneration();
          return;
        }
        void this.processImage(file);
      };

      generateBtn.disabled = !getUploadFile();
      generateBtn.onclick = runGenerate;
    }

    if (uploadArea) {
      uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = "#e67e22";
      };
      uploadArea.ondragleave = () => {
        uploadArea.style.borderColor = "rgba(230,126,34,0.45)";
      };
      uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = "rgba(230,126,34,0.45)";
        if (e.dataTransfer.files.length && fileInput) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event("change"));
        }
      };
    }

    // Categories + session — must not block generate button
    try {
      if (typeof MeeshoAPI !== "undefined") {
        MeeshoAPI.syncFromSession?.();
        this.safeEnsureEmbeddedCategories();
      }
    } catch (e) {
      console.warn("MeeshoAPI init skipped:", e);
    }
    if (window.WEB_OPTIMIZER_MODE && typeof WebSession !== "undefined") {
      WebSession.wireForm();
    }
    this.loadCategoryDropdown();

    const categorySelect = document.getElementById("category-select");
    if (categorySelect && !document.getElementById("category-search")) {
      categorySelect.onchange = () => {
        const categoryId = parseInt(categorySelect.value, 10);
        if (categoryId && typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(categoryId);
        }
      };
    }

    this.wireClearUploadButton();
    this.setupNavigationGuards();

    const maxAttemptsSelect = document.getElementById("max-attempts");
    if (maxAttemptsSelect) {
      maxAttemptsSelect.addEventListener("change", () =>
        this.refreshImageGenQuotaUi(),
      );
    }
    void this.refreshImageGenQuotaUi();
    void this.hydrateSmartModeSettings();
  }

  async hydrateSmartModeSettings(root) {
    const scope = root || this.modal || document;
    let smartCfg = null;
    let imageGenCfg = null;
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        [smartCfg, imageGenCfg] = await Promise.all([
          FirebaseLicense.getSmartModeConfig(true),
          FirebaseLicense.getImageGenerationConfig(true),
        ]);
      } catch (e) {
        console.warn("Smart mode config load failed:", e.message);
      }
    }
    if (!smartCfg && typeof FirebaseLicense !== "undefined") {
      smartCfg = FirebaseLicense.defaultSmartModeConfig();
    }
    if (smartCfg) {
      smartCfg = FirebaseLicense.applySmartModeRuntime(smartCfg, imageGenCfg);
      LIVE_SMART_DEFAULTS.maxAttempts = smartCfg.default_variant;
      LIVE_SMART_DEFAULTS.maxVariantsCap = smartCfg.max_variants_cap;
      const select = scope.querySelector("#max-attempts");
      FirebaseLicense.fillMaxAttemptsSelect(select, smartCfg);
      FirebaseLicense.updateSmartModeLabels(scope, smartCfg);
    }
  }

  /** Show credits balance + generation limits on the optimizer screen. */
  async refreshImageGenQuotaUi() {
    const creditsEl = document.getElementById("image-gen-credits");
    const quotaEl = document.getElementById("image-gen-quota");
    if (!this.requiresLicense() || typeof LicenseManager === "undefined") return;
    try {
      const summary = await LicenseManager.getImageGenSummary();
      const cfg = summary.config;
      const bal =
        summary.creditsBalance === Infinity ? "∞" : summary.creditsBalance;

      if (creditsEl) {
        if (summary.creditsApply) {
          const cost = summary.costPerRun || 1;
          creditsEl.style.display = "block";
          creditsEl.innerHTML = `💳 Credits: <strong>${bal}</strong> left · <strong>${cost}</strong> per generation run`;
        } else {
          creditsEl.style.display = "none";
        }
      }

      if (!quotaEl) return;

      const parts = [];
      if (cfg.configured && cfg.enabled) {
        if (summary.remainingDaily != null) {
          parts.push(
            `Today: <strong>${summary.remainingDaily}</strong>/${cfg.daily_limit} runs left`,
          );
        }
        if (summary.remainingMonthly != null) {
          parts.push(
            `This month: <strong>${summary.remainingMonthly}</strong>/${cfg.monthly_limit} runs left`,
          );
        }
        if (cfg.max_batch_size > 0) {
          parts.push(`Max ${cfg.max_batch_size} variants per run`);
        }
      }

      if (!parts.length) {
        quotaEl.style.display = "none";
        quotaEl.innerHTML = "";
        return;
      }
      quotaEl.style.display = "block";
      quotaEl.innerHTML = "🎫 " + parts.join(" · ");
    } catch (e) {
      if (creditsEl) creditsEl.style.display = "none";
      if (quotaEl) quotaEl.style.display = "none";
    }
  }





  categoryMatchesQuery(cat, query) {
    if (!query) return true;
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.search) {
      const hits = MeeshoCategories.search(query, 200);
      return hits.some((c) => c.id === cat.id);
    }
    const hay = [
      cat.id,
      cat.name,
      cat.parentName,
      cat.sectionName,
      cat.rootName,
      cat.path,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/&/g, " and ");
    const q = String(query).toLowerCase().replace(/&/g, " and ");
    return hay.includes(q);
  }

  parseCategorySearchQuery(raw) {
    const text = String(raw || "").trim();
    if (/^\d{3,6}$/.test(text)) {
      return { mode: "id", id: parseInt(text, 10), text };
    }
    const stripped = text.replace(/\s*\(\d{3,6}\)\s*$/, "").trim();
    const idFromSuffix = text.match(/\((\d{3,6})\)\s*$/);
    if (idFromSuffix) {
      return {
        mode: "id",
        id: parseInt(idFromSuffix[1], 10),
        text: stripped || text,
      };
    }
    return { mode: "text", text: stripped || text };
  }

  resolveCategoryFromSearchInput(raw, limit = 12) {
    const query = String(raw || "").trim();
    if (!query) return { status: "empty" };

    const parsed = this.parseCategorySearchQuery(query);
    if (parsed.mode === "id") {
      const cat = this.findCategoryById(parsed.id);
      if (cat) return { status: "resolved", cat, hits: [cat], query };
      return { status: "not_found", query };
    }

    const hits = this.filterCategoriesForSearch(query, limit);
    if (!hits.length) return { status: "not_found", query };
    if (hits.length === 1) return { status: "resolved", cat: hits[0], hits, query };

    const norm = parsed.text.toLowerCase();
    const exact = hits.find(
      (c) =>
        String(c.name || "").toLowerCase() === norm ||
        String(c.id) === parsed.text,
    );
    if (exact) return { status: "resolved", cat: exact, hits, query };

    return { status: "ambiguous", hits, query };
  }

  /** Quick picks on empty focus — small for fast mobile open */
  static CATEGORY_QUICK_PICK_LIMIT = 80;
  /** Max scored search hits kept in memory / shown (virtual scroll renders a window) */
  static CATEGORY_SEARCH_RESULT_LIMIT = 300;
  static CATEGORY_VIRTUAL_THRESHOLD = 45;
  static CATEGORY_VIRTUAL_ROW_HEIGHT = 52;
  static CATEGORY_VIRTUAL_OVERSCAN = 6;

  getCategoryQuickPickList() {
    if (this._categoryQuickPicksCache?.length) return this._categoryQuickPicksCache;
    const women = this.getWomenClothCategoryList();
    this._categoryQuickPicksCache = women.slice(
      0,
      MeeshoShippingOptimizer.CATEGORY_QUICK_PICK_LIMIT,
    );
    return this._categoryQuickPicksCache;
  }

  warmCategoryCaches() {
    const run = () => {
      try {
        this.getCategoryQuickPickList();
      } catch (e) {
        console.warn("Category cache warm failed:", e);
      }
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(run, { timeout: 2500 });
    } else {
      setTimeout(run, 80);
    }
  }

  getCategoryBrowseList() {
    const list = this.getActiveCategoryList();
    if (!list.length) return [];

    if (this._categoryBrowseCache?.sourceLength === list.length) {
      return this._categoryBrowseCache.list;
    }

    let browse;
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.getBrowseListFrom) {
      browse = MeeshoCategories.getBrowseListFrom(list);
    } else {
      browse = list.slice().sort((a, b) => {
        const pa = String(a.path || a.name || "");
        const pb = String(b.path || b.name || "");
        return pa.localeCompare(pb);
      });
    }

    this._categoryBrowseCache = { sourceLength: list.length, list: browse };
    return browse;
  }

  filterCategoriesForSearch(raw, limit) {
    const parsed = this.parseCategorySearchQuery(raw);
    const list = this.getActiveCategoryList();
    const resultLimit =
      limit !== undefined
        ? limit
        : MeeshoShippingOptimizer.CATEGORY_SEARCH_RESULT_LIMIT;

    if (!parsed.text && parsed.mode !== "id") {
      return this.getCategoryQuickPickList();
    }

    if (parsed.mode === "id") {
      const cat = this.findCategoryById(parsed.id);
      return cat ? [cat] : [];
    }

    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.searchInList) {
      return MeeshoCategories.searchInList(parsed.text, list, resultLimit);
    }

    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.search) {
      this.syncCategoryListToMeeshoCategories(list);
      return MeeshoCategories.search(parsed.text, resultLimit);
    }

    const query = parsed.text.toLowerCase();
    const matches = list.filter((cat) => this.categoryMatchesQuery(cat, query));
    return resultLimit > 0 ? matches.slice(0, resultLimit) : matches;
  }

  applyPageCategoryIfAvailable(options = {}) {
    if (this._categoryUserPicked || typeof MeeshoAPI === "undefined") return false;
    if (this.isCategoryAutocompleteActive() && !options.force) return false;
    if (this._categoryUserEditing && !options.force) return false;

    const searchEl = document.getElementById("category-search");
    if (searchEl && document.activeElement === searchEl && !options.force) return false;

    if (
      document.getElementById("opt-modal") &&
      !options.force &&
      (this._categoryPageSyncedThisModal || this._categoryAcPinned)
    ) {
      return false;
    }

    MeeshoAPI.syncCatalogPricing?.();
    const pageId = MeeshoAPI.detectCategoryId?.();
    if (!pageId) return false;

    const categorySelect = document.getElementById("category-select");
    const existing = parseInt(categorySelect?.value, 10);
    const cat = this.findCategoryById(pageId);

    if (existing === pageId && cat) {
      this.refreshCategoryApiPreview({ id: pageId, source: "page", cat });
      return true;
    }

    if (cat) {
      this.applyCategorySelection(cat, { source: "page" });
    } else {
      this.applyCategoryByIdOnly(pageId, { source: "page" });
    }
    if (options.modalSession || document.getElementById("opt-modal")) {
      this._categoryPageSyncedThisModal = true;
    }
    return true;
  }

  scheduleMeeshoPageSync(maxAttempts = 12, delayMs = 500) {
    if (window.WEB_OPTIMIZER_MODE || !this.isCatalogPage?.()) return;
    if (document.getElementById("opt-modal")) return;

    let attempts = 0;
    const tick = () => {
      if (this._categoryUserPicked && this._uploadUserPicked) return;
      if (this.isCategoryAutocompleteActive()) {
        if (attempts < maxAttempts) setTimeout(tick, delayMs);
        return;
      }

      const searchEl = document.getElementById("category-search");
      if (
        this._categoryUserEditing &&
        searchEl &&
        document.activeElement === searchEl
      ) {
        if (attempts < maxAttempts) setTimeout(tick, delayMs);
        return;
      }

      attempts++;
      const gotCategory =
        !this._categoryUserPicked && this.applyPageCategoryIfAvailable();
      void this.importPageImageIfNeeded();

      if (attempts < maxAttempts && !gotCategory && !this._categoryUserPicked) {
        setTimeout(tick, delayMs);
      }
    };

    tick();
  }

  syncFromMeeshoPage() {
    if (window.WEB_OPTIMIZER_MODE || !this.isCatalogPage?.()) return;
    if (this.isCategoryAutocompleteActive()) return;
    const searchEl = document.getElementById("category-search");
    if (
      this._categoryUserEditing &&
      searchEl &&
      document.activeElement === searchEl
    ) {
      return;
    }
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncCatalogPricing?.();
      MeeshoAPI.detectCatalogImageUrl?.();
    }
    this.applyPageCategoryIfAvailable();
    void this.importPageImageIfNeeded();
  }

  setOptimizerUploadFile(file, options = {}) {
    if (!file) return false;

    this._pendingFile = file;
    if (typeof window !== "undefined") window.__webPendingFile = file;

    if (options.source === "user") {
      this._uploadUserPicked = true;
      this._uploadUserCleared = false;
    } else if (options.source === "page") {
      this._uploadFromPage = true;
    }

    const previewBox = document.getElementById("preview-box");
    const previewImg = document.getElementById("preview-img");
    const uploadArea = document.getElementById("upload-area");
    const generateBtn = document.getElementById("generate-btn");
    const bootMsg = document.getElementById("boot-msg");

    const showPreview = (dataUrl) => {
      if (previewImg) previewImg.src = dataUrl;
      this.originalImageUrl = dataUrl;
      if (previewBox) previewBox.style.display = "block";
      const label = previewBox?.querySelector(".preview-label");
      if (label) {
        label.textContent =
          options.source === "page"
            ? "From Meesho page"
            : file.name || "product.jpg";
      }
      if (uploadArea) uploadArea.style.display = "none";
      this.wireClearUploadButton();
    };

    if (previewImg && file.type?.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => showPreview(ev.target.result);
      reader.readAsDataURL(file);
    }

    const enable = () => {
      if (generateBtn) generateBtn.disabled = false;
      if (bootMsg) bootMsg.textContent = "Image ready — tap Generate Variants";
    };
    enable();

    return true;
  }

  async importPageImageIfNeeded() {
    if (this._uploadUserPicked || this._uploadUserCleared) return false;
    if (this._pendingFile || document.getElementById("image-input")?.files?.[0]) {
      return false;
    }
    if (typeof MeeshoAPI === "undefined" || !MeeshoAPI.detectCatalogImageUrl) {
      return false;
    }

    const url = MeeshoAPI.detectCatalogImageUrl();
    if (!url) return false;

    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) return false;
      const blob = await resp.blob();
      if (!blob?.size || blob.size < 500) return false;

      const file = new File([blob], "meesho-catalog.jpg", {
        type: blob.type || "image/jpeg",
      });
      this.setOptimizerUploadFile(file, { source: "page" });
      console.log("📷 Imported product image from Meesho page");
      return true;
    } catch (e) {
      console.warn("Page image import failed:", e.message);
      return false;
    }
  }

  findCategoryById(id) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const list = this.getActiveCategoryList();
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.findByIdInList) {
      return MeeshoCategories.findByIdInList(parsed, list);
    }
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.findById) {
      const fromLib = MeeshoCategories.findById(parsed);
      if (fromLib) return fromLib;
    }
    return list.find((c) => c.id === parsed) || null;
  }

  formatCategoryUi(cat, options = {}) {
    if (!cat?.id) return { title: "", detail: "" };
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.formatDisplay) {
      return MeeshoCategories.formatDisplay(cat, options);
    }
    const title = `${cat.name} · ID ${cat.id}`;
    const path = cat.path || cat.parentName || "";
    const detail = [path, `sscat_id ${cat.id} for live pricing`]
      .filter(Boolean)
      .join(" · ");
    return { title, detail, apiId: cat.id, path };
  }

  formatCategoryIdUi(id, options = {}) {
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.formatIdOnly) {
      return MeeshoCategories.formatIdOnly(id, options);
    }
    const parsed = parseInt(id, 10);
    return {
      title: `Category ID ${parsed}`,
      detail: `sscat_id ${parsed} for live pricing`,
      apiId: parsed,
      path: "",
    };
  }

  paintCategorySelection(display, { showSelected = true } = {}) {
    const selectedCategory = document.getElementById("selected-category");
    const selectedCategoryName = document.getElementById("selected-category-name");
    const selectedCategoryDetail = document.getElementById("selected-category-detail");

    if (!display?.title) {
      if (selectedCategory) selectedCategory.style.display = "none";
      if (selectedCategoryName) selectedCategoryName.textContent = "";
      if (selectedCategoryDetail) selectedCategoryDetail.textContent = "";
      return;
    }

    if (showSelected && selectedCategory) selectedCategory.style.display = "block";
    if (selectedCategoryName) selectedCategoryName.textContent = display.title;
    if (selectedCategoryDetail) {
      selectedCategoryDetail.textContent = display.detail || "";
    }
  }

  refreshCategoryApiPreview(resolved) {
    const preview = document.getElementById("category-api-preview");
    if (!preview) return;

    const categorySelect = document.getElementById("category-select");
    const peek = resolved || this.peekCategoryForLiveApi(categorySelect);
    if (!peek?.id) {
      preview.style.display = "none";
      preview.textContent = "";
      return;
    }

    const cat = peek.cat || this.findCategoryById(peek.id);
    const display = cat
      ? this.formatCategoryUi(cat, { source: peek.source })
      : this.formatCategoryIdUi(peek.id, { source: peek.source });

    const action =
      peek.source === "user"
        ? "Will request"
        : peek.source === "page"
          ? "Will request (from Meesho page)"
          : peek.source === "default"
            ? "Will request (default)"
            : "Will request";

    preview.style.display = "block";
    preview.textContent = `${action}: ${display.title}${
      display.path ? ` — ${display.path}` : ""
    }. Meesho API uses leaf sscat_id ${peek.id} (not the full path).`;
  }

  peekCategoryForLiveApi(categorySelect) {
    const manualMode = this.isManualShippingMode();
    const needsCategoryForLiveApi =
      !window.WEB_OPTIMIZER_MODE && !manualMode && typeof MeeshoAPI !== "undefined";

    const userPick = categorySelect?.value
      ? parseInt(categorySelect.value, 10)
      : null;
    if (userPick > 0) {
      return {
        id: userPick,
        source: "user",
        cat: this.findCategoryById(userPick),
      };
    }

    if (typeof MeeshoAPI !== "undefined" && !userPick) {
      MeeshoAPI.syncCatalogPricing?.();
    }

    if (typeof MeeshoAPI !== "undefined") {
      const pageId = MeeshoAPI.detectCategoryId?.();
      if (pageId > 0) {
        return {
          id: pageId,
          source: "page",
          cat: this.findCategoryById(pageId),
        };
      }
    }

    if (!needsCategoryForLiveApi) {
      return { id: null, source: "none", cat: null };
    }

    const defId =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.getDefaultCategoryId()
        : 10004;
    if (defId) {
      return {
        id: defId,
        source: "default",
        cat: this.findCategoryById(defId),
      };
    }
    return { error: true };
  }

  getActiveCategoryList() {
    if (this.allCategories?.length) return this.allCategories;
    if (typeof MeeshoCategories !== "undefined" && MeeshoCategories.getList) {
      const list = MeeshoCategories.getList();
      if (list?.length) return list;
    }
    return [];
  }

  syncCategoryListToMeeshoCategories(categories) {
    if (!categories?.length || typeof MeeshoCategories === "undefined") return;
    MeeshoCategories._list = categories;
    window.MEESHO_EMBEDDED_CATEGORIES = categories;
    this._clothCategoryCache = null;
    this._categoryBrowseCache = null;
    this._categoryQuickPicksCache = null;
  }

  getDefaultCategorySlice(limit) {
    const list = this.getActiveCategoryList();
    if (!list.length) return [];

    if (!this._clothCategoryCache || this._clothCategoryCacheSource !== list.length) {
      if (
        typeof MeeshoCategories !== "undefined" &&
        MeeshoCategories.getDefaultListFrom
      ) {
        this._clothCategoryCache = MeeshoCategories.getDefaultListFrom(list, limit);
      } else if (
        typeof MeeshoCategories !== "undefined" &&
        MeeshoCategories.getClothRelatedFromList
      ) {
        const cloth = MeeshoCategories.getClothRelatedFromList(list);
        this._clothCategoryCache =
          limit && limit > 0 && cloth.length > limit
            ? cloth.slice(0, limit)
            : cloth;
      } else {
        this._clothCategoryCache = list.slice(0, limit || 50);
      }
      this._clothCategoryCacheSource = list.length;
    }

    if (limit && limit > 0 && this._clothCategoryCache.length > limit) {
      return this._clothCategoryCache.slice(0, limit);
    }
    return this._clothCategoryCache;
  }

  getWomenClothCategoryList() {
    const list = this.getActiveCategoryList();
    if (
      typeof MeeshoCategories !== "undefined" &&
      MeeshoCategories.getWomenClothRelatedFromList
    ) {
      return MeeshoCategories.getWomenClothRelatedFromList(list);
    }
    return list.filter((c) => c.rootName === "Women Fashion");
  }

  escapeCategoryHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  formatCategoryInputLabel(cat) {
    if (!cat?.id) return "";
    return `${cat.name} (${cat.id})`;
  }

  getCategoryPickerHintText() {
    const total = this.getActiveCategoryList().length || MeeshoCategories?.COUNT || 3777;
    const quick = MeeshoShippingOptimizer.CATEGORY_QUICK_PICK_LIMIT;
    return `${total} categories searchable · ${quick} quick picks when empty`;
  }

  setCategoryLoadingState(loading) {
    const wrap = document.getElementById("category-ac-wrap");
    const search = document.getElementById("category-search");
    const hint = document.getElementById("category-count-hint");
    if (wrap) wrap.classList.toggle("category-loading", !!loading);
    if (search && loading) {
      search.placeholder = "Loading categories…";
      search.disabled = true;
    }
    if (hint && loading) hint.textContent = "Loading categories…";
  }

  getCategoryAutocompleteQuery() {
    const search = document.getElementById("category-search");
    const raw = search?.value?.trim() || "";
    if (
      this._categorySearchCommittedValue &&
      raw === this._categorySearchCommittedValue
    ) {
      return "";
    }
    return raw;
  }

  getCategoryAutocompleteSuggestions() {
    const list = this.getActiveCategoryList();
    const query = this.getCategoryAutocompleteQuery();
    const allTotal = list.length || MeeshoCategories?.COUNT || 3777;

    if (!query) {
      const quick = this.getCategoryQuickPickList();
      return {
        results: quick,
        meta: {
          kind: "quick",
          quickCount: quick.length,
          allTotal,
        },
      };
    }

    const limit = MeeshoShippingOptimizer.CATEGORY_SEARCH_RESULT_LIMIT;
    const results = this.filterCategoriesForSearch(query, limit);
    return {
      results,
      meta: {
        kind: "search",
        query,
        matchCount: results.length,
        allTotal,
        capped: limit > 0 && results.length >= limit,
        capLimit: limit,
      },
    };
  }

  showCategoryAutocomplete() {
    const listEl = document.getElementById("category-ac-list");
    const search = document.getElementById("category-search");
    if (!listEl) return;
    this._categoryAcPinned = true;
    this._categoryAcIgnoreCloseUntil = Date.now() + 800;
    listEl.classList.add("open");
    if (search) search.setAttribute("aria-expanded", "true");
  }

  hideCategoryAutocomplete(options = {}) {
    const force = options.force === true;
    if (this._categoryAcPinned && !force) return;
    const listEl = document.getElementById("category-ac-list");
    const search = document.getElementById("category-search");
    if (!listEl) return;
    this._categoryAcPinned = false;
    listEl.classList.remove("open");
    if (search) search.setAttribute("aria-expanded", "false");
    this._categoryAcActiveIndex = -1;
  }

  buildCategoryAutocompleteItemHtml(cat, index) {
    const path = cat.path || cat.parentName || "";
    const active = index === this._categoryAcActiveIndex ? " active" : "";
    let item = `<li class="category-ac-item${active}" role="option" data-index="${index}" data-id="${cat.id}" aria-selected="${index === this._categoryAcActiveIndex}">`;
    item += `<div class="category-ac-item-name"><span>${this.escapeCategoryHtml(cat.name)}</span><span class="category-ac-item-id">ID ${cat.id}</span></div>`;
    if (path) {
      item += `<div class="category-ac-item-path">${this.escapeCategoryHtml(path)}</div>`;
    }
    item += "</li>";
    return item;
  }

  getCategoryAutocompleteHeaderHtml(meta = {}) {
    if (meta.kind === "quick") {
      const shown = meta.quickCount ?? 0;
      return `<li class="category-ac-header">Quick picks (${shown}) — type to search all ${meta.allTotal}</li>`;
    }
    if (meta.kind === "search") {
      const more = meta.capped ? " — type more to narrow" : "";
      return `<li class="category-ac-header">${meta.matchCount} match${meta.matchCount === 1 ? "" : "es"} for “${this.escapeCategoryHtml(meta.query)}”${more}</li>`;
    }
    return "";
  }

  getCategoryAutocompleteFooterHtml(meta = {}) {
    if (meta.kind === "search" && meta.capped) {
      return `<li class="category-ac-footer">Showing top ${meta.capLimit} of ${meta.allTotal} — refine your search</li>`;
    }
    return "";
  }

  getCategoryAcVisibleRange(total, scrollTop, viewportHeight) {
    const rowH = MeeshoShippingOptimizer.CATEGORY_VIRTUAL_ROW_HEIGHT;
    const overscan = MeeshoShippingOptimizer.CATEGORY_VIRTUAL_OVERSCAN;
    const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowH) + overscan * 2;
    const end = Math.min(total, start + visibleCount);
    return { start, end };
  }

  bindCategoryAutocompleteVirtualScroll() {
    const listEl = document.getElementById("category-ac-list");
    if (!listEl || listEl.dataset.virtualBound === "1") return;
    listEl.dataset.virtualBound = "1";
    listEl.addEventListener(
      "scroll",
      () => {
        if (!this._categoryAcVirtualEnabled) return;
        if (this._categoryAcScrollRaf) return;
        this._categoryAcScrollRaf = requestAnimationFrame(() => {
          this._categoryAcScrollRaf = 0;
          this.renderCategoryAutocompleteVirtual();
        });
      },
      { passive: true },
    );
  }

  renderCategoryAutocompleteVirtual() {
    const listEl = document.getElementById("category-ac-list");
    if (!listEl) return;

    const results = this._categoryAcResults || [];
    const meta = this._categoryAcMeta || {};
    const total = results.length;
    const rowH = MeeshoShippingOptimizer.CATEGORY_VIRTUAL_ROW_HEIGHT;

    if (!total) {
      listEl.innerHTML = `<li class="category-ac-empty">No matches — try another name or numeric ID</li>`;
      this.showCategoryAutocomplete();
      return;
    }

    const scrollTop = listEl.scrollTop || 0;
    const viewportHeight = listEl.clientHeight || 260;
    let { start, end } = this.getCategoryAcVisibleRange(total, scrollTop, viewportHeight);

    if (this._categoryAcActiveIndex >= 0) {
      if (this._categoryAcActiveIndex < start) {
        start = Math.max(0, this._categoryAcActiveIndex - 2);
      }
      if (this._categoryAcActiveIndex >= end) {
        end = Math.min(total, this._categoryAcActiveIndex + 10);
      }
    }

    this._categoryAcVirtualStart = start;

    let html = this.getCategoryAutocompleteHeaderHtml(meta);
    const topPad = start * rowH;
    const bottomPad = Math.max(0, (total - end) * rowH);

    if (topPad > 0) {
      html += `<li class="category-ac-virtual-pad" style="height:${topPad}px" aria-hidden="true"></li>`;
    }
    for (let i = start; i < end; i++) {
      html += this.buildCategoryAutocompleteItemHtml(results[i], i);
    }
    if (bottomPad > 0) {
      html += `<li class="category-ac-virtual-pad" style="height:${bottomPad}px" aria-hidden="true"></li>`;
    }
    html += this.getCategoryAutocompleteFooterHtml(meta);

    listEl.innerHTML = html;
    listEl.querySelectorAll(".category-ac-item").forEach((item) => {
      item.setAttribute("tabindex", "-1");
    });
    this.showCategoryAutocomplete();
  }

  renderCategoryAutocompleteList(categories, meta = {}) {
    const listEl = document.getElementById("category-ac-list");
    if (!listEl) return;

    this._categoryAcResults = categories || [];
    this._categoryAcMeta = meta || {};

    if (!this._categoryAcResults.length) {
      listEl.innerHTML = `<li class="category-ac-empty">No matches — try another name or numeric ID</li>`;
      this._categoryAcVirtualEnabled = false;
      this.showCategoryAutocomplete();
      return;
    }

    const useVirtual =
      this._categoryAcResults.length >
      MeeshoShippingOptimizer.CATEGORY_VIRTUAL_THRESHOLD;

    this._categoryAcVirtualEnabled = useVirtual;
    if (useVirtual) {
      this.bindCategoryAutocompleteVirtualScroll();
      if (listEl.scrollTop > 0) listEl.scrollTop = 0;
      this.renderCategoryAutocompleteVirtual();
      return;
    }

    let html = this.getCategoryAutocompleteHeaderHtml(meta);
    html += this._categoryAcResults
      .map((cat, index) => this.buildCategoryAutocompleteItemHtml(cat, index))
      .join("");
    html += this.getCategoryAutocompleteFooterHtml(meta);

    listEl.innerHTML = html;
    listEl.querySelectorAll(".category-ac-item").forEach((item) => {
      item.setAttribute("tabindex", "-1");
    });

    this.showCategoryAutocomplete();
  }

  updateCategoryAutocompleteSuggestions() {
    const listEl = document.getElementById("category-ac-list");
    const gen = (this._categoryAcUpdateGen = (this._categoryAcUpdateGen || 0) + 1);

    if (listEl) {
      listEl.innerHTML = `<li class="category-ac-header category-ac-loading">Loading suggestions…</li>`;
      this.showCategoryAutocomplete();
    }

    const run = () => {
      if (gen !== this._categoryAcUpdateGen) return;
      const { results, meta } = this.getCategoryAutocompleteSuggestions();
      this._categoryAcActiveIndex = results.length ? 0 : -1;
      this._categoryAcVirtualStart = 0;
      this.renderCategoryAutocompleteList(results, meta);
    };

    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }

  scrollCategoryAutocompleteActiveIntoView() {
    const listEl = document.getElementById("category-ac-list");
    if (!listEl || this._categoryAcActiveIndex < 0) return;

    if (this._categoryAcVirtualEnabled) {
      const rowH = MeeshoShippingOptimizer.CATEGORY_VIRTUAL_ROW_HEIGHT;
      const idx = this._categoryAcActiveIndex;
      const top = idx * rowH;
      const bottom = top + rowH;
      if (top < listEl.scrollTop) {
        listEl.scrollTop = top;
      } else if (bottom > listEl.scrollTop + listEl.clientHeight) {
        listEl.scrollTop = bottom - listEl.clientHeight;
      }
      this.renderCategoryAutocompleteVirtual();
      return;
    }

    const active = listEl.querySelector(
      `.category-ac-item[data-index="${this._categoryAcActiveIndex}"]`,
    );
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  highlightCategoryAutocompleteActive() {
    if (this._categoryAcVirtualEnabled) {
      this.renderCategoryAutocompleteVirtual();
      return;
    }

    const listEl = document.getElementById("category-ac-list");
    if (!listEl) return;
    listEl.querySelectorAll(".category-ac-item").forEach((el) => {
      const idx = parseInt(el.dataset.index, 10);
      const on = idx === this._categoryAcActiveIndex;
      el.classList.toggle("active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
    this.scrollCategoryAutocompleteActiveIntoView();
  }

  selectCategoryAutocompleteIndex(index) {
    const cat = this._categoryAcResults[index];
    if (!cat) return false;
    this.applyCategorySelection(cat, { source: "user" });
    this.hideCategoryAutocomplete({ force: true });
    return true;
  }

  handleCategoryAutocompleteKeydown(e) {
    const search = document.getElementById("category-search");
    if (!search) return;

    if (e.key === "Escape") {
      this.hideCategoryAutocomplete({ force: true });
      if (this._categorySearchCommittedValue) {
        search.value = this._categorySearchCommittedValue;
      }
      return;
    }

    const listOpen = document
      .getElementById("category-ac-list")
      ?.classList.contains("open");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!listOpen) this.updateCategoryAutocompleteSuggestions();
      if (!this._categoryAcResults.length) return;
      this._categoryAcActiveIndex = Math.min(
        this._categoryAcActiveIndex + 1,
        this._categoryAcResults.length - 1,
      );
      this.highlightCategoryAutocompleteActive();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!listOpen) this.updateCategoryAutocompleteSuggestions();
      if (!this._categoryAcResults.length) return;
      this._categoryAcActiveIndex = Math.max(this._categoryAcActiveIndex - 1, 0);
      this.highlightCategoryAutocompleteActive();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (
        listOpen &&
        this._categoryAcActiveIndex >= 0 &&
        this.selectCategoryAutocompleteIndex(this._categoryAcActiveIndex)
      ) {
        return;
      }
      const raw = search.value.trim();
      if (!raw) return;
      const result = this.resolveCategoryFromSearchInput(raw, 12);
      if (result.status === "resolved" && result.cat) {
        this.applyCategorySelection(result.cat, { source: "user" });
        this.hideCategoryAutocomplete({ force: true });
      } else if (result.status === "ambiguous" && result.hits?.[0]) {
        this.applyCategorySelection(result.hits[0], { source: "user" });
        this.hideCategoryAutocomplete({ force: true });
      } else {
        OptimizerUtils.showNotification(
          result.status === "ambiguous"
            ? `Pick a category from the list (${result.hits.length} matches)`
            : `No category found for "${raw}"`,
          "error",
        );
      }
      return;
    }

    if (
      this._categorySearchCommittedValue &&
      search.value === this._categorySearchCommittedValue &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      search.value = e.key;
      this._categorySearchCommittedValue = "";
      e.preventDefault();
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  bindCategoryAutocompleteUI() {
    const wrap = document.getElementById("category-ac-wrap");
    const search = document.getElementById("category-search");
    const clearBtn = document.getElementById("category-clear");
    if (!wrap || !search) return;

    if (wrap.dataset.categoryAcBound !== "1") {
      wrap.dataset.categoryAcBound = "1";
      wrap.addEventListener("mousedown", (e) => {
        if (e.target.closest(".category-ac-item")) {
          e.preventDefault();
        }
      });
      wrap.addEventListener(
        "touchstart",
        (e) => {
          if (e.target.closest(".category-ac-item")) {
            this._categoryAcPointerInWrap = true;
          }
        },
        { passive: true },
      );
      wrap.addEventListener("touchend", () => {
        setTimeout(() => {
          this._categoryAcPointerInWrap = false;
        }, 0);
      });
      wrap.addEventListener("click", (e) => {
        const item = e.target.closest(".category-ac-item");
        if (!item) return;
        e.stopPropagation();
        const id = parseInt(item.dataset.id, 10);
        const cat =
          this._categoryAcResults.find((c) => c.id === id) ||
          this.findCategoryById(id);
        if (cat) {
          this.applyCategorySelection(cat, { source: "user" });
          this.hideCategoryAutocomplete({ force: true });
        }
      });
    }

    const openCategoryList = () => {
      this._categoryUserEditing = true;
      this._categoryAcIgnoreCloseUntil = Date.now() + 800;
      clearTimeout(this._categoryAcOpenTimer);
      this._categoryAcOpenTimer = setTimeout(() => {
        this.updateCategoryAutocompleteSuggestions();
      }, 0);
    };

    search.onpointerdown = (e) => {
      e.stopPropagation();
      openCategoryList();
    };

    search.onfocus = () => {
      openCategoryList();
    };

    search.onmousedown = (e) => {
      e.stopPropagation();
      openCategoryList();
    };

    search.oninput = () => {
      this._categoryUserEditing = true;
      if (clearBtn) clearBtn.style.display = search.value.trim() ? "block" : "none";
      clearTimeout(this._categoryAcDebounce);
      this._categoryAcDebounce = setTimeout(
        () => this.updateCategoryAutocompleteSuggestions(),
        150,
      );
    };

    search.onkeydown = (e) => this.handleCategoryAutocompleteKeydown(e);

    search.onblur = () => {
      clearTimeout(this._categoryEditingTimer);
      this._categoryEditingTimer = setTimeout(() => {
        if (this._categoryAcPointerInWrap) return;
        if (document.activeElement === search) return;
        if (wrap.contains(document.activeElement)) return;
        this._categoryUserEditing = false;
        if (
          this._categorySearchCommittedValue &&
          search.value !== this._categorySearchCommittedValue
        ) {
          search.value = this._categorySearchCommittedValue;
        }
      }, 280);
    };

    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        search.value = "";
        this._categorySearchCommittedValue = "";
        this._categoryUserPicked = false;
        const hidden = document.getElementById("category-select");
        if (hidden) hidden.value = "";
        if (typeof MeeshoAPI !== "undefined") MeeshoAPI.setCategory(null);
        const selectedCategory = document.getElementById("selected-category");
        if (selectedCategory) selectedCategory.style.display = "none";
        const selectedCategoryDetail = document.getElementById(
          "selected-category-detail",
        );
        if (selectedCategoryDetail) selectedCategoryDetail.textContent = "";
        clearBtn.style.display = "none";
        this.refreshCategoryApiPreview();
        this.applyPageCategoryIfAvailable({ force: true });
        search.focus();
        this.updateCategoryAutocompleteSuggestions();
      };
    }
  }

  syncCategorySelectValue(id, cat) {
    const hidden = document.getElementById("category-select");
    const search = document.getElementById("category-search");
    const clearBtn = document.getElementById("category-clear");
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    if (hidden) hidden.value = String(parsed);

    const known = cat || this.findCategoryById(parsed);
    const label = known
      ? this.formatCategoryInputLabel(known)
      : `ID ${parsed}`;

    if (search) {
      search.value = label;
      this._categorySearchCommittedValue = label;
      search.disabled = false;
    }
    if (clearBtn) clearBtn.style.display = "block";
  }

  bindCategoryUI(categories) {
    const categorySearch = document.getElementById("category-search");
    const refreshBtn = document.getElementById("refresh-categories");
    const categoryError = document.getElementById("category-error");

    if (!categorySearch || !categories?.length) return false;

    this.setCategoryLoadingState(false);
    this.allCategories = categories;
    this.syncCategoryListToMeeshoCategories(categories);

    const embedded = MeeshoAPI?._lastCategoryFetchWasEmbedded;
    const previousId = parseInt(
      document.getElementById("category-select")?.value,
      10,
    );

    categorySearch.disabled = false;
    categorySearch.readOnly = false;
    categorySearch.placeholder = `Search ${categories.length} categories by name or ID…`;

    const countHint = document.getElementById("category-count-hint");
    if (countHint) {
      countHint.textContent = this.getCategoryPickerHintText();
    }
    if (refreshBtn) refreshBtn.style.display = embedded ? "none" : "block";
    if (categoryError) categoryError.style.display = "none";

    this.bindCategoryAutocompleteUI();

    if (previousId > 0) {
      this.syncCategorySelectValue(previousId);
    }

    console.log(
      "✅ Loaded",
      categories.length,
      "categories ·",
      MeeshoShippingOptimizer.CATEGORY_QUICK_PICK_LIMIT,
      "quick picks · type to search all",
    );

    this.warmCategoryCaches();

    if (!window.WEB_OPTIMIZER_MODE) {
      if (!this._categoryUserPicked && !this.isCategoryAutocompleteActive()) {
        this.applyDefaultCategoryIfNeeded();
      }
      if (!document.getElementById("opt-modal")) {
        this.scheduleMeeshoPageSync();
      }
    } else {
      this.refreshCategoryApiPreview();
    }
    return true;
  }

  async loadCategoryDropdown() {
    const loadGen = (this._categoryLoadGen = (this._categoryLoadGen || 0) + 1);
    const categorySearch = document.getElementById("category-search");
    const refreshBtn = document.getElementById("refresh-categories");
    const categoryError = document.getElementById("category-error");

    if (!categorySearch) return;

    const cached =
      this.allCategories?.length >= 3000
        ? this.allCategories
        : typeof MeeshoAPI !== "undefined" &&
            MeeshoAPI.cache?.categories?.length >= 3000
          ? MeeshoAPI.cache.categories
          : null;

    if (cached?.length) {
      this.bindCategoryUI(cached);
      return;
    }

    if (typeof MeeshoAPI === "undefined") {
      this.setCategoryLoadingState(false);
      categorySearch.value = "";
      categorySearch.placeholder = "API not available — reload extension";
      categorySearch.disabled = true;
      if (refreshBtn) refreshBtn.style.display = "block";
      if (categoryError) categoryError.style.display = "block";
      return;
    }

    this.setCategoryLoadingState(true);

    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.textContent = "⏳...";
        MeeshoAPI.cache.categories = null;
        try {
          const categories = await MeeshoAPI.fetchCategories(true);
          if (categories?.length && this.bindCategoryUI(categories)) {
            refreshBtn.textContent = "🔄 Refresh";
            return;
          }
        } catch (e) {
          console.warn("Live category refresh failed:", e);
        }
        await this.loadCategoryDropdown();
        refreshBtn.textContent = "🔄 Refresh";
      };
    }

    try {
      const categories = await this.ensureFullCategories();

      if (loadGen !== this._categoryLoadGen) return;

      if (categories?.length && this.bindCategoryUI(categories)) {
        return;
      }

      this.setCategoryLoadingState(false);

      if (window.WEB_OPTIMIZER_MODE) {
        categorySearch.placeholder = "Optional — skip to generate variants";
        categorySearch.disabled = false;
        if (categoryError) categoryError.style.display = "none";
        if (refreshBtn) refreshBtn.style.display = "block";
        return;
      }

      categorySearch.placeholder = "Not loaded — click Refresh";
      categorySearch.disabled = true;
      if (refreshBtn) refreshBtn.style.display = "block";
      if (categoryError) categoryError.style.display = "block";
    } catch (error) {
      console.error("Failed to load categories:", error);
      this.setCategoryLoadingState(false);
      if (window.WEB_OPTIMIZER_MODE) {
        categorySearch.placeholder = "Optional — skip to generate variants";
        categorySearch.disabled = false;
        if (categoryError) categoryError.style.display = "none";
      } else {
        categorySearch.placeholder = "Failed — click Refresh";
        categorySearch.disabled = true;
        if (categoryError) categoryError.style.display = "block";
      }
      if (refreshBtn) refreshBtn.style.display = "block";
    }
  }

  applyCategorySelection(catOrId, options = {}) {
    const categorySelect = document.getElementById("category-select");

    const cat =
      typeof catOrId === "object"
        ? catOrId
        : this.findCategoryById(catOrId);
    if (!cat?.id) return false;

    const display = this.formatCategoryUi(cat, { source: options.source });

    if (options.source === "user") {
      this._categoryUserPicked = true;
    }

    this.syncCategorySelectValue(cat.id, cat);
    this.paintCategorySelection(display, { showSelected: options.showSelected !== false });
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(cat.id);
    }
    this.refreshCategoryApiPreview({
      id: cat.id,
      source: options.source || "user",
      cat,
    });
    return true;
  }

  applyCategoryByIdOnly(id, options = {}) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return false;

    const known = this.findCategoryById(parsed);
    if (known) {
      return this.applyCategorySelection(known, options);
    }

    const display = this.formatCategoryIdUi(parsed, { source: options.source });

    this.syncCategorySelectValue(parsed);
    this.paintCategorySelection(display, { showSelected: options.showSelected !== false });
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(parsed);
    }
    this.refreshCategoryApiPreview({
      id: parsed,
      source: options.source || "page",
      cat: null,
    });
    return true;
  }

  /**
   * Live API category priority: optimizer dropdown → Meesho page sscat → Kurtis default.
   */
  resolveCategoryForLiveApi(categorySelect) {
    const searchEl = document.getElementById("category-search");
    const raw = searchEl?.value?.trim() || "";
    const selectedId = parseInt(categorySelect?.value, 10);

    if (raw && (this._categoryUserEditing || !selectedId)) {
      const result = this.resolveCategoryFromSearchInput(raw, 12);
      if (result.status === "resolved" && result.cat) {
        this.applyCategorySelection(result.cat, { source: "user" });
        const resolved = {
          id: result.cat.id,
          source: "user",
          cat: result.cat,
        };
        if (typeof MeeshoAPI !== "undefined") {
          MeeshoAPI.setCategory(resolved.id);
        }
        return resolved;
      }
      if (result.status === "ambiguous") {
        return {
          error: true,
          message: `Pick a category from suggestions (${result.hits.length} matches for "${raw}")`,
        };
      }
      if (result.status === "not_found") {
        return {
          error: true,
          message: `No category found for "${raw}" — try name or numeric ID`,
        };
      }
    }

    const resolved = this.peekCategoryForLiveApi(categorySelect);
    if (resolved.error) return resolved;

    if (!resolved.id && !window.WEB_OPTIMIZER_MODE && !this.isManualShippingMode()) {
      return {
        error: true,
        message: "Select a category from suggestions or search by name/ID",
      };
    }

    if (resolved.id) {
      if (resolved.cat) {
        if (resolved.source !== "user") {
          this.applyCategorySelection(resolved.cat, {
            source: resolved.source,
            showSelected: true,
          });
        } else {
          this.refreshCategoryApiPreview(resolved);
        }
      } else if (resolved.source === "page") {
        this.applyCategoryByIdOnly(resolved.id, { source: "page" });
      } else if (resolved.source === "default") {
        const defCat = this.findCategoryById(resolved.id);
        if (defCat) {
          this.applyCategorySelection(defCat, { source: "default" });
        }
      } else {
        this.refreshCategoryApiPreview(resolved);
      }

      if (typeof MeeshoAPI !== "undefined") {
        MeeshoAPI.setCategory(resolved.id);
      }
    }

    return resolved;
  }

  applyDefaultCategoryIfNeeded() {
    if (!this.allCategories?.length) {
      this.refreshCategoryApiPreview();
      return;
    }

    if (this._categoryUserPicked) {
      this.refreshCategoryApiPreview();
      return;
    }

    if (this.applyPageCategoryIfAvailable()) return;

    const categorySelect = document.getElementById("category-select");
    if (categorySelect?.value) {
      this.refreshCategoryApiPreview();
      return;
    }

    const defId =
      typeof MeeshoCategories !== "undefined"
        ? MeeshoCategories.getDefaultCategoryId()
        : 10004;
    const targetCat =
      this.findCategoryById(defId) ||
      this.allCategories.find((c) => c.id === defId) ||
      this.allCategories[0];

    if (!targetCat) {
      this.refreshCategoryApiPreview();
      return;
    }
    this.applyCategorySelection(targetCat, { source: "default" });
  }

  gatherSettings() {
    ImageGenerator.updateSettings({
      customText: "",
      textBgColor: "#e67e22",
    });

    if (typeof ImageGenerator.preloadBadges === "function") {
      void ImageGenerator.preloadBadges();
    }
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.preloadBadges) {
      void MeeshoAPI.preloadBadges();
    }

    // Set category in MeeshoAPI (dropdown wins; else page-detected sscat)
    const categorySelect = document.getElementById("category-select");
    const resolved = this.resolveCategoryForLiveApi(categorySelect);
    if (resolved.id && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(resolved.id);
    }
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.syncCatalogPricing) {
      const pricing = MeeshoAPI.syncCatalogPricing();
      if (pricing.priceUsed) {
        console.log("📋 Catalog Meesho Price for live checks: ₹" + pricing.priceUsed);
      }
    }
  }







  resetToUploadForm(options = {}) {
    const keepImage = !!options.keepImage;

    this.isProcessing = false;
    this.shouldStop = false;
    this.selectedVariantId = null;
    this._runPreviousResults = null;
    this._runFinalizedEarly = false;
    this.clearStopTimers();
    this.clearTransientTimers();
    this._activeRunMeta = null;
    this.revokeResultObjectUrls(this.currentResults);
    this.revokeResultObjectUrls(this.framedExtraResults);
    this.currentResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    this.liveAnalysis = null;
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showAnalysisExtras = false;
    this.lastLivePricedResults = [];

    if (!keepImage) {
      this._pendingFile = null;
      this.lastProcessedFile = null;
      this.originalImageUrl = null;
      this._uploadUserCleared = true;
      this._uploadUserPicked = false;
      if (typeof window !== "undefined") window.__webPendingFile = null;
    }

    this.closeVariantEditor();

    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");
    const uploadArea = document.getElementById("upload-area");
    const previewBox = document.getElementById("preview-box");
    const previewImg = document.getElementById("preview-img");
    const imageInput = document.getElementById("image-input");
    const generateBtn = document.getElementById("generate-btn");
    const generateSticky = document.getElementById("generate-sticky");

    if (processingArea) {
      processingArea.style.display = "none";
      processingArea.innerHTML = "";
    }
    if (resultsArea) {
      resultsArea.style.display = "none";
      resultsArea.innerHTML = "";
      delete resultsArea.dataset.view;
    }

    const hasFile =
      keepImage &&
      (this._pendingFile ||
        window.__webPendingFile ||
        imageInput?.files?.[0]);

    if (!keepImage && imageInput) imageInput.value = "";
    if (!keepImage) {
      if (previewImg) previewImg.src = "";
      if (previewBox) previewBox.style.display = "none";
    } else if (previewBox && previewImg && this.originalImageUrl) {
      previewImg.src = this.originalImageUrl;
      previewBox.style.display = "block";
    }

    if (uploadArea) {
      uploadArea.style.display = hasFile ? "none" : "block";
    }

    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "block";
    });

    if (generateSticky) generateSticky.style.display = "";
    if (generateBtn) {
      generateBtn.style.display = "block";
      generateBtn.disabled = !hasFile;
    }

    if (window.WEB_OPTIMIZER_MODE && hasFile) {
      this.refreshLiveResultsPanel({ scroll: false });
    }
  }


  clearStopTimers() {
    clearTimeout(this._stopFinalizeTimer);
    this._stopFinalizeTimer = null;
    clearTimeout(this._stopEscalateTimer);
    this._stopEscalateTimer = null;
  }

  showNoResultsFallback(resultsArea, meta = {}) {
    if (!resultsArea) return;
    this.currentResults = [];
    resultsArea.style.display = "block";
    delete resultsArea.dataset.view;
    resultsArea.innerHTML = OptimizerUI.getResultsHTML([], {
      ...this.getResultsViewOptions(),
      emptyState: meta,
    });
    this.setupResultsEvents();
    this.restoreOptimizerChromeAfterResults();
  }

  requestStopGeneration() {
    if (!this.isProcessing) {
      OptimizerUtils.showNotification("Nothing is running to stop", "info", 2500);
      return;
    }
    if (this.shouldStop) return;
    this.shouldStop = true;
    const processingArea = document.getElementById("processing-area");
    this.markSmartModeStopping(processingArea);
    this.clearStopTimers();
    this._stopEscalateTimer = setTimeout(() => {
      this.markSmartModeStopping(processingArea, { escalate: true });
    }, STOP_ESCALATE_MS);
    this._stopFinalizeTimer = setTimeout(() => {
      this.forceFinishProcessing({
        reason: "stop_timeout",
        attempts: this._activeRunMeta?.attempts,
        maxAttempts: this._activeRunMeta?.maxAttempts,
      });
    }, STOP_FORCE_MS);
  }

  async forceFinishProcessing(meta = {}) {
    if (!this.isProcessing) return;
    this.clearStopTimers();
    this._generationSeq++;
    this._runFinalizedEarly = false;

    const processingArea = document.getElementById("processing-area");
    if (processingArea) {
      processingArea.style.display = "none";
      processingArea.innerHTML = "";
    }

    const resultsArea = document.getElementById("results-area");
    if (resultsArea) resultsArea.classList.remove("results-during-run");

    if (this._runPreviousResults?.length) {
      this.currentResults = [...this._runPreviousResults];
    }

    if (resultsArea && this.currentResults.length > 0) {
      resultsArea.style.display = "block";
      resultsArea.innerHTML = OptimizerUI.getResultsHTML(
        this.currentResults,
        this.getResultsViewOptions(),
      );
      this.setupResultsEvents();
      this.restoreOptimizerChromeAfterResults();
      OptimizerUtils.showNotification(
        "Stopped — your previous variants are still available",
        "info",
      );
    } else if (resultsArea) {
      this.showNoResultsFallback(resultsArea, {
        reason: "stopped",
        attempts: meta.attempts ?? this._activeRunMeta?.attempts,
        maxAttempts: meta.maxAttempts ?? this._activeRunMeta?.maxAttempts,
        errorMessage: meta.errorMessage,
      });
      OptimizerUtils.showNotification("Search stopped", "info");
    } else {
      const uploadArea = document.getElementById("upload-area");
      if (uploadArea) uploadArea.style.display = "block";
      document.querySelectorAll(".opt-section").forEach((s) => {
        s.style.display = "block";
      });
      this.restoreOptimizerChromeAfterResults();
      OptimizerUtils.showNotification("Search stopped", "info");
    }

    this._runPreviousResults = null;
    this._activeRunMeta = null;
    await this.recordImageGenerationForRun();
    this.finishOptimizerRun();
  }

  selectResultVariant(variantId) {
    if (variantId == null || variantId === "") return;
    const vid = String(variantId);
    if (!this.findResultRow(vid)) return;
    if (this.selectedVariantId === vid) return;
    this.selectedVariantId = vid;
    document.querySelectorAll(".result-card").forEach((card) => {
      card.classList.toggle(
        "result-card-selected",
        card.dataset.variantId === vid,
      );
    });
    this.updateApplyBestButton();
  }

  // LIVE MODE — production generate path.
  async processImage(file, options = {}) {
    if (!file) {
      OptimizerUtils.showNotification("Choose an image first", "error");
      return;
    }

    if (this.isProcessing) {
      this.requestStopGeneration();
      return;
    }

    // Gate generation on license validity + AI image-generation limits.
    let imageGenGate = { ok: true, legacy: true };
    if (this.requiresLicense()) {
      const batchCount = LiveSmart.readMainSmartModeSettings().maxAttempts;
      imageGenGate = await LicenseManager.ensureCanGenerateImages(batchCount);
      if (!imageGenGate.ok) {
        OptimizerUtils.showNotification(
          imageGenGate.reason || "Cannot generate right now",
          "error",
          6000,
        );
        this.isLicensed = LicenseManager.isLicensed;
        if (imageGenGate.openModal || imageGenGate.needsTopUp) {
          this.openModal();
        }
        return;
      }
      this.isLicensed = true;
    }
    this._imageGenGate = imageGenGate;
    this._imageGenRecorded = false;
    this._imageGenRunStarted = false;
    this._imageGenCreditsCharged = false;

    if (window.WEB_OPTIMIZER_MODE && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.syncFromSession?.();
    }

    const categorySelect = document.getElementById("category-select");
    const resolved = this.resolveCategoryForLiveApi(categorySelect);
    if (resolved.error) {
      OptimizerUtils.showNotification(
        resolved.message || "Select a category for live Meesho shipping checks",
        "error",
      );
      return;
    }
    if (resolved.id && typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.setCategory(resolved.id);
      const cat = resolved.cat || this.findCategoryById(resolved.id);
      const label = cat
        ? this.formatCategoryUi(cat, { source: resolved.source }).title
        : `ID ${resolved.id}`;
      console.log(`📁 Live API category (${resolved.source}):`, label);
    }

    const manualMode = this.isManualShippingMode();
    const runId = ++this._generationSeq;

    this.isProcessing = true;
    this._imageGenRunStarted = true;
    this.shouldStop = false;
    this._runFinalizedEarly = false;
    this.clearStopTimers();

    if (this.requiresLicense()) {
      const charged = await this.chargeImageGenerationForRun();
      if (!charged) {
        this.isProcessing = false;
        this._imageGenRunStarted = false;
        this._imageGenGate = null;
        const uploadArea = document.getElementById("upload-area");
        const sections = document.querySelectorAll(".opt-section");
        const processingArea = document.getElementById("processing-area");
        if (uploadArea) uploadArea.style.display = "block";
        sections.forEach((s) => (s.style.display = "block"));
        if (processingArea) {
          processingArea.style.display = "none";
          processingArea.innerHTML = "";
        }
        this.enableAllGenerateButtons();
        return;
      }
    }

    this.lastProcessedFile = file;
    this._runPreviousResults = [...(this.currentResults || [])];
    this.lastLivePricedResults = [];
    this.framedExtraResults = [];
    this.showFramedExtras = false;
    this.liveAnalysis = null;
    this.analysisPrimaryResults = [];
    this.analysisExtraResults = [];
    this.showAnalysisExtras = false;

    const uploadArea = document.getElementById("upload-area");
    const sections = document.querySelectorAll(".opt-section");
    const processingArea = document.getElementById("processing-area");
    const resultsArea = document.getElementById("results-area");

    if (uploadArea) uploadArea.style.display = "none";
    this.prepareOptimizerSectionsForRun();
    if (resultsArea && this.currentResults.length > 0) {
      resultsArea.style.display = "block";
      resultsArea.classList.add("results-during-run");
    }

    const runSettings = LiveSmart.readMainSmartModeSettings();
    const targetShipping = runSettings.targetShipping;
    const maxAttempts = runSettings.maxAttempts;
    const shippingCap = LiveSmart.getShippingCap();
    const smartSearchCap = runSettings.maxShippingCap;
    this._activeRunMeta = { maxAttempts, attempts: 0 };

    OptimizerUtils.showNotification(
      `🚀 Generating up to ${maxAttempts} variants`,
      "info",
      4000,
    );

    console.log(
      `🔍 Smart search · max ${maxAttempts}${smartSearchCap ? ` · cap ≤₹${smartSearchCap}` : ""}`,
    );

    if (processingArea) {
      processingArea.style.display = "block";
      processingArea.innerHTML = "";
      this.mountSmartModeProgress(processingArea, maxAttempts);
      this.updateSmartModeProgressUI(
        processingArea,
        0,
        maxAttempts,
        targetShipping,
        null,
        0,
        0,
      );
    }

    const finishRunUi = (mappedResults, runMeta = {}) => {
      if (runId !== this._generationSeq) return;
      this.clearStopTimers();
      if (processingArea) {
        processingArea.style.display = "none";
        processingArea.innerHTML = "";
      }
      if (resultsArea) resultsArea.classList.remove("results-during-run");

      if (mappedResults.length > 0) {
        this.selectedVariantId = null;
        this.currentResults = mappedResults;
        if (resultsArea) {
          resultsArea.style.display = "block";
          delete resultsArea.dataset.view;
          resultsArea.innerHTML = OptimizerUI.getResultsHTML(
            this.currentResults,
            this.getResultsViewOptions(),
          );
          this.setupResultsEvents();
        }
        this.restoreOptimizerChromeAfterResults();
        void this.prepareEditableResultPreviews(this.currentResults).then(() => {
          if (runId !== this._generationSeq || !(this.currentResults || []).length) return;
          const area = document.getElementById("results-area");
          if (!area || area.style.display === "none") return;
          this.currentResults.forEach((row) => this.refreshVariantCard(row));
        });
      } else if (this._runPreviousResults?.length) {
        this.currentResults = [...this._runPreviousResults];
        if (resultsArea) {
          resultsArea.style.display = "block";
          resultsArea.innerHTML = OptimizerUI.getResultsHTML(
            this.currentResults,
            this.getResultsViewOptions(),
          );
          this.setupResultsEvents();
        }
        this.restoreOptimizerChromeAfterResults();
      } else if (resultsArea) {
        const emptyReason = runMeta.error
          ? "error"
          : this.shouldStop || runMeta.stopped
            ? "stopped"
            : "exhausted";
        this.showNoResultsFallback(resultsArea, {
          reason: emptyReason,
          attempts: runMeta.attempts,
          maxAttempts: runMeta.maxAttempts || maxAttempts,
          errorMessage: runMeta.errorMessage,
        });
      } else {
        if (uploadArea) uploadArea.style.display = "block";
        sections.forEach((s) => (s.style.display = "block"));
        this.restoreOptimizerChromeAfterResults();
      }
      this._runPreviousResults = null;
      this._activeRunMeta = null;
      this.finishOptimizerRun();
    };

    const startTime = Date.now();
    let result = { success: false, results: [] };
    const runMeta = { maxAttempts };

    try {
      const blob = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          fetch(e.target.result)
            .then((r) => r.blob())
            .then(resolve);
        };
        reader.readAsDataURL(file);
      });

      this.gatherSettings();

      if (
        !manualMode &&
        window.WEB_OPTIMIZER_MODE &&
        typeof MeeshoAPI.isReady === "function"
      ) {
        OptimizerUtils.showNotification(
          MeeshoAPI.isReady()
            ? "Checking live Meesho shipping…"
            : "Trying live API… save a Meesho session for real prices",
          "info"
        );
      }

      if (
        !manualMode &&
        typeof MeeshoAPI.smartSearch === "function" &&
        (!window.WEB_OPTIMIZER_MODE || MeeshoAPI.isReady())
      ) {
        result = await MeeshoAPI.smartSearch(
          blob,
          targetShipping,
          maxAttempts,
          (attempt, max, bestSoFar, noPidCount) => {
            if (this._activeRunMeta) this._activeRunMeta.attempts = attempt;
            if (processingArea && !this.shouldStop) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              this.updateSmartModeProgressUI(
                processingArea,
                attempt,
                max,
                targetShipping,
                bestSoFar,
                noPidCount,
                elapsed,
              );
            } else if (processingArea && this.shouldStop) {
              this.markSmartModeStopping(processingArea);
            }
          },
          (foundResult) => {
            OptimizerUtils.showNotification(
              `🎉 Found ₹${foundResult.shippingCost}!`,
              "success"
            );
          },
          () => this.shouldStop,
          { maxShippingCap: smartSearchCap },
        );
      }

      if (
        window.WEB_OPTIMIZER_MODE &&
        (manualMode || !result.success || !result.results.length)
      ) {
        if (manualMode) {
          OptimizerUtils.showNotification(
            "Generating variants — enter Meesho prices manually after upload",
            "info"
          );
        } else {
          OptimizerUtils.showNotification(
            "Generating image variants…",
            "info"
          );
        }
        result = await MeeshoAPI.generateLocalVariations(
          blob,
          maxAttempts,
          (attempt, max) => {
            if (this._activeRunMeta) this._activeRunMeta.attempts = attempt;
            if (processingArea && !this.shouldStop) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              this.updateSmartModeProgressUI(
                processingArea,
                attempt,
                max,
                targetShipping,
                null,
                0,
                elapsed,
              );
            } else if (processingArea && this.shouldStop) {
              this.markSmartModeStopping(processingArea);
            }
          },
          () => this.shouldStop
        );
      }
    } catch (err) {
      console.error("❌ Error:", err);
      runMeta.error = true;
      runMeta.errorMessage = err.message || "Generation failed";
      OptimizerUtils.showNotification("Error: " + runMeta.errorMessage, "error");
    }

    runMeta.attempts = result.attempts || runMeta.attempts || 0;
    runMeta.stopped = !!(this.shouldStop || result.stopped);
    if (this._activeRunMeta) {
      this._activeRunMeta.attempts = runMeta.attempts;
    }

    // Charge credits + increment generation counters (1 per run, even if stopped).
    await this.recordImageGenerationForRun();

    if (this._runFinalizedEarly && runId === this._generationSeq) {
      this._runFinalizedEarly = false;
      let earlyMapped = [];
      if (result?.success && result.results?.length > 0) {
        const mapped = result.results.map((r, i) => this.mapResultFromApi(r, i));
        const policy = LiveSmart.applyLiveResultPolicy(mapped);
        earlyMapped = policy.display;
      }
      finishRunUi(earlyMapped, runMeta);
      return;
    }

    let mappedResults = [];
    if (result.success && result.results.length > 0) {
      const mapped = result.results.map((r, i) => this.mapResultFromApi(r, i));
      const framedMapped = (result.framedExtras || []).map((r, i) =>
        this.mapResultFromApi(r, i + 10000),
      );
      const policy = LiveSmart.applyLiveResultPolicy(mapped);
      this.lastLivePricedResults = [...policy.allPriced];
      mappedResults = policy.display;
      this.framedExtraResults = framedMapped;
      this.showFramedExtras = false;
      this.liveAnalysis = null;
      this.analysisPrimaryResults = [];
      this.analysisExtraResults = [];
      this.showAnalysisExtras = false;

      if (policy.hiddenHighCount > 0 && shippingCap) {
        OptimizerUtils.showNotification(
          `Showing all variants — ${policy.hiddenHighCount} above ₹${shippingCap} cap (not in ★ recommend set)`,
          "info",
          5000,
        );
      }
      const recPrices = (policy.recommendation?.picks || [])
        .map((p) => `₹${p.shippingCost}`)
        .join(" + ");
      if (recPrices && policy.recommendation?.picks?.length) {
        OptimizerUtils.showNotification(
          `★ Recommended: ${recPrices} (${policy.recommendation.strategy})`,
          "success",
          6000,
        );
      }

      if (result.localOnly) {
        OptimizerUtils.showNotification(
          manualMode
            ? `✅ ${result.results.length} variants — download, test on Meesho, type ₹ below`
            : `✅ ${result.results.length} variants ready — download & test on Meesho`,
          "success",
        );
      } else if (result.targetReached) {
        OptimizerUtils.showNotification(
          `✅ Best shipping: ₹${result.bestResult.shippingCost}`,
          "success",
        );
      } else if (this.shouldStop) {
        OptimizerUtils.showNotification(
          `Stopped. Best: ₹${result.bestResult?.shippingCost || "—"}`,
          "info",
        );
      } else if (result.bestResult?.shippingCost) {
        OptimizerUtils.showNotification(
          `✅ Best: ₹${result.bestResult.shippingCost} (${result.verifiedCount || 0} verified, ${result.noPidCount || 0} no PID)`,
          "info",
        );
      }
    } else if (mappedResults.length === 0) {
      const emptyMsg = this.shouldStop || runMeta.stopped
        ? "Search stopped — no variants to show"
        : `No results after ${runMeta.attempts || maxAttempts} attempts — try another image`;
      OptimizerUtils.showNotification(emptyMsg, this.shouldStop ? "info" : "error", 5000);
    }

    finishRunUi(mappedResults, runMeta);
  }


  /**
   * Generate exactly 2 local variants for lowest shipping (no live Meesho API).
   * Pool uses live-pattern variants only (standard generateVariation — no ultra/analysis).
   */

  mountSmartModeProgress(processingArea, maxAttempts) {
    if (!processingArea) return null;
    processingArea.style.display = "block";
    const compact = (this.currentResults || []).length > 0;
    const logoUrl =
      typeof OptimizerUI !== "undefined" && OptimizerUI.brandLogoUrl
        ? OptimizerUI.brandLogoUrl()
        : "";
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="" width="${compact ? 32 : 44}" height="${compact ? 32 : 44}" style="display:block;margin:0 auto ${compact ? "6px" : "10px"};border-radius:10px;">`
      : `<div style="font-size:${compact ? "28px" : "44px"};margin-bottom:${compact ? "6px" : "10px"};">📦</div>`;
    let root = processingArea.querySelector("#smart-mode-progress");
    if (!root) {
      processingArea.innerHTML = `
        <div id="smart-mode-progress" class="${compact ? "processing-banner" : ""}" style="text-align:center;padding:${compact ? "12px 14px" : "20px"};">
          ${logoHtml}
          <h3 style="margin:0 0 5px 0;color:#059669;font-size:${compact ? "15px" : "18px"};">${compact ? "Searching again…" : "Finding best shipping"}</h3>
          <p id="smp-attempts" style="color:#9ca3af;font-size:11px;margin-bottom:5px;">0 / ${maxAttempts}</p>
          <p id="smp-time" style="color:#e67e22;font-size:12px;margin-bottom:12px;">⏱️ 0s</p>
          <div id="smp-best-wrap" style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.28);border-radius:12px;padding:14px 12px 12px;margin-bottom:12px;overflow:visible;">
            <div style="font-size:28px;color:#e67e22;">🔍</div>
            <div id="smp-best-label" style="font-size:11px;color:#9ca3af;margin-top:5px;line-height:1.45;">Searching…</div>
          </div>
          <div style="background:#f0e0c8;border-radius:10px;height:10px;margin-bottom:8px;overflow:hidden;">
            <div id="smp-bar" style="width:0%;background:linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);height:100%;border-radius:10px;transition:width 0.25s ease;"></div>
          </div>
          <div id="smp-pct" style="font-size:11px;color:#c45f12;margin-bottom:12px;">0%</div>
          <button id="stop-btn" type="button" class="opt-btn opt-btn-danger" style="padding:10px 25px;font-size:13px;border-radius:10px;">⏹️ Stop</button>
          <p id="smp-stopping" style="display:none;font-size:11px;color:#6b7280;margin-top:10px;">Stopping — showing results so far…</p>
        </div>`;
      root = processingArea.querySelector("#smart-mode-progress");
      const stopBtn = processingArea.querySelector("#stop-btn");
      if (stopBtn && !stopBtn.dataset.wired) {
        stopBtn.dataset.wired = "1";
        stopBtn.onclick = () => {
          console.log("⏹️ Stop");
          this.requestStopGeneration();
        };
      }
    } else if (root) {
      root.classList.toggle("processing-banner", compact);
    }
    return root;
  }

  markSmartModeStopping(processingArea, options = {}) {
    if (!processingArea) return;
    const stopping = processingArea.querySelector("#smp-stopping");
    const stopBtn = processingArea.querySelector("#stop-btn");
    const label = processingArea.querySelector("#smp-best-label");
    if (stopping) {
      stopping.style.display = "block";
      stopping.textContent = options.escalate
        ? "Still finishing current step — showing results shortly…"
        : "Stopping — showing results so far…";
    }
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.style.opacity = "0.55";
      stopBtn.style.cursor = "not-allowed";
      stopBtn.textContent = "Stopping…";
    }
    if (label && (label.textContent === "Searching…" || label.textContent === "Wrapping up…")) {
      label.textContent = options.escalate ? "Finishing up…" : "Wrapping up…";
    }
  }

  updateSmartModeProgressUI(
    processingArea,
    attempt,
    maxAttempts,
    target,
    bestSoFar,
    noPidCount = 0,
    elapsedTime = 0,
  ) {
    if (!processingArea || this.shouldStop) {
      this.markSmartModeStopping(processingArea);
      return;
    }
    this.mountSmartModeProgress(processingArea, maxAttempts);
    const pct = maxAttempts > 0 ? Math.round((attempt / maxAttempts) * 100) : 0;
    const mins = Math.floor(elapsedTime / 60);
    const secs = elapsedTime % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    let estRemaining = "";
    if (attempt > 0 && elapsedTime > 0) {
      const avgPerAttempt = elapsedTime / attempt;
      const remaining = Math.round(avgPerAttempt * (maxAttempts - attempt));
      if (remaining > 60) estRemaining = ` • ~${Math.ceil(remaining / 60)}m left`;
      else if (remaining > 0) estRemaining = ` • ~${remaining}s left`;
    }

    const attemptsEl = processingArea.querySelector("#smp-attempts");
    const timeEl = processingArea.querySelector("#smp-time");
    const barEl = processingArea.querySelector("#smp-bar");
    const pctEl = processingArea.querySelector("#smp-pct");
    const bestWrap = processingArea.querySelector("#smp-best-wrap");

    if (attemptsEl) {
      let text = `${attempt} / ${maxAttempts}`;
      if (noPidCount > 0) text += ` • ${noPidCount} no PID`;
      attemptsEl.textContent = text;
    }
    if (timeEl) timeEl.textContent = `⏱️ ${timeStr}${estRemaining}`;
    if (barEl) barEl.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;

    if (bestWrap) {
      if (bestSoFar) {
        bestWrap.style.background = "rgba(5,150,105,0.12)";
        bestWrap.style.borderColor = "rgba(5,150,105,0.35)";
        bestWrap.innerHTML = `
          <div style="font-size:11px;color:#6b7280;line-height:1.45;padding-top:2px;">Best so far</div>
          <div style="font-size:32px;font-weight:700;color:#059669;line-height:1.15;">₹${bestSoFar}</div>
          <div style="font-size:11px;color:#059669;margin-top:4px;line-height:1.4;">✓ Live Meesho shipping</div>`;
      } else if (!bestWrap.querySelector("#smp-best-label")) {
        bestWrap.innerHTML = `
          <div style="font-size:28px;color:#e67e22;">🔍</div>
          <div id="smp-best-label" style="font-size:11px;color:#9ca3af;margin-top:5px;">Searching…</div>`;
      }
    }
  }

  // Smart Mode HTML - legacy fallback (prefer mountSmartModeProgress)
  getSmartModeHTML(
    attempt,
    maxAttempts,
    target,
    bestSoFar,
    noPidCount = 0,
    elapsedTime = 0,
    options = {}
  ) {
    const skipHigherCount = options.skipHigherCount || 0;
    const phaseLabel = options.phaseLabel || "";
    const pct = Math.round((attempt / maxAttempts) * 100);

    // Format elapsed time
    const mins = Math.floor(elapsedTime / 60);
    const secs = elapsedTime % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    // Estimate remaining time
    let estRemaining = "";
    if (attempt > 0 && elapsedTime > 0) {
      const avgPerAttempt = elapsedTime / attempt;
      const remaining = Math.round(avgPerAttempt * (maxAttempts - attempt));
      if (remaining > 60) {
        estRemaining = `~${Math.ceil(remaining / 60)}m left`;
      } else if (remaining > 0) {
        estRemaining = `~${remaining}s left`;
      }
    }

    return `
            <div style="text-align:center;padding:20px;">
                <div style="font-size:50px;margin-bottom:10px;">🎯</div>
                <h3 style="margin:0 0 5px 0;color:#10b981;font-size:18px;">AI Is Finding Best Shipping</h3>
                <p style="color:##0f0f10;font-size:14px;margin-bottom:3px;">Target: ≤ ₹${target}</p>
                <p style="color:#9ca3af;font-size:11px;margin-bottom:5px;">${attempt} / ${maxAttempts}${
      noPidCount > 0 ? ` • ${noPidCount} no PID (kept)` : ""
    }${skipHigherCount > 0 ? ` • ${skipHigherCount} skipped higher` : ""}</p>
                <p style="color:#e67e22;font-size:12px;margin-bottom:12px;">⏱️ ${timeStr}${
      estRemaining ? ` • ${estRemaining}` : ""
    }</p>
                
                ${
                  bestSoFar
                    ? `
                    <div style="background:${
                      bestSoFar <= target
                        ? "rgba(16,185,129,0.2)"
                        : "rgba(230,126,34,0.12)"
                    };border:2px solid ${
                        bestSoFar <= target
                          ? "#10b981"
                          : "rgba(230,126,34,0.45)"
                      };border-radius:12px;padding:12px;margin-bottom:12px;">
                        <div style="font-size:11px;color:#9ca3af;">Best Found</div>
                        <div style="font-size:32px;font-weight:700;color:${
                          bestSoFar <= target ? "#059669" : "#e67e22"
                        };">₹${bestSoFar}</div>
                        ${
                          bestSoFar <= target
                            ? '<div style="font-size:11px;color:#10b981;margin-top:3px;font-weight:300;">✅ Target Reached!</div>'
                            : '<div style="font-size:10px;color:#10b981;margin-top:3px;font-weight:300;">✓ Live Meesho API</div>'
                        }
                    </div>
                `
                    : `
                    <div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.28);border-radius:12px;padding:15px;margin-bottom:12px;">
                        <div style="font-size:28px;color:#e67e22;">🔍</div>
                        <div style="font-size:11px;color:#9ca3af;margin-top:5px;">Searching...</div>
                    </div>
                `
                }
                
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;height:10px;margin-bottom:8px;overflow:hidden;">
                    <div style="width:${pct}%;background:linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);height:100%;border-radius:10px;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:11px;color:#c45f12;margin-bottom:12px;">${pct}%</div>
                <button id="stop-btn" class="opt-btn opt-btn-danger" style="padding:10px 25px;font-size:13px;border-radius:10px;">⏹️ Stop</button>
            </div>
        `;
  }


  // Fallback estimation method



  async triggerPriceRefresh() {
    const priceSelectors = [
      'input[name="price"]',
      'input[name="mrp"]',
      'input[name="sellingPrice"]',
      'input[placeholder*="price" i]',
      'input[placeholder*="mrp" i]',
      'input[id*="price" i]',
      'input[class*="price" i]',
      ".MuiInputBase-input",
      'input[type="number"]',
    ];

    let priceInput = null;

    for (const sel of priceSelectors) {
      try {
        const inputs = document.querySelectorAll(sel);
        for (const inp of inputs) {
          if (
            inp.value &&
            inp.value.match(/^\d+$/) &&
            parseInt(inp.value) >= 10
          ) {
            priceInput = inp;
            break;
          }
        }
        if (priceInput) break;
      } catch (e) {}
    }

    if (priceInput) {
      const currentValue = priceInput.value;

      priceInput.focus();
      priceInput.click();
      await new Promise((r) => setTimeout(r, 100));

      priceInput.select();
      priceInput.value = currentValue;

      priceInput.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true })
      );
      priceInput.dispatchEvent(
        new Event("change", { bubbles: true, cancelable: true })
      );
      priceInput.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Tab", keyCode: 9 })
      );
      priceInput.dispatchEvent(
        new KeyboardEvent("keyup", { bubbles: true, key: "Tab", keyCode: 9 })
      );

      await new Promise((r) => setTimeout(r, 100));

      priceInput.blur();
      priceInput.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      priceInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

      document.body.click();
    }

    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || "").toLowerCase().trim();
      if (
        text.includes("calculate") ||
        text.includes("update") ||
        text === "save"
      ) {
        btn.click();
        await new Promise((r) => setTimeout(r, 500));
        break;
      }
    }
  }

  isManualShippingMode() {
    if (!window.WEB_OPTIMIZER_MODE) return false;
    const el = document.getElementById("manual-shipping-mode");
    return el ? el.checked : true;
  }

  getBaselineShipping() {
    return 0;
  }


  /** Session priced only above category recommend cap (no floor winners at all). */





  /** Auto-save priced results to local DB after every report or generate run. */

  prepareOptimizerSectionsForRun() {
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = "none";
    });
  }

  hasOptimizerSession() {
    return (
      !!this.getImageFileForGenerate() ||
      (this.currentResults || []).length > 0
    );
  }

  shouldConfirmLeavePage() {
    return this.isProcessing || this.hasOptimizerSession();
  }

  setupNavigationGuards() {
    if (this._navigationGuardWired || typeof window === "undefined") return;
    this._navigationGuardWired = true;

    window.addEventListener("beforeunload", (e) => {
      if (!this.shouldConfirmLeavePage()) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    });

    // History guards only on web app — pushState on Meesho catalog can trigger
    // their SPA router and cause a full page reload.
    if (!window.WEB_OPTIMIZER_MODE) return;

    try {
      if (!history.state?.optimizerGuard) {
        history.pushState({ optimizerGuard: true }, "");
      }
    } catch {
      /* ignore */
    }

    window.addEventListener("popstate", () => {
      if (!this.shouldConfirmLeavePage()) return;
      const ok = confirm(
        "You have an image or generated variants. Leave this page and lose progress?",
      );
      if (!ok) {
        try {
          history.pushState({ optimizerGuard: true }, "");
        } catch {
          /* ignore */
        }
      }
    });
  }

  enableAllGenerateButtons() {
    const hasFile = !!this.getImageFileForGenerate();
    const sticky = document.getElementById("generate-sticky");
    if (sticky) sticky.style.display = "";
    const btn = document.getElementById("generate-btn");
    if (btn) {
      btn.style.display = "block";
      btn.disabled = !hasFile;
    }
  }


  finishOptimizerRun() {
    this.clearStopTimers();
    this.isProcessing = false;
    this.shouldStop = false;
    this.enableAllGenerateButtons();
  }

  restoreOptimizerChromeAfterResults() {
    const hasResults = (this.currentResults || []).length > 0;
    document.querySelectorAll(".opt-section").forEach((s) => {
      s.style.display = hasResults ? "none" : "block";
    });
    const previewBox = document.getElementById("preview-box");
    const previewImg = document.getElementById("preview-img");
    if (previewBox && previewImg?.src) {
      previewBox.style.display = "block";
    }
    const uploadArea = document.getElementById("upload-area");
    const hasFile =
      this._pendingFile ||
      window.__webPendingFile ||
      this.lastProcessedFile ||
      document.getElementById("image-input")?.files?.[0];
    if (uploadArea) {
      uploadArea.style.display = hasFile ? "none" : "block";
    }
    this.enableAllGenerateButtons();
  }

  ensureGenerateChromeVisible() {
    this.enableAllGenerateButtons();
  }

  getImageFileForGenerate() {
    if (this.lastProcessedFile) return this.lastProcessedFile;
    const fileInput = document.getElementById("image-input");
    if (fileInput?.files?.[0]) return fileInput.files[0];
    if (this._pendingFile) return this._pendingFile;
    if (window.__webPendingFile) return window.__webPendingFile;
    return null;
  }




  getResultsViewOptions() {
    return {
      manualMode: this.isManualShippingMode(),
      baselineShipping: this.getBaselineShipping(),
      selectedVariantId: this.selectedVariantId,
      framedExtras: this.framedExtraResults,
      showFramedExtras: this.showFramedExtras,
      liveAnalysis: this.liveAnalysis,
      analysisPrimary: this.analysisPrimaryResults,
      analysisExtras: this.analysisExtraResults,
      showAnalysisExtras: this.showAnalysisExtras,
      livePricedResults: this.lastLivePricedResults || [],
    };
  }



  getVariantLayerCaps(row) {
    if (
      typeof MeeshoAPI !== "undefined" &&
      MeeshoAPI.getEffectiveLayerCapabilities &&
      row?.layers
    ) {
      return MeeshoAPI.getEffectiveLayerCapabilities(
        row.layers,
        row.editFlags,
      );
    }
    return {
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
  }

  isVariantEdited(editFlags, layers, row) {
    if (
      row?._textOverlaysEdited ||
      (row && typeof this.textOverlaysChanged === "function" && this.textOverlaysChanged(row))
    ) {
      return true;
    }
    if (!editFlags && !row?._badgesRepositioned && !row?._staticAppearanceEdited)
      return false;
    if (row?._badgesRepositioned || row?._staticAppearanceEdited) return true;
    if (
      layers?._staticFrame &&
      typeof window.StaticFrameCompose?.isStaticEdited === "function"
    ) {
      return window.StaticFrameCompose.isStaticEdited(editFlags, false);
    }
    return !!(
      editFlags.stickersRemoved ||
      editFlags.borderOnlyRemoved ||
      editFlags.cleanProduct ||
      editFlags.borderRemoved ||
      editFlags.stickersAdded ||
      editFlags.borderAdded ||
      editFlags.fullDecorationsAdded
    );
  }

  normalizeEditFlags(editFlags, previousFlags = {}) {
    const flags = editFlags || {};
    const prev = previousFlags || {};
    const wasClean = !!(prev.cleanProduct || prev.borderRemoved);
    const addingDecorations = !!(
      flags.stickersAdded ||
      flags.borderAdded ||
      flags.fullDecorationsAdded ||
      flags.decorationsAdded
    );
    let cleanProduct = addingDecorations
      ? false
      : !!(flags.cleanProduct || flags.borderRemoved);
    let stickersRemoved = cleanProduct ? false : !!flags.stickersRemoved;
    let borderOnlyRemoved = cleanProduct ? false : !!flags.borderOnlyRemoved;
    let stickersAdded = !!flags.stickersAdded;
    let borderAdded = !!flags.borderAdded;
    let fullDecorationsAdded = !!(
      flags.fullDecorationsAdded || flags.decorationsAdded
    );

    if (!addingDecorations && stickersRemoved && borderOnlyRemoved) {
      cleanProduct = true;
      stickersRemoved = false;
      borderOnlyRemoved = false;
    }

    if (fullDecorationsAdded) {
      stickersRemoved = false;
      borderOnlyRemoved = false;
      stickersAdded = false;
      borderAdded = false;
      cleanProduct = false;
    } else {
      if (stickersAdded) {
        stickersRemoved = false;
        cleanProduct = false;
        if (wasClean && !borderAdded) {
          borderOnlyRemoved = true;
        }
      }
      if (borderAdded) {
        borderOnlyRemoved = false;
        cleanProduct = false;
        if (wasClean && !stickersAdded) {
          stickersRemoved = true;
        }
      }
      if (stickersRemoved) stickersAdded = false;
      if (borderOnlyRemoved) borderAdded = false;
    }

    return {
      stickersRemoved,
      borderOnlyRemoved,
      cleanProduct,
      stickersAdded,
      borderAdded,
      fullDecorationsAdded,
    };
  }

  freezeRowPricing(row, source = {}) {
    const estShipping = source.estShipping ?? source.meta?.estInr ?? row.estShipping ?? 0;
    const localTier =
      Number(source.meta?.localTier ?? row.meta?.localTier ?? row.localEstShipping ?? 0);
    row._frozenPricing = {
      estShipping,
      shippingCost: source.shippingCost ?? row.shippingCost ?? 0,
      pricingImageUrl:
        source.pricingImageUrl ||
        row.pricingImageUrl ||
        source.dataUrl ||
        row.dataUrl ||
        "",
      metaKb: source.meta?.kb ?? row.meta?.kb,
      metaEstInr: source.meta?.estInr ?? estShipping,
      targetKb: source.meta?.targetKb ?? row.meta?.targetKb,
      localTier: localTier > 0 ? localTier : undefined,
    };
    return row;
  }

  ensureFrozenPricing(row) {
    if (!row) return row;
    if (row._frozenPricing?.estShipping > 0 || row._frozenPricing?.metaEstInr > 0) {
      return row;
    }
    return this.freezeRowPricing(row, {
      estShipping: row.estShipping,
      shippingCost: row.shippingCost,
      pricingImageUrl: row.pricingImageUrl,
      dataUrl: row.dataUrl,
      meta: row.meta,
    });
  }

  async ensureRowComposeReady(row) {
    if (!row?.layers) return row;
    await this.preloadStaticComposeModule();
    this.ensureFrozenPricing(row);
    if (window.StaticFrameCompose?.ensureVariantPlacementMeta) {
      await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
    }
    return row;
  }

  getRowDisplayShipping(row) {
    if (row?.localOnly || row?.meta?.localPrice) {
      return { amount: 0, verified: false, localOnly: true };
    }
    const localTier =
      Number(row?.localEstShipping || row?.meta?.localTier || 0) ||
      Number(row?._frozenPricing?.localTier || 0);
    const frozen = row?._frozenPricing;
    if (frozen) {
      if (frozen.shippingCost > 0) {
        return {
          amount: frozen.shippingCost,
          verified: !!row?.isVerified || !!row?.liveVerified,
          localTier: !!frozen.localTier && !row?.liveVerified,
        };
      }
      if (frozen.estShipping > 0) return { amount: frozen.estShipping, verified: false };
      if (frozen.metaEstInr > 0) return { amount: frozen.metaEstInr, verified: false };
    }
    if (row?.shippingCost > 0) {
      return {
        amount: row.shippingCost,
        verified: !!row?.isVerified || !!row?.liveVerified,
      };
    }
    if (localTier > 0) return { amount: localTier, verified: false, localTier: true };
    const est = row?.estShipping ?? row?.meta?.estInr ?? 0;
    return { amount: est, verified: false };
  }

  mapResultFromApi(r, index) {
    const variantId =
      r.variantId || `var-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
    const layers = r.layers || null;
    const pricingImageUrl = r.pricingImageUrl || r.dataUrl || r.imageUrl || "";
    const editFlags = this.normalizeEditFlags(r.editFlags);
    const row = {
      variantId,
      name: r.name || `Var-${index + 1}`,
      pricingImageUrl,
      dataUrl: layers?.length ? "" : r.dataUrl || r.imageUrl || pricingImageUrl || "",
      blob: r.blob || null,
      layers,
      editFlags,
      variantStyle: r.variantStyle || "standard",
      meta: r.meta || null,
      shippingCost: r.shippingCost || 0,
      estShipping: r.estShipping ?? r.meta?.estInr ?? 0,
      isVerified: r.isVerified ?? !r.localOnly,
      duplicatePid: r.duplicatePid,
      manualPrice: !!r.manualPrice,
      uploadedUrl: r.uploadedUrl,
      savings: r.savings,
      isRealPrice: r.isRealPrice,
      liveVerified: r.liveVerified,
      liveTotalPrice: r.liveTotalPrice,
      meeshoPriceUsed: r.meeshoPriceUsed,
      noPid: !!r.noPid,
      analysisMode: !!r.analysisMode,
    };
    row.imageUrl =
      typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl
        ? MeeshoAPI.resolveDisplayUrl(row) || pricingImageUrl
        : pricingImageUrl;
    this.freezeRowPricing(row, {
      estShipping: row.estShipping,
      shippingCost: row.shippingCost,
      pricingImageUrl,
      dataUrl: row.dataUrl,
      meta: row.meta,
    });
    if (row.layers) {
      this.captureTextOverlayDefaults(row);
      this.ensureTextOverlayState(row);
    }
    return row;
  }


  getActiveResultList() {
    return this.currentResults || [];
  }


  getBestActiveResult() {
    const list = this.getActiveResultList();
    if (!list.length) {
      if (this.analysisPrimaryResults.length) return this.analysisPrimaryResults[0];
      return null;
    }
    const priced = list.filter((r) => Number(r.shippingCost) > 0);
    if (!priced.length) return list[0];
    const lowest = Math.min(...priced.map((r) => Number(r.shippingCost)));
    return priced.find((r) => Number(r.shippingCost) === lowest) || list[0];
  }

  getApplyTargetResult() {
    if (this.selectedVariantId) {
      const selected = this.findResultRow(this.selectedVariantId);
      if (selected) return selected;
    }
    return this.getBestActiveResult();
  }


  resolveDownloadUrl(result) {
    if (!result) return "";
    return (
      result.pricingImageUrl ||
      result.dataUrl ||
      result.imageUrl ||
      result.uploadedUrl ||
      ""
    );
  }

  resolveResultImageSrc(result) {
    const fromPreview = this.resolveVariantPreviewSrc(result);
    if (fromPreview) return fromPreview;
    return this.resolveDownloadUrl(result);
  }

  /** Parent for editor/fullscreen overlays — must sit above #opt-modal (z-index 2147483646). */
  getOptimizerOverlayParent() {
    const modal = this.modal || document.getElementById("opt-modal");
    return modal || document.documentElement;
  }

  mountOptimizerOverlay(el) {
    if (!el) return;
    const parent = this.getOptimizerOverlayParent();
    if (el.parentElement !== parent) {
      parent.appendChild(el);
    }
    const inModal = parent.id === "opt-modal";
    el.style.zIndex = inModal ? "2147483647" : "2147483647";
  }

  async ensureOriginalImageUrl(file) {
    if (this.originalImageUrl) return this.originalImageUrl;

    const previewImg = document.getElementById("preview-img");
    if (previewImg?.src?.startsWith("data:")) {
      this.originalImageUrl = previewImg.src;
      return this.originalImageUrl;
    }

    if (!file) return null;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.originalImageUrl = ev.target.result;
        resolve(this.originalImageUrl);
      };
      reader.onerror = () => reject(new Error("Could not read image preview"));
      reader.readAsDataURL(file);
    });
  }

  openVariantFullPreview(row) {
    if (!row) return;
    const src = this.resolveVariantPreviewSrc(row);
    if (!src) {
      OptimizerUtils.showNotification("No preview for this variant", "error");
      return;
    }

    let overlay = document.getElementById("variant-full-preview-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "variant-full-preview-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;";
      overlay.innerHTML = `
        <button type="button" id="variant-full-preview-close" style="position:absolute;top:12px;right:12px;background:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;z-index:1;">Close</button>
        <img id="variant-full-preview-img" alt="Full preview" style="max-width:100%;max-height:92vh;object-fit:contain;border-radius:8px;background:#fff;touch-action:pan-x pan-y pinch-zoom;">
        <div id="variant-full-preview-title" style="color:#fff;font-size:13px;margin-top:10px;text-align:center;max-width:90vw;"></div>`;
      this.mountOptimizerOverlay(overlay);
      overlay.querySelector("#variant-full-preview-close").onclick = () => {
        overlay.style.display = "none";
      };
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.style.display = "none";
      };
    }

    const img = overlay.querySelector("#variant-full-preview-img");
    const title = overlay.querySelector("#variant-full-preview-title");
    if (img) img.src = src;
    if (title) title.textContent = row.name || "Variant preview";
    this.mountOptimizerOverlay(overlay);
    overlay.style.display = "flex";
  }



  findResultRow(variantId) {
    if (variantId == null || variantId === "") return null;
    const id = String(variantId);
    const pools = [
      this.currentResults,
      this._runPreviousResults,
      this.framedExtraResults,
      this.analysisPrimaryResults,
      this.analysisExtraResults,
    ];
    for (const pool of pools) {
      if (!pool?.length) continue;
      const hit = pool.find((r) => String(r.variantId) === id);
      if (hit) return hit;
    }
    return null;
  }


  async setVariantEdits(variantId, editFlags) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const normalized = this.normalizeEditFlags(editFlags, row.editFlags);
    row.editFlags = normalized;

    const composeReady = await this.preloadStaticComposeModule();
    const pickedBase =
      composeReady && window.StaticFrameCompose?.pickStaticBaseLayer
        ? window.StaticFrameCompose.pickStaticBaseLayer(row.layers, normalized)
        : null;
    const canUseBakedLayer =
      !!pickedBase && !pickedBase.rebuild && !pickedBase.drawBadges;

    if (
      window.StaticFrameCompose?.ensureStickerPlacements &&
      (normalized.stickersAdded || normalized.fullDecorationsAdded) &&
      !canUseBakedLayer
    ) {
      if (window.StaticFrameCompose.prepareStickerComposeFrame) {
        await window.StaticFrameCompose.prepareStickerComposeFrame(
          row.layers,
          normalized,
          {
            meta: row.meta || {},
            url:
              pickedBase?.url ||
              row.layers.noBorder ||
              row.layers.productOnly ||
              row.layers.full,
          },
        );
      }
      window.StaticFrameCompose.ensureStickerPlacements(
        row.layers,
        normalized,
        row.meta || {},
      );
      if (window.StaticFrameCompose.ensureVariantPlacementMeta) {
        await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
      }
      this._staticControlsVariantId = null;
    } else if (
      window.StaticFrameCompose?.ensureStickerPlacements &&
      (normalized.stickersAdded || normalized.fullDecorationsAdded)
    ) {
      window.StaticFrameCompose.ensureStickerPlacements(
        row.layers,
        normalized,
        row.meta || {},
      );
      if (window.StaticFrameCompose.ensureVariantPlacementMeta) {
        await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
      }
      this._staticControlsVariantId = null;
    }

    const needsCompose =
      composeReady &&
      row.layers._staticFrame &&
      !canUseBakedLayer &&
      (row._staticAppearanceEdited ||
        row._badgesRepositioned ||
        window.StaticFrameCompose?.needsStaticCompose?.(row) ||
        !!pickedBase?.rebuild ||
        !!pickedBase?.drawBadges);

    if (needsCompose && window.StaticFrameCompose?.composeStaticPreview) {
      try {
        const url = await this.composePreviewForRow(row);
        if (url) {
          this.applyStaticPreviewToRow(row, url, variantId);
          if (this._editingVariantId === variantId) {
            this.renderVariantEditorPanel(row);
          } else {
            this.refreshVariantCard(row);
          }
          return;
        }
      } catch (e) {
        console.warn("Variant edit compose failed:", e);
      }
    }

    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrlAsync) {
      try {
        const url = await MeeshoAPI.resolveDisplayUrlAsync(row);
        this.applyStaticPreviewToRow(row, url, variantId);
      } catch (e) {
        const url = MeeshoAPI.resolveDisplayUrl(row);
        this.applyStaticPreviewToRow(row, url, variantId);
      }
    } else if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrl) {
      const url = MeeshoAPI.resolveDisplayUrl(row);
      this.applyStaticPreviewToRow(row, url, variantId);
    } else if (window.StaticFrameCompose?.composeStaticPreview) {
      const url = await this.composePreviewForRow(row);
      this.applyStaticPreviewToRow(row, url, variantId);
    }

    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    } else {
      this.refreshVariantCard(row);
    }
  }

  async setStaticPlacementSize(variantId, placementId, sizePct, options = {}) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const p = (row.layers._badgePlacements || []).find((b) => b.id === placementId);
    if (p?.lockSize !== false && !options.force) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementSize) return;

    const ok = window.StaticFrameCompose.updatePlacementSize(
      row.layers,
      placementId,
      sizePct,
      options,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);

    if (options.autoLock && this._editingVariantId === variantId) {
      const container = document.querySelector("#variant-edit-static-badges");
      if (container) {
        this.updatePlacementSizeLockUI(container, placementId, row.layers);
      }
    }
  }

  async resetStaticVariantEdits(variantId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    clearTimeout(this._borderThicknessTimer);
    this._borderThicknessTimer = null;
    clearTimeout(this._gownLayerTimer);
    this._gownLayerTimer = null;
    clearTimeout(this._gownPhotoZoomTimer);
    this._gownPhotoZoomTimer = null;
    clearTimeout(this._gownPhotoPanTimer);
    this._gownPhotoPanTimer = null;
    clearTimeout(this._gownPhotoMarginTimer);
    this._gownPhotoMarginTimer = null;
    this._borderComposeGen = (this._borderComposeGen || 0) + 1;

    await this.preloadStaticComposeModule();
    if (window.StaticFrameCompose?.resetStaticPlacements) {
      window.StaticFrameCompose.resetStaticPlacements(row.layers);
    }

    row.editFlags = this.normalizeEditFlags({});
    row._badgesRepositioned = false;
    row._staticAppearanceEdited = false;
    row._textOverlaysEdited = false;

    if (!Array.isArray(row.layers._textOverlaysDefaults)) {
      const fromStatic = row.layers._staticDefaults?.textOverlays;
      row.layers._textOverlaysDefaults = Array.isArray(fromStatic)
        ? JSON.parse(JSON.stringify(fromStatic))
        : [];
    }
    row.layers._textOverlays = JSON.parse(
      JSON.stringify(row.layers._textOverlaysDefaults),
    );
    if (typeof ImageGenerator !== "undefined" && ImageGenerator.syncLegacyTextFields) {
      ImageGenerator.syncLegacyTextFields(row.layers, row.layers._textOverlays);
    }

    let resetUrl = "";
    try {
      resetUrl = await this.composePreviewForRow(row, { staticAppearanceEdited: true });
    } catch (e) {
      console.warn("Reset preview compose failed:", e);
    }
    if (!resetUrl) {
      const urls = row.layers._staticDefaults?.urls;
      resetUrl =
        urls?.full ||
        row.layers.full ||
        row.pricingImageUrl ||
        row.dataUrl ||
        "";
    }

    row.imageUrl = resetUrl;

    if (this._editingVariantId === variantId) {
      this._staticControlsVariantId = null;
      this._textControlsVariantId = null;
      this.applyStaticPreviewToRow(row, resetUrl, variantId);
      this.renderVariantEditorPanel(row);
    } else {
      this.refreshVariantCard(row);
    }
  }

  hasAdvancedEditor(row) {
    if (!row?.layers) return false;
    if (row.layers._staticFrame || (row.layers._badgePlacements || []).length) {
      return true;
    }
    if (window.StaticFrameCompose?.isEditableVariant) {
      return window.StaticFrameCompose.isEditableVariant(row);
    }
    return this.isStaticPromoRow(row);
  }

  canEditResultRow(row) {
    if (!row?.layers) return false;
    if (typeof OptimizerUI !== "undefined" && OptimizerUI.isStaticPromoEditorRow) {
      return OptimizerUI.isStaticPromoEditorRow(row);
    }
    return !!(
      row.layers.full ||
      row.layers.productOnly ||
      row.layers._staticFrame ||
      (row.layers._badgePlacements || []).length
    );
  }

  /** Compose static previews on cards after generate (colors/badges editor needs imageUrl). */
  async prepareEditableResultPreviews(rows) {
    const editable = (rows || []).filter((r) => this.canEditResultRow(r));
    if (!editable.length) return;
    const loaded = await this.preloadStaticComposeModule();
    if (!loaded) {
      console.warn(
        "Static compose module unavailable — tap-to-edit preview may not update",
      );
      return;
    }
    for (const row of editable) {
      try {
        if (window.StaticFrameCompose?.ensureVariantPlacementMeta) {
          await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
        }
      } catch (e) {
        console.warn("Placement meta bootstrap failed:", e);
      }
    }
    const limit = Math.min(editable.length, 16);
    for (let i = 0; i < limit; i++) {
      const row = editable[i];
      try {
        await this.applyRowStaticPreview(row.variantId, row);
      } catch (e) {
        console.warn("Card preview compose failed:", row.variantId, e);
        const fb = this.resolveVariantPreviewSrc(row);
        if (fb) this.applyStaticPreviewToRow(row, fb, row.variantId);
      }
    }
  }

  variantBadgesOnlyCompose(row) {
    return !!row?._badgesRepositioned && !row?._staticAppearanceEdited;
  }

  getVariantComposeOptions(row, { preview = false } = {}) {
    const frozenKb = row?._frozenPricing?.targetKb ?? row?.meta?.targetKb ?? 0;
    const preserveKb =
      !frozenKb && row?.blob?.size
        ? Math.ceil(row.blob.size / 1024)
        : row?.meta?.actualKb || 0;
    if (preview) {
      return {
        targetKb: 0,
        preserveKb: 0,
        jpegQuality: row?.meta?.jpegQuality || 0.92,
        style: row?.layers?._staticFrame?.style,
        preview: true,
      };
    }
    return {
      targetKb: frozenKb,
      preserveKb: frozenKb ? 0 : preserveKb,
      jpegQuality: row?.meta?.jpegQuality,
      style: row?.layers?._staticFrame?.style,
      preview: false,
    };
  }

  updateVariantEditorResetButton(row) {
    const panel = document.getElementById("variant-edit-panel");
    if (!panel || !row || this._editingVariantId !== row.variantId) return;
    const resetBtn = panel.querySelector("#variant-edit-reset");
    if (!resetBtn) return;
    const hasAdvanced = this.hasAdvancedEditor(row);
    const edited =
      !!row._badgesRepositioned ||
      !!row._staticAppearanceEdited ||
      !!row._textOverlaysEdited ||
      this.textOverlaysChanged(row) ||
      this.isVariantEdited(row.editFlags, row.layers, row) ||
      (hasAdvanced && window.StaticFrameCompose?.needsStaticCompose?.(row));
    resetBtn.style.display = edited ? "block" : "none";
  }

  async composePreviewForRow(row, options = {}) {
    if (!row?.layers || !window.StaticFrameCompose?.composeStaticPreview) return "";
    await this.ensureRowComposeReady(row);
    const fallbackUrl =
      row.pricingImageUrl ||
      row.dataUrl ||
      row.imageUrl ||
      row.layers.full ||
      row.layers.noStickers ||
      "";
    if (row.layers._staticFrame) {
      window.StaticFrameCompose.ensureStaticRebuildUrls?.(row.layers, fallbackUrl);
      if (
        row.layers._staticFrame.style === "gown_static" &&
        !row.layers._gownPhotoSource &&
        !row.layers.productOnly &&
        row.blob instanceof Blob &&
        !row.layers._composeFallbackUrl
      ) {
        row.layers._composeFallbackUrl = URL.createObjectURL(row.blob);
      }
    }
    const gen = ++this._borderComposeGen;
    const badgesOnly = this.variantBadgesOnlyCompose(row);
    const url = await window.StaticFrameCompose.composeStaticPreview(
      row.layers,
      row.editFlags || {},
      {
        ...this.getVariantComposeOptions(row, { preview: true }),
        staticAppearanceEdited: !!row._staticAppearanceEdited,
        badgesOnly,
        badgesRepositioned: !!row._badgesRepositioned,
        meta: row.meta,
        ...options,
      },
    );
    if (gen !== this._borderComposeGen) return row.imageUrl || url;
    return url;
  }

  async composeSaveForRow(row) {
    const textEdited =
      !!row?._textOverlaysEdited ||
      (row && typeof this.textOverlaysChanged === "function" && this.textOverlaysChanged(row));

    if (!row?.layers?._staticFrame) {
      if (textEdited) {
        const textUrl = await this.composeTextOverlayPreview(row);
        if (textUrl) return textUrl;
      }
      return this.resolveDownloadUrl(row);
    }

    if (!row?.layers || !window.StaticFrameCompose?.composeStaticPreview) {
      if (textEdited) {
        const textUrl = await this.composeTextOverlayPreview(row);
        if (textUrl) return textUrl;
      }
      return this.resolveDownloadUrl(row);
    }
    const edited =
      this.isVariantEdited(row.editFlags, row.layers, row) ||
      !!row._textOverlaysEdited ||
      this.textOverlaysChanged(row);
    if (!edited) return this.resolveDownloadUrl(row);

    await this.ensureRowComposeReady(row);
    const url = await window.StaticFrameCompose.composeStaticPreview(
      row.layers,
      row.editFlags || {},
      {
        ...this.getVariantComposeOptions(row, { preview: false }),
        staticAppearanceEdited: !!row._staticAppearanceEdited,
        badgesOnly: this.variantBadgesOnlyCompose(row),
        badgesRepositioned: !!row._badgesRepositioned,
        meta: row.meta,
      },
    );
    return url || this.resolveDownloadUrl(row);
  }

  applyStaticPreviewToRow(row, url, variantId) {
    if (!url) return;
    this.ensureFrozenPricing(row);
    row.imageUrl = url;
    if (this._editingVariantId === variantId) {
      const preview = document.getElementById("variant-edit-preview");
      if (preview) {
        if (preview.src !== url) preview.src = url;
        else preview.removeAttribute("src");
        preview.src = url;
      }
    }
    this.refreshVariantCard(row);
    this.updateVariantEditorResetButton(row);
    if (this._editingVariantId === variantId) {
      this.syncPlacementSlidersFromRow(row);
      this.syncPhotoControlsFromRow(row);
    }
  }

  frameSupportsPhotoControls(frame) {
    if (!frame) return false;
    if (window.StaticFrameCompose?.frameHasProductSlot) {
      return window.StaticFrameCompose.frameHasProductSlot(frame);
    }
    return (frame.dw > 0 || frame.baseDw > 0) && (frame.dh > 0 || frame.baseDh > 0);
  }

  ensurePhotoControlDefaults(frame) {
    if (!frame) return;
    if (window.StaticFrameCompose?.ensureFramePhotoDefaults) {
      window.StaticFrameCompose.ensureFramePhotoDefaults(frame);
      return;
    }
    if (frame.photoZoomPct == null) frame.photoZoomPct = 100;
    if (frame.photoPanH == null) frame.photoPanH = 50;
    if (frame.photoPanV == null) frame.photoPanV = 50;
    if (frame.photoZoomLocked == null) frame.photoZoomLocked = true;
    if (frame.photoPanHLocked == null) frame.photoPanHLocked = true;
    if (frame.photoPanVLocked == null) frame.photoPanVLocked = true;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const field = `photoMargin${side}`;
      const lockField = `${field}Locked`;
      if (frame[field] == null) frame[field] = 0;
      if (frame[lockField] == null) frame[lockField] = true;
    }
  }

  photoMarginSides() {
    return [
      { side: "top", label: "Top" },
      { side: "left", label: "Left" },
      { side: "right", label: "Right" },
      { side: "bottom", label: "Bottom" },
    ];
  }

  photoMarginField(side) {
    return `photoMargin${side.charAt(0).toUpperCase()}${side.slice(1)}`;
  }

  photoMarginLockField(side) {
    return `${this.photoMarginField(side)}Locked`;
  }

  syncPlacementSlidersFromRow(row) {
    const container = document.querySelector("#variant-edit-static-badges");
    if (!container || !row?.layers?._badgePlacements) return;

    for (const p of row.layers._badgePlacements) {
      if (!p?.id || p.posH == null || p.posV == null) continue;
      const hSlider = container.querySelector(`.static-pos-h[data-badge-id="${p.id}"]`);
      const vSlider = container.querySelector(`.static-pos-v[data-badge-id="${p.id}"]`);
      const hVal = container.querySelector(`.static-h-val[data-badge-id="${p.id}"]`);
      const vVal = container.querySelector(`.static-v-val[data-badge-id="${p.id}"]`);
      const posH = Math.round(p.posH);
      const posV = Math.round(p.posV);
      if (hSlider && document.activeElement !== hSlider) {
        hSlider.value = String(posH);
        if (hVal) hVal.textContent = String(posH);
      }
      if (vSlider && document.activeElement !== vSlider) {
        vSlider.value = String(posV);
        if (vVal) vVal.textContent = String(posV);
      }
    }
  }

  syncPhotoControlsFromRow(row) {
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const container = document.querySelector("#variant-edit-static-badges");
    if (!container) return;

    this.ensurePhotoControlDefaults(frame);
    const zoom = frame.photoZoomPct ?? 100;
    const panH = frame.photoPanH ?? 50;
    const panV = frame.photoPanV ?? 50;
    const zoomSlider = container.querySelector("#static-photo-zoom");
    const zoomVal = container.querySelector("#static-photo-zoom-val");
    const panHSlider = container.querySelector("#static-photo-pan-h");
    const panVSlider = container.querySelector("#static-photo-pan-v");
    const panHVal = container.querySelector("#static-photo-pan-h-val");
    const panVVal = container.querySelector("#static-photo-pan-v-val");

    if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = String(zoom);
    if (zoomVal && document.activeElement !== zoomSlider) zoomVal.textContent = String(zoom);
    if (panHSlider && document.activeElement !== panHSlider) panHSlider.value = String(panH);
    if (panVSlider && document.activeElement !== panVSlider) panVSlider.value = String(panV);
    if (panHVal && document.activeElement !== panHSlider) panHVal.textContent = String(panH);
    if (panVVal && document.activeElement !== panVSlider) panVVal.textContent = String(panV);
    for (const { side } of this.photoMarginSides()) {
      const field = this.photoMarginField(side);
      const slider = container.querySelector(`#static-photo-margin-${side}`);
      const val = container.querySelector(`#static-photo-margin-${side}-val`);
      const margin = frame[field] ?? 0;
      if (slider && document.activeElement !== slider) slider.value = String(margin);
      if (val && document.activeElement !== slider) val.textContent = String(margin);
    }
    this.updatePhotoControlsLockUI(container, frame);
  }

  async composeTextOverlayPreview(row) {
    if (typeof ImageGenerator === "undefined" || !row?.layers) return "";
    const overlays = ImageGenerator.normalizeTextOverlays(row.layers);
    const hasText = overlays.some(
      (o) => o.enabled !== false && String(o.text || "").trim(),
    );
    if (!hasText) return "";
    const baseUrl =
      row.imageUrl ||
      row.layers.full ||
      row.pricingImageUrl ||
      row.dataUrl ||
      row.layers.noStickers ||
      "";
    if (!baseUrl) return "";

    const quality =
      row.meta?.jpegQuality > 0 && row.meta?.jpegQuality <= 1
        ? row.meta.jpegQuality
        : 0.92;
    const border = Number(row.layers?._staticFrame?.border) || 0;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }
          ctx.drawImage(img, 0, 0);
          ImageGenerator.drawTextOverlays(ctx, canvas.width, canvas.height, border, overlays);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          console.warn("Text overlay preview failed:", e);
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = baseUrl;
    });
  }

  async applyRowStaticPreview(variantId, row = null) {
    const target = row || this.findResultRow(variantId);
    if (!target?.layers) return "";
    await this.preloadStaticComposeModule();
    if (window.StaticFrameCompose?.ensureVariantPlacementMeta) {
      try {
        await window.StaticFrameCompose.ensureVariantPlacementMeta(target);
      } catch (e) {
        console.warn("ensureVariantPlacementMeta failed:", e);
      }
    }
    if (!target.layers._staticFrame) {
      const textUrl = await this.composeTextOverlayPreview(target);
      if (textUrl) {
        this.applyStaticPreviewToRow(target, textUrl, variantId);
        return textUrl;
      }
      const fallback = this.resolveVariantPreviewSrc(target);
      if (fallback) this.applyStaticPreviewToRow(target, fallback, variantId);
      return fallback;
    }
    try {
      const url = await this.composePreviewForRow(target);
      if (url) {
        this.applyStaticPreviewToRow(target, url, variantId);
        return url;
      }
    } catch (e) {
      console.warn("Static preview compose failed:", e);
    }
    const fallback = this.resolveVariantPreviewSrc(target);
    if (fallback) {
      this.applyStaticPreviewToRow(target, fallback, variantId);
      return fallback;
    }
    return "";
  }

  async refreshStaticPreview(variantId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    const composeReady = await this.preloadStaticComposeModule();
    if (!composeReady) {
      console.warn("Static compose module unavailable — badge preview may not update");
    }

    const composeOpts = {
      ...this.getVariantComposeOptions(row, { preview: true }),
      staticAppearanceEdited: !!row._staticAppearanceEdited,
      badgesOnly: this.variantBadgesOnlyCompose(row),
    };

    const needsCompose =
      composeReady &&
      (row._staticAppearanceEdited ||
        row._badgesRepositioned ||
        window.StaticFrameCompose?.shouldRebuildStaticFrame?.(row.layers, {
          staticAppearanceEdited: !!row._staticAppearanceEdited,
        }) ||
        window.StaticFrameCompose?.needsStaticCompose?.(row));

    if (needsCompose && window.StaticFrameCompose?.composeStaticPreview) {
      try {
        const url = await this.composePreviewForRow(row, composeOpts);
        if (url) this.applyStaticPreviewToRow(row, url, variantId);
        return;
      } catch (e) {
        console.warn("Static preview compose failed:", e);
      }
    }

    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.resolveDisplayUrlAsync) {
      try {
        row.imageUrl = await MeeshoAPI.resolveDisplayUrlAsync(row);
      } catch (e) {
        row.imageUrl = MeeshoAPI.resolveDisplayUrl(row);
      }
    } else if (window.StaticFrameCompose?.composeStaticPreview) {
      const url = await this.composePreviewForRow(row, composeOpts);
      if (url) this.applyStaticPreviewToRow(row, url, variantId);
      return;
    }

    this.applyStaticPreviewToRow(row, row.imageUrl, variantId);
  }

  async setStaticBadgeAnchor(variantId, placementId, anchor) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementAnchor) return;

    const ok = window.StaticFrameCompose.updatePlacementAnchor(
      row.layers,
      placementId,
      anchor,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);
  }

  async setStaticPlacementSliders(variantId, placementId, posH, posV) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementSliders) return;

    const ok = window.StaticFrameCompose.updatePlacementSliders(
      row.layers,
      placementId,
      posH,
      posV,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);
  }

  async setStaticPlacementSliderAxis(variantId, placementId, axis, value, options = {}) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementSliderAxis) return;

    const ok = window.StaticFrameCompose.updatePlacementSliderAxis(
      row.layers,
      placementId,
      axis,
      value,
      options,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.refreshStaticPreview(variantId);

    if (options.autoLock && this._editingVariantId === variantId) {
      const container = document.querySelector("#variant-edit-static-badges");
      if (container) {
        this.updatePlacementAxisLockUI(container, placementId, row.layers);
      }
    }
  }

  toggleStaticPlacementAxisLock(variantId, placementId, axis) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const p = (row.layers._badgePlacements || []).find((b) => b.id === placementId);
    if (!p) return;

    const locked = axis === "h" ? p.lockH !== false : p.lockV !== false;
    if (window.StaticFrameCompose?.setPlacementAxisLock) {
      window.StaticFrameCompose.setPlacementAxisLock(
        row.layers,
        placementId,
        axis,
        !locked,
      );
    } else {
      if (axis === "h") p.lockH = !locked;
      else p.lockV = !locked;
    }

    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePlacementAxisLockUI(container, placementId, row.layers);
  }

  updatePlacementAxisLockUI(container, placementId, layers) {
    const p = (layers?._badgePlacements || []).find((b) => b.id === placementId);
    if (!p || !container) return;

    const lockH = p.lockH !== false;
    const lockV = p.lockV !== false;
    const hLockBtn = container.querySelector(
      `.static-axis-lock[data-axis="h"][data-badge-id="${placementId}"]`,
    );
    const vLockBtn = container.querySelector(
      `.static-axis-lock[data-axis="v"][data-badge-id="${placementId}"]`,
    );
    const hSlider = container.querySelector(`.static-pos-h[data-badge-id="${placementId}"]`);
    const vSlider = container.querySelector(`.static-pos-v[data-badge-id="${placementId}"]`);
    const hWrap = container.querySelector(`.static-pos-h-wrap[data-badge-id="${placementId}"]`);
    const vWrap = container.querySelector(`.static-pos-v-wrap[data-badge-id="${placementId}"]`);

    if (hLockBtn) {
      hLockBtn.textContent = lockH ? "🔒" : "🔓";
      hLockBtn.title = lockH
        ? "Unlock horizontal to adjust"
        : "Lock horizontal position";
      hLockBtn.setAttribute("aria-pressed", lockH ? "true" : "false");
    }
    if (vLockBtn) {
      vLockBtn.textContent = lockV ? "🔒" : "🔓";
      vLockBtn.title = lockV
        ? "Unlock vertical to adjust"
        : "Lock vertical position";
      vLockBtn.setAttribute("aria-pressed", lockV ? "true" : "false");
    }
    if (hSlider) hSlider.disabled = lockH;
    if (vSlider) vSlider.disabled = lockV;
    if (hWrap) hWrap.classList.toggle("static-slider-locked", lockH);
    if (vWrap) vWrap.classList.toggle("static-slider-locked", lockV);
  }

  toggleStaticPlacementSizeLock(variantId, placementId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    const p = (row.layers._badgePlacements || []).find((b) => b.id === placementId);
    if (!p) return;

    const locked = p.lockSize !== false;
    if (window.StaticFrameCompose?.setPlacementSizeLock) {
      window.StaticFrameCompose.setPlacementSizeLock(
        row.layers,
        placementId,
        !locked,
      );
    } else {
      p.lockSize = !locked;
    }

    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePlacementSizeLockUI(container, placementId, row.layers);
  }

  updatePlacementSizeLockUI(container, placementId, layers) {
    const p = (layers?._badgePlacements || []).find((b) => b.id === placementId);
    if (!p || !container) return;

    const lockSize = p.lockSize !== false;
    const lockBtn = container.querySelector(
      `.static-size-lock[data-badge-id="${placementId}"]`,
    );
    const slider = container.querySelector(`.static-size-pct[data-badge-id="${placementId}"]`);
    const wrap = container.querySelector(`.static-size-wrap[data-badge-id="${placementId}"]`);

    if (lockBtn) {
      lockBtn.textContent = lockSize ? "🔒" : "🔓";
      lockBtn.title = lockSize
        ? "Unlock size to adjust"
        : "Lock badge size";
      lockBtn.setAttribute("aria-pressed", lockSize ? "true" : "false");
    }
    if (slider) slider.disabled = lockSize;
    if (wrap) wrap.classList.toggle("static-slider-locked", lockSize);
  }

  async setStaticBadgeNum(variantId, placementId, badgeNum) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.updatePlacementBadge) return;

    const ok = window.StaticFrameCompose.updatePlacementBadge(
      row.layers,
      placementId,
      badgeNum,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.applyRowStaticPreview(variantId, row);
    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    }
  }

  async setStaticPlacementHidden(variantId, placementId, hidden) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.setPlacementHidden) return;

    const ok = window.StaticFrameCompose.setPlacementHidden(
      row.layers,
      placementId,
      hidden,
    );
    if (!ok) return;

    row._badgesRepositioned = true;
    await this.applyRowStaticPreview(variantId, row);
  }

  async setStaticAllStickersHidden(variantId, hidden) {
    const row = this.findResultRow(variantId);
    if (!row?.layers) return;

    await this.preloadStaticComposeModule();
    if (!window.StaticFrameCompose?.setAllPlacementsHidden) return;

    window.StaticFrameCompose.setAllPlacementsHidden(row.layers, hidden);
    row._badgesRepositioned = true;
    await this.applyRowStaticPreview(variantId, row);

    if (this._editingVariantId === variantId) {
      this.renderVariantEditorPanel(row);
    }
  }

  async setStaticFrameColors(variantId, patch) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    const SFC = window.StaticFrameCompose;
    if (!SFC?.updateFrameAppearance) return;

    const frame = row.layers._staticFrame;
    const hadGownGradient =
      frame.style === "gown_static" &&
      SFC.staticStyleUsesGradientColors?.(frame.style, frame);

    SFC.updateFrameAppearance(row.layers, patch);
    row._staticAppearanceEdited = true;

    const hasGownGradient =
      frame.style === "gown_static" &&
      SFC.staticStyleUsesGradientColors?.(frame.style, frame);

    await this.applyRowStaticPreview(variantId, row);

    if (hadGownGradient !== hasGownGradient && this._editingVariantId === variantId) {
      this._staticControlsVariantId = null;
      this.renderVariantEditorPanel(row);
    }
  }

  updateFillMatUI(container, frame) {
    if (!container || !frame) return;
    const enabled = frame.fillMatEnabled !== false;
    const checkbox = container.querySelector("#static-fill-mat-enabled");
    const wrap = container.querySelector(".static-fill-mat-wrap");
    if (checkbox) checkbox.checked = enabled;
    if (wrap) wrap.classList.toggle("static-fill-mat-disabled", !enabled);
    wrap?.querySelectorAll(".static-color-row button, .static-color-row input").forEach((el) => {
      el.disabled = !enabled;
    });
  }

  updatePhotoMarginFillUI(container, frame) {
    if (!container || !frame) return;
    const enabled = frame.photoMarginFillEnabled !== false;
    const checkbox = container.querySelector("#static-photo-margin-fill-enabled");
    const wrap = container.querySelector(".static-photo-margin-fill-wrap");
    if (checkbox) checkbox.checked = enabled;
    if (wrap) wrap.classList.toggle("static-photo-margin-fill-disabled", !enabled);
    wrap?.querySelectorAll(".static-color-row button, .static-color-row input").forEach((el) => {
      el.disabled = !enabled;
    });
  }

  async setStaticFillMatEnabled(variantId, enabled) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.setStaticFrameColors(variantId, { fillMatEnabled: !!enabled });

    if (this._editingVariantId === variantId) {
      const container = document.querySelector("#variant-edit-static-badges");
      if (container) this.updateFillMatUI(container, row.layers._staticFrame);
    }
  }

  updateBorderThicknessLockUI(container, frame) {
    if (!container || !frame) return;
    const locked = frame.borderThicknessLocked !== false;
    const btn = container.querySelector("#static-border-lock");
    const slider = container.querySelector("#static-border-thickness");
    const wrap = container.querySelector(".static-border-wrap");
    if (btn) {
      btn.textContent = locked ? "🔒" : "🔓";
      btn.title = locked
        ? "Unlock border thickness to adjust"
        : "Lock border thickness";
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
    }
    if (slider) slider.disabled = locked;
    if (wrap) wrap.classList.toggle("static-slider-locked", locked);
  }

  toggleStaticBorderThicknessLock(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame) return;
    const locked = frame.borderThicknessLocked !== false;
    frame.borderThicknessLocked = !locked;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updateBorderThicknessLockUI(container, frame);
  }

  queueStaticBorderThickness(variantId, pct) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;
    if (row.layers._staticFrame.borderThicknessLocked !== false) return;

    const panel = document.getElementById("variant-edit-static-badges");
    const val = panel?.querySelector("#static-border-thickness-val");
    if (val) val.textContent = String(pct);

    clearTimeout(this._borderThicknessTimer);
    this._borderThicknessTimer = setTimeout(() => {
      void this.applyStaticBorderThickness(variantId, pct);
    }, 50);
  }

  async applyStaticBorderThickness(variantId, pct) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;
    if (row.layers._staticFrame.borderThicknessLocked !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    window.StaticFrameCompose.updateFrameAppearance(row.layers, {
      borderThicknessPct: pct,
    });
    if (window.StaticFrameCompose.reanchorPlacements) {
      window.StaticFrameCompose.reanchorPlacements(row.layers);
    }
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Border thickness preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async setStaticBorderThickness(variantId, pct) {
    clearTimeout(this._borderThicknessTimer);
    await this.applyStaticBorderThickness(variantId, pct);
  }

  updateGownFrameLayersLockUI(container, frame) {
    if (!container || !frame) return;
    const locked = frame.gownFrameLayersLocked !== false;
    const btn = container.querySelector("#static-gown-layers-lock");
    const wrap = container.querySelector(".static-gown-layers-wrap");
    if (btn) {
      btn.textContent = locked ? "🔒" : "🔓";
      btn.title = locked ? "Unlock frame layers to adjust" : "Lock frame layers";
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
    }
    if (wrap) wrap.classList.toggle("static-slider-locked", locked);
    container.querySelectorAll(".static-gown-layer-pct").forEach((slider) => {
      slider.disabled = locked;
    });
  }

  toggleStaticGownFrameLayersLock(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame || frame.style !== "gown_static") return;
    frame.gownFrameLayersLocked = frame.gownFrameLayersLocked === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updateGownFrameLayersLockUI(container, frame);
  }

  queueStaticGownLayerPct(variantId, layerKey, pct) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame || frame.style !== "gown_static") return;
    if (frame.gownFrameLayersLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(
      `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
    );
    if (val) val.textContent = String(pct);

    clearTimeout(this._gownLayerTimer);
    this._gownLayerTimer = setTimeout(() => {
      void this.applyStaticGownLayerPcts(variantId);
    }, 50);
  }

  readGownLayerPctFromUI(container) {
    const patch = {};
    container?.querySelectorAll(".static-gown-layer-pct").forEach((slider) => {
      const key = slider.dataset.gownLayer;
      if (!key) return;
      patch[key] = parseInt(slider.value, 10);
    });
    return patch;
  }

  async applyStaticGownLayerPcts(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!frame || frame.style !== "gown_static") return;
    if (frame.gownFrameLayersLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const gownLayerPct = this.readGownLayerPctFromUI(container);
    if (!Object.keys(gownLayerPct).length) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    window.StaticFrameCompose.updateFrameAppearance(row.layers, { gownLayerPct });
    if (window.StaticFrameCompose.reanchorPlacements) {
      window.StaticFrameCompose.reanchorPlacements(row.layers);
    }
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Gown frame layer preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async applyStaticGownLayerPct(variantId, layerKey, pct) {
    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(
      `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
    );
    if (val) val.textContent = String(pct);
    clearTimeout(this._gownLayerTimer);
    await this.applyStaticGownLayerPcts(variantId);
  }

  async setStaticGownLayerPct(variantId, layerKey, pct) {
    clearTimeout(this._gownLayerTimer);
    await this.applyStaticGownLayerPct(variantId, layerKey, pct);
  }

  updatePhotoControlsLockUI(container, frame) {
    if (!container || !frame) return;
    const zoomLocked = frame.photoZoomLocked !== false;
    const panHLocked = frame.photoPanHLocked !== false;
    const panVLocked = frame.photoPanVLocked !== false;
    const zoomBtn = container.querySelector("#static-photo-zoom-lock");
    const zoomSlider = container.querySelector("#static-photo-zoom");
    const panHBtn = container.querySelector("#static-photo-pan-h-lock");
    const panVBtn = container.querySelector("#static-photo-pan-v-lock");
    const panHSlider = container.querySelector("#static-photo-pan-h");
    const panVSlider = container.querySelector("#static-photo-pan-v");
    const zoomWrap = container.querySelector(".static-photo-zoom-wrap");
    const panHWrap = container.querySelector(".static-photo-pan-h-wrap");
    const panVWrap = container.querySelector(".static-photo-pan-v-wrap");

    if (zoomBtn) {
      zoomBtn.textContent = zoomLocked ? "🔒" : "🔓";
      zoomBtn.title = zoomLocked ? "Unlock photo zoom to adjust" : "Lock photo zoom";
      zoomBtn.setAttribute("aria-pressed", zoomLocked ? "true" : "false");
    }
    if (panHBtn) {
      panHBtn.textContent = panHLocked ? "🔒" : "🔓";
      panHBtn.title = panHLocked ? "Unlock horizontal pan to adjust" : "Lock horizontal pan";
      panHBtn.setAttribute("aria-pressed", panHLocked ? "true" : "false");
    }
    if (panVBtn) {
      panVBtn.textContent = panVLocked ? "🔒" : "🔓";
      panVBtn.title = panVLocked ? "Unlock vertical pan to adjust" : "Lock vertical pan";
      panVBtn.setAttribute("aria-pressed", panVLocked ? "true" : "false");
    }
    if (zoomSlider) zoomSlider.disabled = zoomLocked;
    if (panHSlider) panHSlider.disabled = panHLocked;
    if (panVSlider) panVSlider.disabled = panVLocked;
    if (zoomWrap) zoomWrap.classList.toggle("static-slider-locked", zoomLocked);
    if (panHWrap) panHWrap.classList.toggle("static-slider-locked", panHLocked);
    if (panVWrap) panVWrap.classList.toggle("static-slider-locked", panVLocked);

    for (const { side, label } of this.photoMarginSides()) {
      const lockField = this.photoMarginLockField(side);
      const locked = frame[lockField] !== false;
      const btn = container.querySelector(`#static-photo-margin-${side}-lock`);
      const slider = container.querySelector(`#static-photo-margin-${side}`);
      const wrap = container.querySelector(`.static-photo-margin-${side}-wrap`);
      if (btn) {
        btn.textContent = locked ? "🔒" : "🔓";
        btn.title = locked
          ? `Unlock ${label.toLowerCase()} margin to adjust`
          : `Lock ${label.toLowerCase()} margin`;
        btn.setAttribute("aria-pressed", locked ? "true" : "false");
      }
      if (slider) slider.disabled = locked;
      if (wrap) wrap.classList.toggle("static-slider-locked", locked);
    }
  }

  toggleStaticPhotoZoomLock(variantId) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    frame.photoZoomLocked = frame.photoZoomLocked === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePhotoControlsLockUI(container, frame);
  }

  toggleStaticPhotoPanLock(variantId, axis) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (axis === "h") frame.photoPanHLocked = frame.photoPanHLocked === false;
    else if (axis === "v") frame.photoPanVLocked = frame.photoPanVLocked === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePhotoControlsLockUI(container, frame);
  }

  toggleStaticPhotoMarginLock(variantId, side) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const lockField = this.photoMarginLockField(side);
    frame[lockField] = frame[lockField] === false;
    const container = document.querySelector("#variant-edit-static-badges");
    if (container) this.updatePhotoControlsLockUI(container, frame);
  }

  queueStaticPhotoZoom(variantId, zoomPct) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (frame.photoZoomLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector("#static-photo-zoom-val");
    if (val) val.textContent = String(zoomPct);

    clearTimeout(this._gownPhotoZoomTimer);
    this._gownPhotoZoomTimer = setTimeout(() => {
      void this.applyStaticPhotoZoom(variantId, zoomPct);
    }, 50);
  }

  async applyStaticPhotoZoom(variantId, zoomPct) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (frame.photoZoomLocked !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    window.StaticFrameCompose.updateFrameAppearance(row.layers, { photoZoomPct: zoomPct });
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Photo zoom preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  queueStaticPhotoPan(variantId, axis, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (axis === "h" && frame.photoPanHLocked !== false) return;
    if (axis === "v" && frame.photoPanVLocked !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(
      axis === "h" ? "#static-photo-pan-h-val" : "#static-photo-pan-v-val",
    );
    if (val) val.textContent = String(value);

    clearTimeout(this._gownPhotoPanTimer);
    this._gownPhotoPanTimer = setTimeout(() => {
      void this.applyStaticPhotoPan(variantId, axis, value);
    }, 50);
  }

  async applyStaticPhotoPan(variantId, axis, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    if (axis === "h" && frame.photoPanHLocked !== false) return;
    if (axis === "v" && frame.photoPanVLocked !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    const patch = axis === "h" ? { photoPanH: value } : { photoPanV: value };
    window.StaticFrameCompose.updateFrameAppearance(row.layers, patch);
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Photo pan preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async setStaticPhotoPan(variantId, axis, value) {
    clearTimeout(this._gownPhotoPanTimer);
    await this.applyStaticPhotoPan(variantId, axis, value);
  }

  queueStaticPhotoMargin(variantId, side, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const lockField = this.photoMarginLockField(side);
    if (frame[lockField] !== false) return;

    const container = document.querySelector("#variant-edit-static-badges");
    const val = container?.querySelector(`#static-photo-margin-${side}-val`);
    if (val) val.textContent = String(value);

    clearTimeout(this._gownPhotoMarginTimer);
    this._gownPhotoMarginTimer = setTimeout(() => {
      void this.applyStaticPhotoMargin(variantId, side, value);
    }, 50);
  }

  async applyStaticPhotoMargin(variantId, side, value) {
    const row = this.findResultRow(variantId);
    const frame = row?.layers?._staticFrame;
    if (!this.frameSupportsPhotoControls(frame)) return;
    const lockField = this.photoMarginLockField(side);
    if (frame[lockField] !== false) return;

    const loaded = await this.preloadStaticComposeModule();
    if (!loaded || !window.StaticFrameCompose?.updateFrameAppearance) return;

    const field = this.photoMarginField(side);
    window.StaticFrameCompose.updateFrameAppearance(row.layers, { [field]: value });
    if (window.StaticFrameCompose.reanchorPlacements) {
      window.StaticFrameCompose.reanchorPlacements(row.layers);
    }
    row._staticAppearanceEdited = true;

    try {
      await this.applyRowStaticPreview(variantId, row);
    } catch (e) {
      console.warn("Photo margin preview failed:", e);
      await this.refreshStaticPreview(variantId);
    }
  }

  async setStaticPhotoMargin(variantId, side, value) {
    clearTimeout(this._gownPhotoMarginTimer);
    await this.applyStaticPhotoMargin(variantId, side, value);
  }

  async setStaticPhotoZoom(variantId, zoomPct) {
    clearTimeout(this._gownPhotoZoomTimer);
    await this.applyStaticPhotoZoom(variantId, zoomPct);
  }

  async setStaticGradientPreset(variantId, presetId) {
    const row = this.findResultRow(variantId);
    if (!row?.layers?._staticFrame) return;

    await this.preloadStaticComposeModule();
    const SFC = window.StaticFrameCompose;
    if (!SFC) return;

    if (presetId) {
      if (!SFC.applyGradientPreset) return;
      SFC.applyGradientPreset(row.layers, presetId);
    } else {
      if (!SFC.clearGradientPreset) return;
      SFC.clearGradientPreset(row.layers);
    }
    row._staticAppearanceEdited = true;
    await this.applyRowStaticPreview(variantId, row);

    if (this._editingVariantId === variantId) {
      this._staticControlsVariantId = null;
      this.renderVariantEditorPanel(row);
    }
  }

  clearUploadedImage() {
    this.resetToUploadForm({ keepImage: false });
  }

  wireClearUploadButton() {
    const btn = document.getElementById("clear-upload-btn");
    if (!btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearUploadedImage();
    };
  }

  buildStaticColorFieldHtml(id, label, colorValue, fallback = "#000000") {
    const SFC = window.StaticFrameCompose;
    const hex = SFC?.normalizeFrameColor?.(colorValue, fallback) || fallback;
    const swatches = SFC?.FRAME_COLOR_SWATCHES || [];
    const chips = swatches
      .map((s) => {
        const chipHex = SFC?.normalizeFrameColor?.(s.hex) || s.hex;
        const active = chipHex === hex;
        return `<button type="button" class="static-color-chip" data-color-id="${id}" data-hex="${chipHex}" title="${s.label} (${chipHex})" aria-label="${s.label}" style="width:30px;height:30px;border-radius:50%;border:2px solid ${active ? "#111827" : "#e5e7eb"};background:${chipHex};padding:0;cursor:pointer;flex-shrink:0;box-shadow:${active ? "0 0 0 2px #fff inset" : "none"};"></button>`;
      })
      .join("");
    return `<div class="static-color-row" data-color-id="${id}" style="margin-bottom:10px;padding:8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;min-width:72px;">${label}</span>
        <button type="button" class="static-color-swatch-btn" data-color-id="${id}" aria-label="Pick ${label} colour" title="Pick colour" style="width:40px;height:40px;border-radius:6px;border:1px solid #d1d5db;background:${hex};padding:0;cursor:pointer;flex-shrink:0;"></button>
        <label style="flex:1;font-size:10px;color:#4b5563;display:flex;flex-direction:column;gap:3px;">HEX
          <input type="text" class="static-color-hex-input" id="${id}-hex" value="${hex}" placeholder="#fff000" maxlength="7" spellcheck="false" autocomplete="off" style="width:100%;padding:8px;font-size:13px;font-family:monospace;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
        </label>
      </div>
      <div class="static-color-presets" style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
    </div>`;
  }

  hslToHex(h, s, l) {
    const SFC = window.StaticFrameCompose;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const hex = SFC?.rgbToHex?.(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    );
    return SFC?.normalizeFrameColor?.(hex) || hex;
  }

  hexToHsl(hex) {
    const SFC = window.StaticFrameCompose;
    const rgb = SFC?.hexToRgb?.(hex);
    if (!rgb) return { h: 0, s: 0, l: 50 };
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  ensureStaticColorPickerOverlay() {
    let overlay = document.getElementById("static-color-picker-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "static-color-picker-overlay";
    overlay.style.cssText =
      "display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:16px;";
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;max-width:360px;width:100%;padding:16px;box-shadow:0 20px 40px rgba(0,0,0,.25);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="font-size:15px;">Select colour</strong>
          <button type="button" id="static-color-picker-close" style="border:none;background:#f3f4f6;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span id="static-color-picker-preview" style="width:48px;height:48px;border-radius:8px;border:1px solid #d1d5db;background:#71cbd3;flex-shrink:0;"></span>
          <label style="flex:1;font-size:11px;color:#4b5563;display:flex;flex-direction:column;gap:4px;">HEX
            <input type="text" id="static-color-picker-hex" maxlength="7" spellcheck="false" autocomplete="off" style="width:100%;padding:10px;font-size:14px;font-family:monospace;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;">
          </label>
        </div>
        <label style="display:block;font-size:11px;color:#4b5563;margin-bottom:4px;">Hue
          <input type="range" id="static-color-picker-hue" min="0" max="360" value="180" style="width:100%;height:28px;margin-top:4px;background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);">
        </label>
        <label style="display:block;font-size:11px;color:#4b5563;margin:8px 0 4px;">Saturation
          <input type="range" id="static-color-picker-sat" min="0" max="100" value="50" style="width:100%;height:28px;margin-top:4px;">
        </label>
        <label style="display:block;font-size:11px;color:#4b5563;margin:8px 0 4px;">Brightness
          <input type="range" id="static-color-picker-val" min="0" max="100" value="50" style="width:100%;height:28px;margin-top:4px;background:linear-gradient(to right,#000,#fff);">
        </label>
        <div style="font-size:11px;color:#6b7280;margin:10px 0 6px;">Suggestions</div>
        <div id="static-color-picker-swatches" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" id="static-color-picker-cancel" style="padding:8px 14px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;">Cancel</button>
          <button type="button" id="static-color-picker-set" style="padding:8px 14px;border:none;border-radius:8px;background:#10b981;color:#fff;font-weight:600;cursor:pointer;">Set</button>
        </div>
      </div>`;
    this.mountOptimizerOverlay(overlay);
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    };
    overlay.querySelector("#static-color-picker-close").onclick = () => {
      overlay.style.display = "none";
    };
    overlay.querySelector("#static-color-picker-cancel").onclick = () => {
      overlay.style.display = "none";
    };
    return overlay;
  }

  openStaticColorPicker(container, fieldId, variantId) {
    const SFC = window.StaticFrameCompose;
    if (!SFC || !container) return;
    const overlay = this.ensureStaticColorPickerOverlay();
    const hexField = container.querySelector(`#${fieldId}-hex`);
    const startHex =
      SFC.normalizeFrameColor(hexField?.value) ||
      SFC.normalizeFrameColor(
        container.querySelector(`.static-color-swatch-btn[data-color-id="${fieldId}"]`)?.style
          .backgroundColor,
      ) ||
      "#71cbd3";
    const { h, s, l } = this.hexToHsl(startHex);
    const hue = overlay.querySelector("#static-color-picker-hue");
    const sat = overlay.querySelector("#static-color-picker-sat");
    const val = overlay.querySelector("#static-color-picker-val");
    const hexInput = overlay.querySelector("#static-color-picker-hex");
    const preview = overlay.querySelector("#static-color-picker-preview");
    const swatchWrap = overlay.querySelector("#static-color-picker-swatches");

    const updateSatBg = (hexColor) => {
      const hsl = this.hexToHsl(hexColor);
      sat.style.background = `linear-gradient(to right,#808080,hsl(${hsl.h},100%,50%))`;
    };

    const syncFromHsl = () => {
      const hex = this.hslToHex(
        parseInt(hue.value, 10),
        parseInt(sat.value, 10),
        parseInt(val.value, 10),
      );
      if (!hex) return;
      if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;
      if (preview) preview.style.background = hex;
      updateSatBg(hex);
    };

    const syncFromHex = () => {
      let raw = hexInput.value.trim();
      if (!raw) return;
      if (!raw.startsWith("#")) raw = `#${raw}`;
      const hex = SFC.normalizeFrameColor(raw);
      if (!hex) return;
      const hsl = this.hexToHsl(hex);
      hue.value = String(hsl.h);
      sat.value = String(hsl.s);
      val.value = String(hsl.l);
      if (preview) preview.style.background = hex;
      updateSatBg(hex);
    };

    hue.value = String(h);
    sat.value = String(s);
    val.value = String(l);
    if (hexInput) hexInput.value = startHex;
    if (preview) preview.style.background = startHex;
    updateSatBg(startHex);

    if (swatchWrap) {
      swatchWrap.innerHTML = (SFC.FRAME_COLOR_SWATCHES || [])
        .map((sw) => {
          const chipHex = SFC.normalizeFrameColor(sw.hex) || sw.hex;
          return `<button type="button" class="static-color-picker-chip" data-hex="${chipHex}" title="${sw.label}" style="width:32px;height:32px;border-radius:50%;border:2px solid #e5e7eb;background:${chipHex};padding:0;cursor:pointer;"></button>`;
        })
        .join("");
      swatchWrap.querySelectorAll(".static-color-picker-chip").forEach((chip) => {
        chip.onclick = () => {
          const hex = SFC.normalizeFrameColor(chip.dataset.hex);
          if (!hex) return;
          hexInput.value = hex;
          syncFromHex();
        };
      });
    }

    hue.oninput = syncFromHsl;
    sat.oninput = syncFromHsl;
    val.oninput = syncFromHsl;
    hexInput.oninput = () => {
      clearTimeout(this._colorPickerHexTimer);
      this._colorPickerHexTimer = setTimeout(syncFromHex, 120);
    };
    hexInput.onchange = syncFromHex;

    overlay.querySelector("#static-color-picker-set").onclick = () => {
      const hex = SFC.normalizeFrameColor(hexInput.value);
      if (!hex) return;
      this.updateStaticColorRowDisplay(container, fieldId, hex);
      const customApply = container._staticColorPickerOnApply;
      if (typeof customApply === "function") {
        customApply(hex, fieldId);
      } else {
        const cfg = this.getStaticColorFieldConfig(fieldId, container);
        if (cfg) {
          const patch = { [cfg.patchKey]: hex, gradientPreset: null };
          if (cfg.frameType) patch.frameType = cfg.frameType;
          void this.setStaticFrameColors(variantId, patch);
        }
      }
      overlay.style.display = "none";
    };

    overlay.style.display = "flex";
  }

  getStaticColorFieldConfig(fieldId, container) {
    const style = container?.dataset?.editorStyle || "";
    const map = {
      "static-color-top": { patchKey: "gradientTop", frameType: "gradient" },
      "static-color-bottom": { patchKey: "gradientBottom", frameType: "gradient" },
      "static-color-border": {
        patchKey: "borderColor",
        frameType: style === "lifestyle_promo" ? "solid" : undefined,
      },
      "static-color-mat": { patchKey: "matColor" },
      "static-color-outer-mat": { patchKey: "outerMatColor" },
      "static-color-inner-accent": { patchKey: "innerStrokeColor" },
      "static-color-fill-mat": { patchKey: "fillMatColor" },
      "static-color-pad": { patchKey: "padColor" },
      "static-color-margin-fill": { patchKey: "photoMarginFillColor" },
    };
    return map[fieldId] || null;
  }

  updateStaticColorRowDisplay(container, id, hex) {
    const SFC = window.StaticFrameCompose;
    if (!SFC || !hex) return;
    const hexField = container.querySelector(`#${id}-hex`);
    const swatchBtn = container.querySelector(
      `.static-color-swatch-btn[data-color-id="${id}"]`,
    );
    if (swatchBtn) swatchBtn.style.background = hex;
    if (hexField && document.activeElement !== hexField) hexField.value = hex;
    container.querySelectorAll(`.static-color-chip[data-color-id="${id}"]`).forEach((chip) => {
      const chipHex = SFC.normalizeFrameColor(chip.dataset.hex);
      const active = chipHex === hex;
      chip.style.borderColor = active ? "#111827" : "#e5e7eb";
      chip.style.boxShadow = active ? "0 0 0 2px #fff inset" : "none";
    });
  }

  syncStaticColorRowFromHex(container, id) {
    const SFC = window.StaticFrameCompose;
    const hexField = container.querySelector(`#${id}-hex`);
    if (!hexField || !SFC) return false;
    let raw = hexField.value.trim();
    if (!raw) return false;
    if (!raw.startsWith("#")) raw = `#${raw}`;
    const hex = SFC.normalizeFrameColor(raw);
    if (!hex) return false;
    this.updateStaticColorRowDisplay(container, id, hex);
    return true;
  }

  readStaticColorField(container, id) {
    const SFC = window.StaticFrameCompose;
    if (!SFC) return null;
    const hexField = container.querySelector(`#${id}-hex`);
    if (hexField?.value?.trim()) {
      let raw = hexField.value.trim();
      if (!raw.startsWith("#")) raw = `#${raw}`;
      const fromHex = SFC.normalizeFrameColor(raw);
      if (fromHex) return fromHex;
    }
    const swatchBtn = container.querySelector(`.static-color-swatch-btn[data-color-id="${id}"]`);
    if (swatchBtn?.style?.backgroundColor) {
      return SFC.normalizeFrameColor(swatchBtn.style.backgroundColor);
    }
    return null;
  }

  syncStaticColorRowFromRgb(container, id) {
    return false;
  }

  syncStaticColorRowFromRgbText(container, id) {
    return false;
  }

  bindStaticColorFields(container, { variantId, style }) {
    container.dataset.editorStyle = style || "";
    const colorMap = {
      "static-color-top": { patchKey: "gradientTop", frameType: "gradient" },
      "static-color-bottom": { patchKey: "gradientBottom", frameType: "gradient" },
      "static-color-border": {
        patchKey: "borderColor",
        frameType: style === "lifestyle_promo" ? "solid" : undefined,
      },
      "static-color-mat": { patchKey: "matColor" },
      "static-color-outer-mat": { patchKey: "outerMatColor" },
      "static-color-inner-accent": { patchKey: "innerStrokeColor" },
      "static-color-fill-mat": { patchKey: "fillMatColor" },
      "static-color-pad": { patchKey: "padColor" },
      "static-color-margin-fill": { patchKey: "photoMarginFillColor" },
    };

    const applyOneColor = (id) => {
      const cfg = colorMap[id];
      if (!cfg || !container.querySelector(`#${id}-hex`)) return;
      const hex = this.readStaticColorField(container, id);
      if (!hex) return;
      const patch = { [cfg.patchKey]: hex, gradientPreset: null };
      if (cfg.frameType) patch.frameType = cfg.frameType;
      const presetSel = container.querySelector("#static-gradient-preset");
      if (presetSel) presetSel.value = "";
      void this.setStaticFrameColors(variantId, patch);
    };

    const timers = new Map();
    for (const id of Object.keys(colorMap)) {
      if (!container.querySelector(`#${id}-hex`)) continue;

      const swatchBtn = container.querySelector(`.static-color-swatch-btn[data-color-id="${id}"]`);
      if (swatchBtn) {
        swatchBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openStaticColorPicker(container, id, variantId);
        };
      }

      const hexField = container.querySelector(`#${id}-hex`);
      if (hexField) {
        hexField.oninput = () => {
          clearTimeout(timers.get(hexField));
          timers.set(
            hexField,
            setTimeout(() => {
              if (this.syncStaticColorRowFromHex(container, id)) applyOneColor(id);
            }, 220),
          );
        };
        hexField.onchange = () => {
          clearTimeout(timers.get(hexField));
          if (this.syncStaticColorRowFromHex(container, id)) applyOneColor(id);
        };
      }
    }

    container.querySelectorAll(".static-color-chip").forEach((chip) => {
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fieldId = chip.dataset.colorId;
        const hex = window.StaticFrameCompose?.normalizeFrameColor?.(chip.dataset.hex);
        if (!fieldId || !hex) return;
        this.updateStaticColorRowDisplay(container, fieldId, hex);
        applyOneColor(fieldId);
      };
    });
  }

  normalizeTextOverlaysOnLayers(layers) {
    if (!layers) return [];
    if (typeof ImageGenerator !== "undefined" && ImageGenerator.normalizeTextOverlays) {
      return ImageGenerator.normalizeTextOverlays(layers);
    }
    const legacy = String(layers._customText || "").trim();
    if (!legacy) return [];
    return [
      {
        id: "text-1",
        text: legacy,
        position: layers._customTextPosition || "bottom",
        posH: undefined,
        posV: undefined,
        textColor: layers._customTextColor || "#ffffff",
        bgColor: layers._customTextBg || "#e67e22",
        fontSizePct: 100,
        enabled: true,
      },
    ];
  }

  captureTextOverlayDefaults(row) {
    if (!row?.layers || row.layers._textOverlaysDefaults !== undefined) return;
    const overlays = this.normalizeTextOverlaysOnLayers(row.layers);
    row.layers._textOverlaysDefaults = JSON.parse(JSON.stringify(overlays));
  }

  ensureTextOverlayState(row) {
    if (!row?.layers) return [];
    const overlays = this.normalizeTextOverlaysOnLayers(row.layers);
    row.layers._textOverlays = overlays;
    if (typeof ImageGenerator !== "undefined" && ImageGenerator.syncLegacyTextFields) {
      ImageGenerator.syncLegacyTextFields(row.layers, overlays);
    }
    return overlays;
  }

  textOverlaysChanged(row) {
    if (!row?.layers) return false;
    const normalize =
      typeof ImageGenerator !== "undefined" && ImageGenerator.normalizeTextOverlay
        ? (o, i) => ImageGenerator.normalizeTextOverlay(o, i)
        : (o) => o;
    const current = JSON.stringify(
      this.normalizeTextOverlaysOnLayers(row.layers).map(normalize),
    );
    const defaults = JSON.stringify(
      (row.layers._textOverlaysDefaults || []).map(normalize),
    );
    return current !== defaults;
  }

  scheduleTextOverlayPreview(variantId, delayMs = 180) {
    clearTimeout(this._textOverlayPreviewTimer);
    this._textOverlayPreviewTimer = setTimeout(() => {
      void this.applyRowStaticPreview(variantId);
    }, delayMs);
  }

  renderVariantTextControls(row, container) {
    if (!container || !row?.layers) return;
    const overlays = this.ensureTextOverlayState(row);

    let html = `<details class="variant-text-accordion" open style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;background:#fafafa;">
      <summary style="font-size:12px;font-weight:700;color:#374151;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;">
        <span>✏️ Text on image</span>
        <span style="font-size:10px;color:#6b7280;font-weight:500;">${overlays.length} layer${overlays.length === 1 ? "" : "s"}</span>
      </summary>
      <p style="font-size:10px;color:#6b7280;margin:8px 0;line-height:1.4;">Add promo text (e.g. FREE SHIPPING). Unlock position sliders to move text. Changes update preview only — shipping ₹ stays the same.</p>
      <div id="variant-text-list">`;

    if (!overlays.length) {
      html += `<p style="font-size:11px;color:#9ca3af;margin:0 0 8px;">No text yet — tap Add text below.</p>`;
    }

    overlays.forEach((overlay, index) => {
      const posH = overlay.posH ?? 50;
      const posV = overlay.posV ?? 100;
      const lockH = overlay.lockH !== false;
      const lockV = overlay.lockV !== false;
      const colorFieldId = `variant-text-color-${overlay.id}`;
      const bgFieldId = `variant-text-bg-${overlay.id}`;
      html += `<div class="variant-text-card" data-text-id="${overlay.id}" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:600;">Text ${index + 1}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" class="variant-text-enabled" data-text-id="${overlay.id}"${
        overlay.enabled !== false ? " checked" : ""
      } style="width:14px;height:14px;">Show
            </label>
            <button type="button" class="variant-text-remove" data-text-id="${overlay.id}" style="border:none;background:#fee2e2;color:#b91c1c;font-size:10px;padding:4px 8px;border-radius:6px;cursor:pointer;">Remove</button>
          </div>
        </div>
        <label style="display:block;font-size:10px;margin-bottom:6px;">Label
          <input type="text" class="variant-text-content opt-input" data-text-id="${overlay.id}" value="${String(
        overlay.text || "",
      )
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")}" placeholder="e.g. FREE SHIPPING" style="width:100%;margin-top:4px;font-size:12px;padding:6px;">
        </label>
        <div class="variant-text-pos-h-wrap${lockH ? " static-slider-locked" : ""}" data-text-id="${overlay.id}" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" class="variant-text-axis-lock" data-axis="h" data-text-id="${overlay.id}" aria-pressed="${lockH ? "true" : "false"}" title="${lockH ? "Unlock horizontal to adjust" : "Lock horizontal"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockH ? "🔒" : "🔓"}</button>
            <span style="font-size:10px;">Horizontal <span class="variant-text-h-val" data-text-id="${overlay.id}">${posH}</span>%</span>
          </div>
          <input type="range" class="variant-text-pos-h" data-text-id="${overlay.id}" min="0" max="100" value="${posH}" style="width:100%;"${lockH ? " disabled" : ""}>
        </div>
        <div class="variant-text-pos-v-wrap${lockV ? " static-slider-locked" : ""}" data-text-id="${overlay.id}" style="margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" class="variant-text-axis-lock" data-axis="v" data-text-id="${overlay.id}" aria-pressed="${lockV ? "true" : "false"}" title="${lockV ? "Unlock vertical to adjust" : "Lock vertical"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockV ? "🔒" : "🔓"}</button>
            <span style="font-size:10px;">Vertical <span class="variant-text-v-val" data-text-id="${overlay.id}">${posV}</span>%</span>
          </div>
          <input type="range" class="variant-text-pos-v" data-text-id="${overlay.id}" min="0" max="100" value="${posV}" style="width:100%;"${lockV ? " disabled" : ""}>
        </div>
        ${this.buildStaticColorFieldHtml(colorFieldId, "Text color", overlay.textColor || "#ffffff", "#ffffff")}
        ${this.buildStaticColorFieldHtml(bgFieldId, "Background", overlay.bgColor || "#e67e22", "#e67e22")}
        <label style="display:block;font-size:10px;margin-top:4px;">Size <span class="variant-text-size-val" data-text-id="${overlay.id}">${
        overlay.fontSizePct || 100
      }</span>%
          <input type="range" class="variant-text-size" data-text-id="${overlay.id}" min="50" max="200" value="${
        overlay.fontSizePct || 100
      }" style="width:100%;">
        </label>
      </div>`;
    });

    html += `</div>
      <button type="button" id="variant-text-add" style="width:100%;padding:8px;border:1px dashed #d1d5db;border-radius:8px;background:#fff;font-size:12px;font-weight:600;color:#c45f12;cursor:pointer;">+ Add text</button>
    </details>`;

    container.innerHTML = html;
    this.bindVariantTextControls(row, container);
  }

  bindVariantTextControls(row, container) {
    if (!container || !row?.layers) return;
    const variantId = row.variantId;
    const SFC = window.StaticFrameCompose;

    const readOverlaysFromDom = () => {
      const list = container.querySelector("#variant-text-list");
      if (!list) return [];
      return Array.from(list.querySelectorAll(".variant-text-card")).map((card) => {
        const id = card.dataset.textId;
        const colorFieldId = `variant-text-color-${id}`;
        const bgFieldId = `variant-text-bg-${id}`;
        const posHInput = card.querySelector(`.variant-text-pos-h[data-text-id="${id}"]`);
        const posVInput = card.querySelector(`.variant-text-pos-v[data-text-id="${id}"]`);
        const existing = (row.layers._textOverlays || []).find((o) => o.id === id) || {};
        return {
          id,
          text: card.querySelector(`.variant-text-content[data-text-id="${id}"]`)?.value || "",
          posH: parseInt(posHInput?.value || "50", 10),
          posV: parseInt(posVInput?.value || "100", 10),
          lockH: !!posHInput?.disabled,
          lockV: !!posVInput?.disabled,
          textColor:
            this.readStaticColorField(container, colorFieldId) ||
            existing.textColor ||
            "#ffffff",
          bgColor:
            this.readStaticColorField(container, bgFieldId) ||
            existing.bgColor ||
            "#e67e22",
          fontSizePct: parseInt(
            card.querySelector(`.variant-text-size[data-text-id="${id}"]`)?.value || "100",
            10,
          ),
          enabled: !!card.querySelector(`.variant-text-enabled[data-text-id="${id}"]`)?.checked,
        };
      }).map((o, i) =>
        typeof ImageGenerator !== "undefined" && ImageGenerator.normalizeTextOverlay
          ? ImageGenerator.normalizeTextOverlay(o, i)
          : o,
      );
    };

    const commit = () => {
      const overlays = readOverlaysFromDom();
      row.layers._textOverlays = overlays;
      row._textOverlaysEdited = this.textOverlaysChanged(row);
      if (typeof ImageGenerator !== "undefined" && ImageGenerator.syncLegacyTextFields) {
        ImageGenerator.syncLegacyTextFields(row.layers, overlays);
      }
      this.scheduleTextOverlayPreview(variantId);
      this.updateVariantEditorResetButton(row);
    };

    container._staticColorPickerOnApply = (hex, fieldId) => {
      if (!fieldId?.startsWith("variant-text-")) return;
      commit();
    };

    container.querySelector("#variant-text-add")?.addEventListener("click", (e) => {
      e.preventDefault();
      const overlays = readOverlaysFromDom();
      const next =
        typeof ImageGenerator !== "undefined" && ImageGenerator.createTextOverlay
          ? ImageGenerator.createTextOverlay({ text: "SALE" })
          : {
              id: `text-${Date.now()}`,
              text: "SALE",
              posH: 50,
              posV: 100,
              lockH: true,
              lockV: true,
              textColor: "#ffffff",
              bgColor: "#e67e22",
              fontSizePct: 100,
              enabled: true,
            };
      overlays.push(next);
      row.layers._textOverlays = overlays;
      this.renderVariantTextControls(row, container);
      row._textOverlaysEdited = true;
      this.scheduleTextOverlayPreview(variantId, 60);
      this.updateVariantEditorResetButton(row);
    });

    container.querySelectorAll(".variant-text-remove").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const id = btn.dataset.textId;
        const overlays = readOverlaysFromDom().filter((o) => o.id !== id);
        row.layers._textOverlays = overlays;
        this.renderVariantTextControls(row, container);
        row._textOverlaysEdited = this.textOverlaysChanged(row);
        this.scheduleTextOverlayPreview(variantId, 60);
        this.updateVariantEditorResetButton(row);
      };
    });

    container.querySelectorAll(".variant-text-content").forEach((el) => {
      el.oninput = commit;
    });
    container.querySelectorAll(".variant-text-enabled").forEach((el) => {
      el.onchange = commit;
    });
    container.querySelectorAll(".variant-text-size").forEach((el) => {
      el.oninput = () => {
        const val = container.querySelector(
          `.variant-text-size-val[data-text-id="${el.dataset.textId}"]`,
        );
        if (val) val.textContent = el.value;
        commit();
      };
    });

    container.querySelectorAll(".variant-text-axis-lock").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textId = btn.dataset.textId;
        const axis = btn.dataset.axis;
        const overlays = readOverlaysFromDom();
        const overlay = overlays.find((o) => o.id === textId);
        if (!overlay) return;
        if (axis === "h") overlay.lockH = overlay.lockH === false;
        else overlay.lockV = overlay.lockV === false;
        row.layers._textOverlays = overlays;
        this.renderVariantTextControls(row, container);
        row._textOverlaysEdited = this.textOverlaysChanged(row);
        this.updateVariantEditorResetButton(row);
      };
    });

    const bindAxisSlider = (cls, axis) => {
      const timers = new Map();
      container.querySelectorAll(cls).forEach((range) => {
        range.oninput = () => {
          if (range.disabled) return;
          const textId = range.dataset.textId;
          const valSpan = container.querySelector(
            axis === "h"
              ? `.variant-text-h-val[data-text-id="${textId}"]`
              : `.variant-text-v-val[data-text-id="${textId}"]`,
          );
          if (valSpan) valSpan.textContent = range.value;
          clearTimeout(timers.get(range));
          timers.set(range, setTimeout(commit, 120));
        };
        const commitSlider = () => {
          if (range.disabled) return;
          clearTimeout(timers.get(range));
          commit();
        };
        range.onchange = commitSlider;
        range.addEventListener("pointerup", commitSlider);
        range.addEventListener("touchend", commitSlider, { passive: true });
      });
    };
    bindAxisSlider(".variant-text-pos-h", "h");
    bindAxisSlider(".variant-text-pos-v", "v");

    const colorTimers = new Map();
    container.querySelectorAll(".variant-text-card").forEach((card) => {
      const textId = card.dataset.textId;
      for (const fieldId of [`variant-text-color-${textId}`, `variant-text-bg-${textId}`]) {
        const swatchBtn = container.querySelector(
          `.static-color-swatch-btn[data-color-id="${fieldId}"]`,
        );
        if (swatchBtn) {
          swatchBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openStaticColorPicker(container, fieldId, variantId);
          };
        }
        const hexField = container.querySelector(`#${fieldId}-hex`);
        if (hexField) {
          hexField.oninput = () => {
            clearTimeout(colorTimers.get(hexField));
            colorTimers.set(
              hexField,
              setTimeout(() => {
                if (this.syncStaticColorRowFromHex(container, fieldId)) commit();
              }, 220),
            );
          };
          hexField.onchange = () => {
            clearTimeout(colorTimers.get(hexField));
            if (this.syncStaticColorRowFromHex(container, fieldId)) commit();
          };
        }
      }
    });

    container.querySelectorAll(".static-color-chip").forEach((chip) => {
      const fieldId = chip.dataset.colorId;
      if (!fieldId?.startsWith("variant-text-")) return;
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hex = SFC?.normalizeFrameColor?.(chip.dataset.hex);
        if (!fieldId || !hex) return;
        this.updateStaticColorRowDisplay(container, fieldId, hex);
        commit();
      };
    });
  }

  renderStaticBadgePlacementControls(row, container) {
    const SFC = window.StaticFrameCompose;
    if (!SFC || !container) return;

    const frame = row.layers._staticFrame || {};
    if (window.StaticFrameCompose?.ensureFrameOuterDimensions) {
      window.StaticFrameCompose.ensureFrameOuterDimensions(row.layers, row.meta || {});
    }
    const style = frame.style || row.meta?.path || row.meta?.style || "";
    const showFrameColors = !!(frame.outerW || frame.style);
    const slots = SFC.getBadgeSlots(row);
    const placements = row.layers._badgePlacements || [];
    const presets = SFC.GRADIENT_PRESETS || [];
    const allHidden = slots.length > 0 && slots.every((s) => s.hidden);

    let html = "";
    if (showFrameColors) {
      html += `<div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">Frame colors</div>`;

      html += `<label style="display:block;font-size:11px;margin-bottom:6px;">Gradient preset
        <select id="static-gradient-preset" class="opt-select" style="width:100%;margin-top:4px;font-size:12px;padding:6px;">`;
      html += `<option value="">— Custom / solid —</option>`;
      presets.forEach((g) => {
        html += `<option value="${g.id}"${
          frame.gradientPreset === g.id ? " selected" : ""
        }>${g.label}</option>`;
      });
      html += `</select></label>`;

    const gownGradient =
      style === "gown_static" && SFC.staticStyleUsesGradientColors?.(style, frame);
    const gradientTopLabel = gownGradient ? "Border top" : "Top";
    const gradientBottomLabel = gownGradient ? "Border bottom" : "Bottom";

    if (style === "showcase" || style === "live_standard" || SFC.staticStyleUsesGradientColors?.(style, frame)) {
      html += this.buildStaticColorFieldHtml(
        "static-color-top",
        gradientTopLabel,
        frame.gradientTop,
        "#FF9800",
      );
      html += this.buildStaticColorFieldHtml(
        "static-color-bottom",
        gradientBottomLabel,
        frame.gradientBottom,
        "#4CAF50",
      );
    }

    if (style === "lifestyle_promo") {
      html += this.buildStaticColorFieldHtml(
        "static-color-border",
        "Border",
        frame.borderColor,
        "#32d74b",
      );
    }

    if (style === "gown_static") {
      if (!gownGradient) {
        html += this.buildStaticColorFieldHtml(
          "static-color-border",
          "Outer border",
          frame.borderColor,
          "#71cbd3",
        );
      }
      html += this.buildStaticColorFieldHtml(
        "static-color-outer-mat",
        "Outer mat",
        frame.outerMatColor ?? frame.matColor,
        "#ffffff",
      );
      const fillMatEnabled = frame.fillMatEnabled !== false;
      const fillMatColor =
        frame.fillMatColor ?? frame.padColor ?? frame.matColor ?? "#ffffff";
      html += `<div class="static-fill-mat-wrap${
        fillMatEnabled ? "" : " static-fill-mat-disabled"
      }" style="margin-bottom:6px;">
        <p style="font-size:9px;color:#6b7280;margin:0 0 4px;line-height:1.35;">Outer border = teal ring. Outer mat = white band outside the inner board. Fill mat = inner board around the photo (colors the whole board when enabled). Photo pad = thin edge ring — only used when fill mat is off.</p>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;">
          <input type="checkbox" id="static-fill-mat-enabled"${fillMatEnabled ? " checked" : ""}>
          Fill mat (inner board around photo)
        </label>`;
      html += this.buildStaticColorFieldHtml(
        "static-color-fill-mat",
        "Fill mat color",
        fillMatColor,
        "#ffffff",
      );
      html += `</div>`;
      html += this.buildStaticColorFieldHtml(
        "static-color-pad",
        "Photo pad (fill mat off)",
        frame.padColor ?? frame.matColor,
        "#ffffff",
      );
    } else if (style === "tall_static" || style === "live_framed") {
      html += this.buildStaticColorFieldHtml(
        "static-color-border",
        "Border",
        frame.borderColor,
        "#45a9e5",
      );
      html += this.buildStaticColorFieldHtml(
        "static-color-mat",
        "Mat",
        frame.matColor,
        "#ffffff",
      );
    }

    const borderPct = frame.borderThicknessPct ?? 100;
    if (style === "gown_static") {
      if (window.StaticFrameCompose?.ensureGownLayerPcts) {
        window.StaticFrameCompose.ensureGownLayerPcts(frame);
      } else if (!frame.gownLayerPct) {
        frame.gownLayerPct = window.StaticFrameCompose?.defaultGownLayerPct?.() || {
          border: 100,
          outerMat: 100,
          innerMat: 100,
        };
      }
      const lp = frame.gownLayerPct;
      if (frame.gownFrameLayersLocked == null) frame.gownFrameLayersLocked = true;
      const frameLocked = frame.gownFrameLayersLocked !== false;
      const gownLayers = [
        { key: "border", label: "Outer border (teal ring)" },
        { key: "outerMat", label: "Outer mat (white band)" },
        { key: "innerMat", label: "Photo pad (white edge)" },
      ];
      html += `<div class="static-gown-layers-wrap${
        frameLocked ? " static-slider-locked" : ""
      }" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <button type="button" id="static-gown-layers-lock" aria-pressed="${
            frameLocked ? "true" : "false"
          }" title="${
        frameLocked ? "Unlock frame layers to adjust" : "Lock frame layers"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        frameLocked ? "🔒" : "🔓"
      }</button>
          <span style="font-size:10px;font-weight:600;">Frame layers (100 = default · photo size fixed)</span>
        </div>
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Teal border → outer mat → fill mat board → photo pad around the lifestyle photo. Unlock 🔓 then drag a slider — only that band changes; the photo box stays the same size.</p>`;
      for (const layer of gownLayers) {
        const v = lp[layer.key] ?? 100;
        html += `<div class="static-gown-layer-row" data-gown-layer="${
          layer.key
        }" style="margin-bottom:6px;">
          <span style="font-size:10px;">${layer.label} <span class="static-gown-layer-val" data-gown-layer="${
          layer.key
        }">${v}</span></span>
          <input type="range" class="static-gown-layer-pct" data-gown-layer="${
            layer.key
          }" min="0" max="1000" value="${v}" style="width:100%;"${
          frameLocked ? " disabled" : ""
        }>
        </div>`;
      }
      html += `</div>`;
    } else if (style !== "gown_static") {
      if (frame.borderThicknessLocked == null) frame.borderThicknessLocked = true;
      const borderLocked = frame.borderThicknessLocked !== false;
      html += `<div class="static-border-wrap${
        borderLocked ? " static-slider-locked" : ""
      }" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" id="static-border-lock" aria-pressed="${
            borderLocked ? "true" : "false"
          }" title="${
        borderLocked ? "Unlock border thickness to adjust" : "Lock border thickness"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        borderLocked ? "🔒" : "🔓"
      }</button>
          <span style="font-size:10px;">Border thickness <span id="static-border-thickness-val">${borderPct}</span> (100 = default)</span>
        </div>
        <input type="range" id="static-border-thickness" min="0" max="1000" value="${borderPct}" style="width:100%;"${
        borderLocked ? " disabled" : ""
      }>
      </div>`;
    }

    if (this.frameSupportsPhotoControls(frame)) {
      this.ensurePhotoControlDefaults(frame);
      const zoomLocked = frame.photoZoomLocked !== false;
      const panHLocked = frame.photoPanHLocked !== false;
      const panVLocked = frame.photoPanVLocked !== false;
      const photoZoom = frame.photoZoomPct ?? 100;
      const photoPanH = frame.photoPanH ?? 50;
      const photoPanV = frame.photoPanV ?? 50;
      const marginMax = window.StaticFrameCompose?.PHOTO_MARGIN_MAX ?? 200;
      let marginControlsHtml = `<div style="font-size:10px;font-weight:600;margin:8px 0 4px;">Photo margins (image ↔ border)</div>
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Unlock each side to add space between the photo and frame border. 0 px = default fit. Frame bands stay fixed.</p>`;
      for (const { side, label } of this.photoMarginSides()) {
        const field = this.photoMarginField(side);
        const locked = frame[this.photoMarginLockField(side)] !== false;
        const marginVal = frame[field] ?? 0;
        marginControlsHtml += `<div class="static-photo-margin-${side}-wrap${locked ? " static-slider-locked" : ""}" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-margin-${side}-lock" aria-pressed="${locked ? "true" : "false"}" title="${locked ? `Unlock ${label.toLowerCase()} margin to adjust` : `Lock ${label.toLowerCase()} margin`}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${locked ? "🔒" : "🔓"}</button>
            <span style="font-size:10px;">${label} <span id="static-photo-margin-${side}-val">${marginVal}</span> px</span>
          </div>
          <input type="range" id="static-photo-margin-${side}" min="0" max="${marginMax}" value="${marginVal}" style="width:100%;"${locked ? " disabled" : ""}>
        </div>`;
      }
      const marginFillEnabled = frame.photoMarginFillEnabled !== false;
      let marginFillColor = frame.photoMarginFillColor;
      if (!marginFillColor) {
        if (style === "gown_static") {
          marginFillColor =
            frame.fillMatEnabled !== false
              ? frame.fillMatColor ?? frame.padColor ?? frame.matColor ?? "#ffffff"
              : frame.padColor ?? frame.matColor ?? "#ffffff";
        } else {
          marginFillColor = frame.matColor ?? "#ffffff";
        }
      }
      marginControlsHtml += `<div class="static-photo-margin-fill-wrap${
        marginFillEnabled ? "" : " static-photo-margin-fill-disabled"
      }" style="margin-top:8px;padding-top:6px;border-top:1px solid #e5e7eb;">
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Fill the gap bands created by top/left/right/bottom margins with a solid color.</p>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:6px;">
          <input type="checkbox" id="static-photo-margin-fill-enabled"${marginFillEnabled ? " checked" : ""}>
          Fill margins
        </label>`;
      marginControlsHtml += this.buildStaticColorFieldHtml(
        "static-color-margin-fill",
        "Margin fill color",
        marginFillColor,
        "#ffffff",
      );
      marginControlsHtml += `</div>`;
      html += `<div class="static-photo-controls-wrap" style="margin-bottom:8px;">
        <div style="font-size:10px;font-weight:600;margin-bottom:4px;">Photo zoom & pan</div>
        <p style="font-size:9px;color:#6b7280;margin:0 0 6px;line-height:1.35;">Unlock each slider to adjust. Zoom scales from the center (100 = cover-fit). Pan shifts the photo when zoomed in, or within the frame when zoomed out — 50 is centered.</p>
        <div class="static-photo-zoom-wrap${
          zoomLocked ? " static-slider-locked" : ""
        }" style="margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-zoom-lock" aria-pressed="${
              zoomLocked ? "true" : "false"
            }" title="${
        zoomLocked ? "Unlock photo zoom to adjust" : "Lock photo zoom"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        zoomLocked ? "🔒" : "🔓"
      }</button>
            <span style="font-size:10px;">Zoom <span id="static-photo-zoom-val">${photoZoom}</span>% (100 = cover-fit)</span>
          </div>
          <input type="range" id="static-photo-zoom" min="50" max="200" value="${photoZoom}" style="width:100%;"${
        zoomLocked ? " disabled" : ""
      }>
        </div>
        <div class="static-photo-pan-h-wrap${
          panHLocked ? " static-slider-locked" : ""
        }" style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-pan-h-lock" aria-pressed="${
              panHLocked ? "true" : "false"
            }" title="${
        panHLocked ? "Unlock horizontal pan to adjust" : "Lock horizontal pan"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        panHLocked ? "🔒" : "🔓"
      }</button>
            <span style="font-size:10px;">Pan horizontal <span id="static-photo-pan-h-val">${photoPanH}</span></span>
          </div>
          <input type="range" id="static-photo-pan-h" min="0" max="100" value="${photoPanH}" style="width:100%;"${
        panHLocked ? " disabled" : ""
      }>
        </div>
        <div class="static-photo-pan-v-wrap${
          panVLocked ? " static-slider-locked" : ""
        }">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <button type="button" id="static-photo-pan-v-lock" aria-pressed="${
              panVLocked ? "true" : "false"
            }" title="${
        panVLocked ? "Unlock vertical pan to adjust" : "Lock vertical pan"
      }" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${
        panVLocked ? "🔒" : "🔓"
      }</button>
            <span style="font-size:10px;">Pan vertical <span id="static-photo-pan-v-val">${photoPanV}</span></span>
          </div>
          <input type="range" id="static-photo-pan-v" min="0" max="100" value="${photoPanV}" style="width:100%;"${
        panVLocked ? " disabled" : ""
      }>
        </div>
        ${marginControlsHtml}
      </div>`;
    }
    }

    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px;">
      <span style="font-size:11px;font-weight:600;color:#6b7280;">Stickers</span>
      <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;">
        <input type="checkbox" id="static-hide-all-stickers"${allHidden ? " checked" : ""} style="width:14px;height:14px;">
        Hide all
      </label>
    </div>`;

    slots.forEach((slot) => {
      const p = placements.find((b) => b.id === slot.id);
      const posH = p?.posH ?? slot.posH ?? 0;
      const posV = p?.posV ?? slot.posV ?? 0;
      const sizePct = p?.sizePct ?? slot.sizePct ?? 100;
      const lockH = p?.lockH !== false;
      const lockV = p?.lockV !== false;
      const lockSize = p?.lockSize !== false;
      const freeValue =
        window.StaticFrameCompose?.FREE_SHIPPING_BADGE_VALUE || "free";
      const showFreeOption = slot.freeShippingSlot || p?._freeShippingSlot;
      const isFreeShipActive = p?.kind === "freeShipping";
      const isGownArt = p?.kind === "gownArt";
      const selectedBadge = isFreeShipActive
        ? freeValue
        : isGownArt
        ? "gown-art"
        : String(p?.num || slot.num || 1);

      html += `<div class="static-sticker-card" data-badge-id="${slot.id}" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px;background:#fafafa;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:600;">${slot.label}</span>
          <label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" class="static-sticker-hide" data-badge-id="${slot.id}"${
        p?.hidden ? " checked" : ""
      } style="width:14px;height:14px;">
            Hide
          </label>
        </div>`;

      html += `<label style="display:block;font-size:10px;margin-bottom:6px;">Sticker
          <select data-badge-id="${slot.id}" class="static-badge-pick opt-select" style="width:100%;margin-top:2px;font-size:11px;padding:4px;">`;
      if (showFreeOption) {
        html += `<option value="${freeValue}"${
          isFreeShipActive ? " selected" : ""
        }>Free shipping (red circle)</option>`;
      }
      if (style === "gown_static" && slot.id?.startsWith("gown-")) {
        html += `<option value="gown-art"${
          isGownArt ? " selected" : ""
        }>${slot.label} (default art)</option>`;
      }
      for (let n = 1; n <= 25; n++) {
        html += `<option value="${n}"${
          !isFreeShipActive && !isGownArt && parseInt(selectedBadge, 10) === n ? " selected" : ""
        }>Badge ${n}</option>`;
      }
      html += `</select></label>`;

      html += `<div class="static-size-wrap${lockSize ? " static-slider-locked" : ""}" data-badge-id="${slot.id}" style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" class="static-size-lock" data-badge-id="${slot.id}" aria-pressed="${lockSize ? "true" : "false"}" title="${lockSize ? "Unlock size to adjust" : "Lock badge size"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockSize ? "🔒" : "🔓"}</button>
          <span style="font-size:10px;">Size <span class="static-size-val" data-badge-id="${slot.id}">${sizePct}</span>%</span>
        </div>
        <input type="range" class="static-size-pct" data-badge-id="${slot.id}" min="25" max="200" value="${sizePct}" style="width:100%;"${lockSize ? " disabled" : ""}>
      </div>`;
      html += `<div class="static-pos-h-wrap${lockH ? " static-slider-locked" : ""}" data-badge-id="${slot.id}" style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" class="static-axis-lock" data-axis="h" data-badge-id="${slot.id}" aria-pressed="${lockH ? "true" : "false"}" title="${lockH ? "Unlock horizontal to adjust" : "Lock horizontal"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockH ? "🔒" : "🔓"}</button>
          <span style="font-size:10px;">Horizontal <span class="static-h-val" data-badge-id="${slot.id}">${posH}</span>%</span>
        </div>
        <input type="range" class="static-pos-h" data-badge-id="${slot.id}" min="0" max="100" value="${posH}" style="width:100%;"${lockH ? " disabled" : ""}>
      </div>`;
      html += `<div class="static-pos-v-wrap${lockV ? " static-slider-locked" : ""}" data-badge-id="${slot.id}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <button type="button" class="static-axis-lock" data-axis="v" data-badge-id="${slot.id}" aria-pressed="${lockV ? "true" : "false"}" title="${lockV ? "Unlock vertical to adjust" : "Lock vertical"}" style="border:none;background:transparent;font-size:14px;line-height:1;cursor:pointer;padding:0;">${lockV ? "🔒" : "🔓"}</button>
          <span style="font-size:10px;">Vertical <span class="static-v-val" data-badge-id="${slot.id}">${posV}</span>%</span>
        </div>
        <input type="range" class="static-pos-v" data-badge-id="${slot.id}" min="0" max="100" value="${posV}" style="width:100%;"${lockV ? " disabled" : ""}>
      </div>`;
      html += `</div>`;
    });

    const priceLock = (() => {
      const ship = this.getRowDisplayShipping(row);
      if (ship.amount > 0) {
        const kbNote = row._frozenPricing?.targetKb
          ? ` (${row._frozenPricing.targetKb}KB)`
          : "";
        return ship.verified
          ? `shipping ₹${ship.amount}${kbNote}`
          : `est ₹${ship.amount}${kbNote}`;
      }
      if (row._frozenPricing?.targetKb) {
        return `est ₹ at ${row._frozenPricing.targetKb}KB`;
      }
      return "original pricing";
    })();
    html += `<p style="font-size:10px;color:#6b7280;margin:0;">Edits keep ${priceLock} unchanged.</p>`;
    container.innerHTML = html;

    const vid = row.variantId;
    const presetSel = container.querySelector("#static-gradient-preset");
    if (presetSel) {
      presetSel.onchange = () => {
        void this.setStaticGradientPreset(vid, presetSel.value || null);
      };
    }

    this.bindStaticColorFields(container, { variantId: vid, style });

    const fillMatCheckbox = container.querySelector("#static-fill-mat-enabled");
    if (fillMatCheckbox) {
      fillMatCheckbox.onchange = () => {
        void this.setStaticFillMatEnabled(vid, fillMatCheckbox.checked);
      };
    }
    if (style === "gown_static") {
      this.updateFillMatUI(container, frame);
    }

    const borderThickness = container.querySelector("#static-border-thickness");
    const borderThicknessVal = container.querySelector("#static-border-thickness-val");
    const borderLock = container.querySelector("#static-border-lock");
    if (borderLock) {
      borderLock.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticBorderThicknessLock(vid);
      };
    }
    if (borderThickness) {
      const commitBorder = () => {
        if (borderThickness.disabled) return;
        const v = parseInt(borderThickness.value, 10);
        if (borderThicknessVal) borderThicknessVal.textContent = String(v);
        void this.setStaticBorderThickness(vid, v);
      };
      borderThickness.oninput = () => {
        if (borderThickness.disabled) return;
        const v = parseInt(borderThickness.value, 10);
        if (borderThicknessVal) borderThicknessVal.textContent = String(v);
        this.queueStaticBorderThickness(vid, v);
      };
      borderThickness.onchange = commitBorder;
      borderThickness.addEventListener("pointerup", commitBorder);
      borderThickness.addEventListener("touchend", commitBorder, { passive: true });
    }

    const gownLayersLock = container.querySelector("#static-gown-layers-lock");
    if (gownLayersLock) {
      gownLayersLock.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticGownFrameLayersLock(vid);
      };
    }
    container.querySelectorAll(".static-gown-layer-pct").forEach((slider) => {
      const layerKey = slider.dataset.gownLayer;
      const commitLayer = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const valSpan = container.querySelector(
          `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
        );
        if (valSpan) valSpan.textContent = String(v);
        void this.setStaticGownLayerPct(vid, layerKey, v);
      };
      slider.oninput = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const valSpan = container.querySelector(
          `.static-gown-layer-val[data-gown-layer="${layerKey}"]`,
        );
        if (valSpan) valSpan.textContent = String(v);
        this.queueStaticGownLayerPct(vid, layerKey, v);
      };
      slider.onchange = commitLayer;
      slider.addEventListener("pointerup", commitLayer);
      slider.addEventListener("touchend", commitLayer, { passive: true });
    });

    const photoZoomLock = container.querySelector("#static-photo-zoom-lock");
    if (photoZoomLock) {
      photoZoomLock.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPhotoZoomLock(vid);
      };
    }
    const photoZoomSlider = container.querySelector("#static-photo-zoom");
    if (photoZoomSlider) {
      const commitZoom = () => {
        if (photoZoomSlider.disabled) return;
        const v = parseInt(photoZoomSlider.value, 10);
        const val = container.querySelector("#static-photo-zoom-val");
        if (val) val.textContent = String(v);
        void this.setStaticPhotoZoom(vid, v);
      };
      photoZoomSlider.oninput = () => {
        if (photoZoomSlider.disabled) return;
        const v = parseInt(photoZoomSlider.value, 10);
        const val = container.querySelector("#static-photo-zoom-val");
        if (val) val.textContent = String(v);
        this.queueStaticPhotoZoom(vid, v);
      };
      photoZoomSlider.onchange = commitZoom;
      photoZoomSlider.addEventListener("pointerup", commitZoom);
      photoZoomSlider.addEventListener("touchend", commitZoom, { passive: true });
    }

    const bindPhotoPanLock = (axis) => {
      const btn = container.querySelector(
        axis === "h" ? "#static-photo-pan-h-lock" : "#static-photo-pan-v-lock",
      );
      if (!btn) return;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPhotoPanLock(vid, axis);
      };
    };
    bindPhotoPanLock("h");
    bindPhotoPanLock("v");

    const bindPhotoPan = (axis) => {
      const slider = container.querySelector(
        axis === "h" ? "#static-photo-pan-h" : "#static-photo-pan-v",
      );
      if (!slider) return;
      const valId = axis === "h" ? "#static-photo-pan-h-val" : "#static-photo-pan-v-val";
      const commitPan = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(valId);
        if (val) val.textContent = String(v);
        void this.setStaticPhotoPan(vid, axis, v);
      };
      slider.oninput = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(valId);
        if (val) val.textContent = String(v);
        this.queueStaticPhotoPan(vid, axis, v);
      };
      slider.onchange = commitPan;
      slider.addEventListener("pointerup", commitPan);
      slider.addEventListener("touchend", commitPan, { passive: true });
    };
    bindPhotoPan("h");
    bindPhotoPan("v");

    for (const { side } of this.photoMarginSides()) {
      const lockBtn = container.querySelector(`#static-photo-margin-${side}-lock`);
      if (lockBtn) {
        lockBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleStaticPhotoMarginLock(vid, side);
        };
      }
      const slider = container.querySelector(`#static-photo-margin-${side}`);
      if (!slider) continue;
      const commitMargin = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(`#static-photo-margin-${side}-val`);
        if (val) val.textContent = String(v);
        void this.setStaticPhotoMargin(vid, side, v);
      };
      slider.oninput = () => {
        if (slider.disabled) return;
        const v = parseInt(slider.value, 10);
        const val = container.querySelector(`#static-photo-margin-${side}-val`);
        if (val) val.textContent = String(v);
        this.queueStaticPhotoMargin(vid, side, v);
      };
      slider.onchange = commitMargin;
      slider.addEventListener("pointerup", commitMargin);
      slider.addEventListener("touchend", commitMargin, { passive: true });
    }

    const marginFillCb = container.querySelector("#static-photo-margin-fill-enabled");
    if (marginFillCb) {
      marginFillCb.onchange = () => {
        void this.setStaticFrameColors(vid, {
          photoMarginFillEnabled: marginFillCb.checked,
        });
        const row = this.findResultRow(vid);
        if (row?.layers?._staticFrame && this._editingVariantId === vid) {
          this.updatePhotoMarginFillUI(container, row.layers._staticFrame);
        }
      };
    }

    const hideAll = container.querySelector("#static-hide-all-stickers");
    if (hideAll) {
      hideAll.onchange = () => {
        void this.setStaticAllStickersHidden(vid, hideAll.checked);
      };
    }

    container.querySelectorAll(".static-sticker-hide").forEach((cb) => {
      cb.onchange = () => {
        void this.setStaticPlacementHidden(vid, cb.dataset.badgeId, cb.checked);
      };
    });

    container.querySelectorAll(".static-badge-pick").forEach((sel) => {
      sel.onchange = () => {
        void this.setStaticBadgeNum(vid, sel.dataset.badgeId, sel.value);
      };
    });

    container.querySelectorAll(".static-axis-lock").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPlacementAxisLock(vid, btn.dataset.badgeId, btn.dataset.axis);
      };
    });

    const bindAxisSlider = (cls, axis) => {
      const timers = new Map();
      container.querySelectorAll(cls).forEach((range) => {
        range.oninput = () => {
          if (range.disabled) return;
          const id = range.dataset.badgeId;
          const valSpan = container.querySelector(
            axis === "h"
              ? `.static-h-val[data-badge-id="${id}"]`
              : `.static-v-val[data-badge-id="${id}"]`,
          );
          if (valSpan) valSpan.textContent = range.value;
          clearTimeout(timers.get(range));
          timers.set(
            range,
            setTimeout(() => {
              void this.setStaticPlacementSliderAxis(
                vid,
                id,
                axis,
                parseInt(range.value, 10),
              );
            }, 120),
          );
        };
        const commit = () => {
          if (range.disabled) return;
          clearTimeout(timers.get(range));
          const id = range.dataset.badgeId;
          void this.setStaticPlacementSliderAxis(
            vid,
            id,
            axis,
            parseInt(range.value, 10),
          );
        };
        range.onchange = commit;
        range.addEventListener("pointerup", commit);
        range.addEventListener("touchend", commit, { passive: true });
      });
    };
    bindAxisSlider(".static-pos-h", "h");
    bindAxisSlider(".static-pos-v", "v");

    container.querySelectorAll(".static-size-lock").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleStaticPlacementSizeLock(vid, btn.dataset.badgeId);
      };
    });

    const sizeTimers = new Map();
    container.querySelectorAll(".static-size-pct").forEach((range) => {
      range.oninput = () => {
        if (range.disabled) return;
        const id = range.dataset.badgeId;
        const valSpan = container.querySelector(`.static-size-val[data-badge-id="${id}"]`);
        if (valSpan) valSpan.textContent = range.value;
        clearTimeout(sizeTimers.get(range));
        sizeTimers.set(
          range,
          setTimeout(() => {
            void this.setStaticPlacementSize(vid, id, parseInt(range.value, 10));
          }, 120),
        );
      };
      const commitSize = () => {
        if (range.disabled) return;
        clearTimeout(sizeTimers.get(range));
        void this.setStaticPlacementSize(
          vid,
          range.dataset.badgeId,
          parseInt(range.value, 10),
          { autoLock: true },
        );
      };
      range.onchange = commitSize;
      range.addEventListener("pointerup", commitSize);
      range.addEventListener("touchend", commitSize, { passive: true });
    });
  }

  refreshVariantCard(row) {
    const img = document.querySelector(
      `.result-img[data-variant-id="${row.variantId}"]`
    );
    if (img) {
      img.src =
        (typeof OptimizerUI !== "undefined" && OptimizerUI.pickResultImageSrc
          ? OptimizerUI.pickResultImageSrc(row)
          : null) || row.imageUrl || "";
    }
    const badge = document.querySelector(
      `.result-edit-badge[data-variant-id="${row.variantId}"]`
    );
    if (badge) {
      const edited = this.isVariantEdited(row.editFlags, row.layers, row);
      badge.style.display = edited ? "block" : "none";
    }
    const priceEl = document.querySelector(
      `.result-card[data-variant-id="${row.variantId}"] .result-price-label`
    );
    if (priceEl) {
      const ship = this.getRowDisplayShipping(row);
      if (ship.amount > 0) {
        priceEl.textContent = ship.verified
          ? `₹${ship.amount}`
          : `est ₹${ship.amount}`;
      }
    }
  }

  closeVariantEditor() {
    const panel = document.getElementById("variant-edit-panel");
    if (panel) panel.style.display = "none";
    this.clearTransientTimers();
    this._staticControlsVariantId = null;
    this._textControlsVariantId = null;
    this._editingVariantId = null;
  }

  renderVariantEditorPanel(row) {
    const panel = document.getElementById("variant-edit-panel");
    if (!panel || !row) return;

    const preview = panel.querySelector("#variant-edit-preview");
    const stickerCb = panel.querySelector("#variant-edit-no-stickers");
    const borderOnlyCb = panel.querySelector("#variant-edit-border-only");
    const cleanCb = panel.querySelector("#variant-edit-clean-product");
    const addStickersCb = panel.querySelector("#variant-edit-add-stickers");
    const addBorderCb = panel.querySelector("#variant-edit-add-border");
    const addBothCb = panel.querySelector("#variant-edit-add-both");
    const priceNote = panel.querySelector("#variant-edit-price-note");
    const title = panel.querySelector("#variant-edit-title");

    const flags = this.normalizeEditFlags(row.editFlags);
    const caps = this.getVariantLayerCaps(row);

    const setRow = (wrapId, cb, can) => {
      const wrap = panel.querySelector(wrapId);
      if (wrap) {
        wrap.style.display = "flex";
        wrap.style.opacity = can || cb?.checked ? "1" : "0.45";
      }
      if (cb) cb.disabled = !can && !cb.checked;
    };
    setRow("#variant-edit-remove-stickers-wrap", stickerCb, caps.canRemoveStickers);
    setRow("#variant-edit-remove-border-wrap", borderOnlyCb, caps.canRemoveBorder);
    setRow("#variant-edit-remove-both-wrap", cleanCb, caps.canRemoveBoth);
    setRow("#variant-edit-add-stickers-wrap", addStickersCb, caps.canAddStickers);
    setRow("#variant-edit-add-border-wrap", addBorderCb, caps.canAddBorder);
    setRow("#variant-edit-add-both-wrap", addBothCb, caps.canAddBoth);

    const isStatic = caps.isStaticPromo || this.isStaticPromoRow(row);
    const hasAdvanced = caps.canAdjustBadges || this.hasAdvancedEditor(row);
    const addSection = panel.querySelector("#variant-edit-add-section");
    const staticSection = panel.querySelector("#variant-edit-static-badges");
    const textSection = panel.querySelector("#variant-edit-text-section");
    const resetBtn = panel.querySelector("#variant-edit-reset");
    const stickerSlots = (row.layers._badgePlacements || []).length;
    const needsStickerControls =
      (flags.stickersAdded || flags.fullDecorationsAdded) && stickerSlots > 0;
    const staticControlsStale =
      needsStickerControls &&
      staticSection &&
      !staticSection.querySelector(".static-sticker-card");
    if (addSection) addSection.style.display = "block";
    if (textSection && row.layers) {
      textSection.style.display = "block";
      const sameTextVariant = this._textControlsVariantId === row.variantId;
      if (!sameTextVariant) {
        this._textControlsVariantId = row.variantId;
        this.renderVariantTextControls(row, textSection);
      }
    } else if (textSection) {
      textSection.style.display = "none";
      textSection.innerHTML = "";
      this._textControlsVariantId = null;
    }

    if (staticSection) {
      if (hasAdvanced) {
        staticSection.style.display = "block";
        const sameVariant =
          this._staticControlsVariantId === row.variantId && !staticControlsStale;
        if (!sameVariant) {
          this._staticControlsVariantId = row.variantId;
          void this.preloadStaticComposeModule().then((loaded) => {
            if (this._editingVariantId !== row.variantId) return;
            if (!loaded || !window.StaticFrameCompose) {
              staticSection.innerHTML =
                '<p style="font-size:11px;color:#b45309;margin:0;">Editor controls failed to load — reload the extension and try again.</p>';
              return;
            }
            this.renderStaticBadgePlacementControls(row, staticSection);
          });
        } else {
          const slider = staticSection.querySelector("#static-border-thickness");
          const val = staticSection.querySelector("#static-border-thickness-val");
          const pct = row.layers._staticFrame?.borderThicknessPct ?? 100;
          if (slider && document.activeElement !== slider) slider.value = String(pct);
          if (val && document.activeElement !== slider) val.textContent = String(pct);
          this.syncPlacementSlidersFromRow(row);
          this.syncPhotoControlsFromRow(row);
          this.updateBorderThicknessLockUI(staticSection, row.layers._staticFrame);
        }
      } else {
        staticSection.style.display = "none";
        staticSection.innerHTML = "";
        this._staticControlsVariantId = null;
      }
    }

    if (preview) {
      const previewSrc = this.resolveVariantPreviewSrc(row);
      if (previewSrc) {
        preview.src = previewSrc;
        preview.style.display = "block";
      } else {
        preview.removeAttribute("src");
        preview.style.display = "none";
      }
    }
    if (stickerCb) stickerCb.checked = !!flags.stickersRemoved;
    if (borderOnlyCb) borderOnlyCb.checked = !!flags.borderOnlyRemoved;
    if (cleanCb) cleanCb.checked = !!flags.cleanProduct;
    if (addStickersCb) addStickersCb.checked = !!flags.stickersAdded;
    if (addBorderCb) addBorderCb.checked = !!flags.borderAdded;
    if (addBothCb) addBothCb.checked = !!flags.fullDecorationsAdded;
    if (title) title.textContent = row.name || "Variant";
    if (priceNote) {
      const ship = this.getRowDisplayShipping(row);
      priceNote.textContent =
        ship.amount > 0
          ? ship.verified
            ? `Shipping ₹${ship.amount} is unchanged — preview/save only.`
            : `Est. ₹${ship.amount} is unchanged — preview/save only.`
          : "Shipping price is unchanged — this only affects the image you save.";
    }
    const footerNote = panel.querySelector("#variant-edit-footer-note");
    if (footerNote) {
      footerNote.textContent = hasAdvanced
        ? "Frame, badges, text & colors — pricing unchanged on save."
        : "Preview options + text overlays — edits update save only, not shipping ₹.";
    }
    if (resetBtn) {
      this.updateVariantEditorResetButton(row);
    }
  }

  ensureVariantEditorPanel() {
    let panel = document.getElementById("variant-edit-panel");
    if (panel && panel.querySelector("motionless")) {
      panel.remove();
      panel = null;
    }
    if (panel && !panel.querySelector("#variant-edit-reset")) {
      panel.remove();
      panel = null;
    }
    if (panel && !panel.querySelector("#variant-edit-add-stickers")) {
      panel.remove();
      panel = null;
    }
    if (panel && !panel.querySelector("#variant-edit-text-section")) {
      panel.remove();
      panel = null;
    }
    if (panel && panel.dataset.staticEditorV !== "21") {
      panel.remove();
      panel = null;
    }
    if (panel) {
      this.mountOptimizerOverlay(panel);
      return panel;
    }

    panel = document.createElement("div");
    panel.id = "variant-edit-panel";
    panel.dataset.staticEditorV = "21";
    panel.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483647;align-items:center;justify-content:center;padding:12px;";
    panel.innerHTML = `
      <style>
        #variant-edit-panel .variant-edit-sheet {
          background:#fff;border-radius:12px;max-width:440px;width:100%;max-height:94vh;
          display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.25);overflow:hidden;
        }
        #variant-edit-panel #variant-edit-scroll {
          overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;-webkit-overflow-scrolling:touch;
          padding:0 16px 12px;overscroll-behavior:contain;touch-action:pan-y pinch-zoom;
        }
        #variant-edit-panel #variant-edit-preview-wrap {
          position:sticky;top:0;z-index:2;margin:0 0 10px;padding:4px 0 10px;
          background:#fff;
        }
        #variant-edit-panel #variant-edit-preview {
          width:auto;max-width:100%;max-height:180px;height:auto;margin:0 auto;
          object-fit:contain;
          border-radius:8px;background:#f9fafb;display:block;
          box-shadow:0 2px 8px rgba(0,0,0,0.08);cursor:pointer;
        }
        #variant-edit-panel #variant-edit-preview-hint {
          font-size:10px;color:#6b7280;text-align:center;margin:4px 0 0;pointer-events:none;
        }
        #variant-edit-panel .static-slider-locked input[type="range"]:disabled {
          opacity:0.5;cursor:not-allowed;
        }
        #variant-edit-panel input[type="range"] {
          touch-action:none;
          width:100%;
          min-height:32px;
          margin:4px 0;
        }
        #variant-edit-panel .static-sticker-card input[type="range"],
        #variant-edit-panel #static-border-thickness,
        #variant-edit-panel .static-gown-layer-pct,
        #variant-edit-panel #static-photo-zoom,
        #variant-edit-panel #static-photo-pan-h,
        #variant-edit-panel #static-photo-margin-top,
        #variant-edit-panel #static-photo-margin-left,
        #variant-edit-panel #static-photo-margin-right,
        #variant-edit-panel #static-photo-margin-bottom,
        #variant-edit-panel #static-photo-pan-v {
          accent-color:#10b981;
        }
      </style>
      <div class="variant-edit-sheet">
        <div style="padding:14px 16px 0;flex-shrink:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong id="variant-edit-title" style="font-size:15px;">Variant</strong>
            <button type="button" id="variant-edit-close" style="border:none;background:#f3f4f6;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
          </div>
        </div>
        <div id="variant-edit-scroll">
          <div id="variant-edit-preview-wrap" title="Tap for full size">
            <img id="variant-edit-preview" alt="Preview">
            <div id="variant-edit-preview-hint">Tap image for full size</div>
          </div>
          <p id="variant-edit-price-note" style="font-size:11px;color:#047857;background:#ecfdf5;padding:8px;border-radius:6px;margin:0 0 12px;"></p>
          <div id="variant-edit-remove-section" style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">Remove</div>
            <label id="variant-edit-remove-stickers-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-no-stickers" style="width:18px;height:18px;">
              Remove stickers / badges only
            </label>
            <label id="variant-edit-remove-border-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-border-only" style="width:18px;height:18px;">
              Remove border only (keep stickers)
            </label>
            <label id="variant-edit-remove-both-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-clean-product" style="width:18px;height:18px;">
              Remove border and stickers (clean product)
            </label>
          </div>
          <div id="variant-edit-text-section" style="display:none;margin-bottom:10px;"></div>
          <div id="variant-edit-static-badges" style="display:none;margin-bottom:10px;"></div>
          <div id="variant-edit-add-section" style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px;">Add</div>
            <label id="variant-edit-add-stickers-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-add-stickers" style="width:18px;height:18px;">
              Add stickers / badges only
            </label>
            <label id="variant-edit-add-border-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-add-border" style="width:18px;height:18px;">
              Add border only (keep product)
            </label>
            <label id="variant-edit-add-both-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;cursor:pointer;">
              <input type="checkbox" id="variant-edit-add-both" style="width:18px;height:18px;">
              Add border and stickers
            </label>
          </div>
          <p id="variant-edit-footer-note" style="font-size:10px;color:#6b7280;margin:0 0 8px;">6 preview options — edits update save only, not shipping ₹.</p>
        </div>
        <div style="flex-shrink:0;padding:10px 16px 14px;border-top:1px solid #f3f4f6;background:#fff;">
          <button type="button" id="variant-edit-reset" style="display:none;width:100%;padding:10px;margin-bottom:8px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;cursor:pointer;">Reset to original</button>
          <button type="button" id="variant-edit-done" class="generate-btn" style="width:100%;padding:12px;">Done</button>
        </div>
      </div>
    `;
    this.mountOptimizerOverlay(panel);

    panel.querySelector("#variant-edit-close").onclick = () =>
      this.closeVariantEditor();
    panel.querySelector("#variant-edit-done").onclick = () =>
      this.closeVariantEditor();
    const resetBtn = panel.querySelector("#variant-edit-reset");
    if (resetBtn) {
      resetBtn.onclick = () => {
        const id = this._editingVariantId;
        if (id) void this.resetStaticVariantEdits(id);
      };
    }
    panel.onclick = (e) => {
      if (e.target === panel) this.closeVariantEditor();
    };

    const previewWrap = panel.querySelector("#variant-edit-preview-wrap");
    const previewImg = panel.querySelector("#variant-edit-preview");
    if (previewImg) {
      previewImg.onclick = (e) => {
        e.stopPropagation();
        if (!this.isClickOnVisibleImage(previewImg, e)) return;
        const id = this._editingVariantId;
        if (!id) return;
        const row = this.findResultRow(id);
        if (row) this.openVariantFullPreview(row);
      };
    }
    if (previewWrap) {
      previewWrap.onclick = (e) => {
        if (e.target === previewWrap) e.stopPropagation();
      };
    }

    const onEditChange = (ev) => {
      const id = this._editingVariantId;
      if (!id) return;

      const row = this.findResultRow(id);
      if (!row) return;
      const stickerCb = panel.querySelector("#variant-edit-no-stickers");
      const borderOnlyCb = panel.querySelector("#variant-edit-border-only");
      const cleanCb = panel.querySelector("#variant-edit-clean-product");
      const addStickersCb = panel.querySelector("#variant-edit-add-stickers");
      const addBorderCb = panel.querySelector("#variant-edit-add-border");
      const addBothCb = panel.querySelector("#variant-edit-add-both");
      const target = ev?.target;

      if (target === cleanCb && cleanCb.checked) {
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
        addBothCb.checked = false;
      } else if (target === addBothCb && addBothCb.checked) {
        cleanCb.checked = false;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
      } else if (
        (target === stickerCb || target === borderOnlyCb) &&
        stickerCb.checked &&
        borderOnlyCb.checked
      ) {
        cleanCb.checked = true;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
        addBothCb.checked = false;
      } else if (
        (target === addStickersCb || target === addBorderCb) &&
        addStickersCb.checked &&
        addBorderCb.checked
      ) {
        addBothCb.checked = true;
        addStickersCb.checked = false;
        addBorderCb.checked = false;
        cleanCb.checked = false;
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
      } else if (
        cleanCb.checked &&
        (target === stickerCb || target === borderOnlyCb)
      ) {
        cleanCb.checked = false;
      } else if (
        addBothCb.checked &&
        (target === addStickersCb || target === addBorderCb)
      ) {
        addBothCb.checked = false;
      }

      if (target === stickerCb && stickerCb.checked) {
        addStickersCb.checked = false;
        addBothCb.checked = false;
      }
      if (target === borderOnlyCb && borderOnlyCb.checked) {
        addBorderCb.checked = false;
        addBothCb.checked = false;
      }
      if (target === addStickersCb && addStickersCb.checked) {
        stickerCb.checked = false;
        borderOnlyCb.checked = false;
        cleanCb.checked = false;
        addBothCb.checked = false;
      }
      if (target === addBorderCb && addBorderCb.checked) {
        borderOnlyCb.checked = false;
        stickerCb.checked = false;
        cleanCb.checked = false;
        addBothCb.checked = false;
      }

      this.setVariantEdits(id, {
        stickersRemoved: !!stickerCb?.checked,
        borderOnlyRemoved: !!borderOnlyCb?.checked,
        cleanProduct: !!cleanCb?.checked,
        stickersAdded: !!addStickersCb?.checked,
        borderAdded: !!addBorderCb?.checked,
        fullDecorationsAdded: !!addBothCb?.checked,
      });
    };
    [
      "#variant-edit-no-stickers",
      "#variant-edit-border-only",
      "#variant-edit-clean-product",
      "#variant-edit-add-stickers",
      "#variant-edit-add-border",
      "#variant-edit-add-both",
    ].forEach((sel) => {
      const el = panel.querySelector(sel);
      if (el) el.onchange = onEditChange;
    });

    return panel;
  }

  async openVariantEditor(variantId) {
    const row = this.findResultRow(variantId);
    if (!this.canEditResultRow(row)) {
      if (row) {
        this.openVariantFullPreview(row);
        return;
      }
      OptimizerUtils.showNotification(
        "Layer edit not available for this variant",
        "info"
      );
      return;
    }

    this._editingVariantId = variantId;
    this.ensureFrozenPricing(row);
    this.captureTextOverlayDefaults(row);
    this.ensureTextOverlayState(row);
    const previewSrc = this.resolveVariantPreviewSrc(row);
    if (previewSrc) row.imageUrl = previewSrc;

    this.ensureVariantEditorPanel();
    this.renderVariantEditorPanel(row);
    const panel = document.getElementById("variant-edit-panel");
    if (panel) {
      this.mountOptimizerOverlay(panel);
      panel.style.display = "flex";
    }

    void (async () => {
      const composeLoaded = await this.preloadStaticComposeModule();
      if (!composeLoaded && this._editingVariantId === variantId) {
        OptimizerUtils.showNotification(
          "Editor controls loading… sliders may be limited until reload",
          "info",
          5000,
        );
      }
      if (this._editingVariantId !== variantId) return;
      if (this.hasAdvancedEditor(row) || this.isStaticPromoRow(row)) {
        if (window.StaticFrameCompose?.ensureVariantPlacementMeta) {
          try {
            await window.StaticFrameCompose.ensureVariantPlacementMeta(row);
          } catch (e) {
            console.warn("ensureVariantPlacementMeta:", e);
          }
        } else if (
          window.StaticFrameCompose?.ensureStaticPlacementMeta &&
          row.layers._staticFrame
        ) {
          window.StaticFrameCompose.ensureStaticPlacementMeta(
            row.layers,
            row.layers._staticFrame.style,
          );
        }
        try {
          await this.applyRowStaticPreview(variantId, row);
        } catch (e) {
          console.warn("Editor open preview compose:", e);
        }
      }
      if (this._editingVariantId === variantId) {
        this.renderVariantEditorPanel(row);
      }
    })();
  }

  refreshResultsView() {
    const resultsArea = document.getElementById("results-area");
    if (!resultsArea) return;
    if (!this.currentResults.length && !this.analysisPrimaryResults.length) {
      return;
    }
    resultsArea.innerHTML = OptimizerUI.getResultsHTML(
      this.currentResults,
      this.getResultsViewOptions()
    );
    this.setupResultsEvents();
  }

  setManualShipping(variantId, price) {
    const row = this.findResultRow(variantId);
    if (!row) return;
    const value = parseInt(price, 10);
    const inFramed = this.framedExtraResults.some(
      (r) => r.variantId === variantId,
    );
    if (!value || value <= 0) {
      row.shippingCost = 0;
      row.manualPrice = false;
      row.isVerified = false;
    } else {
      row.shippingCost = value;
      row.manualPrice = true;
      row.isVerified = true;
    }
    if (inFramed) {
      this.resortFramedExtrasByManualPrice();
    } else {
      this.resortResultsByManualPrice();
    }
  }

  resortFramedExtrasByManualPrice() {
    this.framedExtraResults.sort((a, b) => {
      const aPriced = a.shippingCost > 0 ? 0 : 1;
      const bPriced = b.shippingCost > 0 ? 0 : 1;
      if (aPriced !== bPriced) return aPriced - bPriced;
      if (a.shippingCost > 0 && b.shippingCost > 0) {
        return a.shippingCost - b.shippingCost;
      }
      return 0;
    });
    this.refreshResultsView();
  }

  resortResultsByManualPrice() {
    this.currentResults.sort((a, b) => {
      const aPriced = a.shippingCost > 0 ? 0 : 1;
      const bPriced = b.shippingCost > 0 ? 0 : 1;
      if (aPriced !== bPriced) return aPriced - bPriced;
      if (a.shippingCost > 0 && b.shippingCost > 0) {
        return a.shippingCost - b.shippingCost;
      }
      return 0;
    });
    this.refreshResultsView();
  }

  async importCategoriesFromJson() {
    const textarea = document.getElementById("category-json-import");
    if (!textarea || typeof MeeshoAPI === "undefined") return;
    try {
      const categories = MeeshoAPI.importCategoryTreeJson(textarea.value);
      OptimizerUtils.showNotification(
        `Imported ${categories.length} categories`,
        "success"
      );
      MeeshoAPI.cache.categories = categories;
      await this.loadCategoryDropdown();
    } catch (err) {
      OptimizerUtils.showNotification(err.message || "Invalid category JSON", "error");
    }
  }

  setupResultsEvents() {
    document.querySelectorAll(".manual-price-input").forEach((input) => {
      const apply = () => {
        this.setManualShipping(input.dataset.variantId, input.value);
      };
      input.onchange = apply;
      input.onblur = apply;
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          apply();
        }
      };
    });

    document.querySelectorAll(".result-card").forEach((card) => {
      card.style.cursor = "pointer";
      card.onclick = (e) => {
        if (
          e.target.closest(
            ".apply-btn, .result-card-save, .manual-price-input, button, input",
          )
        ) {
          return;
        }
        const variantId = card.dataset.variantId;
        if (!variantId) return;
        this.selectResultVariant(variantId);
      };
    });

    document.querySelectorAll(".result-img").forEach((img) => {
      img.style.cursor = "pointer";
      img.onclick = (e) => this.handleResultImagePreviewClick(img, e);
    });

    const resultsArea = document.getElementById("results-area");
    if (resultsArea && !resultsArea.dataset.previewTapBound) {
      resultsArea.dataset.previewTapBound = "1";
      resultsArea.addEventListener("click", (e) => {
        const img = e.target.closest?.(".result-img[data-variant-id]");
        if (!img || !resultsArea.contains(img)) return;
        this.handleResultImagePreviewClick(img, e);
      });
    }

    document.querySelectorAll(".result-card-save").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const row = this.findResultRow(btn.dataset.variantId);
        if (row) this.downloadImage(row);
      };
    });

    document.querySelectorAll(".apply-btn").forEach((btn) => {
      if (window.WEB_OPTIMIZER_MODE) btn.textContent = "Save";
      btn.onclick = () => {
        const row = this.findResultRow(btn.dataset.variantId);
        if (!row) return;
        if (window.WEB_OPTIMIZER_MODE) {
          this.downloadImage(row);
        } else {
          this.applyImage(row);
        }
      };
    });

    const toggleFramed = document.getElementById("toggle-framed-extras");
    if (toggleFramed) {
      toggleFramed.onclick = () => {
        this.showFramedExtras = !this.showFramedExtras;
        this.refreshResultsView();
      };
    }

    const toggleAnalysis = document.getElementById("toggle-analysis-extras");
    if (toggleAnalysis) {
      toggleAnalysis.onclick = () => {
        this.showAnalysisExtras = !this.showAnalysisExtras;
        this.refreshResultsView();
      };
    }

    const dlAllBtn = document.getElementById("dl-all-btn");
    if (dlAllBtn) {
      dlAllBtn.onclick = () => {
        const list = this.getActiveResultList();
        list.forEach((r, i) => {
          setTimeout(() => this.downloadImage(r), i * 400);
        });
      };
    }

    const applyBestBtn = document.getElementById("apply-best-btn");
    if (applyBestBtn) {
      this.updateApplyBestButton();
    }

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) {
      restartBtn.onclick = () => {
        this.resetToUploadForm();
      };
    }
  }

  updateApplyBestButton() {
    const applyBestBtn = document.getElementById("apply-best-btn");
    if (!applyBestBtn) return;
    const target = this.getApplyTargetResult();
    const best = this.getBestActiveResult();
    const usingSelection =
      !!this.selectedVariantId &&
      target?.variantId === this.selectedVariantId &&
      target?.variantId !== best?.variantId;
    const price = target?.shippingCost || target?.estShipping || "";
    const labelBase = usingSelection ? "Apply Selected" : "Apply Best";

    if (window.WEB_OPTIMIZER_MODE) {
      applyBestBtn.textContent = price ? `Download Best ₹${price}` : "Download Best";
      applyBestBtn.onclick = () => this.downloadImage(target);
      return;
    }

    if (this.isMeeshoPage()) {
      applyBestBtn.textContent = price
        ? `${labelBase} ₹${price}`
        : `${labelBase} Variant`;
      applyBestBtn.onclick = () => void this.applyImage(target);
      return;
    }

    applyBestBtn.textContent = price ? `Download Best ₹${price}` : "Download Best";
    applyBestBtn.onclick = () => this.downloadImage(target);
  }

  async downloadImage(result) {
    if (!result) {
      OptimizerUtils.showNotification("Could not find image to download", "error");
      return;
    }

    const name = (result.name || "variant").replace(/\s+/g, "-");
    const filename = "meesho-" + name + "-" + Date.now() + ".jpg";
    let url = "";
    const edited =
      this.isVariantEdited(result.editFlags, result.layers, result) ||
      !!result._textOverlaysEdited ||
      this.textOverlaysChanged(result);
    if (edited && result.layers?._staticFrame) {
      try {
        url = await this.composeSaveForRow(result);
      } catch (e) {
        console.warn("Save compose failed, using pricing image:", e);
      }
    }
    if (!url) {
      url = this.resolveDownloadUrl(result);
    }

    if (!url) {
      OptimizerUtils.showNotification(
        "No image data for " + (result.name || "variant"),
        "error"
      );
      return;
    }

    try {
      const edited = this.isVariantEdited(
        result.editFlags,
        result.layers,
        result,
      );
      let blob = !edited && result.blob instanceof Blob ? result.blob : null;
      if (!blob) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Fetch failed");
        blob = await resp.blob();
      }

      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      }, 250);
      OptimizerUtils.showNotification("Downloaded: " + (result.name || "image"), "success");
    } catch (e) {
      console.error("Download failed:", e);
      try {
        window.open(url, "_blank", "noopener");
        OptimizerUtils.showNotification(
          "Tap and hold the image to save (mobile)",
          "info"
        );
      } catch (e2) {
        OptimizerUtils.showNotification("Download failed — try Save on the card", "error");
      }
    }
  }

  async resolveResultBlob(result) {
    if (!result) return null;

    const edited =
      this.isVariantEdited(result.editFlags, result.layers, result) ||
      !!result._textOverlaysEdited ||
      this.textOverlaysChanged(result);

    if (edited && result.layers?._staticFrame) {
      try {
        const composed = await this.composeSaveForRow(result);
        if (composed) {
          const resp = await fetch(composed);
          if (resp.ok) return await resp.blob();
        }
      } catch (e) {
        console.warn("Compose for apply failed:", e);
      }
    }

    if (!edited && result.blob instanceof Blob && result.blob.size > 0) {
      return result.blob;
    }

    const url = this.resolveDownloadUrl(result);
    if (!url) return null;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Could not load variant image");
    return await resp.blob();
  }

  async waitForMeeshoCatalogImageInput(maxMs = 4000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const input = this.findMeeshoCatalogImageInput();
      if (input) return input;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  async applyImage(result) {
    if (!result) {
      OptimizerUtils.showNotification("No variant selected to apply", "error");
      return;
    }

    if (!(await this.ensureLicensed("Apply"))) return;

    try {
      const ctx =
        typeof MeeshoAPI !== "undefined" && MeeshoAPI.findFrontImageUploadContext
          ? MeeshoAPI.findFrontImageUploadContext()
          : { fileInput: null, removeButton: null, previewImg: null };
      let imageInput = ctx.fileInput || this.findMeeshoCatalogImageInput();

      if (!imageInput && (ctx.removeButton || ctx.uploadButton || this.canApplyToMeeshoPage())) {
        imageInput = await this.waitForMeeshoCatalogImageInput();
      }

      if (!imageInput) {
        OptimizerUtils.showNotification(
          "Open Add Product (Front Image upload) on Meesho, then tap Apply again — downloading image for now",
          "info",
          7000,
        );
        await this.downloadImage(result);
        return;
      }

      OptimizerUtils.showNotification("Applying image to Meesho…", "info");

      const blob = await this.resolveResultBlob(result);
      if (!blob?.size) {
        OptimizerUtils.showNotification("Could not load variant image", "error");
        return;
      }

      const file = new File([blob], "optimized-" + Date.now() + ".jpg", {
        type: blob.type || "image/jpeg",
      });

      const assignToInput = (input) => {
        if (!input) return false;
        if (
          typeof MeeshoAPI !== "undefined" &&
          MeeshoAPI.assignFileToCatalogInput
        ) {
          return MeeshoAPI.assignFileToCatalogInput(input, file);
        }
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        } catch (assignErr) {
          console.warn("File assign failed:", assignErr);
          return false;
        }
      };

      const previousPreview =
        ctx.previewImg?.currentSrc || ctx.previewImg?.src || "";

      let applied = assignToInput(imageInput);

      if (!applied && ctx.removeButton) {
        try {
          ctx.removeButton.click();
          await new Promise((r) => setTimeout(r, 700));
          imageInput =
            MeeshoAPI.findCatalogFileInput?.() ||
            ctx.fileInput ||
            this.findMeeshoCatalogImageInput();
          applied = assignToInput(imageInput);
        } catch (removeErr) {
          console.warn("Remove existing image before apply failed:", removeErr);
        }
      }

      if (!applied) {
        OptimizerUtils.showNotification(
          "Auto-apply blocked on this browser — downloaded image instead. Use Upload on Front Image.",
          "info",
          7000,
        );
        await this.downloadImage(result);
        return;
      }

      await new Promise((r) => setTimeout(r, 1200));

      const latestCtx =
        typeof MeeshoAPI !== "undefined" && MeeshoAPI.findFrontImageUploadContext
          ? MeeshoAPI.findFrontImageUploadContext()
          : ctx;
      const newPreview =
        latestCtx.previewImg?.currentSrc || latestCtx.previewImg?.src || "";
      if (
        previousPreview &&
        newPreview &&
        previousPreview === newPreview &&
        ctx.removeButton
      ) {
        try {
          ctx.removeButton.click();
          await new Promise((r) => setTimeout(r, 700));
          imageInput =
            MeeshoAPI.findCatalogFileInput?.() ||
            this.findMeeshoCatalogImageInput();
          if (!assignToInput(imageInput)) {
            throw new Error("Re-apply after remove failed");
          }
          await new Promise((r) => setTimeout(r, 1200));
        } catch (retryErr) {
          console.warn("Replace existing front image failed:", retryErr);
        }
      }

      this.closeModal();

      // Wait for Meesho to process the image
      await new Promise((r) => setTimeout(r, 3000));

      // Trigger price refresh multiple times
      await this.triggerPriceRefresh();
      await new Promise((r) => setTimeout(r, 1500));
      await this.triggerPriceRefresh();
      await new Promise((r) => setTimeout(r, 2000));

      // Now read the ACTUAL price from page (this is what Meesho calculated)
      const finalShipping = await this.waitForFinalShipping();

      // Update stats
      const savings = result.savings > 0 ? result.savings : 0;
      await this.updateStats(savings);

      // Show the tested price and actual page price
      const testedPrice = result.shippingCost;
      if (finalShipping) {
        if (finalShipping === testedPrice) {
          OptimizerUtils.showNotification(
            `✅ Shipping: ₹${finalShipping}`,
            "success"
          );
        } else if (finalShipping < testedPrice) {
          // Page price is LOWER - great news!
          OptimizerUtils.showNotification(
            `🎉 Shipping: ₹${finalShipping} (Better than expected!)`,
            "success"
          );
          console.log(
            `✅ Price better than expected - Page: ₹${finalShipping}, API: ₹${testedPrice}`
          );
        } else {
          // Page price is higher
          OptimizerUtils.showNotification(
            `✅ Shipping: ₹${finalShipping} (API showed ₹${testedPrice})`,
            "info"
          );
          console.log(
            `⚠️ Price higher than API - Page: ₹${finalShipping}, API: ₹${testedPrice}`
          );
        }
      } else {
        OptimizerUtils.showNotification(
          `✅ Applied! (API: ₹${testedPrice})`,
          "success"
        );
      }
    } catch (err) {
      console.error("Apply error:", err);
      OptimizerUtils.showNotification("Error applying image", "error");
    }
  }

  // Wait and get final shipping from page
  async waitForFinalShipping() {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 500));

      // Try to find shipping on page
      const shipping = this.detectShipping();
      if (shipping && shipping > 0) {
        console.log("📦 Final shipping from page:", shipping);
        return shipping;
      }
    }
    return null;
  }

  // Update stats in storage
  async updateStats(savings) {
    try {
      const result = await chrome.storage.sync.get(["stats"]);
      const stats = result.stats || { imagesOptimized: 0, totalSavings: 0 };

      stats.imagesOptimized = (stats.imagesOptimized || 0) + 1;
      stats.totalSavings = (stats.totalSavings || 0) + savings;

      await chrome.storage.sync.set({ stats: stats });
      console.log("📊 Stats updated:", stats);
    } catch (err) {
      console.error("Stats update error:", err);
    }
  }

  stopProcessing() {
    this.requestStopGeneration();
  }
}

// Initialize — singleton so popup re-inject does not duplicate listeners
if (window.WEB_OPTIMIZER_MODE) {
  window.MeeshoShippingOptimizer = MeeshoShippingOptimizer;
  if (typeof initWebOptimizerButtons === "function") initWebOptimizerButtons();
} else if (!window.meeshoOptimizer) {
  window.meeshoOptimizer = new MeeshoShippingOptimizer();
} else if (typeof window.meeshoOptimizer.openModal === "function") {
  // Script re-injected (e.g. from popup) — open on request only, no second instance
  console.log("Shipping Optimizer already active on this tab");
}
