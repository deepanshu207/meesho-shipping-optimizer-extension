// ============================================
// SHIPPING OPTIMIZER — Firebase license service
// Uses ONLY shipping_optimizer_* collections in swagstree-web.
// Does NOT touch any other Swagstree app data.
// ============================================

const FirebaseLicense = {
  COLLECTION_PREFIX: "shipping_optimizer",

  _configCache: null,
  _configCacheTime: 0,
  _cacheTtlMs: 5 * 60 * 1000,

  get firebase() {
    return typeof CONFIG !== "undefined" ? CONFIG.FIREBASE : null;
  },

  isEnabled() {
    return (
      CONFIG?.USE_FIREBASE_LICENSE === true &&
      !!this.firebase?.projectId &&
      !!this.firebase?.apiKey
    );
  },

  collectionPath(name) {
    return `${this.COLLECTION_PREFIX}_${name}`;
  },

  documentsBaseUrl() {
    const projectId = this.firebase.projectId;
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  },

  docUrl(collection, docId) {
    return `${this.documentsBaseUrl()}/${this.collectionPath(collection)}/${encodeURIComponent(docId)}`;
  },

  collectionUrl(collection) {
    return `${this.documentsBaseUrl()}/${this.collectionPath(collection)}`;
  },

  parseFirestoreValue(field) {
    if (!field || typeof field !== "object") return null;
    if ("stringValue" in field) return field.stringValue;
    if ("integerValue" in field) return parseInt(field.integerValue, 10);
    if ("doubleValue" in field) return Number(field.doubleValue);
    if ("booleanValue" in field) return field.booleanValue;
    if ("timestampValue" in field) return field.timestampValue;
    if ("nullValue" in field) return null;
    if ("mapValue" in field) {
      const out = {};
      const inner = field.mapValue.fields || {};
      for (const [k, v] of Object.entries(inner)) {
        out[k] = this.parseFirestoreValue(v);
      }
      return out;
    }
    if ("arrayValue" in field) {
      return (field.arrayValue.values || []).map((v) =>
        this.parseFirestoreValue(v),
      );
    }
    return null;
  },

  toFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") {
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    }
    if (Array.isArray(value)) {
      return {
        arrayValue: { values: value.map((v) => this.toFirestoreValue(v)) },
      };
    }
    if (typeof value === "object") {
      const fields = {};
      for (const [k, v] of Object.entries(value)) {
        fields[k] = this.toFirestoreValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
  },

  parseDocument(doc) {
    if (!doc?.fields) return null;
    const out = {};
    for (const [k, v] of Object.entries(doc.fields)) {
      out[k] = this.parseFirestoreValue(v);
    }
    return out;
  },

  async fetchDoc(collection, docId) {
    if (!this.isEnabled()) return null;
    const url = `${this.docUrl(collection, docId)}?key=${encodeURIComponent(this.firebase.apiKey)}`;
    try {
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (res.status === 404) return null;
      if (!res.ok) {
        console.warn("Firebase read failed:", collection, docId, res.status);
        return null;
      }
      return this.parseDocument(await res.json());
    } catch (e) {
      console.warn("Firebase read error:", e.message);
      return null;
    }
  },

  async listDocs(collection) {
    if (!this.isEnabled()) return [];
    const url = `${this.collectionUrl(collection)}?key=${encodeURIComponent(this.firebase.apiKey)}&pageSize=200`;
    try {
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.documents || []).map((doc) => {
        const id = (doc.name || "").split("/").pop();
        return { id, ...this.parseDocument(doc) };
      });
    } catch (e) {
      console.warn("Firebase list error:", e.message);
      return [];
    }
  },

  async patchDoc(collection, docId, partial, updateFields) {
    if (!this.isEnabled()) return false;
    const fields = {};
    for (const [k, v] of Object.entries(partial)) {
      fields[k] = this.toFirestoreValue(v);
    }
    const mask = (updateFields || Object.keys(partial))
      .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
      .join("&");
    const url = `${this.docUrl(collection, docId)}?key=${encodeURIComponent(this.firebase.apiKey)}&${mask}`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      return res.ok;
    } catch (e) {
      console.warn("Firebase patch error:", e.message);
      return false;
    }
  },

  defaultPlans() {
    return [
      { id: "monthly", name: "Monthly", price: 599, days: 30, duration: "1 Month", save: "", best: false, active: true, order: 0 },
      { id: "quarterly", name: "3 Months", price: 1399, days: 90, duration: "3 Months", save: "Save ₹1000", best: false, active: true, order: 1 },
      { id: "halfyearly", name: "6 Months", price: 2299, days: 180, duration: "6 Months", save: "Save ₹3000", best: false, active: true, order: 2 },
      { id: "yearly", name: "Yearly", price: 3099, days: 365, duration: "1 Year", save: "Save ₹8000", best: true, active: true, order: 3 },
    ];
  },

  slugifyPlanId(id) {
    return String(id || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "");
  },

  normalizePlanEntry(p, idFallback, index) {
    const id = this.slugifyPlanId(p?.id || idFallback || `plan_${index}`);
    return {
      id: id || `plan_${index}`,
      name: p?.name || p?.title || "Plan",
      price: Number(p?.price) || 0,
      days: Number(p?.days) || 30,
      duration: p?.duration || p?.name || "Plan",
      save: p?.save || p?.saveLabel || "",
      best: !!p?.best,
      active: p?.active !== false,
      order: p?.order != null ? Number(p.order) : index,
    };
  },

  parsePlansRaw(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return raw
        .filter((p) => p && typeof p === "object")
        .map((p, i) => this.normalizePlanEntry(p, p.id || `plan_${i}`, i));
    }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([id, p], i) =>
        this.normalizePlanEntry({ ...p, id: p?.id || id }, id, i),
      );
    }
    return null;
  },

  sortPlans(plans) {
    return [...plans].sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        String(a.name).localeCompare(String(b.name)),
    );
  },

  ensureSingleBestPlan(plans) {
    let found = false;
    return plans.map((p) => {
      if (!p.best) return p;
      if (found) return { ...p, best: false };
      found = true;
      return p;
    });
  },

  normalizeKey(key) {
    return CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : String(key || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "-");
  },

  /** MEESHO-XXXX-XXXX-XXXX — 4-char segments, uppercase alphanumeric */
  generateLicenseKey() {
    const seg = () => {
      let s = Math.random().toString(36).substring(2, 6).toUpperCase();
      while (s.length < 4) s += "X";
      return s.substring(0, 4);
    };
    return `MEESHO-${seg()}-${seg()}-${seg()}`;
  },

  async licenseKeyExists(key) {
    const normalized = this.normalizeKey(key);
    if (!normalized) return true;
    const lic = await this.fetchDoc("licenses", normalized);
    if (lic) return true;
    const demoKeys = await this.getDemoKeysMap();
    return !!demoKeys[normalized];
  },

  async generateUniqueLicenseKey(maxAttempts = 12) {
    for (let i = 0; i < maxAttempts; i++) {
      const key = this.generateLicenseKey();
      if (!(await this.licenseKeyExists(key))) return key;
    }
    const tail = Date.now().toString(36).toUpperCase().slice(-8);
    return `MEESHO-${tail.slice(0, 4)}-${tail.slice(4)}-UNIQ`;
  },

  async getPlanById(planId) {
    if (!planId) return null;
    const all = await this.getAllPlans();
    const key = String(planId).trim().toLowerCase();
    return (
      all.find(
        (p) =>
          p.id === key ||
          p.id === planId ||
          this.slugifyPlanId(planId) === p.id,
      ) || null
    );
  },

  async getAllPlans(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    const parsed = this.parsePlansRaw(app?.plans || app?.pricing);
    const list = parsed?.length
      ? parsed
      : this.defaultPlans().map((p, i) => ({ ...p, order: i }));
    return this.sortPlans(list);
  },

  async getPricingPlans(forceFresh = false) {
    const all = await this.getAllPlans(forceFresh);
    const active = all.filter((p) => p.active !== false);
    const plans = this.ensureSingleBestPlan(active);
    return plans.length ? plans : this.defaultPlans();
  },

  async resolvePlanDays(lic) {
    if (lic.planDays != null) return Number(lic.planDays) || 30;
    if (lic.plan_days != null) return Number(lic.plan_days) || 30;
    const planId = lic.planId || lic.plan_id || lic.planType || lic.plan_type;
    if (planId) {
      const plan = await this.getPlanById(planId);
      if (plan) return plan.days;
    }
    return 365;
  },

  /** Expiry from activation time + plan days (default for paid licenses) */
  computeExpiresAt(activatedAtIso, planDays) {
    const days = Number(planDays) || 30;
    const start = activatedAtIso ? new Date(activatedAtIso) : new Date();
    return new Date(start.getTime() + days * 86400000).toISOString();
  },

  planGridColumns(count) {
    if (count <= 1) return "1fr";
    if (count === 3) return "1fr 1fr";
    return "1fr 1fr";
  },

  async getAppConfig(force = false) {
    if (
      !force &&
      this._configCache &&
      Date.now() - this._configCacheTime < this._cacheTtlMs
    ) {
      return this._configCache;
    }
    const doc = await this.fetchDoc("config", "app");
    this._configCache = doc;
    this._configCacheTime = Date.now();
    return doc;
  },

  isExtensionEnabled() {
    const app = this._configCache;
    if (!app) return true;
    return app.extension_enabled !== false && app.extensionEnabled !== false;
  },

  async getAnnouncement() {
    const app = await this.getAppConfig();
    return (app?.announcement || "").trim();
  },

  async isExtensionEnabledRemote() {
    const app = await this.getAppConfig();
    return app?.extension_enabled !== false && app?.extensionEnabled !== false;
  },

  async getWhatsAppSettings() {
    const app = await this.getAppConfig();
    return {
      number:
        app?.whatsapp_number ||
        app?.whatsappNumber ||
        CONFIG.DEFAULT_WHATSAPP,
      message:
        app?.whatsapp_message ||
        app?.whatsappMessage ||
        CONFIG.DEFAULT_WHATSAPP_MESSAGE,
    };
  },

  async getDemoKeysMap() {
    const merged = { ...(CONFIG.BUILTIN_DEMO_KEYS || {}) };
    const app = await this.getAppConfig();
    if (app?.demo_keys && typeof app.demo_keys === "object") {
      Object.assign(merged, app.demo_keys);
    }
    if (app?.demoKeys && typeof app.demoKeys === "object") {
      Object.assign(merged, app.demoKeys);
    }

    const docs = await this.listDocs("demo_keys");
    for (const row of docs) {
      if (row.active === false) continue;
      const key = CONFIG.normalizeLicenseKey
        ? CONFIG.normalizeLicenseKey(row.id)
        : String(row.id || "").toUpperCase();
      if (!key) continue;
      merged[key] = {
        days: Number(row.days) || 30,
        label: row.label || row.name || "",
      };
    }
    return merged;
  },

  async verifyPaidLicense(licenseKey, machineId) {
    const key = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(licenseKey)
      : String(licenseKey || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "-");

    const lic = await this.fetchDoc("licenses", key);
    if (!lic) {
      return { valid: false, reason: "License key not found" };
    }

    const appCfg = await this.getAppConfig();
    if (
      appCfg?.extension_enabled === false ||
      appCfg?.extensionEnabled === false
    ) {
      return {
        valid: false,
        reason: "Extension licensing is temporarily disabled",
      };
    }

    if (lic.active === false) {
      return { valid: false, reason: "License deactivated" };
    }

    const expiresAt = lic.expiresAt || lic.expires_at || null;
    const bound = lic.machineId || lic.machine_id || "";

    if (bound && expiresAt && new Date() > new Date(expiresAt)) {
      return { valid: false, reason: "License expired" };
    }

    const planDays = await this.resolvePlanDays(lic);
    let resolvedExpiresAt = expiresAt;
    let resolvedActivatedAt = lic.activatedAt || lic.activated_at || null;

    if (!bound) {
      const activatedAt = new Date().toISOString();
      resolvedActivatedAt = activatedAt;
      const expiryOnActivation =
        lic.expiry_starts_on_activation !== false &&
        lic.expiryStartsOnActivation !== false;

      if (expiryOnActivation || !resolvedExpiresAt) {
        resolvedExpiresAt = this.computeExpiresAt(activatedAt, planDays);
      }

      await this.patchDoc(
        "licenses",
        key,
        {
          machineId,
          activatedAt,
          expiresAt: resolvedExpiresAt,
          lastVerifiedAt: activatedAt,
        },
        ["machineId", "activatedAt", "expiresAt", "lastVerifiedAt"],
      );
    } else if (bound !== machineId) {
      return {
        valid: false,
        reason: "License already activated on another device",
      };
    } else {
      resolvedExpiresAt = expiresAt;
      await this.patchDoc(
        "licenses",
        key,
        { lastVerifiedAt: new Date().toISOString() },
        ["lastVerifiedAt"],
      );
    }

    if (resolvedExpiresAt && new Date() > new Date(resolvedExpiresAt)) {
      return { valid: false, reason: "License expired" };
    }

    return {
      valid: true,
      license: {
        key,
        planType: lic.planType || lic.plan_type || lic.planId || "premium",
        planDays,
        expiresAt: resolvedExpiresAt,
        activatedAt: resolvedActivatedAt || new Date().toISOString(),
        customerName: lic.customer_name || lic.customerName || "",
        customerPhone: lic.customer_phone || lic.customerPhone || "",
      },
    };
  },

  renderPlanButtons(container, plans, variant = "modal") {
    if (!container) return;
    const list = this.ensureSingleBestPlan(
      plans?.length ? plans : this.defaultPlans(),
    );

    container.style.display = "grid";
    container.style.gridTemplateColumns = this.planGridColumns(list.length);
    container.style.gap = container.style.gap || "8px";

    if (!list.length) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#9ca3af;font-size:11px;">No plans available — add plans in Firebase config.</div>';
      return;
    }

    if (variant === "popup") {
      container.innerHTML = list
        .map((p) => {
          const bestClass = p.best ? " best" : "";
          const tag = p.best
            ? `<span class="plan-best-tag">BEST VALUE</span>`
            : "";
          const save = p.save
            ? `<div class="plan-note">${p.save}</div>`
            : `<div class="plan-note" style="color:var(--mso-muted);">${p.days} days</div>`;
          const nameStyle = p.best ? ' style="margin-top:4px;"' : "";
          const priceStyle = p.best
            ? ' style="color:var(--mso-success);"'
            : "";
          return `<button type="button" class="plan-btn plan-buy-btn${bestClass}" data-plan="${p.id}" data-price="${p.price}" data-days="${p.days}" data-duration="${p.duration}">
            ${tag}
            <div class="plan-name"${nameStyle}>${p.name}</div>
            <div class="plan-price"${priceStyle}>₹${p.price}</div>
            ${save}
          </button>`;
        })
        .join("");
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const best = p.best
          ? `border:2px solid #e67e22;background:linear-gradient(180deg,#fff8ee,#fff);position:relative;`
          : `border:1px solid #f0e0c8;background:#fff;`;
        const tag = p.best
          ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#ffd700,#e67e22);color:#fff;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:700;">BEST VALUE</div>`
          : "";
        const save = p.save
          ? `<div style="font-size:9px;color:#10b981;">${p.save}</div>`
          : `<div style="font-size:9px;color:#6b7280;">${p.days} days</div>`;
        return `<button type="button" class="plan-buy-btn" data-plan="${p.id}" data-price="${p.price}" data-days="${p.days}" data-duration="${p.duration}" style="${best}border-radius:8px;padding:10px;text-align:center;cursor:pointer;color:#1f2937;">
          ${tag}
          <div style="font-size:11px;color:#6b7280;${p.best ? "margin-top:4px;" : ""}">${p.name}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          ${save}
        </button>`;
      })
      .join("");
  },

  async hydrateLicenseUi(root) {
    if (!root || !this.isEnabled()) return { plans: this.defaultPlans() };
    const plansGrid =
      root.querySelector("#license-plans-grid") ||
      root.querySelector(".license-plans-grid");
    const hint = root.querySelector("#license-demo-hint");

    const [plans, demoKeys, wa] = await Promise.all([
      this.getPricingPlans(true),
      this.getDemoKeysMap(),
      this.getWhatsAppSettings(),
    ]);

    if (plansGrid) this.renderPlanButtons(plansGrid, plans);
    if (hint) {
      const sample = Object.keys(demoKeys)[0] || "MEESHO-DEMOFREE";
      hint.innerHTML = `Plans &amp; promo codes managed in Firebase · Demo: <strong>${sample}</strong>`;
    }

    const announcementEl =
      root.querySelector("#license-announcement") ||
      root.querySelector(".license-announcement");
    const announcement = await this.getAnnouncement();
    if (announcementEl) {
      if (announcement) {
        announcementEl.style.display = "block";
        announcementEl.innerHTML = announcement;
      } else {
        announcementEl.style.display = "none";
        announcementEl.innerHTML = "";
      }
    }

    return { plans, demoKeys, whatsapp: wa, announcement };
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FirebaseLicense = FirebaseLicense;
}
