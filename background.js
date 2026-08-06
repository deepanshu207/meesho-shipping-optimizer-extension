// Background service worker for Meesho Shipping Optimizer

importScripts("config.js", "js/firebaseLicense.js", "js/machineId.js");

class BackgroundService {
  constructor() {
    self.backgroundInstance = this;
    this.initializeListeners();
  }

  initializeListeners() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.onInstall();
      } else if (details.reason === "update") {
        this.onUpdate();
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  onInstall() {
    console.log("Meesho Shipping Optimizer installed");
    chrome.storage.sync.set({
      settings: {
        autoOptimize: false,
        maxVariations: 5,
        preferredImageFormat: "png",
        compressionLevel: 0.8,
      },
    });
  }

  onUpdate() {
    console.log("Meesho Shipping Optimizer updated");
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "VERIFY_LICENSE": {
          const isValid = await this.verifyLicenseKey(message.licenseKey);
          sendResponse({ success: true, valid: isValid });
          break;
        }
        case "GET_LICENSE_STATUS": {
          const licenseStatus = await this.getLicenseStatus();
          sendResponse({ success: true, status: licenseStatus });
          break;
        }
        case "FORCE_LICENSE_CHECK":
          await autoLicenseCheck();
          sendResponse({ success: true });
          break;
        case "PROCESS_IMAGE":
          sendResponse({
            success: true,
            data: await this.processImageVariations(message.imageData),
          });
          break;
        case "CHECK_SHIPPING":
          sendResponse({
            success: true,
            cost: await this.checkShippingCost(message.imageData),
          });
          break;
        case "SAVE_SETTINGS":
          await this.saveSettings(message.settings);
          sendResponse({ success: true });
          break;
        case "GET_SETTINGS":
          sendResponse({ success: true, settings: await this.getSettings() });
          break;
        case "OPEN_WHATSAPP":
          sendResponse({
            ok: await this.openWhatsAppWeb(message),
          });
          break;
        case "OPEN_WHATSAPP_MOBILE":
          sendResponse({
            ok: await this.openWhatsAppMobile(message),
          });
          break;
        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async processImageVariations(imageData) {
    return [{ name: "Original", data: imageData, modifications: [] }];
  }

  normalizeWhatsAppPhone(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  }

  tabsQuery(queryInfo) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query(queryInfo, (tabs) => {
          resolve(chrome.runtime.lastError ? [] : tabs || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  },

  async focusTab(tab) {
    if (!tab?.id) return;
    try {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId != null) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (e) {}
  },

  async pickMeeshoTab() {
    const active = await this.tabsQuery({
      active: true,
      lastFocusedWindow: true,
    });
    const activeTab = active[0];
    if ((activeTab?.url || "").includes("supplier.meesho.com")) {
      return activeTab;
    }
    const meeshoTabs = await this.tabsQuery({
      url: "*://supplier.meesho.com/*",
    });
    return (
      meeshoTabs.find((t) => t.active) ||
      meeshoTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] ||
      null
    );
  },

  /** Desktop — wa.me in a new tab. */
  async openWhatsAppWeb(message) {
    const phone = this.normalizeWhatsAppPhone(message?.phone);
    const text = encodeURIComponent(message?.message || "");
    const web = `https://wa.me/${phone}?text=${text}`;

    return new Promise((resolve) => {
      try {
        chrome.tabs.create({ url: web, active: true }, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Mobile — inject deep-link click into Meesho page (MAIN world).
   * Does not open api.whatsapp.com in the browser.
   */
  async openWhatsAppMobile(message) {
    const phone = this.normalizeWhatsAppPhone(message?.phone);
    const msg = String(message?.message || "");
    const tab = await this.pickMeeshoTab();

    if (!tab?.id) return false;

    await this.focusTab(tab);

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (phoneDigits, messageText) => {
          const text = encodeURIComponent(messageText || "");
          const phone = String(phoneDigits || "").replace(/\D/g, "");
          const urls = [`whatsapp://send?phone=${phone}&text=${text}`];
          if (/Android/i.test(navigator.userAgent || "")) {
            urls.unshift(
              `intent://send?phone=${phone}&text=${text}#Intent;scheme=whatsapp;package=com.whatsapp;end`,
            );
          }
          const root = document.body || document.documentElement;
          if (!root) return { ok: false };

          for (let i = 0; i < urls.length; i++) {
            try {
              const link = document.createElement("a");
              link.href = urls[i];
              link.style.cssText =
                "position:fixed;left:-9999px;top:-9999px;opacity:0";
              root.appendChild(link);
              link.click();
              link.remove();
              return { ok: true, method: i };
            } catch (e) {}
          }
          return { ok: false };
        },
        args: [phone, msg],
      });
      return results?.[0]?.result?.ok === true;
    } catch (e) {
      console.warn("WhatsApp mobile launch failed:", e.message);
      return false;
    }
  },

  /** @deprecated use openWhatsAppWeb */
  async openWhatsApp(message) {
    return this.openWhatsAppWeb(message);
  }

  async checkShippingCost(imageData) {
    const baseCost = 20;
    const sizeFactor = Math.min((imageData?.length || 0) / 100000, 1) * 10;
    return Math.round(baseCost + sizeFactor + Math.random() * 15);
  }

  async saveSettings(settings) {
    return chrome.storage.sync.set({ settings });
  }

  async getSettings() {
    const r = await chrome.storage.sync.get(["settings"]);
    return r.settings || {};
  }

  async verifyLicenseKey(licenseKey) {
    const trimmedKey = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(licenseKey)
      : String(licenseKey || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "-");

    let demoKeys = { ...(CONFIG.BUILTIN_DEMO_KEYS || {}) };
    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        demoKeys = await FirebaseLicense.getDemoKeysMap();
      } catch (e) {}
    } else if (CONFIG.getDemoKeys) {
      try {
        demoKeys = await CONFIG.getDemoKeys();
      } catch (e) {}
    }

    const demoKeyMatch = Object.keys(demoKeys).find(
      (k) => k.toUpperCase() === trimmedKey,
    );

    if (demoKeyMatch) {
      const demoInfo = demoKeys[demoKeyMatch];
      const unlimitedTime =
        typeof FirebaseLicense !== "undefined" &&
        FirebaseLicense.isUnlimitedFlag
          ? FirebaseLicense.isUnlimitedFlag(
              demoInfo?.unlimited_time ?? demoInfo?.unlimitedTime,
            )
          : !!(demoInfo?.unlimited_time || demoInfo?.unlimitedTime);
      const licenseInfo = {
        key: trimmedKey,
        planType: "demo",
        planName: demoInfo?.label || "Demo",
        unlimitedTime,
        activatedAt: new Date().toISOString(),
      };
      if (!unlimitedTime) {
        licenseInfo.expiresAt = new Date(
          Date.now() + (Number(demoInfo.days) || 30) * 86400000,
        ).toISOString();
      }
      await chrome.storage.sync.set({
        licenseKey: trimmedKey,
        licenseStatus: "active",
        licenseInfo,
        lastVerified: Date.now(),
      });
      return true;
    }

    const machineId = await this.getMachineId();
    if (!machineId) return false;

    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        const fbResult = await FirebaseLicense.verifyPaidLicense(
          trimmedKey,
          machineId,
        );
        if (fbResult.valid === true) {
          await chrome.storage.sync.set({
            licenseKey: trimmedKey,
            licenseStatus: "active",
            licenseInfo: fbResult.license,
            lastVerified: Date.now(),
          });
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  async getMachineId() {
    if (typeof MachineId !== "undefined" && MachineId.get) {
      return MachineId.get();
    }
    const r = await chrome.storage.local.get(["machineId"]);
    return r.machineId || null;
  }

  async getLicenseStatus() {
    const r = await chrome.storage.sync.get(["licenseKey", "licenseStatus"]);
    return {
      key: r.licenseKey,
      status: r.licenseStatus || "inactive",
    };
  }
}

function safeNotify(msg) {
  try {
    chrome.runtime.sendMessage(msg, () => {
      if (chrome.runtime.lastError) {
        /* no listener */
      }
    });
  } catch (e) {}
}

async function autoLicenseCheck() {
  try {
    const data = await chrome.storage.sync.get(["activeLicenses", "licenseKey"]);
    const keys = [];
    if (Array.isArray(data.activeLicenses) && data.activeLicenses.length) {
      data.activeLicenses.forEach((e) => {
        if (e?.key) keys.push(e.key);
      });
    } else if (data.licenseKey) {
      keys.push(data.licenseKey);
    }
    if (!keys.length) return;

    const bg = self.backgroundInstance;
    if (!bg) return;

    let anyValid = false;
    for (const key of keys) {
      if (await bg.verifyLicenseKey(key)) anyValid = true;
    }

    if (!anyValid) {
      await chrome.storage.sync.set({
        licenseStatus: "inactive",
        licenseInfo: null,
        licenseKey: null,
        activeLicenses: [],
      });
      console.log("License invalid. Extension locked.");
    }

    safeNotify({ type: "LICENSE_UPDATED", valid: anyValid });
  } catch (e) {
    console.error("License auto-check failed:", e);
  }
}

setTimeout(autoLicenseCheck, 3000);
setInterval(autoLicenseCheck, 5 * 60 * 1000);

new BackgroundService();
