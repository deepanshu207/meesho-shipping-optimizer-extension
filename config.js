// ============================================
// MEESHO SHIPPING OPTIMIZER - CONFIGURATION
// Developer: Deepanshu Arora
// ============================================

const CONFIG = {
  DEFAULT_WHATSAPP: "919654414891",
  DEFAULT_WHATSAPP_MESSAGE:
    "Hi! I want to purchase Shipping Optimizer license.",

  EXTENSION_NAME: "Shipping Optimizer",
  AUTHOR: "Deepanshu Arora",
  VERSION: "1.6.6",

  /** Default Meesho single-catalog add page (supplier panel). */
  MEESHO_CATALOG_URL:
    "https://supplier.meesho.com/panel/v3/new/cataloging/ytnlz/catalogs/single/add",

  // Firebase (extension-e6e32) — dedicated project, ONLY shipping_optimizer_* collections
  USE_FIREBASE_LICENSE: true,
  FIREBASE: {
    apiKey: "AIzaSyDJd0Ufed0zwCHYmakz-WcncU_NSWxkJ1U",
    authDomain: "extension-e6e32.firebaseapp.com",
    projectId: "extension-e6e32",
    storageBucket: "extension-e6e32.firebasestorage.app",
    messagingSenderId: "860976240598",
    appId: "1:860976240598:web:e5d903d52db5b71e48b677",
    measurementId: "G-WCTXFCDXLT",
    /** Firebase auto-created Web client — must match Google Cloud + Authorized redirect URIs for this extension ID */
    oauthClientId:
      "860976240598-82l82a6dp7btp6eucdmlqh68fuf2s0bs.apps.googleusercontent.com",
  },

  /** HTTPS Cloud Function URL — claimGoogleTrial (set after deploy; also in Firebase app config). */
  GOOGLE_TRIAL_FUNCTION_URL:
    "https://us-central1-extension-e6e32.cloudfunctions.net/claimGoogleTrial",

  LICENSE_CHECK_INTERVAL: 24 * 60 * 60 * 1000,

  // Fallback demo keys when Firebase is offline. Firebase app.demo_keys and
  // shipping_optimizer_demo_keys/* override matching keys (5 min cache).
  BUILTIN_DEMO_KEYS: {
    "MEESHO-DEMOFREE": { days: 30 },
    "MEESHO-DEMOFREE-PROMO": { days: 30 },
    "MEESHO-DEMO-PROMO": { days: 30 },
    "MEESHO-DEMO999": { days: 7 },
  },

  _demoKeysCache: null,
  _demoKeysCacheTime: 0,

  normalizeLicenseKey: function (key) {
    return String(key || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-");
  },

  mergeDemoKeys: function (serverKeys) {
    const merged = { ...this.BUILTIN_DEMO_KEYS };
    if (
      serverKeys &&
      typeof serverKeys === "object" &&
      !Array.isArray(serverKeys)
    ) {
      Object.assign(merged, serverKeys);
    }
    return merged;
  },

  getDemoKeys: async function () {
    if (this._demoKeysCache && Date.now() - this._demoKeysCacheTime < 300000) {
      return this._demoKeysCache;
    }

    if (
      this.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        const fb = await FirebaseLicense.getDemoKeysMap();
        if (fb && Object.keys(fb).length) {
          this._demoKeysCache = this.mergeDemoKeys(fb);
          this._demoKeysCacheTime = Date.now();
          return this._demoKeysCache;
        }
      } catch (e) {
        console.log("Firebase demo keys fetch failed:", e.message);
      }
    }

    this._demoKeysCache = { ...this.BUILTIN_DEMO_KEYS };
    this._demoKeysCacheTime = Date.now();
    return this._demoKeysCache;
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.CONFIG = CONFIG;
}
console.log("Config loaded:", CONFIG.EXTENSION_NAME, "v" + CONFIG.VERSION);
