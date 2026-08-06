// Popup helpers — Kiwi/mobile-safe navigation & WhatsApp

const PopupActions = {
  MEESHO_CATALOG_URL:
    (typeof CONFIG !== "undefined" && CONFIG.MEESHO_CATALOG_URL) ||
    "https://supplier.meesho.com/panel/v3/new/cataloging/ytnlz/catalogs/single/add",

  /** Ignore taps right after popup opens (ghost click from extension icon). */
  POPUP_GUARD_MS: 450,
  _popupReadyAt: 0,

  armPopupInteractionGuard() {
    this._popupReadyAt = Date.now() + this.POPUP_GUARD_MS;
  },

  popupInteractionsReady() {
    return Date.now() >= this._popupReadyAt;
  },

  isAndroid() {
    return /Android/i.test(navigator.userAgent || "");
  },

  isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  },

  normalizeWhatsAppNumber(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  },

  getWhatsAppNumber() {
    return this.normalizeWhatsAppNumber(
      (typeof CONFIG !== "undefined" && CONFIG.DEFAULT_WHATSAPP) ||
        "919654414891",
    );
  },

  buildWhatsAppUrls(number, message) {
    if (typeof WhatsAppLink !== "undefined") {
      return WhatsAppLink.buildUrls(number, message);
    }
    const phone = this.normalizeWhatsAppNumber(number);
    const text = encodeURIComponent(message || "");
    return {
      api: `https://api.whatsapp.com/send?phone=${phone}&text=${text}`,
      waMe: `https://wa.me/${phone}?text=${text}`,
      scheme: `whatsapp://send?phone=${phone}&text=${text}`,
    };
  },

  openWhatsApp(number, message) {
    if (typeof WhatsAppLink !== "undefined") {
      return WhatsAppLink.open(number, message);
    }
    const urls = this.buildWhatsAppUrls(number, message);
    if (this.isMobile()) {
      if (typeof WhatsAppLink !== "undefined") {
        return WhatsAppLink.openMobileScheme(urls.scheme);
      }
      return Promise.resolve(true);
    }
    return this.openUrl(urls.waMe || urls.api);
  },

  /** @deprecated use openWhatsApp */
  openWhatsAppApp(urls) {
    return this.openWhatsApp(
      (urls?.scheme || "").match(/phone=([^&]+)/)?.[1],
      decodeURIComponent((urls?.scheme || "").match(/text=([^#]+)/)?.[1] || ""),
    );
  },

  openUrl(url) {
    if (!url) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        if (chrome?.tabs?.create) {
          chrome.tabs.create({ url }, () => {
            resolve(!chrome.runtime.lastError);
          });
          return;
        }
      } catch (e) {}
      try {
        const opened = window.open(url, "_blank");
        resolve(!!opened);
      } catch (e) {
        resolve(false);
      }
    });
  },

  tabsQuery(queryInfo) {
    return new Promise((resolve) => {
      try {
        if (!chrome?.tabs?.query) {
          resolve([]);
          return;
        }
        chrome.tabs.query(queryInfo, (tabs) => {
          resolve(chrome.runtime.lastError ? [] : tabs || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  },

  tabUpdate(tabId, props) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.update(tabId, props, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (e) {
        resolve(false);
      }
    });
  },

  windowUpdate(windowId, props) {
    return new Promise((resolve) => {
      try {
        chrome.windows.update(windowId, props, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (e) {
        resolve(false);
      }
    });
  },

  async findMeeshoTab() {
    let tabs = await this.tabsQuery({ url: "*://supplier.meesho.com/*" });
    if (!tabs.length) {
      tabs = await this.tabsQuery({});
      tabs = tabs.filter((t) =>
        (t.url || "").includes("supplier.meesho.com"),
      );
    }
    if (!tabs.length) return null;
    return (
      tabs.find(
        (t) =>
          t.url &&
          (t.url.includes("/cataloging/") ||
            t.url.includes("/catalogs/single") ||
            t.url.includes("/catalog")),
      ) || tabs[0]
    );
  },

  async isOptimizerReady(tabId) {
    try {
      if (!chrome?.scripting?.executeScript) return false;
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () =>
          !!(window.meeshoOptimizer && window.meeshoOptimizer.openModal),
      });
      return !!results?.[0]?.result;
    } catch (e) {
      return false;
    }
  },

  async injectOptimizer(tabId) {
    if (await this.isOptimizerReady(tabId)) return true;

    try {
      if (chrome?.scripting?.insertCSS) {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ["styles.css"],
        });
      }
    } catch (e) {}

    try {
      if (chrome?.scripting?.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            "config.js",
            "js/firebaseLicense.js",
            "js/machineId.js",
            "js/utils.js",
            "js/whatsappLink.js",
            "js/license.js",
            "js/meeshoCategories.js",
            "js/meeshoApi.js",
            "js/imageGenerator.js",
            "js/ui.js",
            "content.js",
          ],
        });
        return await this.isOptimizerReady(tabId);
      }
    } catch (e) {
      console.warn("Script inject failed:", e);
    }
    return false;
  },

  async sendOpenOptimizer(tabId, retries = 4) {
    for (let i = 0; i < retries; i++) {
      const ok = await new Promise((resolve) => {
        try {
          chrome.tabs.sendMessage(tabId, { action: "openOptimizer" }, () => {
            resolve(!chrome.runtime.lastError);
          });
        } catch (e) {
          resolve(false);
        }
      });
      if (ok) return true;
      await new Promise((r) => setTimeout(r, 200 + i * 150));
    }
    return false;
  },

  async openOptimizerOnMeesho(onStatus) {
    const report = (msg) => onStatus?.(msg);

    let tab = await this.findMeeshoTab();

    if (!tab?.id) {
      report("Opening Meesho catalog…");
      await this.openUrl(this.MEESHO_CATALOG_URL);
      try {
        window.close();
      } catch (e) {}
      return;
    }

    report("Opening optimizer…");
    await this.tabUpdate(tab.id, { active: true });
    if (tab.windowId) await this.windowUpdate(tab.windowId, { focused: true });

    let ok = await this.sendOpenOptimizer(tab.id);
    if (!ok) {
      await this.injectOptimizer(tab.id);
      ok = await this.sendOpenOptimizer(tab.id);
    }

    if (!ok) {
      report("Tap the orange Optimizer button on the Meesho page.");
    }

    try {
      window.close();
    } catch (e) {}
  },

  bindTap(el, handler) {
    if (!el || typeof handler !== "function") return;
    let lastTap = 0;
    const run = (e) => {
      if (!this.popupInteractionsReady()) {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        return;
      }
      const now = Date.now();
      if (now - lastTap < 400) return;
      lastTap = now;
      if (e?.preventDefault) e.preventDefault();
      if (e?.stopPropagation) e.stopPropagation();
      handler(e);
    };
    el.addEventListener("click", run);
    // touchend omitted — it causes ghost taps when the popup opens under the finger
  },
};

window.PopupActions = PopupActions;
