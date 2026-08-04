// Popup — license, WhatsApp plans, open optimizer on Meesho

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("status-badge");
  const licenseInfo = document.getElementById("license-info");
  const activationSection = document.getElementById("activation-section");
  const activateBtn = document.getElementById("activate-btn");
  const licenseInput = document.getElementById("license-input");
  const openCatalogBtn = document.getElementById("open-catalog");
  const openMeeshoBtn = document.getElementById("open-meesho");
  const messageEl = document.getElementById("popup-message");
  const versionBadge = document.getElementById("version-badge");

  if (versionBadge && typeof CONFIG !== "undefined") {
    versionBadge.textContent = "v" + (CONFIG.VERSION || "1.0.0");
  }

  const serverUrls =
    typeof CONFIG !== "undefined" && CONFIG.getServerUrls
      ? CONFIG.getServerUrls()
      : [];

  const productName = "Meesho Shipping Optimizer";

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = "message " + (type || "");
    if (!text) messageEl.style.display = "none";
    else messageEl.style.display = "block";
  }

  function maskKey(key) {
    if (!key || key.length < 8) return key;
    return key.substring(0, 6) + "••••" + key.substring(key.length - 4);
  }

  async function getMachineId() {
    const stored = await chrome.storage.local.get(["machineId"]);
    if (stored.machineId) return stored.machineId;

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      Date.now(),
    ].join("|");

    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = (hash << 5) - hash + fingerprint.charCodeAt(i);
      hash &= hash;
    }

    const machineId =
      "M" + Math.abs(hash).toString(36).toUpperCase().substring(0, 12);
    await chrome.storage.local.set({ machineId });
    return machineId;
  }

  let demoKeys = null;

  async function fetchDemoKeys() {
    if (demoKeys) return demoKeys;
    demoKeys = await CONFIG.getDemoKeys();
    return demoKeys;
  }

  async function verifyLicenseWithServer(key) {
    const trimmedKey = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : key.trim().toUpperCase().replace(/\s+/g, "-");

    const serverDemoKeys = await fetchDemoKeys();
    const demoKeyMatch = Object.keys(serverDemoKeys).find(
      (k) => k.toUpperCase() === trimmedKey,
    );

    if (demoKeyMatch) {
      const demoInfo = serverDemoKeys[demoKeyMatch];
      const expiresAt = new Date(
        Date.now() + demoInfo.days * 24 * 60 * 60 * 1000,
      );

      await chrome.storage.sync.set({
        licenseKey: trimmedKey,
        licenseStatus: "active",
        licenseInfo: {
          key: trimmedKey,
          planType: "demo",
          expiresAt: expiresAt.toISOString(),
          activatedAt: new Date().toISOString(),
        },
        lastVerified: Date.now(),
      });

      return { success: true };
    }

    const machineId = await getMachineId();
    let lastError = "Could not connect to license server";

    for (const url of serverUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url + "/verify-license", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ licenseKey: trimmedKey, machineId }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          lastError = "Server error: " + response.status;
          continue;
        }

        const result = await response.json();

        if (result.valid === true) {
          await chrome.storage.sync.set({
            licenseKey: trimmedKey,
            licenseStatus: "active",
            licenseInfo: result.license || {
              key: trimmedKey,
              planType: "premium",
              activatedAt: new Date().toISOString(),
            },
            lastVerified: Date.now(),
          });
          return { success: true };
        }

        return {
          success: false,
          message:
            result.reason || result.message || "License verification failed",
        };
      } catch (e) {
        lastError =
          e.name === "AbortError" ? "Connection timeout" : e.message;
      }
    }

    return { success: false, message: lastError };
  }

  async function loadLicenseStatus() {
    try {
      const result = await chrome.storage.sync.get([
        "licenseKey",
        "licenseStatus",
        "licenseInfo",
      ]);

      if (result.licenseStatus === "active" && result.licenseKey) {
        statusBadge.textContent = "Active";
        statusBadge.className = "status-badge active";

        const info = result.licenseInfo || {};
        let infoHTML = `<div class="license-key">${maskKey(result.licenseKey)}</div>`;

        if (info.expiresAt) {
          const expiresAt = new Date(info.expiresAt);
          const diffMs = expiresAt - new Date();

          if (diffMs <= 0) {
            statusBadge.textContent = "Expired";
            statusBadge.className = "status-badge inactive";
            infoHTML += `<div class="expiry-warning"><span>❌</span><span>License expired</span></div>`;
            activationSection.classList.remove("hidden");
          } else {
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            let expiryText = "";
            if (diffMins < 60) {
              expiryText = `${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
            } else if (diffHours < 24) {
              expiryText = `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
            } else {
              expiryText = `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
            }

            if (diffDays < 7) {
              infoHTML += `<div class="expiry-warning"><span>⚠️</span><span>Expires in ${expiryText}</span></div>`;
            } else if (info.planType === "demo") {
              infoHTML += `<p style="font-size:11px;color:var(--mso-muted);margin-top:8px;">Demo · ${expiryText} left</p>`;
            }

            activationSection.classList.add("hidden");
          }
        } else {
          activationSection.classList.add("hidden");
        }

        licenseInfo.innerHTML = infoHTML;
      } else {
        statusBadge.textContent = "Inactive";
        statusBadge.className = "status-badge inactive";
        licenseInfo.innerHTML =
          '<p style="font-size:12px;color:var(--mso-muted);">Activate a license to use generate &amp; apply.</p>';
        activationSection.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error loading license:", error);
      statusBadge.textContent = "Error";
      statusBadge.className = "status-badge inactive";
    }
  }

  async function fetchWhatsAppSettings() {
    for (const url of serverUrls) {
      try {
        const response = await fetch(`${url}/settings?t=${Date.now()}`, {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.settings) {
            return {
              number:
                result.settings.whatsapp_number || CONFIG.DEFAULT_WHATSAPP,
              message:
                result.settings.whatsapp_message ||
                CONFIG.DEFAULT_WHATSAPP_MESSAGE,
            };
          }
        }
      } catch (e) {}
    }

    return {
      number: CONFIG.DEFAULT_WHATSAPP,
      message: CONFIG.DEFAULT_WHATSAPP_MESSAGE,
    };
  }

  function openWhatsApp(number, message) {
    chrome.tabs.create({
      url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    });
  }

  async function openOptimizerOnTab(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "openOptimizer" });
    } catch {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["styles.css"],
      });
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

  if (activateBtn && licenseInput) {
    activateBtn.addEventListener("click", async () => {
      const key = licenseInput.value.trim();
      if (!key) {
        showMessage("Please enter a license key", "error");
        return;
      }
      if (key.length < 10) {
        showMessage("License key is too short", "error");
        return;
      }

      activateBtn.textContent = "Verifying…";
      activateBtn.disabled = true;
      showMessage("", "");

      try {
        const result = await verifyLicenseWithServer(key);
        if (result.success) {
          showMessage("License activated successfully!", "success");
          await loadLicenseStatus();
        } else {
          showMessage(result.message || "License verification failed", "error");
        }
      } catch (error) {
        showMessage("Error: " + error.message, "error");
      } finally {
        activateBtn.textContent = "Activate License";
        activateBtn.disabled = false;
      }
    });

    licenseInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") activateBtn.click();
    });
  }

  document.querySelectorAll(".plan-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const duration = btn.dataset.duration;
      const price = btn.dataset.price;
      const settings = await fetchWhatsAppSettings();
      const message = `Hi! I want to purchase ${productName}.

📦 *Plan Selected:* ${duration}
💰 *Price:* ₹${price}

Please share payment details and license key.`;
      openWhatsApp(settings.number, message);
    });
  });

  const whatsappBtn = document.getElementById("whatsapp-btn");
  if (whatsappBtn) {
    whatsappBtn.addEventListener("click", async () => {
      const settings = await fetchWhatsAppSettings();
      openWhatsApp(settings.number, settings.message);
    });
  }

  const supportWhatsappBtn = document.getElementById("support-whatsapp");
  if (supportWhatsappBtn) {
    supportWhatsappBtn.addEventListener("click", async () => {
      const settings = await fetchWhatsAppSettings();
      openWhatsApp(
        settings.number,
        `Hi! I need support for ${productName}.`,
      );
    });
  }

  if (openCatalogBtn) {
    openCatalogBtn.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab?.id && (tab.url || "").includes("supplier.meesho.com")) {
        await openOptimizerOnTab(tab.id);
        window.close();
        return;
      }

      chrome.tabs.query({ url: "*://supplier.meesho.com/*" }, async (tabs) => {
        if (tabs?.length) {
          const catalogTab =
            tabs.find(
              (t) =>
                t.url &&
                (t.url.includes("/catalogs/single") ||
                  t.url.includes("/cataloging/")),
            ) || tabs[0];

          chrome.tabs.update(catalogTab.id, { active: true });
          chrome.windows.update(catalogTab.windowId, { focused: true });
          await openOptimizerOnTab(catalogTab.id);
          window.close();
        } else {
          chrome.tabs.create({
            url: "https://supplier.meesho.com/panel/v3/new/cataloging/single/add",
          });
          window.close();
        }
      });
    });
  }

  if (openMeeshoBtn) {
    openMeeshoBtn.addEventListener("click", () => {
      chrome.tabs.create({
        url: "https://supplier.meesho.com/panel/v3/new/cataloging/single/add",
      });
    });
  }

  await loadLicenseStatus();
});
