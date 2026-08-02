// Boot embedded web optimizer using full content.js logic
(function () {
  const MAX_BOOT_MS = 15000;
  const start = Date.now();

  function setBootMsg(text) {
    const el = document.getElementById("boot-msg");
    if (el) el.textContent = text || "";
  }

  function boot() {
    if (typeof MeeshoShippingOptimizer === "undefined") {
      if (Date.now() - start < MAX_BOOT_MS) {
        setTimeout(boot, 50);
        return;
      }
      setBootMsg("Engine failed to load — refresh the page");
      return;
    }

    try {
      setBootMsg("Ready — choose an image");
      const root = document.getElementById("optimizer-app");
      const optimizer = new MeeshoShippingOptimizer();
      window.meeshoOptimizer = optimizer;
      optimizer.mountEmbedded(root);
      optimizer.preloadTestLabModule?.();

      const btn = document.getElementById("generate-btn");
      const hasFile =
        window.__webPendingFile ||
        optimizer._pendingFile ||
        document.getElementById("image-input")?.files?.[0];
      if (btn && hasFile) btn.disabled = false;
    } catch (err) {
      console.error(err);
      setBootMsg("Error: " + err.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
