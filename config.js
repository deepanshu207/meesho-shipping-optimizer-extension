// ============================================
// MEESHO SHIPPING OPTIMIZER - CONFIGURATION
// Developer: Deepanshu Arora
// ============================================

const CONFIG = {
  // Server URLs
  SERVER_URL: "https://darkviolet-ostrich-615182.hostingersite.com/api",
  SERVER_URL_FALLBACK:
    "https://darkviolet-ostrich-615182.hostingersite.com/api",

  // Extension Settings
  EXTENSION_NAME: "Meesho Shipping Cost Optimizer",
  AUTHOR: "Deepanshu Arora",
  VERSION: "1.8.0",

  LICENSE_CHECK_INTERVAL: 24 * 60 * 60 * 1000,

  // Fallback demo key (only used if server unreachable)
  FALLBACK_DEMO_KEY: "MEESHO-DEMOFREE",
  FALLBACK_DEMO_DAYS: 1,

  // Cache for server demo keys
  _demoKeysCache: null,
  _demoKeysCacheTime: 0,

  // Fetch demo keys from server
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
          if (data.success && data.demoKeys) {
            this._demoKeysCache = data.demoKeys;
            this._demoKeysCacheTime = Date.now();
            return data.demoKeys;
          }
        }
      } catch (e) {
        console.log("Demo keys fetch failed:", url);
      }
    }

    return { [this.FALLBACK_DEMO_KEY]: { days: this.FALLBACK_DEMO_DAYS } };
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
