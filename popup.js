// Popup — license, WhatsApp, Kiwi/mobile-safe actions

document.addEventListener("DOMContentLoaded", async () => {
  const PA = window.PopupActions;
  const statusBadge = document.getElementById("status-badge");
  const licenseInfo = document.getElementById("license-info");
  const activationSection = document.getElementById("activation-section");
  const activateBtn = document.getElementById("activate-btn");
  const licenseInput = document.getElementById("license-input");
  const openCatalogBtn = document.getElementById("open-catalog");
  const openMeeshoBtn = document.getElementById("open-meesho");
  const messageEl = document.getElementById("popup-message");
  const versionBadge = document.getElementById("version-badge");
  const statusLine = document.getElementById("popup-status-line");

  if (versionBadge && typeof CONFIG !== "undefined") {
    versionBadge.textContent = "v" + (CONFIG.VERSION || "1.0.0");
  }

  const productName = CONFIG?.EXTENSION_NAME || "Shipping Optimizer";
  let cachedWhatsApp = null;

  function setStatus(text) {
    if (statusLine) statusLine.textContent = text || "";
  }

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = "message " + (type || "");
    messageEl.style.display = text ? "block" : "none";
  }

  function maskKey(key) {
    if (!key || key.length < 8) return key;
    return key.substring(0, 6) + "••••" + key.substring(key.length - 4);
  }

  async function getMachineId() {
    if (typeof MachineId !== "undefined" && MachineId.get) {
      return MachineId.get();
    }
    const stored = await chrome.storage.local.get(["machineId"]);
    return stored.machineId || "unknown";
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

    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        const fbResult = await FirebaseLicense.verifyPaidLicense(
          trimmedKey,
          machineId,
        );
        if (fbResult.valid === true) {
          await chrome.storage.sync.set({
            licenseKey: trimmedKey,
            licenseStatus: "active",
            licenseInfo: fbResult.license || {
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
          message: fbResult.reason || "License key not found or invalid",
        };
      } catch (e) {
        console.warn("Firebase verify failed:", e.message);
        return {
          success: false,
          message: "Could not verify license. Check your connection and try again.",
        };
      }
    }

    return {
      success: false,
      message: "License service unavailable. Enable Firebase in config.",
    };
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return iso;
    }
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
        infoHTML += `<p style="font-size:11px;color:var(--mso-muted);margin-top:6px;">Plan: <strong>${info.planType || "premium"}</strong>`;
        if (info.maxDevices != null) {
          infoHTML += ` · Devices: <strong>${info.deviceCount || 1}/${info.maxDevices}</strong>`;
        }
        if (info.billingMode === "credits" || info.billingMode === "hybrid") {
          infoHTML += ` · Credits: <strong>${info.creditsBalance ?? 0}</strong>`;
        }
        if (info.activatedAt) {
          infoHTML += ` · Activated: ${formatWhen(info.activatedAt)}`;
        }
        infoHTML += `</p>`;

        const supportRow = document.getElementById("license-support-row");
        const deviceEl = document.getElementById("device-id-display");
        const browserEl = document.getElementById("device-browser-label");
        const machineId = await getMachineId();
        if (supportRow && deviceEl) {
          supportRow.classList.remove("hidden");
          deviceEl.textContent = machineId;
          if (browserEl && typeof MachineId !== "undefined") {
            browserEl.textContent =
              "Browser: " + MachineId.detectBrowserLabel() + " · ID is unique per browser profile";
          }
        }

        const creditsSection = document.getElementById("popup-credits-section");
        const showCreditsTopUp =
          info.billingMode === "credits" ||
          info.billingMode === "hybrid" ||
          (info.creditsBalance != null && Number(info.creditsBalance) <= 0);
        if (creditsSection) {
          creditsSection.classList.toggle("hidden", !showCreditsTopUp);
        }

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
        const supportRow = document.getElementById("license-support-row");
        const deviceEl = document.getElementById("device-id-display");
        const browserEl = document.getElementById("device-browser-label");
        const machineId = await getMachineId();
        if (supportRow && deviceEl) {
          supportRow.classList.remove("hidden");
          deviceEl.textContent = machineId;
          if (browserEl && typeof MachineId !== "undefined") {
            browserEl.textContent =
              "Browser: " + MachineId.detectBrowserLabel() + " · ID is unique per browser profile";
          }
        }
        const creditsSection = document.getElementById("popup-credits-section");
        if (creditsSection) creditsSection.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error loading license:", error);
      statusBadge.textContent = "Error";
      statusBadge.className = "status-badge inactive";
    }
  }

  function getWhatsAppNumber() {
    if (cachedWhatsApp?.number) {
      return PA.normalizeWhatsAppNumber(cachedWhatsApp.number);
    }
    return PA.getWhatsAppNumber();
  }

  function getWhatsAppMessage() {
    return (
      cachedWhatsApp?.message ||
      CONFIG.DEFAULT_WHATSAPP_MESSAGE
    );
  }

  async function loadFirebaseSettings() {
    if (
      typeof FirebaseLicense === "undefined" ||
      !FirebaseLicense.isEnabled()
    ) {
      return;
    }
    try {
      cachedWhatsApp = await FirebaseLicense.getWhatsAppSettings();
    } catch (e) {
      console.warn("Firebase settings load failed:", e.message);
    }
  }

  function bindCreditPackButtons() {
    document.querySelectorAll(".credit-pack-btn").forEach((btn) => {
      PA.bindTap(btn, () => {
        const credits = btn.dataset.credits;
        const price = btn.dataset.price;
        const label = btn.dataset.label || `${credits} Credits`;
        const message = `Hi! I want to buy credits for ${productName}.

⚡ *Credit Pack:* ${label}
💰 *Price:* ₹${price}

Please share payment details.`;
        openWhatsApp(message);
      });
    });
  }

  function bindPlanButtons() {
    document.querySelectorAll(".plan-btn, .plan-buy-btn").forEach((btn) => {
      PA.bindTap(btn, () => {
        const duration = btn.dataset.duration;
        const price = btn.dataset.price;
        const message = `Hi! I want to purchase ${productName}.

📦 *Plan Selected:* ${duration}
💰 *Price:* ₹${price}

Please share payment details and license key.`;
        openWhatsApp(message);
      });
    });
  }

  async function hydratePopupPlans() {
    const grid = document.getElementById("license-plans-grid");
    if (!grid) return;

    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      const [plans, creditPacks, creditsCfg] = await Promise.all([
        FirebaseLicense.getPricingPlans(true),
        FirebaseLicense.getCreditPacks(true),
        FirebaseLicense.getCreditsConfig(true),
      ]);
      FirebaseLicense.renderPlanButtons(grid, plans, "popup");
      const creditsGrid = document.getElementById("license-credits-grid");
      const creditsSection = document.getElementById("popup-credits-section");
      if (creditsGrid && creditsCfg.enabled) {
        FirebaseLicense.renderCreditPacks(creditsGrid, creditPacks, "popup");
        if (creditsSection) creditsSection.classList.remove("hidden");
        const priceHint = document.getElementById("credits-price-hint");
        if (priceHint) {
          priceHint.textContent = `₹${creditsCfg.price_per_credit} per credit · minimum ${creditsCfg.min_purchase} credits · top up when credits run out`;
        }
      }
      const hint = document.getElementById("license-demo-hint");
      if (hint) {
        const demoKeys = await FirebaseLicense.getDemoKeysMap();
        const sample = Object.keys(demoKeys)[0] || "MEESHO-DEMOFREE";
        hint.innerHTML = `1 device default · Family/Friends for more · Demo: <strong>${sample}</strong>`;
      }
      const ann = await FirebaseLicense.getAnnouncement();
      const annCard = document.getElementById("firebase-announcement");
      const annText = document.getElementById("firebase-announcement-text");
      if (ann && annCard && annText) {
        annCard.style.display = "block";
        annText.textContent = ann;
      } else if (annCard) {
        annCard.style.display = "none";
      }
    } else {
      FirebaseLicense?.renderPlanButtons?.(
        grid,
        FirebaseLicense?.defaultPlans?.() || [],
        "popup",
      );
    }
    bindPlanButtons();
    bindCreditPackButtons();
  }

  function openWhatsApp(message) {
    PA.openWhatsApp(getWhatsAppNumber(), message);
  }

  function scrollToActivation() {
    activationSection?.classList.remove("hidden");
    activationSection?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    licenseInput?.focus();
  }

  async function handleOpenOptimizer() {
    setStatus("Working…");
    showMessage("", "");
    try {
      await PA.openOptimizerOnMeesho(setStatus);
    } catch (e) {
      console.error(e);
      showMessage("Could not open optimizer. Open Meesho catalog first.", "error");
      setStatus("");
    }
  }

  async function handleOpenMeesho() {
    setStatus("Opening Meesho…");
    await PA.openUrl(PA.MEESHO_CATALOG_URL);
    setStatus("");
    try {
      window.close();
    } catch (e) {}
  }

  PA.bindTap(activateBtn, async () => {
    const key = licenseInput?.value?.trim();
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

  if (licenseInput) {
    licenseInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") activateBtn?.click();
    });
  }

  PA.bindTap(document.getElementById("copy-support-btn"), async () => {
    const result = await chrome.storage.sync.get(["licenseKey", "licenseInfo"]);
    const copied = await MachineId.copySupportBundle(
      result.licenseKey,
      result.licenseInfo,
    );
    showMessage(
      copied ? "Support info copied — paste in WhatsApp" : "Could not copy",
      copied ? "success" : "error",
    );
  });

  PA.bindTap(document.getElementById("whatsapp-btn"), () => {
    openWhatsApp(getWhatsAppMessage());
  });

  PA.bindTap(document.getElementById("support-whatsapp"), () => {
    openWhatsApp(`Hi! I need support for ${productName}.`);
  });

  PA.bindTap(openCatalogBtn, handleOpenOptimizer);
  PA.bindTap(openMeeshoBtn, handleOpenMeesho);

  document.querySelectorAll("[data-action]").forEach((el) => {
    PA.bindTap(el, () => {
      const action = el.dataset.action;
      if (action === "optimizer") handleOpenOptimizer();
      else if (action === "meesho") handleOpenMeesho();
      else if (action === "license") scrollToActivation();
      else if (action === "whatsapp") {
        openWhatsApp(`Hi! I want to upgrade my ${productName} license.`);
      }
    });
  });

  await loadFirebaseSettings();
  await hydratePopupPlans();
  await loadLicenseStatus();
  setStatus(
    PA.isMobile()
      ? "Tip: open Meesho catalog, then tap Open Image Optimizer."
      : "",
  );
});
