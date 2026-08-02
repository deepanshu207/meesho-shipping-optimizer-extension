// ============================================
// MEESHO SHIPPING OPTIMIZER - CONFIGURATION
// ============================================

const CONFIG = {
  // Server URLs
  SERVER_URL: "https://darkviolet-ostrich-615182.hostingersite.com/api",
  SERVER_URL_FALLBACK:
    "https://darkviolet-ostrich-615182.hostingersite.com/api",

  // Default WhatsApp (Fallback)
  DEFAULT_WHATSAPP: "918905811996",
  DEFAULT_WHATSAPP_MESSAGE:
    "Hi! I want to purchase Meesho AI Shipping Optimizer Cost license.",

  // Extension Settings
  EXTENSION_NAME: "Meesho Shipping Cost Optimizer",
  VERSION: "1.1.0",

  /** Public path for bundled live shipping seed CSVs (web + extension). */
  PUBLIC_SEED_REPORTS_PATH: "/data/seed-reports",
  LICENSE_CHECK_INTERVAL: 24 * 60 * 60 * 1000,

  // Demo keys are now fetched from server
  // Fallback demo key (only used if server unreachable)
  FALLBACK_DEMO_KEY: "MEESHO-DEMOFREE",
  FALLBACK_DEMO_DAYS: 1,

  // Cache for server demo keys
  _demoKeysCache: null,
  _demoKeysCacheTime: 0,

  // Fetch demo keys from server
  getDemoKeys: async function () {
    // Return cache if fresh (5 min)
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
            console.log(
              "✅ Demo keys fetched from server:",
              Object.keys(data.demoKeys)
            );
            return data.demoKeys;
          }
        }
      } catch (e) {
        console.log("Demo keys fetch failed:", url);
      }
    }

    // Fallback
    console.log("⚠️ Using fallback demo key");
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
console.log("📋 Config loaded - Server:", CONFIG.SERVER_URL);
