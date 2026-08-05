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

  isUnlimitedFlag(val) {
    return val === true || val === "true" || val === 1 || val === "1";
  },

  normalizePlanEntry(p, idFallback, index) {
    const id = this.slugifyPlanId(p?.id || idFallback || `plan_${index}`);
    const rawMax = p?.max_devices ?? p?.maxDevices;
    const unlimitedDevices = this.isUnlimitedFlag(
      p?.unlimited_devices ?? p?.unlimitedDevices,
    ) || rawMax === 0 || rawMax === "0";
    const maxDevices = unlimitedDevices
      ? 0
      : Math.max(1, Number(rawMax) || 1);
    const rawDays = p?.days;
    const unlimitedTime =
      this.isUnlimitedFlag(p?.unlimited_time ?? p?.unlimitedTime) ||
      rawDays === 0 ||
      rawDays === "0";
    const planKind = String(
      p?.plan_kind || p?.planKind || p?.type || "subscription",
    ).toLowerCase();
    return {
      id: id || `plan_${index}`,
      name: p?.name || p?.title || "Plan",
      price: Number(p?.price) || 0,
      days: unlimitedTime ? 0 : Number(rawDays) || 30,
      duration:
        p?.duration ||
        (unlimitedTime ? "Unlimited" : p?.name || "Plan"),
      save: p?.save || p?.saveLabel || "",
      description: p?.description || p?.note || "",
      best: !!p?.best,
      active: p?.active !== false,
      order: p?.order != null ? Number(p.order) : index,
      max_devices: maxDevices,
      unlimited_devices: unlimitedDevices,
      unlimited_time: unlimitedTime || planKind === "lifetime" || planKind === "unlimited",
      unlimited_credits: this.isUnlimitedFlag(
        p?.unlimited_credits ?? p?.unlimitedCredits,
      ),
      device_tier:
        p?.device_tier ||
        p?.deviceTier ||
        (unlimitedDevices
          ? "unlimited"
          : maxDevices <= 1
            ? "standard"
            : maxDevices <= 3
              ? "family"
              : "friends"),
      billing_mode: p?.billing_mode || p?.billingMode || "subscription",
      plan_kind: planKind,
      included_credits:
        Number(p?.included_credits ?? p?.includedCredits ?? 0) || 0,
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

  defaultCreditsConfig() {
    return {
      enabled: true,
      price_per_credit: 2,
      min_purchase: 10,
      cost_per_operation: 1,
      packs: [
        {
          id: "pack_10",
          credits: 10,
          price: 20,
          label: "10 Credits",
          active: true,
          order: 0,
        },
        {
          id: "pack_20",
          credits: 20,
          price: 38,
          label: "20 Credits",
          active: true,
          order: 1,
        },
        {
          id: "pack_50",
          credits: 50,
          price: 90,
          label: "50 Credits",
          active: true,
          order: 2,
        },
        {
          id: "pack_100",
          credits: 100,
          price: 170,
          label: "100 Credits",
          active: true,
          order: 3,
        },
      ],
    };
  },

  normalizeCreditPack(p, idFallback, index) {
    const id = this.slugifyPlanId(p?.id || idFallback || `pack_${index}`);
    return {
      id: id || `pack_${index}`,
      credits: Number(p?.credits) || 10,
      price: Number(p?.price) || 0,
      label: p?.label || p?.name || `${Number(p?.credits) || 10} Credits`,
      active: p?.active !== false,
      order: p?.order != null ? Number(p.order) : index,
    };
  },

  parseCreditPacks(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return raw
        .filter((p) => p && typeof p === "object")
        .map((p, i) => this.normalizeCreditPack(p, p.id || `pack_${i}`, i));
    }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([id, p], i) =>
        this.normalizeCreditPack({ ...p, id: p?.id || id }, id, i),
      );
    }
    return null;
  },

  resolveUnlimitedTime(lic, plan) {
    if (this.isUnlimitedFlag(lic?.unlimited_time ?? lic?.unlimitedTime)) {
      return true;
    }
    if (this.isUnlimitedFlag(plan?.unlimited_time ?? plan?.unlimitedTime)) {
      return true;
    }
    const kind = String(
      lic?.plan_kind ??
        lic?.planKind ??
        plan?.plan_kind ??
        plan?.planKind ??
        "",
    ).toLowerCase();
    if (kind === "lifetime" || kind === "unlimited") return true;
    const days =
      lic?.planDays ??
      lic?.plan_days ??
      plan?.days;
    return days === 0 || days === "0";
  },

  resolveUnlimitedDevices(lic, plan) {
    if (this.isUnlimitedFlag(lic?.unlimited_devices ?? lic?.unlimitedDevices)) {
      return true;
    }
    if (this.isUnlimitedFlag(plan?.unlimited_devices ?? plan?.unlimitedDevices)) {
      return true;
    }
    const max =
      lic?.max_devices ??
      lic?.maxDevices ??
      plan?.max_devices ??
      plan?.maxDevices;
    return max === 0 || max === "0";
  },

  resolveUnlimitedCredits(lic, plan) {
    if (this.isUnlimitedFlag(lic?.unlimited_credits ?? lic?.unlimitedCredits)) {
      return true;
    }
    if (this.isUnlimitedFlag(plan?.unlimited_credits ?? plan?.unlimitedCredits)) {
      return true;
    }
    return false;
  },

  formatPlanDurationLabel(plan) {
    if (!plan) return "";
    if (plan.unlimited_time || plan.days === 0) return "Unlimited";
    if (plan.duration) return plan.duration;
    return `${plan.days} days`;
  },

  formatPlanDevicesLabel(plan) {
    if (!plan) return "1 device";
    if (plan.unlimited_devices || plan.max_devices === 0) {
      return "Unlimited devices";
    }
    const n = plan.max_devices || 1;
    return `${n} device${n === 1 ? "" : "s"}`;
  },

  async getCreditsConfig(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    const raw = app?.credits || app?.credits_config || {};
    const defaults = this.defaultCreditsConfig();
    const packs =
      this.parseCreditPacks(raw.packs) ||
      this.parseCreditPacks(defaults.packs) ||
      defaults.packs;
    return {
      ...defaults,
      ...raw,
      enabled: raw.enabled !== false,
      price_per_credit: Number(raw.price_per_credit ?? raw.pricePerCredit ?? 2) || 2,
      min_purchase: Number(raw.min_purchase ?? raw.minPurchase ?? 10) || 10,
      cost_per_operation:
        Number(raw.cost_per_operation ?? raw.costPerOperation ?? 1) || 1,
      packs: this.sortPlans(packs.filter((p) => p.active !== false)),
    };
  },

  async getCreditPacks(forceFresh = false) {
    const cfg = await this.getCreditsConfig(forceFresh);
    return cfg.packs?.length ? cfg.packs : this.defaultCreditsConfig().packs;
  },

  getDeviceIds(lic) {
    const ids = lic?.device_ids || lic?.deviceIds;
    if (Array.isArray(ids)) return ids.filter(Boolean);
    const legacy = lic?.machineId || lic?.machine_id;
    return legacy ? [legacy] : [];
  },

  resolveMaxDevices(lic, plan) {
    if (this.resolveUnlimitedDevices(lic, plan)) return 0;
    if (lic?.max_devices != null) return Math.max(1, Number(lic.max_devices) || 1);
    if (lic?.maxDevices != null) return Math.max(1, Number(lic.maxDevices) || 1);
    if (plan?.max_devices != null) return Math.max(1, Number(plan.max_devices) || 1);
    if (plan?.maxDevices != null) return Math.max(1, Number(plan.maxDevices) || 1);
    return 1;
  },

  resolveBillingMode(lic, plan) {
    return (
      lic?.billing_mode ||
      lic?.billingMode ||
      plan?.billing_mode ||
      plan?.billingMode ||
      "subscription"
    );
  },

  resolveCreditsBalance(lic) {
    return Number(lic?.credits_balance ?? lic?.creditsBalance ?? 0) || 0;
  },

  isCreditsBilling(mode) {
    return mode === "credits" || mode === "hybrid";
  },

  licenseHasAccess(lic, plan, resolvedExpiresAt) {
    const mode = this.resolveBillingMode(lic, plan);
    const unlimitedTime = this.resolveUnlimitedTime(lic, plan);
    const unlimitedCredits = this.resolveUnlimitedCredits(lic, plan);
    const credits = this.resolveCreditsBalance(lic);
    const expired =
      !unlimitedTime &&
      resolvedExpiresAt &&
      new Date() > new Date(resolvedExpiresAt);

    if (mode === "credits") return unlimitedCredits || credits > 0;
    if (mode === "hybrid") {
      if (expired) return false;
      return unlimitedCredits || credits > 0;
    }
    if (expired) return false;
    return true;
  },

  resolveDeviceBinding(lic, machineId, plan) {
    const deviceIds = this.getDeviceIds(lic);
    const unlimitedDevices = this.resolveUnlimitedDevices(lic, plan);
    const maxDevices = this.resolveMaxDevices(lic, plan);

    if (deviceIds.includes(machineId)) {
      return { ok: true, deviceIds, maxDevices, unlimitedDevices, registered: false };
    }

    if (unlimitedDevices) {
      return {
        ok: true,
        deviceIds: [...deviceIds, machineId],
        maxDevices: 0,
        unlimitedDevices: true,
        registered: true,
      };
    }

    if (deviceIds.length >= maxDevices) {
      const tier =
        maxDevices <= 1
          ? "Standard (1 device)"
          : maxDevices <= 3
            ? `Family (${maxDevices} devices)`
            : `Friends (${maxDevices} devices)`;
      return {
        ok: false,
        reason: `Device limit reached (${deviceIds.length}/${maxDevices}). This license is ${tier}. Upgrade for more devices.`,
        deviceIds,
        maxDevices,
      };
    }
    return {
      ok: true,
      deviceIds: [...deviceIds, machineId],
      maxDevices,
      unlimitedDevices: false,
      registered: true,
    };
  },

  buildLicensePayload(lic, plan, extras = {}) {
    const deviceIds = extras.deviceIds || this.getDeviceIds(lic);
    const unlimitedDevices =
      extras.unlimitedDevices ??
      this.resolveUnlimitedDevices(lic, plan);
    const maxDevices = unlimitedDevices
      ? 0
      : extras.maxDevices ?? this.resolveMaxDevices(lic, plan);
    const mode = this.resolveBillingMode(lic, plan);
    const unlimitedTime =
      extras.unlimitedTime ?? this.resolveUnlimitedTime(lic, plan);
    const unlimitedCredits =
      extras.unlimitedCredits ?? this.resolveUnlimitedCredits(lic, plan);
    return {
      key: extras.key,
      planType: lic.planType || lic.plan_type || lic.planId || "premium",
      planId: lic.planId || lic.plan_id || lic.planType,
      planName:
        extras.planName ||
        plan?.name ||
        lic.plan_name ||
        lic.planName ||
        lic.planId ||
        lic.plan_type ||
        "Premium",
      planKind:
        lic.plan_kind ||
        lic.planKind ||
        plan?.plan_kind ||
        plan?.planKind ||
        "subscription",
      planDays: extras.planDays,
      billingMode: mode,
      maxDevices,
      unlimitedDevices,
      unlimitedTime,
      unlimitedCredits,
      deviceCount: deviceIds.length,
      deviceIds,
      creditsBalance:
        extras.creditsBalance ?? this.resolveCreditsBalance(lic),
      creditsUsed: Number(lic.credits_used ?? lic.creditsUsed ?? 0) || 0,
      expiresAt: unlimitedTime
        ? null
        : extras.expiresAt || lic.expiresAt || lic.expires_at || null,
      activatedAt:
        extras.activatedAt || lic.activatedAt || lic.activated_at || null,
      customerName: lic.customer_name || lic.customerName || "",
      customerPhone: lic.customer_phone || lic.customerPhone || "",
    };
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
    const planId = lic.planId || lic.plan_id || lic.planType || lic.plan_type;
    const plan = planId ? await this.getPlanById(planId) : null;
    if (this.resolveUnlimitedTime(lic, plan)) return 0;
    if (lic.planDays != null) return Number(lic.planDays) || 0;
    if (lic.plan_days != null) return Number(lic.plan_days) || 0;
    if (plan) return plan.days;
    return 365;
  },

  /** Expiry from activation time + plan days; days 0 = unlimited (no expiry) */
  computeExpiresAt(activatedAtIso, planDays) {
    const days = Number(planDays);
    if (!days || days <= 0) return null;
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

    const plan = await this.getPlanById(
      lic.planId || lic.plan_id || lic.planType || lic.plan_type,
    );
    const planDays = await this.resolvePlanDays(lic);
    const billingMode = this.resolveBillingMode(lic, plan);
    const maxDevices = this.resolveMaxDevices(lic, plan);
    const unlimitedTime = this.resolveUnlimitedTime(lic, plan);
    const unlimitedCredits = this.resolveUnlimitedCredits(lic, plan);

    let resolvedExpiresAt = lic.expiresAt || lic.expires_at || null;
    let resolvedActivatedAt = lic.activatedAt || lic.activated_at || null;
    let deviceIds = this.getDeviceIds(lic);
    let creditsBalance = this.resolveCreditsBalance(lic);

    const binding = this.resolveDeviceBinding(lic, machineId, plan);
    if (!binding.ok) {
      return { valid: false, reason: binding.reason };
    }
    deviceIds = binding.deviceIds;

    const isFirstActivation = !resolvedActivatedAt;
    const needsDevicePatch =
      binding.registered || isFirstActivation;

    if (isFirstActivation || needsDevicePatch) {
      const activatedAt = resolvedActivatedAt || new Date().toISOString();
      resolvedActivatedAt = activatedAt;
      const expiryOnActivation =
        lic.expiry_starts_on_activation !== false &&
        lic.expiryStartsOnActivation !== false;

      if (
        billingMode !== "credits" &&
        !unlimitedTime &&
        (expiryOnActivation || !resolvedExpiresAt)
      ) {
        resolvedExpiresAt = this.computeExpiresAt(activatedAt, planDays);
      }

      if (
        creditsBalance <= 0 &&
        this.isCreditsBilling(billingMode)
      ) {
        const preset =
          Number(
            lic.credits_balance ??
              lic.creditsBalance ??
              lic.included_credits ??
              lic.includedCredits ??
              lic.initial_credits ??
              lic.initialCredits ??
              plan?.included_credits ??
              0,
          ) || 0;
        if (preset > 0) creditsBalance = preset;
      }

      const patch = {
        device_ids: deviceIds,
        machineId: deviceIds[0] || machineId,
        activatedAt: resolvedActivatedAt,
        lastVerifiedAt: activatedAt,
        max_devices: maxDevices,
        billing_mode: billingMode,
        unlimited_time: unlimitedTime,
        unlimited_devices: !!binding.unlimitedDevices,
        unlimited_credits: unlimitedCredits,
      };
      if (resolvedExpiresAt) patch.expiresAt = resolvedExpiresAt;
      else if (unlimitedTime) patch.expiresAt = "";
      if (
        this.isCreditsBilling(billingMode) &&
        creditsBalance > 0 &&
        this.resolveCreditsBalance(lic) <= 0
      ) {
        patch.credits_balance = creditsBalance;
      }

      await this.patchDoc("licenses", key, patch, Object.keys(patch));
    } else {
      await this.patchDoc(
        "licenses",
        key,
        { lastVerifiedAt: new Date().toISOString() },
        ["lastVerifiedAt"],
      );
    }

    if (
      !this.licenseHasAccess(
        { ...lic, credits_balance: creditsBalance },
        plan,
        resolvedExpiresAt,
      )
    ) {
      const mode = billingMode;
      if (mode === "credits" || (mode === "hybrid" && creditsBalance <= 0)) {
        return {
          valid: false,
          reason: "Credits exhausted — buy more credits to continue",
          needsTopUp: true,
          creditsBalance,
        };
      }
      return { valid: false, reason: "License expired" };
    }

    return {
      valid: true,
      license: this.buildLicensePayload(lic, plan, {
        key,
        planDays,
        planName: plan?.name,
        deviceIds,
        maxDevices,
        unlimitedTime,
        unlimitedCredits,
        unlimitedDevices: binding.unlimitedDevices,
        creditsBalance,
        expiresAt: resolvedExpiresAt,
        activatedAt: resolvedActivatedAt,
      }),
    };
  },

  async refreshLicenseFromFirebase(licenseKey, machineId) {
    const key = this.normalizeKey(licenseKey);
    const lic = await this.fetchDoc("licenses", key);
    if (!lic || lic.active === false) {
      return { valid: false, reason: "License not found or deactivated" };
    }
    const plan = await this.getPlanById(
      lic.planId || lic.plan_id || lic.planType || lic.plan_type,
    );
    const deviceIds = this.getDeviceIds(lic);
    const unlimitedDevices = this.resolveUnlimitedDevices(lic, plan);
    if (
      machineId &&
      deviceIds.length &&
      !deviceIds.includes(machineId) &&
      !unlimitedDevices
    ) {
      return { valid: false, reason: "This device is not registered on this license" };
    }
    const resolvedExpiresAt = lic.expiresAt || lic.expires_at || null;
    if (!this.licenseHasAccess(lic, plan, resolvedExpiresAt)) {
      return {
        valid: false,
        reason: "License expired or credits exhausted",
        needsTopUp: this.isCreditsBilling(this.resolveBillingMode(lic, plan)),
      };
    }
    return {
      valid: true,
      license: this.buildLicensePayload(lic, plan, {
        key,
        planDays: await this.resolvePlanDays(lic),
        planName: plan?.name,
        deviceIds,
        maxDevices: this.resolveMaxDevices(lic, plan),
        unlimitedTime: this.resolveUnlimitedTime(lic, plan),
        unlimitedCredits: this.resolveUnlimitedCredits(lic, plan),
        unlimitedDevices,
        creditsBalance: this.resolveCreditsBalance(lic),
        expiresAt: resolvedExpiresAt,
        activatedAt: lic.activatedAt || lic.activated_at,
      }),
    };
  },

  async deductCredits(licenseKey, amount) {
    if (!this.isEnabled()) {
      return { ok: false, reason: "Firebase unavailable" };
    }
    const key = this.normalizeKey(licenseKey);
    const lic = await this.fetchDoc("licenses", key);
    if (!lic) return { ok: false, reason: "License not found" };

    const plan = await this.getPlanById(
      lic.planId || lic.plan_id || lic.planType || lic.plan_type,
    );
    if (this.resolveUnlimitedCredits(lic, plan)) {
      return { ok: true, skipped: true, unlimited: true };
    }
    const cfg = await this.getCreditsConfig();
    const cost = Math.max(1, Number(amount) || cfg.cost_per_operation || 1);
    const balance = this.resolveCreditsBalance(lic);
    if (balance < cost) {
      return {
        ok: false,
        reason: "Insufficient credits",
        balance,
        needsTopUp: true,
      };
    }

    const newBalance = balance - cost;
    const used =
      (Number(lic.credits_used ?? lic.creditsUsed ?? 0) || 0) + cost;
    const ok = await this.patchDoc(
      "licenses",
      key,
      { credits_balance: newBalance, credits_used: used },
      ["credits_balance", "credits_used"],
    );
    if (!ok) return { ok: false, reason: "Could not update credits" };

    return { ok: true, balance: newBalance, used, deducted: cost };
  },

  async unbindDevice(licenseKey, machineId) {
    const key = this.normalizeKey(licenseKey);
    if (!key || !machineId) return { ok: false, reason: "Missing key or device" };
    const lic = await this.fetchDoc("licenses", key);
    if (!lic) return { ok: true, skipped: true };
    const deviceIds = this.getDeviceIds(lic).filter((id) => id !== machineId);
    const ok = await this.patchDoc(
      "licenses",
      key,
      {
        device_ids: deviceIds,
        machineId: deviceIds[0] || "",
      },
      ["device_ids", "machineId"],
    );
    return { ok };
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
          const durationLabel = this.formatPlanDurationLabel(p);
          const devicesLabel = this.formatPlanDevicesLabel(p);
          const save = p.save
            ? `<div class="plan-note">${p.save}</div>`
            : `<div class="plan-note" style="color:var(--mso-muted);">${durationLabel} · ${devicesLabel}</div>`;
          const nameStyle = p.best ? ' style="margin-top:4px;"' : "";
          const priceStyle = p.best
            ? ' style="color:var(--mso-success);"'
            : "";
          return `<button type="button" class="plan-btn plan-buy-btn${bestClass}" data-plan="${p.id}" data-price="${p.price}" data-days="${p.days}" data-duration="${p.duration || durationLabel}" data-plan-kind="${p.plan_kind || ""}">
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
        const durationLabel = this.formatPlanDurationLabel(p);
        const devicesLabel = this.formatPlanDevicesLabel(p);
        const save = p.save
          ? `<div style="font-size:9px;color:#10b981;">${p.save}</div>`
          : `<div style="font-size:9px;color:#6b7280;">${durationLabel} · ${devicesLabel}</div>`;
        return `<button type="button" class="plan-buy-btn" data-plan="${p.id}" data-price="${p.price}" data-days="${p.days}" data-duration="${p.duration || durationLabel}" data-plan-kind="${p.plan_kind || ""}" style="${best}border-radius:8px;padding:10px;text-align:center;cursor:pointer;color:#1f2937;">
          ${tag}
          <div style="font-size:11px;color:#6b7280;${p.best ? "margin-top:4px;" : ""}">${p.name}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          ${save}
        </button>`;
      })
      .join("");
  },

  renderCreditPacks(container, packs, variant = "popup") {
    if (!container) return;
    const list = packs?.length ? packs : this.defaultCreditsConfig().packs;
    container.style.display = "grid";
    container.style.gridTemplateColumns = this.planGridColumns(list.length);
    container.style.gap = container.style.gap || "8px";

    if (!list.length) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#9ca3af;font-size:11px;">No credit packs available.</div>';
      return;
    }

    if (variant === "popup") {
      container.innerHTML = list
        .map(
          (p) =>
            `<button type="button" class="plan-btn credit-pack-btn" data-pack="${p.id}" data-credits="${p.credits}" data-price="${p.price}" data-label="${p.label}">
            <div class="plan-name">${p.label || p.credits + " Credits"}</div>
            <div class="plan-price">₹${p.price}</div>
            <div class="plan-note" style="color:var(--mso-muted);">${p.credits} credits</div>
          </button>`,
        )
        .join("");
      return;
    }

    container.innerHTML = list
      .map(
        (p) =>
          `<button type="button" class="credit-pack-btn" data-pack="${p.id}" data-credits="${p.credits}" data-price="${p.price}" data-label="${p.label}" style="border:1px solid #f0e0c8;background:#fff;border-radius:8px;padding:10px;text-align:center;cursor:pointer;color:#1f2937;">
          <div style="font-size:11px;color:#6b7280;">${p.label || p.credits + " Credits"}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          <div style="font-size:9px;color:#6b7280;">${p.credits} credits</div>
        </button>`,
      )
      .join("");
  },

  async hydrateLicenseUi(root) {
    if (!root || !this.isEnabled()) return { plans: this.defaultPlans() };
    const plansGrid =
      root.querySelector("#license-plans-grid") ||
      root.querySelector(".license-plans-grid");
    const creditsGrid =
      root.querySelector("#license-credits-grid") ||
      root.querySelector(".license-credits-grid");
    const creditsSection =
      root.querySelector("#license-credits-section") ||
      root.querySelector(".license-credits-section");
    const hint = root.querySelector("#license-demo-hint");

    const [plans, creditPacks, creditsCfg, demoKeys, wa] = await Promise.all([
      this.getPricingPlans(true),
      this.getCreditPacks(true),
      this.getCreditsConfig(true),
      this.getDemoKeysMap(),
      this.getWhatsAppSettings(),
    ]);

    if (plansGrid) this.renderPlanButtons(plansGrid, plans);
    if (creditsSection) {
      creditsSection.style.display = creditsCfg.enabled ? "block" : "none";
    }
    if (creditsGrid && creditsCfg.enabled) {
      this.renderCreditPacks(creditsGrid, creditPacks, "modal");
    }
    if (hint) {
      const sample = Object.keys(demoKeys)[0] || "MEESHO-DEMOFREE";
      hint.innerHTML = `1 device per license by default · Family/Friends plans allow more · Demo: <strong>${sample}</strong>`;
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

    return { plans, creditPacks, creditsConfig: creditsCfg, demoKeys, whatsapp: wa, announcement };
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FirebaseLicense = FirebaseLicense;
}
