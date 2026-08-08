// Popup — license, WhatsApp, Kiwi/mobile-safe actions

document.addEventListener("DOMContentLoaded", async () => {
  const PA = window.PopupActions;
  PA.armPopupInteractionGuard();
  document.body?.classList.add("popup-booting");
  setTimeout(() => {
    document.body?.classList.remove("popup-booting");
  }, PA.POPUP_GUARD_MS);
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
  let cachedPlans = [];
  let cachedCreditPacks = [];
  let cachedSupportConfig = null;
  let supportPage = 1;

  const viewMain = document.getElementById("popup-view-main");
  const viewPlan = document.getElementById("popup-view-plan");
  const viewCredit = document.getElementById("popup-view-credit");
  const viewSupport = document.getElementById("popup-view-support");
  const footerMain = document.getElementById("popup-footer-main");

  function showPopupView(name) {
    const views = {
      main: viewMain,
      plan: viewPlan,
      credit: viewCredit,
      support: viewSupport,
    };
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", key !== name);
    });
    if (footerMain) {
      footerMain.classList.toggle("hidden", name !== "main");
    }
  }

  document.querySelectorAll("[data-popup-back]").forEach((btn) => {
    PA.bindTap(btn, () => {
      const target = btn.dataset.popupBack || "main";
      showPopupView(target);
    });
  });

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
      const licenseInfo = LicenseManager.buildDemoLicenseInfo(
        trimmedKey,
        demoInfo,
      );

      await chrome.storage.sync.set({
        licenseKey: trimmedKey,
        licenseStatus: "active",
        licenseInfo,
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
      if (typeof LicenseManager !== "undefined") {
        await LicenseManager.checkLicense();
      }

      const licenses =
        typeof LicenseManager !== "undefined"
          ? await LicenseManager.getActiveLicenses()
          : [];
      const activeList = document.getElementById("active-licenses-list");
      const activeActions = document.getElementById("license-active-actions");

      if (licenses.length) {
        statusBadge.textContent = licenses.length > 1 ? `${licenses.length} Active` : "Active";
        statusBadge.className = "status-badge active";

        if (activeList && typeof LicenseManager !== "undefined") {
          activeList.innerHTML = LicenseManager.renderAccountListHtml(licenses);
          activeList.querySelectorAll(".license-signoff-btn").forEach((btn) => {
            PA.bindTap(btn, async () => {
              const key = btn.dataset.licenseKey;
              btn.disabled = true;
              btn.textContent = "Signing off…";
              await LicenseManager.signOffLicense(key);
              showMessage("License removed from this device", "success");
              await loadLicenseStatus();
            });
          });
          const signOffAllInline = activeList.querySelector("#license-signoff-all-btn");
          if (signOffAllInline) signOffAllInline.remove();
        }

        const primary = LicenseManager.pickPrimaryLicense(licenses);
        const info = LicenseManager.normalizeLicenseInfo(
          primary?.licenseInfo || {},
        );
        const typeLabel = LicenseManager.formatLicenseTypeLabel(info);
        const totalCredits = LicenseManager.getTotalCreditsBalance(licenses);
        const creditUsage = LicenseManager.getCreditsUsageSummary(licenses);
        const validity = LicenseManager.getLicenseValiditySummary(info);
        const summary = LicenseManager.summarizeLicenseEntry(primary);

        let infoHTML = `<div class="license-type-pill">${LicenseManager.getLicenseRoleLabel(primary)}</div>`;
        infoHTML += `<div style="font-size:10px;font-weight:700;color:${
          summary.status === "active"
            ? "#059669"
            : summary.status === "credits_exhausted"
              ? "#d97706"
              : "#dc2626"
        };margin-bottom:4px;">${summary.statusLabel}</div>`;
        infoHTML += `<div style="font-size:14px;font-weight:700;color:var(--mso-ink);margin-bottom:6px;">${typeLabel}</div>`;
        infoHTML += `<div class="license-key">${maskKey(primary.key)}</div>`;
        infoHTML += `<p style="font-size:11px;color:var(--mso-muted);margin-top:8px;line-height:1.45;">`;
        if (licenses.length > 1) {
          infoHTML += `<strong>${licenses.length} licenses</strong> on this device`;
          if (totalCredits !== Infinity && totalCredits > 0) {
            infoHTML += ` · Combined credits: <strong>${totalCredits}</strong>`;
          }
          infoHTML += `<br>`;
        }
        if (info.maxDevices != null) {
          const devLabel = info.unlimitedDevices
            ? "Unlimited devices"
            : `${info.deviceCount || 1}/${info.maxDevices} devices`;
          infoHTML += `${devLabel}`;
        }
        const addonCredits = Number(info.addonCredits) || 0;
        const showCredits =
          creditUsage.applies ||
          info.billingMode === "credits" ||
          info.billingMode === "hybrid" ||
          addonCredits > 0 ||
          creditUsage.used > 0;
        if (showCredits) {
          if (info.unlimitedCredits) {
            infoHTML += ` · Credits: <strong>Unlimited</strong>`;
          } else {
            const usageLine = LicenseManager.formatCreditsUsageText(
              creditUsage,
              0,
            );
            if (usageLine) {
              infoHTML += ` · ${usageLine}`;
            } else {
              const balance = Number(info.creditsBalance) || 0;
              infoHTML += ` · Credits left: <strong>${balance}</strong>`;
            }
            if (addonCredits > 0) {
              const baseCredits = Number(info.includedCredits) || 0;
              infoHTML += ` <span style="color:var(--mso-muted);">(${baseCredits} base + ${addonCredits} addon)</span>`;
            }
          }
        }
        if (info.unlimitedTime) {
          infoHTML += ` · <strong>Never expires</strong>`;
        } else if (info.expiresAt) {
          infoHTML += ` · ${validity.kind === "expired" ? "Expired" : "Expires"}: <strong>${new Date(info.expiresAt).toLocaleDateString()}</strong>`;
        } else {
          infoHTML += ` · <strong>No expiry</strong>`;
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
          licenses.some((e) => {
            const m = e.licenseInfo?.billingMode;
            return m === "credits" || m === "hybrid";
          }) || (totalCredits !== Infinity && totalCredits <= 5);
        if (creditsSection) {
          creditsSection.classList.toggle("hidden", !showCreditsTopUp);
        }

        if (!LicenseManager.licenseEntryHasAccess(primary)) {
          statusBadge.textContent = "Inactive";
          statusBadge.className = "status-badge inactive";
          infoHTML += `<div class="expiry-warning"><span>❌</span><span>Primary license inactive — add a new key or sign off</span></div>`;
          activationSection.classList.remove("hidden");
        } else if (validity.kind === "unlimited") {
          statusBadge.textContent = "Lifetime";
          statusBadge.className = "status-badge active";
          activationSection.classList.add("hidden");
        } else if (info.expiresAt && validity.kind === "expired") {
          statusBadge.textContent = "Expired";
          statusBadge.className = "status-badge inactive";
          infoHTML += `<div class="expiry-warning"><span>❌</span><span>License expired</span></div>`;
          activationSection.classList.remove("hidden");
        } else if (info.expiresAt && validity.kind === "active") {
          const diffDays = validity.daysLeft ?? 0;
          if (diffDays < 7) {
            const diffMs = new Date(info.expiresAt) - new Date();
            const diffHours = Math.floor(diffMs / 3600000);
            const expiryText =
              diffHours < 24
                ? `${Math.floor(diffMs / 60000)} minutes`
                : diffDays < 1
                  ? `${diffHours} hours`
                  : `${diffDays} days`;
            infoHTML += `<div class="expiry-warning"><span>⚠️</span><span>Expires in ${expiryText}</span></div>`;
          }
          activationSection.classList.add("hidden");
        } else {
          activationSection.classList.add("hidden");
        }

        licenseInfo.innerHTML = infoHTML;
        if (activeActions) activeActions.classList.remove("hidden");
      } else {
        statusBadge.textContent = "Inactive";
        statusBadge.className = "status-badge inactive";
        licenseInfo.innerHTML =
          '<p style="font-size:12px;color:var(--mso-muted);">Activate a license to use generate &amp; apply.</p>';
        if (activeList) activeList.innerHTML = "";
        if (activeActions) activeActions.classList.add("hidden");
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
        await setupGoogleTrialUi();
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
    document.querySelectorAll(".credit-pack-open-btn").forEach((btn) => {
      PA.bindTap(btn, (e) => {
        if (
          e?.target?.closest?.(
            ".plan-detail-corner, .credit-pack-detail-corner-btn",
          )
        ) {
          return;
        }
        const packId = btn.dataset.pack;
        if (packId) void openWhatsAppForCreditPack(packId, btn);
      });
    });
    document.querySelectorAll(".credit-pack-detail-corner-btn").forEach((btn) => {
      PA.bindTap(btn, (e) => {
        e?.stopPropagation?.();
        const packId = btn.dataset.pack;
        if (packId) void showCreditPackDetail(packId);
      });
    });
  }

  async function openWhatsAppForCreditPack(packId, sourceBtn) {
    let pack =
      cachedCreditPacks.find((p) => p.id === packId) ||
      (await FirebaseLicense?.getCreditPackById?.(packId));
    if (!pack && sourceBtn?.dataset) {
      pack = {
        id: packId,
        credits: sourceBtn.dataset.credits,
        price: sourceBtn.dataset.price,
        label: sourceBtn.dataset.label,
      };
    }
    const message = FirebaseLicense.buildCreditPackPurchaseMessage(
      pack || { id: packId },
      productName,
    );
    await openWhatsApp(message);
  }

  async function showCreditPackDetail(packId) {
    const body = document.getElementById("credit-pack-detail-body");
    if (!body) return;
    showPopupView("credit");
    body.innerHTML =
      '<p style="font-size:12px;color:var(--mso-muted);">Loading pack…</p>';

    let pack =
      cachedCreditPacks.find(
        (p) =>
          p.id === packId ||
          FirebaseLicense?.slugifyPlanId?.(packId) === p.id,
      ) || null;
    if (!pack && typeof FirebaseLicense !== "undefined") {
      pack = await FirebaseLicense.getCreditPackById(packId);
    }
    if (!pack) {
      body.innerHTML =
        '<p style="font-size:12px;color:#dc2626;">Credit pack not found.</p>';
      return;
    }

    body.innerHTML = FirebaseLicense.renderCreditPackDetailHtml(pack, {
      productName,
    });
    const buyBtn = body.querySelector(".credit-pack-detail-buy-btn");
    if (buyBtn) {
      PA.bindTap(buyBtn, () => openWhatsAppForCreditPack(pack.id));
    }
  }

  function bindPlanAddonButtons() {
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.wirePlanAddonSelection
    ) {
      FirebaseLicense.wirePlanAddonSelection(document);
    }
  }

  function bindPlanButtons() {
    document.querySelectorAll(".plan-buy-btn.plan-card-main, .plan-btn.plan-buy-btn").forEach((btn) => {
      PA.bindTap(btn, (e) => {
        if (e?.target?.closest?.(".plan-detail-corner, .plan-detail-corner-btn")) {
          return;
        }
        const planId = btn.dataset.plan;
        if (planId) void openWhatsAppForPlan(planId);
      });
    });
    document.querySelectorAll(".plan-detail-corner-btn").forEach((btn) => {
      PA.bindTap(btn, (e) => {
        e?.stopPropagation?.();
        const planId = btn.dataset.plan;
        if (planId) showPlanDetail(planId);
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
      const [plans, creditPacks, creditsCfg, supportCfg] = await Promise.all([
        FirebaseLicense.getPricingPlans(true),
        FirebaseLicense.getCreditPacks(true),
        FirebaseLicense.getCreditsConfig(true),
        FirebaseLicense.getSupportConfig(true),
      ]);
      cachedPlans = plans;
      cachedCreditPacks = creditPacks;
      cachedSupportConfig = supportCfg;
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
      const deviceHint = document.getElementById("license-device-hint");
      if (deviceHint) {
        deviceHint.textContent =
          "1 device default · Family/Friends for more devices";
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
    bindPlanAddonButtons();
    bindPlanButtons();
    bindCreditPackButtons();
  }

  async function openWhatsApp(message, number) {
    const phone = number || getWhatsAppNumber();
    if (PA.isMobile() && typeof WhatsAppLink !== "undefined") {
      const ok = WhatsAppLink.openMobileSync(phone, message);
      if (!ok) {
        showMessage(
          "Could not open WhatsApp — install WhatsApp and try again.",
          "error",
        );
      }
      return ok;
    }
    const ok = await PA.openWhatsApp(phone, message);
    if (!ok) {
      showMessage("Could not open WhatsApp.", "error");
    }
    return ok;
  }

  async function openWhatsAppForPlan(planId) {
    let message;
    if (
      planId &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.buildPlanPurchaseMessage
    ) {
      message = FirebaseLicense.buildPlanPurchaseMessage(
        planId,
        productName,
        document,
      );
    } else {
      message = getWhatsAppMessage();
    }
    await openWhatsApp(message);
  }

  async function showPlanDetail(planId) {
    const body = document.getElementById("plan-detail-body");
    if (!body) return;
    showPopupView("plan");
    body.innerHTML =
      '<p style="font-size:12px;color:var(--mso-muted);">Loading plan…</p>';

    let plan =
      cachedPlans.find(
        (p) =>
          p.id === planId ||
          FirebaseLicense?.slugifyPlanId?.(planId) === p.id,
      ) || null;
    if (!plan && typeof FirebaseLicense !== "undefined") {
      plan = await FirebaseLicense.getPlanById(planId);
    }
    if (!plan) {
      body.innerHTML =
        '<p style="font-size:12px;color:#dc2626;">Plan not found.</p>';
      return;
    }

    body.innerHTML = FirebaseLicense.renderPlanDetailHtml(plan, {
      productName,
    });
    FirebaseLicense.wirePlanAddonSelection(body);
    bindPlanDetailBuy(body, plan.id);
  }

  function bindPlanDetailBuy(root, planId) {
    const buyBtn = root.querySelector(".plan-detail-buy-btn");
    if (!buyBtn) return;
    PA.bindTap(buyBtn, async () => {
      await openWhatsAppForPlan(planId);
    });
  }

  async function showSupportUsers(page = 1) {
    const body = document.getElementById("support-users-body");
    const titleEl = document.getElementById("support-view-title");
    if (!body) return;

    showPopupView("support");
    body.innerHTML =
      '<p style="font-size:12px;color:var(--mso-muted);">Loading contacts…</p>';

    if (!cachedSupportConfig && typeof FirebaseLicense !== "undefined") {
      cachedSupportConfig = await FirebaseLicense.getSupportConfig(true);
    }
    const cfg = cachedSupportConfig || { users: [], page_size: 5, title: "Support" };
    if (titleEl) titleEl.textContent = cfg.title || "Support";

    if (!cfg.enabled || !cfg.users?.length) {
      body.innerHTML = `<p style="font-size:12px;color:var(--mso-muted);text-align:center;padding:12px 0;">No support team listed — opening default WhatsApp.</p>
        <button type="button" class="btn btn-whatsapp" id="support-fallback-btn">Chat on WhatsApp</button>`;
      PA.bindTap(document.getElementById("support-fallback-btn"), () => {
        openWhatsApp(`Hi! I need support for ${productName}.`);
      });
      return;
    }

    supportPage = page;
    const pageData = FirebaseLicense.getSupportUsersPage(cfg, page);
    body.innerHTML = FirebaseLicense.renderSupportUsersHtml(pageData, {
      title: cfg.title,
      defaultMessage: `Hi! I need support for ${productName}.`,
    });
    bindSupportUserEvents(body, cfg);
  }

  function bindSupportUserEvents(root, cfg) {
    root.querySelectorAll(".support-user-row").forEach((row) => {
      PA.bindTap(row, async () => {
        const number = row.dataset.supportNumber;
        const custom = row.dataset.supportMessage;
        const message =
          custom ||
          `Hi! I need support for ${productName}.`;
        await openWhatsApp(message, number || getWhatsAppNumber());
      });
    });

    root.querySelectorAll(".support-page-btn").forEach((btn) => {
      PA.bindTap(btn, () => {
        if (btn.disabled) return;
        const nextPage = Number(btn.dataset.supportPage) || 1;
        showSupportUsers(nextPage);
      });
    });
  }

  function openSupportOrWhatsApp(defaultMessage) {
    if (cachedSupportConfig?.enabled && cachedSupportConfig.users?.length) {
      showSupportUsers(1);
      return;
    }
    openWhatsApp(defaultMessage);
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

  async function setupGoogleTrialUi() {
    if (typeof FirebaseLicense === "undefined") return;
    const btn = document.getElementById("google-trial-btn");
    if (!btn || btn.dataset.boundGoogleTrial) return;
    btn.dataset.boundGoogleTrial = "1";

    const runTrial = async () => {
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Signing in…";
      showMessage("", "");
      try {
        const result = await LicenseManager.activateGoogleFreeTrial();
        if (result.success) {
          if (result.limited) {
            showMessage(
              result.message ||
                "Trial saved — runs used up or expired. Buy a plan to continue.",
              "error",
            );
          } else {
            showMessage(result.message || "Free trial activated!", "success");
          }
          await loadLicenseStatus();
          await FirebaseLicense.hydrateGoogleTrialUi(document, {
            onClick: runTrial,
          });
        } else {
          showMessage(
            result.message || "Could not start free trial.",
            "error",
          );
        }
      } catch (e) {
        showMessage(e.message || "Google sign-in failed.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = prev || "Continue with Google";
      }
    };

    await FirebaseLicense.hydrateGoogleTrialUi(document, { onClick: runTrial });
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
      const result =
        typeof LicenseManager !== "undefined"
          ? await LicenseManager.verifyLicenseKey(key)
          : await verifyLicenseWithServer(key);
      if (result.success) {
        if (result.limited) {
          showMessage(
            result.message ||
              "License saved on this device — renew or buy credits to continue",
            "error",
          );
        } else {
          showMessage(
            result.merged
              ? "License added — multiple licenses now active"
              : "License activated successfully!",
            "success",
          );
        }
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

  PA.bindTap(document.getElementById("show-add-license-btn"), () => {
    scrollToActivation();
  });

  PA.bindTap(document.getElementById("signoff-all-btn"), async () => {
    if (typeof LicenseManager === "undefined") return;
    const btn = document.getElementById("signoff-all-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Signing off…";
    }
    await LicenseManager.signOffAllLicenses();
    showMessage("All licenses signed off — enter a new key below", "success");
    await loadLicenseStatus();
    scrollToActivation();
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign off all licenses";
    }
  });

  PA.bindTap(document.getElementById("copy-support-btn"), async () => {
    const licenses =
      typeof LicenseManager !== "undefined"
        ? await LicenseManager.getActiveLicenses()
        : [];
    const primary = LicenseManager?.pickPrimaryLicense?.(licenses);
    const copied = await MachineId.copySupportBundle(
      primary?.key || licenses[0]?.key,
      primary?.licenseInfo || licenses[0]?.licenseInfo,
    );
    showMessage(
      copied ? "Support info copied — paste in WhatsApp" : "Could not copy",
      copied ? "success" : "error",
    );
  });

  PA.bindTap(document.getElementById("whatsapp-btn"), () => {
    openSupportOrWhatsApp(getWhatsAppMessage());
  });

  PA.bindTap(document.getElementById("support-whatsapp"), () => {
    void openWhatsApp(`Hi! I need support for ${productName}.`);
  });

  PA.bindTap(openCatalogBtn, handleOpenOptimizer);
  PA.bindTap(openMeeshoBtn, handleOpenMeesho);

  document.querySelectorAll("[data-action]").forEach((el) => {
    PA.bindTap(el, () => {
      const action = el.dataset.action;
      if (action === "meesho") handleOpenMeesho();
      else if (action === "license") scrollToActivation();
      else if (action === "whatsapp") {
        openSupportOrWhatsApp(`Hi! I want to upgrade my ${productName} license.`);
      }
    });
  });

  async function refreshImageGenQuota() {
    const el = document.getElementById("image-gen-quota-popup");
    if (!el || typeof LicenseManager === "undefined") return;
    try {
      const summary = await LicenseManager.getImageGenSummary();
      const cfg = summary.config;
      const parts = [];

      if (summary.creditsApply) {
        const usageText = LicenseManager.formatCreditsUsageText(
          summary.creditsUsage,
          summary.costPerRun || 1,
        );
        if (usageText) {
          parts.push(`💳 <strong>${usageText}</strong>`);
        }
      }

      if (cfg.configured && cfg.enabled) {
        if (summary.remainingDaily != null) {
          parts.push(
            `Today: <strong>${summary.remainingDaily}</strong>/${cfg.daily_limit} runs left`,
          );
        }
        if (summary.remainingMonthly != null) {
          parts.push(
            `Month: <strong>${summary.remainingMonthly}</strong>/${cfg.monthly_limit} runs left`,
          );
        }
        if (cfg.max_batch_size > 0) {
          parts.push(`max ${cfg.max_batch_size} variants/run`);
        }
      } else if (cfg.configured && !cfg.enabled) {
        el.style.display = "block";
        el.innerHTML = "⚠️ AI image generation is currently disabled.";
        return;
      }

      if (!parts.length) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.innerHTML = parts.join(" · ");
    } catch (e) {
      el.style.display = "none";
    }
  }

  await loadFirebaseSettings();
  await hydratePopupPlans();
  await loadLicenseStatus();
  await setupGoogleTrialUi();
  await refreshImageGenQuota();
  setStatus(
    PA.isMobile()
      ? "Tap Open Image Optimizer on Meesho catalog page."
      : "",
  );
});
