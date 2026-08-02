// Chrome extension API shim for standalone web deployment
window.WEB_OPTIMIZER_MODE = true;

(function () {
  const SYNC_PREFIX = "__meesho_sync_";
  const LOCAL_PREFIX = "__meesho_local_";

  function createStorage(prefix) {
    return {
      get(keys) {
        return new Promise((resolve) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result = {};
          keyList.forEach((key) => {
            const raw = localStorage.getItem(prefix + key);
            if (raw !== null) {
              try {
                result[key] = JSON.parse(raw);
              } catch {
                result[key] = raw;
              }
            }
          });
          resolve(result);
        });
      },
      set(items) {
        return new Promise((resolve) => {
          Object.entries(items).forEach(([key, value]) => {
            localStorage.setItem(prefix + key, JSON.stringify(value));
          });
          resolve();
        });
      },
      remove(keys) {
        return new Promise((resolve) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((key) => localStorage.removeItem(prefix + key));
          resolve();
        });
      },
    };
  }

  const storage = {
    sync: createStorage(SYNC_PREFIX),
    local: createStorage(LOCAL_PREFIX),
  };

  storage.sync.set({
    licenseStatus: "active",
    licenseKey: "WEB-FREE",
    licenseInfo: {
      key: "WEB-FREE",
      planType: "premium",
      activatedAt: new Date().toISOString(),
    },
    lastVerified: Date.now(),
  });

  const messageListeners = [];

  window.chrome = {
    storage,
    runtime: {
      getURL(path) {
        return "/" + String(path).replace(/^\//, "");
      },
      onMessage: {
        addListener(fn) {
          messageListeners.push(fn);
        },
      },
      sendMessage() {},
      lastError: null,
    },
    tabs: {
      create({ url }) {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      query(_filter, callback) {
        if (typeof callback === "function") callback([]);
      },
      update() {},
      sendMessage() {
        return Promise.resolve();
      },
    },
    windows: {
      update() {},
    },
    scripting: {
      insertCSS() {
        return Promise.resolve();
      },
      executeScript() {
        return Promise.resolve();
      },
    },
  };
})();
