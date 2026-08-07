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
      licenseInfo: this.normalizeLicenseInfo({
        ...(entry.licenseInfo || {}),
        key,
      }),
      activatedAt: entry.activatedAt || entry.licenseInfo?.activatedAt || null,
    };
  },

  /** Normalize unlimited-time / lifetime flags from any stored shape. */
  normalizeLicenseInfo(info) {
    if (!info) return info;
    const planKind = String(info.planKind || info.plan_kind || "").toLowerCase();
    const unlimitedTime = !!(
      info.unlimitedTime ||
      info.unlimited_time ||
      planKind === "lifetime" ||
      planKind === "unlimited"
    );
    const unlimitedCredits = !!(
      info.unlimitedCredits || info.unlimited_credits
    );
    const unlimitedDevices = !!(
      info.unlimitedDevices || info.unlimited_devices
    );
    return {
      ...info,
      planKind: planKind || info.planKind || "subscription",
      unlimitedTime,
      unlimitedCredits,
      unlimitedDevices,
      expiresAt: unlimitedTime ? null : info.expiresAt || info.expires_at || null,
      billingMode:
        info.billingMode || info.billing_mode || "subscription",
      creditsBalance:
        Number(info.creditsBalance ?? info.credits_balance ?? 0) || 0,
      creditsUsed: Number(info.creditsUsed ?? info.credits_used ?? 0) || 0,
      accessStatus: info.accessStatus || info.access_status || "active",
    };
  },

  isUnlimitedTimeLicense(info) {
    const n = this.normalizeLicenseInfo(info || {});
    return !!n.unlimitedTime;
  },

  /** Human-readable validity for UI (never expires, open-ended, dated, expired). */
  getLicenseValiditySummary(info) {
    const n = this.normalizeLicenseInfo(info || {});
    if (n.unlimitedTime) {
      return {
        kind: "unlimited",
        label: "Never expires",
        shortLabel: "Lifetime",
      };
    }
    if (!n.expiresAt) {
      return {
        kind: "open",
        label: "No expiry date",
        shortLabel: "Active",
      };
    }
    const exp = new Date(n.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return { kind: "open", label: "No expiry date", shortLabel: "Active" };
    }
    if (new Date() > exp) {
      return {
        kind: "expired",
        label: `Expired ${exp.toLocaleDateString()}`,
        shortLabel: "Expired",
        expiresAt: n.expiresAt,
      };
    }
    const diffMs = exp - new Date();
    const diffDays = Math.floor(diffMs / 86400000);
    return {
      kind: "active",
      label: `Expires ${exp.toLocaleDateString()}`,
      shortLabel: diffDays < 7 ? `${diffDays}d left` : exp.toLocaleDateString(),
      expiresAt: n.expiresAt,
      daysLeft: diffDays,
    };
  },

  /** Whether any *accessible* license still requires credits to operate. */
  requiresCreditBilling(licenses) {
    return (licenses || []).some((entry) => {
      if (!this.licenseEntryHasAccess(entry)) return false;
      const info = this.normalizeLicenseInfo(entry.licenseInfo || {});
      if (info.unlimitedCredits) return false;
      const mode = info.billingMode || "subscription";
      return mode === "credits" || mode === "hybrid";
    });
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
    if (entry?.licenseInfo?.planType === "google_trial") return "Google trial";
    return "Primary plan";
  },

  formatLicenseTypeLabel(info) {
    if (!info) return "Unknown";
    if (info.planType === "demo") return "Demo license";
    if (info.planType === "google_trial") return "Google free trial";
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
      if (info.unlimitedCredits) unlimited = true;
      if (this.licenseHasSpendableCredits(info)) {
        total += Number(info.creditsBalance ?? 0) || 0;
      }
    });
    return unlimited ? Infinity : total;
  },

  /** Aggregate credits total / used / remaining for UI. */
  getCreditsUsageSummary(licenses) {
    let balance = 0;
    let used = 0;
    let unlimited = false;
    let applies = false;

    (licenses || []).forEach((entry) => {
      const info = this.normalizeLicenseInfo(entry.licenseInfo || {});
      if (info.unlimitedCredits) {
        unlimited = true;
        return;
      }
      const bal = Number(info.creditsBalance ?? 0) || 0;
      const u = Number(info.creditsUsed ?? 0) || 0;
      if (this.licenseHasSpendableCredits(info) || bal > 0 || u > 0) {
        applies = true;
        balance += bal;
        used += u;
      }
    });

    if (unlimited) {
      return {
        applies: false,
        unlimited: true,
        balance: Infinity,
        used,
        total: Infinity,
        left: Infinity,
      };
    }

    return {
      applies,
      unlimited: false,
      balance,
      used,
      total: balance + used,
      left: balance,
    };
  },

  formatCreditsUsageText(usage, costPerRun) {
    if (!usage || usage.unlimited) return "Credits: Unlimited";
    if (!usage.applies && usage.left <= 0 && usage.used <= 0) return "";
    const left = usage.left ?? usage.balance ?? 0;
    const used = usage.used ?? 0;
    const total = usage.total ?? left + used;
    let text = `Total ${total} · Used ${used} · Left ${left}`;
    if (costPerRun > 0) text += ` · ${costPerRun}/run`;
    return text;
  },

  summarizeLicenseEntry(entry) {
    const info = this.normalizeLicenseInfo(entry?.licenseInfo || {});
    const validity = this.getLicenseValiditySummary(info);
    const typeLabel = this.formatLicenseTypeLabel(info);
    const role = this.getLicenseRoleLabel(entry);
    const usage = this.getCreditsUsageSummary([entry]);
    const accessOk = this.licenseEntryHasAccess(entry);
    let status = info.accessStatus || "active";
    let statusLabel = "Active";
    if (!accessOk) {
      if (validity.kind === "expired" || status === "expired") {
        status = "expired";
        statusLabel = "Expired";
      } else if (
        status === "credits_exhausted" ||
        ((info.billingMode === "hybrid" || info.billingMode === "credits") &&
          Number(info.creditsBalance ?? 0) <= 0)
      ) {
        status = "credits_exhausted";
        statusLabel = "Credits exhausted";
      } else {
        status = "inactive";
        statusLabel = "Inactive";
      }
    }
    return {
      key: entry?.key,
      role,
      typeLabel,
      status,
      statusLabel,
      accessOk,
      validity,
      info,
      usage,
      creditsLine: this.formatCreditsUsageText(usage, 0),
    };
  },

  renderLicenseStatusBannerHtml(licenses) {
    const list = (licenses || []).filter(Boolean);
    if (!list.length) return "";
    return list
      .map((entry) => {
        const s = this.summarizeLicenseEntry(entry);
        const key = this.maskLicenseKey(entry.key);
        const expiry =
          s.validity.kind === "expired"
            ? `Expired ${s.info.expiresAt ? new Date(s.info.expiresAt).toLocaleDateString() : ""}`
            : s.info.expiresAt
              ? `Expires ${new Date(s.info.expiresAt).toLocaleDateString()}`
              : s.info.unlimitedTime
                ? "Never expires"
                : "No expiry";
        const statusColor =
          s.status === "active"
            ? "#059669"
            : s.status === "credits_exhausted"
              ? "#d97706"
              : "#dc2626";
        const credits =
          s.creditsLine && s.usage.applies
            ? `<div style="margin-top:6px;font-size:11px;color:#3d2914;">💳 ${this.escapeHtml(s.creditsLine)}</div>`
            : "";
        const renewHint =
          s.status === "expired"
            ? `<div style="margin-top:8px;font-size:11px;color:#b45309;">Renew below with the same license key — your key stays on this device.</div>`
            : s.status === "credits_exhausted"
              ? `<div style="margin-top:8px;font-size:11px;color:#b45309;">Buy a credit pack below to continue with the same license.</div>`
              : "";
        return `<div class="license-status-card" style="background:#fff;border:1px solid #f0e0c8;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div style="min-width:0;">
              <div style="font-size:10px;font-weight:700;color:#c45f12;text-transform:uppercase;">${this.escapeHtml(s.role)}</div>
              <div style="font-size:13px;font-weight:700;color:#1f2937;margin-top:4px;">${this.escapeHtml(s.typeLabel)}</div>
              <div style="font-family:Consolas,monospace;font-size:11px;color:#6b7280;margin-top:4px;word-break:break-all;">${key}</div>
            </div>
            <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;color:${statusColor};background:${statusColor}1a;">${this.escapeHtml(s.statusLabel)}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;margin-top:8px;line-height:1.45;">${this.escapeHtml(expiry)}</div>
          ${credits}
          ${renewHint}
        </div>`;
      })
      .join("");
  },

  escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  licenseEntryHasAccess(entry) {
    const info = this.normalizeLicenseInfo(entry?.licenseInfo || {});
    const mode = info.billingMode || "subscription";
    const unlimitedTime = info.unlimitedTime;
    const unlimitedCredits = info.unlimitedCredits;

    if (info.planType === "demo") {
      if (unlimitedTime) return true;
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

    // subscription — unlimited time, open-ended (no expiresAt), or not yet expired
    if (unlimitedTime) return true;
    if (!info.expiresAt) return true;
    return new Date() <= new Date(info.expiresAt);
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
          details += `<div>Validity: <strong>Never expires</strong></div>`;
        } else if (info.expiresAt) {
          const validity = this.getLicenseValiditySummary(info);
          details += `<div>${validity.kind === "expired" ? "Expired" : "Expires"}: <strong>${new Date(info.expiresAt).toLocaleDateString()}</strong></div>`;
        } else {
          details += `<div>Validity: <strong>No expiry</strong></div>`;
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
                licenseInfo: this.mergeRefreshedLicenseInfo(
                  entry.licenseInfo,
                  refreshed.license,
                ),
              });
            } else if (refreshed.reason === "License not found or deactivated") {
              // Drop only when admin deactivated the key.
            } else if (refreshed.license) {
              updated.push({
                ...entry,
                licenseInfo: this.mergeRefreshedLicenseInfo(
                  entry.licenseInfo,
                  refreshed.license,
                ),
              });
            } else {
              // Keep license in session (credits exhausted, expiry, network, device issues).
              updated.push(entry);
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

  mergeRefreshedLicenseInfo(localInfo, remoteInfo) {
    const local = this.normalizeLicenseInfo(localInfo || {});
    const remote = this.normalizeLicenseInfo(remoteInfo || {});
    const merged = { ...remote };

    if (remote.unlimitedCredits) return merged;

    const localBal = Number(local.creditsBalance ?? 0);
    const remoteBal = Number(remote.creditsBalance ?? 0);
    const localUsed = Number(local.creditsUsed ?? 0);
    const remoteUsed = Number(remote.creditsUsed ?? 0);

    // Never restore a higher balance from stale Firebase after a local deduction.
    if (localBal < remoteBal) {
      merged.creditsBalance = localBal;
      merged.creditsUsed = Math.max(localUsed, remoteUsed);
    }

    return merged;
  },

  isImageGenCreditChargeSuccess(result, expectedCost) {
    if (!result?.ok) return false;
    if (result.deducted != null || result.local) return true;
    if (expectedCost <= 0) return true;
    if (result.skipped && result.unlimited) return true;
    return false;
  },

  /** True when this license has a finite credit balance to spend on image generation. */
  licenseHasSpendableCredits(info) {
    const n = this.normalizeLicenseInfo(info || {});
    if (n.unlimitedCredits) return false;
    const balance = Number(n.creditsBalance ?? 0) || 0;
    if (balance <= 0) return false;
    const mode = n.billingMode || "subscription";
    return mode === "credits" || mode === "hybrid" || mode === "subscription";
  },

  getCreditSources(licenses) {
    return (licenses || [])
      .filter((entry) => {
        if (!this.licenseEntryHasAccess(entry)) return false;
        return this.licenseHasSpendableCredits(entry.licenseInfo);
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
      if (mode === "subscription" && !this.licenseHasSpendableCredits(info)) continue;

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

  async consumeCreditsWithFallback(amount) {
    const n = Math.max(1, Number(amount) || 1);
    const remote = await this.consumeCredits(n);
    if (remote.ok && !remote.skipped) return remote;
    if (remote.skipped && remote.unlimited) return remote;
    if (remote.ok && remote.skipped) {
      const local = await this.consumeCreditsLocal(n);
      if (local.ok) return local;
      return remote;
    }
    if (
      remote.reason === "Credits sync unavailable" ||
      remote.reason === "Firebase unavailable" ||
      remote.reason === "Could not update credits"
    ) {
      return this.consumeCreditsLocal(n);
    }
    return remote;
  },

  async ensureCanOperate(actionLabel) {
    await this.checkLicense();
    if (!this.isLicensed) return { ok: false, reason: "License required" };

    const licenses = await this.getActiveLicenses();
    if (!this.requiresCreditBilling(licenses)) {
      return { ok: true };
    }

    const unlimited = licenses.some(
      (e) =>
        this.licenseEntryHasAccess(e) &&
        this.normalizeLicenseInfo(e.licenseInfo).unlimitedCredits,
    );
    if (!unlimited) {
      const sources = this.getCreditSources(licenses).filter((e) =>
        this.licenseEntryHasAccess(e),
      );
      const total = sources.reduce(
        (sum, e) => sum + (Number(e.licenseInfo?.creditsBalance ?? 0) || 0),
        0,
      );
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
    return { ok: true };
  },

  // ── AI image generation limits (synced with admin config) ──────────────

  imageGenDefaultConfig() {
    return {
      configured: false,
      enabled: true,
      credits_per_image: 0,
      daily_limit: 0,
      monthly_limit: 0,
      max_batch_size: 0,
    };
  },

  async getImageGenConfig(forceFresh = false) {
    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        return await FirebaseLicense.getImageGenerationConfig(forceFresh);
      } catch (e) {
        console.warn("Image-gen config load failed:", e.message);
      }
    }
    return this.imageGenDefaultConfig();
  },

  async _getLocalImageCounters(key) {
    try {
      const r = await chrome.storage.local.get(["imageGenCounters"]);
      return (r.imageGenCounters || {})[key] || {};
    } catch (e) {
      return {};
    }
  },

  async _setLocalImageCounters(key, counters) {
    try {
      const r = await chrome.storage.local.get(["imageGenCounters"]);
      const map = r.imageGenCounters || {};
      map[key] = counters;
      await chrome.storage.local.set({ imageGenCounters: map });
    } catch (e) {
      /* ignore */
    }
  },

  /** Current (period-normalized) counters for the primary license. */
  async getImageGenCounters() {
    const licenses = await this.getActiveLicenses();
    const primary = this.pickPrimaryLicense(licenses);
    const normalize =
      typeof FirebaseLicense !== "undefined"
        ? (c) => FirebaseLicense.normalizeImageGenCounters(c)
        : (c) => c || {};
    if (!primary) return { normalize: null, ...normalize({}) };
    const info = primary.licenseInfo || {};
    if (info.planType === "demo") {
      const local = await this._getLocalImageCounters(primary.key);
      return { key: primary.key, demo: true, ...normalize(local) };
    }
    return {
      key: primary.key,
      demo: false,
      ...normalize({
        total: info.imagesGeneratedTotal,
        today: info.imagesGeneratedToday,
        todayDate: info.imagesGeneratedTodayDate,
        month: info.imagesGeneratedMonth,
        monthKey: info.imagesGeneratedMonthKey,
      }),
    };
  },

  _hasCreditsBillingLicense(licenses) {
    return (licenses || []).some(
      (e) =>
        this.licenseEntryHasAccess(e) &&
        this.licenseHasSpendableCredits(e.licenseInfo),
    );
  },

  _imageCreditsApply(licenses, config) {
    if (
      (licenses || []).some(
        (e) =>
          this.licenseEntryHasAccess(e) &&
          this.normalizeLicenseInfo(e.licenseInfo).unlimitedCredits,
      )
    ) {
      return false;
    }
    return this._hasCreditsBillingLicense(licenses);
  },

  async getOperationCreditCost() {
    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      try {
        const cfg = await FirebaseLicense.getCreditsConfig();
        return Math.max(1, Number(cfg.cost_per_operation) || 1);
      } catch (e) {
        console.warn("Credits config load failed:", e.message);
      }
    }
    return 1;
  },

  /** Credits charged per generation run for credits/hybrid licenses. */
  async resolveImageGenRunCost(licenses, config) {
    if (!this._imageCreditsApply(licenses, config)) return 0;
    if (config?.configured && config.credits_per_image > 0) {
      return config.credits_per_image;
    }
    return this.getOperationCreditCost();
  },

  /** Resolved per-run credit cost for a gate (for UI + charge checks). */
  async getImageGenRunCost(gate) {
    const config = gate?.config || (await this.getImageGenConfig());
    const licenses = await this.getActiveLicenses();
    let cost = Number(gate?.cost) || 0;
    if (cost <= 0) {
      cost = await this.resolveImageGenRunCost(licenses, config);
    }
    return cost;
  },

  async consumeCreditsLocal(amount) {
    const n = Math.max(1, Number(amount) || 1);
    const licenses = await this.getActiveLicenses();
    const sources = this.getCreditSources(licenses).filter((e) =>
      this.licenseEntryHasAccess(e),
    );
    for (const entry of sources) {
      const info = this.normalizeLicenseInfo(entry.licenseInfo || {});
      if (info.unlimitedCredits) {
        return { ok: true, skipped: true, unlimited: true };
      }
      const balance = Number(info.creditsBalance ?? 0);
      if (balance < n) continue;
      const newBalance = balance - n;
      const used = (Number(info.creditsUsed ?? 0) || 0) + n;
      await this.updateLicenseEntry(entry.key, {
        creditsBalance: newBalance,
        creditsUsed: used,
      });
      if (
        CONFIG?.USE_FIREBASE_LICENSE &&
        typeof FirebaseLicense !== "undefined" &&
        FirebaseLicense.isEnabled()
      ) {
        void FirebaseLicense.patchDoc(
          "licenses",
          entry.key,
          { credits_balance: newBalance, credits_used: used },
          ["credits_balance", "credits_used"],
        );
      }
      const refreshed = await this.getActiveLicenses();
      this.licenseInfo = this.pickPrimaryLicense(refreshed)?.licenseInfo;
      this.isLicensed = refreshed.length > 0 && this.licensesHaveAccess(refreshed);
      return { ok: true, balance: newBalance, used, deducted: n, local: true };
    }
    return {
      ok: false,
      reason: "Insufficient credits",
      needsTopUp: true,
    };
  },

  /**
   * Check whether a generation run can start now.
   * Limits and credits are per run (1 upload → variants), not per variant.
   * `variantCount` is only used for max_batch_size (max variants per run).
   */
  async canGenerateImages(variantCount) {
    const config = await this.getImageGenConfig();
    const variants = Math.max(1, Number(variantCount) || 1);
    const runs = 1;

    const licenses = await this.getActiveLicenses();

    if (!config.configured) {
      const creditsApply = this._imageCreditsApply(licenses, config);
      let cost = 0;
      if (creditsApply) {
        cost = await this.resolveImageGenRunCost(licenses, config);
        const balance = this.getTotalCreditsBalance(licenses);
        if (balance !== Infinity && balance < cost) {
          return {
            ok: false,
            reason: `Need ${cost} credit${cost === 1 ? "" : "s"}, you have ${balance}. Buy a credit pack to continue.`,
            needsTopUp: true,
            config,
            cost,
            legacy: true,
            creditsApply,
          };
        }
      }
      return { ok: true, legacy: true, config, cost, creditsApply };
    }
    if (!config.enabled) {
      return {
        ok: false,
        reason: "AI image generation is currently disabled.",
        config,
        cost: 0,
      };
    }
    if (config.max_batch_size > 0 && variants > config.max_batch_size) {
      return {
        ok: false,
        reason: `Max ${config.max_batch_size} variants per generation — reduce the count and try again.`,
        config,
        cost: 0,
      };
    }

    const counters = await this.getImageGenCounters();

    if (config.daily_limit > 0) {
      if (counters.today >= config.daily_limit) {
        return {
          ok: false,
          reason: `Daily limit reached (${config.daily_limit}/day). Resets tomorrow.`,
          config,
          counters,
          cost: 0,
          limitReached: true,
        };
      }
      if (counters.today + runs > config.daily_limit) {
        const left = Math.max(0, config.daily_limit - counters.today);
        return {
          ok: false,
          reason: `Only ${left} generation${left === 1 ? "" : "s"} left today (limit ${config.daily_limit}/day).`,
          config,
          counters,
          cost: 0,
          limitReached: true,
        };
      }
    }

    if (config.monthly_limit > 0) {
      if (counters.month >= config.monthly_limit) {
        return {
          ok: false,
          reason: `Monthly limit reached (${config.monthly_limit}/month).`,
          config,
          counters,
          cost: 0,
          limitReached: true,
        };
      }
      if (counters.month + runs > config.monthly_limit) {
        const left = Math.max(0, config.monthly_limit - counters.month);
        return {
          ok: false,
          reason: `Only ${left} generation${left === 1 ? "" : "s"} left this month (limit ${config.monthly_limit}/month).`,
          config,
          counters,
          cost: 0,
          limitReached: true,
        };
      }
    }

    const creditsApply = this._imageCreditsApply(licenses, config);
    let cost = 0;
    if (creditsApply) {
      cost = (await this.resolveImageGenRunCost(licenses, config)) * runs;
      const balance = this.getTotalCreditsBalance(licenses);
      if (balance !== Infinity && balance < cost) {
        return {
          ok: false,
          reason: `Need ${cost} credit${cost === 1 ? "" : "s"}, you have ${balance}. Buy a credit pack to continue.`,
          needsTopUp: true,
          config,
          counters,
          cost,
          creditsApply,
        };
      }
    }

    return { ok: true, config, counters, cost, creditsApply };
  },

  /** Full gate before generation: license validity + image limits. */
  async ensureCanGenerateImages(batchCount) {
    await this.checkLicense();
    if (!this.isLicensed) {
      return {
        ok: false,
        reason: "Activate a license to generate images.",
        openModal: true,
      };
    }
    return this.canGenerateImages(batchCount);
  },

  /** Deduct credits when a generation run starts (1 per run, including stopped runs). */
  async chargeImageGenerationRun(gate) {
    const config = gate?.config || (await this.getImageGenConfig());
    const licenses = await this.getActiveLicenses();
    let cost = Number(gate?.cost) || 0;
    if (cost <= 0) {
      cost = await this.resolveImageGenRunCost(licenses, config);
    }
    if (cost <= 0) return { ok: true, skipped: true };
    return this.consumeCreditsWithFallback(cost);
  },

  /** Increment generation-run counters after a run (credits charged separately at run start). */
  async recordImageGeneration(count, gate) {
    const n = Math.max(1, Number(count) || 1);

    const config = gate?.config || (await this.getImageGenConfig());
    if (!config.configured) return { ok: true, skipped: true };

    const licenses = await this.getActiveLicenses();
    const primary = this.pickPrimaryLicense(licenses);
    if (!primary) return { ok: false, reason: "No license" };
    const info = primary.licenseInfo || {};

    const useFirebase =
      info.planType !== "demo" &&
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled();

    if (!useFirebase) {
      const cur = FirebaseLicense.normalizeImageGenCounters(
        await this._getLocalImageCounters(primary.key),
      );
      const next = {
        total: cur.total + n,
        today: cur.today + n,
        todayDate: cur.todayDate,
        month: cur.month + n,
        monthKey: cur.monthKey,
      };
      await this._setLocalImageCounters(primary.key, next);
      await this.updateLicenseEntry(primary.key, {
        imagesGeneratedTotal: next.total,
        imagesGeneratedToday: next.today,
        imagesGeneratedTodayDate: next.todayDate,
        imagesGeneratedMonth: next.month,
        imagesGeneratedMonthKey: next.monthKey,
      });
      return { ok: true, counters: next };
    }

    const res = await FirebaseLicense.recordImageGeneration(primary.key, n);
    if (res.ok && res.counters) {
      await this.updateLicenseEntry(primary.key, {
        imagesGeneratedTotal: res.counters.total,
        imagesGeneratedToday: res.counters.today,
        imagesGeneratedTodayDate: res.counters.todayDate,
        imagesGeneratedMonth: res.counters.month,
        imagesGeneratedMonthKey: res.counters.monthKey,
      });
    }
    return res;
  },

  /** Summary for UI: config + counters + remaining + per-run cost. */
  async getImageGenSummary() {
    const config = await this.getImageGenConfig();
    const counters = await this.getImageGenCounters();
    const licenses = await this.getActiveLicenses();
    const creditsApply = this._imageCreditsApply(licenses, config);
    const costPerRun = creditsApply
      ? await this.resolveImageGenRunCost(licenses, config)
      : 0;
    const balance = this.getTotalCreditsBalance(licenses);
    const usage = this.getCreditsUsageSummary(licenses);
    const remainingDaily =
      config.daily_limit > 0
        ? Math.max(0, config.daily_limit - counters.today)
        : null;
    const remainingMonthly =
      config.monthly_limit > 0
        ? Math.max(0, config.monthly_limit - counters.month)
        : null;
    return {
      config,
      counters,
      creditsApply,
      creditsBalance: balance,
      creditsUsage: usage,
      costPerRun,
      /** @deprecated use costPerRun — kept for older callers */
      costPerImage: costPerRun,
      remainingDaily,
      remainingMonthly,
    };
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
        if (fbResult.valid === true || fbResult.reactivatable || fbResult.license) {
          const licenseInfo = this.normalizeLicenseInfo(
            fbResult.license || {
              key: trimmedKey,
              planType: "premium",
              activatedAt: new Date().toISOString(),
            },
          );
          const entry = {
            key: trimmedKey,
            licenseInfo,
            activatedAt: licenseInfo.activatedAt || new Date().toISOString(),
          };
          const existing = await this.getActiveLicenses();
          const merged = this.mergeLicenseEntry(existing, entry);
          await this.saveActiveLicenses(merged);
          this.isLicensed = this.licensesHaveAccess(merged);
          this.licenseKey = this.pickPrimaryLicense(merged)?.key || trimmedKey;
          this.licenseInfo = licenseInfo;
          if (fbResult.valid) {
            return { success: true, merged: merged.length > 1 };
          }
          return {
            success: true,
            limited: true,
            merged: merged.length > 1,
            message: fbResult.reason || "License saved — renew or buy credits to continue",
            needsTopUp: fbResult.needsTopUp,
            needsRenewal: fbResult.needsRenewal,
            accessStatus: fbResult.accessStatus,
          };
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

  async activateGoogleFreeTrial() {
    const isExtensionPage =
      typeof location !== "undefined" &&
      String(location.protocol || "").startsWith("chrome-extension");

    if (
      !isExtensionPage &&
      typeof chrome !== "undefined" &&
      chrome.runtime?.sendMessage
    ) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "ACTIVATE_GOOGLE_TRIAL",
        });
        if (response?.success) {
          const licenses = await this.getActiveLicenses();
          this.isLicensed = this.licensesHaveAccess(licenses);
          this.licenseKey = this.pickPrimaryLicense(licenses)?.key || null;
          this.licenseInfo =
            this.pickPrimaryLicense(licenses)?.licenseInfo || null;
        }
        return (
          response || {
            success: false,
            message: "Could not reach extension background.",
          }
        );
      } catch (e) {
        return { success: false, message: e.message || "Google trial failed." };
      }
    }

    if (
      typeof FirebaseAuth === "undefined" ||
      typeof FirebaseLicense === "undefined" ||
      !FirebaseLicense.isEnabled()
    ) {
      return {
        success: false,
        message: "Google sign-in is not available in this build.",
      };
    }

    try {
      let user = await FirebaseAuth.getCurrentUser();
      if (!user) {
        await FirebaseAuth.signInWithGoogle();
        user = await FirebaseAuth.getCurrentUser();
      }
      if (!user?.uid) {
        return { success: false, message: "Google sign-in was cancelled." };
      }

      const idToken = await FirebaseAuth.getIdToken(true);
      const machineId = await this.getMachineId();
      const claim = await FirebaseLicense.claimGoogleFreeTrial(
        machineId,
        idToken,
      );

      if (!claim.success) {
        return {
          success: false,
          message: claim.reason || "Could not start free trial.",
          trialExpired: claim.trialExpired,
          code: claim.code,
        };
      }

      const licenseKey = claim.licenseKey;
      const licenseInfo = this.normalizeLicenseInfo({
        ...(claim.license || {}),
        key: licenseKey,
        planType: "google_trial",
        planName: claim.license?.planName || "Google free trial",
        googleUid: user.uid,
        customerEmail: user.email,
      });

      const entry = {
        key: licenseKey,
        licenseInfo,
        activatedAt: licenseInfo.activatedAt || new Date().toISOString(),
      };
      const existing = await this.getActiveLicenses();
      const merged = this.mergeLicenseEntry(existing, entry);
      await this.saveActiveLicenses(merged);
      this.isLicensed = this.licensesHaveAccess(merged);
      this.licenseKey = this.pickPrimaryLicense(merged)?.key || licenseKey;
      this.licenseInfo = licenseInfo;

      return {
        success: true,
        existing: claim.existing,
        message: claim.message || "Free trial activated!",
        licenseKey,
      };
    } catch (e) {
      return {
        success: false,
        message: e.message || "Google sign-in failed.",
      };
    }
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
      const text = settings.message || "";
      if (typeof WhatsAppLink !== "undefined") {
        const ok = await WhatsAppLink.open(phone, text);
        if (!ok && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")) {
          console.warn("WhatsApp open failed — ensure Meesho tab is open");
        }
      } else {
        window.open(
          `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
          "_blank",
        );
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
