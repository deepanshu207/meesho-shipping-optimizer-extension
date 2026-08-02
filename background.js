// Background service worker for Meesho Shipping Optimizer

class BackgroundService {
  constructor() {
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
        case "VERIFY_LICENSE":
        case "GET_LICENSE_STATUS":
        case "FORCE_LICENSE_CHECK":
          sendResponse({
            success: true,
            valid: true,
            status: { key: "FREE", status: "active" },
          });
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
    return [
      { name: "Original", data: imageData, modifications: [] },
    ];
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
}

new BackgroundService();
