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
      await chrome.storage.sync.set({
        licenseKey: trimmedKey,
        licenseStatus: "active",
        licenseInfo: {
          key: trimmedKey,
          planType: "demo",
          expiresAt: new Date(
            Date.now() + (demoInfo.days || 30) * 86400000,
          ).toISOString(),
        },
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
    const data = await chrome.storage.sync.get(["licenseKey"]);
    if (!data.licenseKey) return;

    const bg = self.backgroundInstance;
    if (!bg) return;

    const valid = await bg.verifyLicenseKey(data.licenseKey);

    if (!valid) {
      await chrome.storage.sync.set({
        licenseStatus: "inactive",
        licenseInfo: null,
      });
      console.log("License invalid. Extension locked.");
    }

    safeNotify({ type: "LICENSE_UPDATED", valid });
  } catch (e) {
    console.error("License auto-check failed:", e);
  }
}

setTimeout(autoLicenseCheck, 3000);
setInterval(autoLicenseCheck, 5 * 60 * 1000);

new BackgroundService();
