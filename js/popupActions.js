// Popup helpers — Kiwi/mobile-safe navigation & WhatsApp

const PopupActions = {
  MEESHO_CATALOG_URL:
    "https://supplier.meesho.com/panel/v3/new/cataloging/single/add",

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
    const phone = this.normalizeWhatsAppNumber(number);
    const text = encodeURIComponent(message || "");
    return {
      api: `https://api.whatsapp.com/send?phone=${phone}&text=${text}`,
      waMe: `https://wa.me/${phone}?text=${text}`,
      intent: `intent://send?phone=${phone}&text=${text}#Intent;scheme=whatsapp;package=com.whatsapp;end`,
      scheme: `whatsapp://send?phone=${phone}&text=${text}`,
    };
  },

  openWhatsApp(number, message) {
    const urls = this.buildWhatsAppUrls(number, message);
    if (this.isAndroid()) {
      // Prefer WhatsApp app on Android (Kiwi / Chrome mobile)
      window.location.href = urls.scheme;
      setTimeout(() => {
        this.openUrl(urls.api);
      }, 700);
      return;
    }
    this.openUrl(urls.waMe || urls.api);
  },

  openUrl(url) {
    if (!url) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        if (chrome?.tabs?.create) {
          chrome.tabs.create({ url }, () => {
            if (chrome.runtime.lastError) {
              const opened = window.open(url, "_blank");
              if (!opened) window.location.href = url;
            }
            resolve(true);
          });
          return;
        }
      } catch (e) {}
      try {
        const opened = window.open(url, "_blank");
        if (!opened) window.location.href = url;
        resolve(true);
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

  async injectOptimizer(tabId) {
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
            "js/utils.js",
            "js/license.js",
            "js/meeshoCategories.js",
            "js/meeshoApi.js",
            "js/imageGenerator.js",
            "js/ui.js",
            "content.js",
          ],
        });
      }
    } catch (e) {
      console.warn("Script inject failed:", e);
    }
  },

  async sendOpenOptimizer(tabId) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, { action: "openOptimizer" }, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (e) {
        resolve(false);
      }
    });
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
      report("On Meesho page, tap the orange Optimizer button.");
      await this.openUrl(tab.url || this.MEESHO_CATALOG_URL);
    }

    try {
      window.close();
    } catch (e) {}
  },

  bindTap(el, handler) {
    if (!el || typeof handler !== "function") return;
    let lastTap = 0;
    const run = (e) => {
      const now = Date.now();
      if (now - lastTap < 400) return;
      lastTap = now;
      if (e?.preventDefault) e.preventDefault();
      if (e?.stopPropagation) e.stopPropagation();
      handler(e);
    };
    el.addEventListener("click", run);
    el.addEventListener("touchend", run, { passive: false });
  },
};

window.PopupActions = PopupActions;
