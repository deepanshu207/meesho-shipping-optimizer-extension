// Popup — open optimizer on Meesho supplier panel (no license required)

document.addEventListener("DOMContentLoaded", () => {
  const openCatalogBtn = document.getElementById("open-catalog");
  const openMeeshoBtn = document.getElementById("open-meesho");

  async function openOptimizerOnTab(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "openOptimizer" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "config.js",
          "js/utils.js",
          "js/license.js",
          "js/meeshoCategories.js",
          "js/meeshoApi.js",
          "js/imageGenerator.js",
          "js/ui.js",
          "content.js",
        ],
      });
      await chrome.tabs.sendMessage(tabId, { action: "openOptimizer" });
    }
  }

  if (openCatalogBtn) {
    openCatalogBtn.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;
      const url = tab.url || "";
      if (!url.includes("supplier.meesho.com")) {
        chrome.tabs.create({
          url: "https://supplier.meesho.com/panel/v3/new/cataloging/single/add",
        });
        return;
      }
      await openOptimizerOnTab(tab.id);
      window.close();
    });
  }

  if (openMeeshoBtn) {
    openMeeshoBtn.addEventListener("click", () => {
      chrome.tabs.create({
        url: "https://supplier.meesho.com/panel/v3/new/cataloging/single/add",
      });
    });
  }
});
