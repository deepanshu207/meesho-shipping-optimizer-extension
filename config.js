// ============================================
// MEESHO SHIPPING OPTIMIZER - CONFIGURATION
// Developer: Deepanshu Arora
// ============================================

const CONFIG = {
  SERVER_URL: "https://darkviolet-ostrich-615182.hostingersite.com/api",
  SERVER_URL_FALLBACK:
    "https://darkviolet-ostrich-615182.hostingersite.com/api",

  DEFAULT_WHATSAPP: "918905811996",
  DEFAULT_WHATSAPP_MESSAGE:
    "Hi! I want to purchase Meesho Shipping Optimizer license.",

  EXTENSION_NAME: "Shipping Optimizer",
  AUTHOR: "Deepanshu Arora",
  VERSION: "1.0.0",

  LICENSE_CHECK_INTERVAL: 24 * 60 * 60 * 1000,

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

    const urls = [this.SERVER_URL, this.SERVER_URL_FALLBACK];
    for (const url of urls) {
      try {
        const res = await fetch(`${url}/demo-keys`, {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this._demoKeysCache = this.mergeDemoKeys(data.demoKeys);
            this._demoKeysCacheTime = Date.now();
            return this._demoKeysCache;
          }
        }
      } catch (e) {
        console.log("Demo keys fetch failed:", url);
      }
    }

    this._demoKeysCache = { ...this.BUILTIN_DEMO_KEYS };
    this._demoKeysCacheTime = Date.now();
    return this._demoKeysCache;
  },

  getServerUrls: function () {
    return [this.SERVER_URL, this.SERVER_URL_FALLBACK];
  },

  getEndpoint: function (path) {
    return {
      primary: this.SERVER_URL + path,
      fallback: this.SERVER_URL_FALLBACK + path,
    };
  },
};

window.CONFIG = CONFIG;
console.log("Config loaded:", CONFIG.EXTENSION_NAME, "v" + CONFIG.VERSION);
