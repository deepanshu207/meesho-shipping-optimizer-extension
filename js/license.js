// License management for Shipping Optimizer v1.2.0

const LicenseManager = {
  isLicensed: false,
  licenseKey: null,
  licenseInfo: null,
  activeLicenses: [],

  maskLicenseKey(key) {
    if (!key || key.length < 8) return key || "—";
    return key.substring(0, 6) + "••••" + key.substring(key.length - 4);
  },

  normalizeEntry(entry) {
    if (!entry) return null;
    const key = entry.key || entry.licenseInfo?.key;
    if (!key) return null;
    return {
      key,
      role: entry.role || entry.licenseInfo?.role || null,
      licenseInfo: { ...(entry.licenseInfo || {}), key },
      activatedAt: entry.activatedAt || entry.licenseInfo?.activatedAt || null,
    };
  },

  async getActiveLicenses() {
    try {
      const result = await chrome.storage.sync.get([
        "activeLicenses",
        "licenseKey",
        "licenseInfo",
        "licenseStatus",
      ]);
      if (Array.isArray(result.activeLicenses) && result.activeLicenses.length) {
        return result.activeLicenses
          .map((e) => this.normalizeEntry(e))
          .filter(Boolean);
      }
      if (result.licenseStatus === "active" && result.licenseKey) {
        return [
          this.normalizeEntry({
            key: result.licenseKey,
            licenseInfo: result.licenseInfo || { key: result.licenseKey },
          }),
        ].filter(Boolean);
      }
      return [];
    } catch (e) {
      console.warn("getActiveLicenses:", e);
      return [];
    }
  },

  pickPrimaryLicense(licenses) {
    const list = licenses || [];
    if (!list.length) return null;
    const primary = list.find((entry) => {
      const mode = entry.licenseInfo?.billingMode || "subscription";
      return mode !== "credits" && entry.role !== "credits_topup";
    });
    return primary || list[0];
  },

  getLicenseRoleLabel(entry) {
    const mode = entry?.licenseInfo?.billingMode || "subscription";
    if (entry?.role === "credits_topup" || mode === "credits") {
      return "Credit top-up";
    }
    if (mode === "hybrid") return "Plan + credits";
    if (
      entry?.licenseInfo?.planKind === "lifetime" ||
      entry?.licenseInfo?.unlimitedTime
    ) {
      return "Lifetime plan";
    }
    if (entry?.licenseInfo?.planType === "demo") return "Demo";
    return "Primary plan";
  },

  formatLicenseTypeLabel(info) {
    if (!info) return "Unknown";
    if (info.planType === "demo") return "Demo license";
    const planName =
      info.planName ||
      info.planId ||
      info.planType ||
      "Premium";
    const mode = info.billingMode || "subscription";
    if (mode === "credits") return `${planName} · Credits only`;
    if (mode === "hybrid") return `${planName} · Plan + credits`;
    if (info.planKind === "lifetime" || info.unlimitedTime) {
      return `${planName} · Lifetime`;
    }
    return `${planName} · Subscription`;
  },

  getTotalCreditsBalance(licenses) {
    let total = 0;
    let unlimited = false;
    (licenses || []).forEach((entry) => {
      const info = entry.licenseInfo || {};
      const mode = info.billingMode || "subscription";
      if (info.unlimitedCredits) unlimited = true;
      if (mode === "credits" || mode === "hybrid") {
        total += Number(info.creditsBalance ?? 0) || 0;
      }
    });
    return unlimited ? Infinity : total;
  },

  licenseEntryHasAccess(entry) {
    const info = entry?.licenseInfo || {};
    const mode = info.billingMode || "subscription";
    const unlimitedTime = !!info.unlimitedTime;
    const unlimitedCredits = !!info.unlimitedCredits;

    if (info.planType === "demo") {
      if (info.unlimitedTime) return true;
      if (!info.expiresAt) return true;
      return new Date() <= new Date(info.expiresAt);
    }

    if (mode === "credits") {
      return unlimitedCredits || Number(info.creditsBalance ?? 0) > 0;
    }

    if (mode === "hybrid") {
      if (!unlimitedTime && info.expiresAt && new Date() > new Date(info.expiresAt)) {
        return false;
      }
      return unlimitedCredits || Number(info.creditsBalance ?? 0) > 0;
    }

    if (!unlimitedTime && info.expiresAt && new Date() > new Date(info.expiresAt)) {
      return false;
    }
    return true;
  },

  licensesHaveAccess(licenses) {
    return (licenses || []).some((entry) => this.licenseEntryHasAccess(entry));
  },

  mergeLicenseEntry(existing, newEntry) {
    const list = [...(existing || [])];
    const idx = list.findIndex((e) => e.key === newEntry.key);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newEntry };
      return list;
    }

    const newMode = newEntry.licenseInfo?.billingMode || "subscription";
    const hasPrimary = list.some((e) => {
      const mode = e.licenseInfo?.billingMode || "subscription";
      return mode !== "credits" && e.role !== "credits_topup";
    });

    if (newMode === "credits" && hasPrimary) {
      return [...list, { ...newEntry, role: "credits_topup" }];
    }

    if (newMode !== "credits" && list.length === 1) {
      const only = list[0];
      const onlyMode = only.licenseInfo?.billingMode || "subscription";
      if (onlyMode === "credits") {
        return [
          newEntry,
          { ...only, role: "credits_topup" },
        ];
      }
    }

    if (newMode !== "credits") {
      const creditOnly = list.filter((e) => {
        const mode = e.licenseInfo?.billingMode || "subscription";
        return mode === "credits" || e.role === "credits_topup";
      });
      return [newEntry, ...creditOnly];
    }

    return [...list, { ...newEntry, role: "credits_topup" }];
  },

  async saveActiveLicenses(licenses) {
    const normalized = (licenses || [])
      .map((e) => this.normalizeEntry(e))
      .filter(Boolean);
    const primary = this.pickPrimaryLicense(normalized);

    this.activeLicenses = normalized;
    this.licenseKey = primary?.key || null;
    this.licenseInfo = primary?.licenseInfo || null;
    this.isLicensed =
      normalized.length > 0 && this.licensesHaveAccess(normalized);

    await chrome.storage.sync.set({
      activeLicenses: normalized,
      licenseKey: primary?.key || null,
      licenseInfo: primary?.licenseInfo || null,
      licenseStatus: normalized.length ? "active" : "inactive",
      lastVerified: Date.now(),
    });
  },

  async updateLicenseEntry(key, patchInfo) {
    const licenses = await this.getActiveLicenses();
    const normalizedKey = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : String(key || "").trim().toUpperCase();
    const idx = licenses.findIndex((e) => e.key === normalizedKey);
    if (idx < 0) return false;
    licenses[idx] = {
      ...licenses[idx],
      licenseInfo: { ...licenses[idx].licenseInfo, ...patchInfo },
    };
    await this.saveActiveLicenses(licenses);
    return true;
  },

  renderAccountListHtml(licenses) {
    const list = licenses || [];
    if (!list.length) {
      return `<p style="font-size:12px;color:#9ca3af;margin:0;">No active licenses on this device.</p>`;
    }

    const totalCredits = this.getTotalCreditsBalance(list);
    const creditLicenses = list.filter((e) => {
      const mode = e.licenseInfo?.billingMode || "subscription";
      return mode === "credits" || mode === "hybrid";
    });

    let html = "";
    if (list.length > 1 && creditLicenses.length) {
      const creditLabel =
        totalCredits === Infinity
          ? "Unlimited"
          : String(totalCredits);
      html += `<div style="background:rgba(255,215,0,0.12);border:1px solid #f0e0c8;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:11px;color:#6b7280;">
        <strong style="color:#c45f12;">${list.length} active licenses</strong>
        · Combined credits: <strong style="color:#059669;">${creditLabel}</strong>
      </div>`;
    }

    html += list
      .map((entry) => {
        const info = entry.licenseInfo || {};
        const role = this.getLicenseRoleLabel(entry);
        const typeLabel = this.formatLicenseTypeLabel(info);
        const mode = info.billingMode || "subscription";
        let details = "";

        const addonCredits = Number(info.addonCredits) || 0;
        if (mode === "credits" || mode === "hybrid" || addonCredits > 0) {
          if (info.unlimitedCredits) {
            details += `<div>Credits: <strong>Unlimited</strong></div>`;
          } else {
            const baseCredits = Number(info.includedCredits) || 0;
            const breakdown =
              addonCredits > 0
                ? ` <span style="color:#9ca3af;">(${baseCredits} base + ${addonCredits} addon)</span>`
                : "";
            details += `<div>Credits: <strong>${info.creditsBalance ?? 0}</strong>${breakdown}</div>`;
          }
        }
        if (info.unlimitedTime) {
          details += `<div>Validity: <strong>Unlimited time</strong></div>`;
        } else if (info.expiresAt) {
          details += `<div>Expires: <strong>${new Date(info.expiresAt).toLocaleDateString()}</strong></div>`;
        }
        if (info.maxDevices != null) {
          const devLabel = info.unlimitedDevices
            ? "Unlimited devices"
            : `${info.deviceCount || 1}/${info.maxDevices} devices`;
          details += `<div>${devLabel}</div>`;
        }

        const accessOk = this.licenseEntryHasAccess(entry);
        return `<div class="license-account-card" data-license-key="${entry.key}" style="background:#fff;border:1px solid #f0e0c8;border-radius:10px;padding:12px;margin-bottom:8px;${accessOk ? "" : "opacity:0.75;"}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="min-width:0;">
              <div style="font-size:10px;font-weight:700;color:#c45f12;text-transform:uppercase;letter-spacing:0.04em;">${role}</div>
              <div style="font-size:13px;font-weight:700;color:#1f2937;margin:4px 0 2px;">${typeLabel}</div>
              <div style="font-family:Consolas,monospace;font-size:11px;color:#6b7280;word-break:break-all;">${this.maskLicenseKey(entry.key)}</div>
            </div>
            <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;${accessOk ? "background:rgba(5,150,105,0.12);color:#059669;" : "background:rgba(239,68,68,0.1);color:#dc2626;"}">${accessOk ? "Active" : "Inactive"}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;margin-top:8px;line-height:1.5;">${details || "—"}</div>
          <button type="button" class="license-signoff-btn opt-btn opt-btn-secondary" data-license-key="${entry.key}" style="width:100%;margin-top:10px;padding:8px;font-size:11px;">Sign off this license</button>
        </div>`;
      })
      .join("");

    html += `<button type="button" id="license-signoff-all-btn" class="opt-btn opt-btn-danger" style="width:100%;padding:9px;font-size:11px;margin-top:4px;">Sign off all licenses</button>`;
    return html;
  },

  async refreshAccountListUi(root) {
    const container =
      root?.querySelector?.("#license-account-list") ||
      document.getElementById("license-account-list");
    if (!container) return;
    const licenses = await this.getActiveLicenses();
    container.innerHTML = this.renderAccountListHtml(licenses);
    return licenses;
  },

  // Check license status from storage
  checkLicense: async function () {
    try {
      const licenses = await this.getActiveLicenses();
      if (!licenses.length) {
        this.isLicensed = false;
        this.licenseKey = null;
        this.licenseInfo = null;
        this.activeLicenses = [];
        return false;
      }

      const machineId = await this.getMachineId();
      const updated = [];

      for (const entry of licenses) {
        const info = entry.licenseInfo || {};
        if (info.planType === "demo") {
          if (info.unlimitedTime || !info.expiresAt) {
            updated.push(entry);
            continue;
          }
          if (info.expiresAt && new Date() > new Date(info.expiresAt)) {
            continue;
          }
          updated.push(entry);
          continue;
        }

        if (
          CONFIG?.USE_FIREBASE_LICENSE &&
          typeof FirebaseLicense !== "undefined" &&
          FirebaseLicense.isEnabled()
        ) {
          try {
            const refreshed = await FirebaseLicense.refreshLicenseFromFirebase(
              entry.key,
              machineId,
            );
            if (refreshed.valid && refreshed.license) {
              updated.push({
                ...entry,
                licenseInfo: refreshed.license,
              });
            }
          } catch (e) {
            if (this.licenseEntryHasAccess(entry)) updated.push(entry);
          }
        } else if (this.licenseEntryHasAccess(entry)) {
          updated.push(entry);
        }
      }

      await this.saveActiveLicenses(updated);
      this.isLicensed = updated.length > 0 && this.licensesHaveAccess(updated);
      console.log("License check:", this.isLicensed ? "Active" : "Inactive");
      return this.isLicensed;
    } catch (error) {
      console.error("License check error:", error);
      return this.isLicensed;
    }
  },

  getMachineId: async function () {
    if (typeof MachineId !== "undefined" && MachineId.get) {
      return MachineId.get();
    }
    return "M" + Date.now().toString(36).toUpperCase();
  },

  demoKeys: null,

  isDemoUnlimitedTime(demoInfo) {
    if (!demoInfo) return false;
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isUnlimitedFlag
    ) {
      return FirebaseLicense.isUnlimitedFlag(
        demoInfo.unlimited_time ?? demoInfo.unlimitedTime,
      );
    }
    return !!(demoInfo.unlimited_time || demoInfo.unlimitedTime);
  },

  buildDemoLicenseInfo(trimmedKey, demoInfo) {
    const unlimitedTime = this.isDemoUnlimitedTime(demoInfo);
    const days = Number(demoInfo?.days) || 30;
    const info = {
      key: trimmedKey,
      planType: "demo",
      planName: demoInfo?.label || "Demo",
      billingMode: "subscription",
      unlimitedTime,
      activatedAt: new Date().toISOString(),
    };
    if (!unlimitedTime) {
      info.expiresAt = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000,
      ).toISOString();
    }
    return info;
  },

  fetchDemoKeys: async function () {
    if (this.demoKeys) return this.demoKeys;
    this.demoKeys = await CONFIG.getDemoKeys();
    return this.demoKeys;
  },

  async refreshLicenseInfoFromFirebase() {
    await this.checkLicense();
    return this.licenseInfo;
  },

  getCreditSources(licenses) {
    return (licenses || [])
      .filter((entry) => {
        const mode = entry.licenseInfo?.billingMode || "subscription";
        return mode === "credits" || mode === "hybrid";
      })
      .sort((a, b) => {
        const aHybrid = a.licenseInfo?.billingMode === "hybrid" ? 0 : 1;
        const bHybrid = b.licenseInfo?.billingMode === "hybrid" ? 0 : 1;
        if (aHybrid !== bHybrid) return aHybrid - bHybrid;
        return (
          Number(b.licenseInfo?.creditsBalance ?? 0) -
          Number(a.licenseInfo?.creditsBalance ?? 0)
        );
      });
  },

  async consumeCredits(amount) {
    const licenses = await this.getActiveLicenses();
    const demoOnly = licenses.every((e) => e.licenseInfo?.planType === "demo");
    if (!licenses.length || demoOnly) {
      return { ok: true, skipped: true };
    }

    const sources = this.getCreditSources(licenses);
    if (!sources.length) return { ok: true, skipped: true };

    for (const entry of sources) {
      const info = entry.licenseInfo || {};
      if (info.unlimitedCredits) {
        return { ok: true, skipped: true, unlimited: true };
      }
      if (info.planType === "demo") continue;
      const mode = info.billingMode || "subscription";
      if (mode === "subscription") continue;

      if (
        CONFIG?.USE_FIREBASE_LICENSE &&
        typeof FirebaseLicense !== "undefined" &&
        FirebaseLicense.isEnabled()
      ) {
        const result = await FirebaseLicense.deductCredits(entry.key, amount);
        if (result.ok) {
          await this.updateLicenseEntry(entry.key, {
            creditsBalance: result.balance,
            creditsUsed: result.used,
          });
          this.licenseInfo = this.pickPrimaryLicense(
            await this.getActiveLicenses(),
          )?.licenseInfo;
          return result;
        }
        if (result.reason === "Insufficient credits") continue;
        return result;
      }
    }

    return { ok: false, reason: "Credits sync unavailable" };
  },

  async ensureCanOperate(actionLabel) {
    await this.checkLicense();
    if (!this.isLicensed) return { ok: false, reason: "License required" };

    const licenses = await this.getActiveLicenses();
    const needsCredits = licenses.some((e) => {
      const mode = e.licenseInfo?.billingMode || "subscription";
      return mode === "credits" || mode === "hybrid";
    });

    if (needsCredits) {
      const unlimited = licenses.some((e) => e.licenseInfo?.unlimitedCredits);
      if (!unlimited) {
        const total = this.getTotalCreditsBalance(licenses);
        if (total <= 0) {
          return {
            ok: false,
            reason: actionLabel
              ? `${actionLabel} requires credits — buy a credit pack`
              : "Insufficient credits",
            needsTopUp: true,
          };
        }
      }
      const consumed = await this.consumeCredits();
      if (!consumed.ok && !consumed.skipped) {
        return consumed;
      }
    }
    return { ok: true };
  },

  verifyLicenseKey: async function (key) {
    if (!key || key.length < 10) {
      return { success: false, message: "Invalid license key format" };
    }

    const trimmedKey = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : key.trim().toUpperCase().replace(/\s+/g, "-");
    console.log("🔑 Verifying key:", trimmedKey);

    const demoKeys = await this.fetchDemoKeys();
    const demoKeyMatch = Object.keys(demoKeys).find(
      (k) => k.toUpperCase() === trimmedKey,
    );

    if (demoKeyMatch) {
      const demoInfo = demoKeys[demoKeyMatch];
      const entry = {
        key: trimmedKey,
        licenseInfo: this.buildDemoLicenseInfo(trimmedKey, demoInfo),
        activatedAt: new Date().toISOString(),
      };

      try {
        await this.saveActiveLicenses([entry]);
        this.isLicensed = true;
        this.licenseKey = trimmedKey;
        return { success: true };
      } catch (storageError) {
        return {
          success: false,
          message: "Failed to save license: " + storageError.message,
        };
      }
    }

    const machineId = await this.getMachineId();

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
          const entry = {
            key: trimmedKey,
            licenseInfo: fbResult.license || {
              key: trimmedKey,
              planType: "premium",
              activatedAt: new Date().toISOString(),
            },
            activatedAt: new Date().toISOString(),
          };
          const existing = await this.getActiveLicenses();
          const merged = this.mergeLicenseEntry(existing, entry);
          await this.saveActiveLicenses(merged);
          this.isLicensed = true;
          this.licenseKey = this.pickPrimaryLicense(merged)?.key || trimmedKey;
          this.licenseInfo = fbResult.license;
          return { success: true, merged: merged.length > 1 };
        }
        return {
          success: false,
          message: fbResult.reason || "License key not found or invalid",
        };
      } catch (e) {
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
  },

  async signOffLicense(key) {
    const normalizedKey = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : String(key || "").trim().toUpperCase();
    const licenses = await this.getActiveLicenses();
    const entry = licenses.find((e) => e.key === normalizedKey);
    if (!entry) {
      return { ok: false, message: "License not found on this device" };
    }

    const machineId = await this.getMachineId();
    if (
      entry.licenseInfo?.planType !== "demo" &&
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        await FirebaseLicense.unbindDevice(normalizedKey, machineId);
      } catch (e) {
        console.warn("Device unbind failed:", e.message);
      }
    }

    const remaining = licenses.filter((e) => e.key !== normalizedKey);
    if (remaining.length) {
      await this.saveActiveLicenses(remaining);
    } else {
      await this.clearLicense("signed_off");
    }

    this.isLicensed = remaining.length > 0 && this.licensesHaveAccess(remaining);
    return { ok: true, remaining: remaining.length };
  },

  async signOffAllLicenses() {
    const licenses = await this.getActiveLicenses();
    const machineId = await this.getMachineId();

    for (const entry of licenses) {
      if (
        entry.licenseInfo?.planType === "demo" ||
        !CONFIG?.USE_FIREBASE_LICENSE ||
        typeof FirebaseLicense === "undefined" ||
        !FirebaseLicense.isEnabled()
      ) {
        continue;
      }
      try {
        await FirebaseLicense.unbindDevice(entry.key, machineId);
      } catch (e) {
        console.warn("Unbind failed for", entry.key, e.message);
      }
    }

    await this.clearLicense("signed_off");
    return { ok: true };
  },

  clearLicense: async function (reason = "cleared") {
    this.isLicensed = false;
    this.licenseKey = null;
    this.licenseInfo = null;
    this.activeLicenses = [];

    await chrome.storage.sync.set({
      licenseStatus: reason,
      licenseKey: null,
      licenseInfo: null,
      activeLicenses: [],
    });
  },

  getWhatsAppSettings: async function () {
    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        const wa = await FirebaseLicense.getWhatsAppSettings();
        if (wa?.number) return wa;
      } catch (e) {
        console.log("Firebase WhatsApp settings failed:", e.message);
      }
    }

    return {
      number: CONFIG.DEFAULT_WHATSAPP || "919654414891",
      message:
        CONFIG.DEFAULT_WHATSAPP_MESSAGE ||
        "Hi! I want to purchase Shipping Optimizer license.",
    };
  },

  openWhatsApp: async function (buttonElement) {
    const originalText = buttonElement ? buttonElement.innerHTML : "";

    if (buttonElement) {
      buttonElement.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
                    <div style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top:2px solid white;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                    <span>Connecting...</span>
                </div>
            `;
      buttonElement.disabled = true;
    }

    try {
      const settings = await this.getWhatsAppSettings();

      if (buttonElement) {
        buttonElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><span>✅</span><span>Opening WhatsApp...</span></div>`;
      }

      const phone = String(settings.number || CONFIG.DEFAULT_WHATSAPP || "919654414891").replace(/\D/g, "");
      const text = encodeURIComponent(settings.message || "");
      const isAndroid = /Android/i.test(navigator.userAgent || "");
      if (isAndroid) {
        window.location.href = `whatsapp://send?phone=${phone}&text=${text}`;
        setTimeout(() => {
          window.open(
            `https://api.whatsapp.com/send?phone=${phone}&text=${text}`,
            "_blank",
          );
        }, 600);
      } else {
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
      }
    } catch (error) {
      const phone = String(CONFIG.DEFAULT_WHATSAPP || "919654414891").replace(/\D/g, "");
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(
          CONFIG.DEFAULT_WHATSAPP_MESSAGE ||
            "Hi! I want to purchase Shipping Optimizer license.",
        )}`,
        "_blank",
      );
    } finally {
      if (buttonElement) {
        setTimeout(() => {
          buttonElement.innerHTML = originalText;
          buttonElement.disabled = false;
        }, 2000);
      }
    }
  },
};

window.LicenseManager = LicenseManager;
