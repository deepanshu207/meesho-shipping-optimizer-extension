// Wire upload UI (already in HTML) to optimizer engine
(function () {
  const MAX_BOOT_MS = 20000;
  const start = Date.now();

  function setBootMsg(text) {
    const el = document.getElementById("boot-msg");
    if (el) el.textContent = text;
  }

  function boot() {
    if (typeof MeeshoShippingOptimizer === "undefined") {
      if (Date.now() - start < MAX_BOOT_MS) {
        setTimeout(boot, 100);
        return;
      }
      setBootMsg("Engine failed to load — refresh the page.");
      return;
    }

    try {
      setBootMsg("");
      const root = document.getElementById("optimizer-app");
      const optimizer = new MeeshoShippingOptimizer();
      window.meeshoOptimizer = optimizer;
      optimizer.mountEmbedded(root);
    } catch (err) {
      console.error(err);
      setBootMsg("Error: " + err.message);
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
