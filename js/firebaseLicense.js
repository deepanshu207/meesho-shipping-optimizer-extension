// ============================================
// SHIPPING OPTIMIZER — Firebase license service
// Dedicated project: extension-e6e32.
// Reads/writes ONLY shipping_optimizer_* collections
// (shipping_optimizer_config, _demo_keys, _licenses).
// REST base URL is derived from CONFIG.FIREBASE.projectId.
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
      allow_credit_addons: !!(
        p?.allow_credit_addons ?? p?.allowCreditAddons
      ),
      max_addon_selections:
        Number(p?.max_addon_selections ?? p?.maxAddonSelections ?? 0) || 0,
      credit_addons: this.parseCreditAddons(
        p?.credit_addons ?? p?.creditAddons,
      ),
      features: this.parsePlanFeatures(p?.features ?? p?.plan_features),
      detail_sections: this.parsePlanDetailSections(
        p?.detail_sections ?? p?.detailSections,
      ),
      highlights: this.parsePlanHighlights(p?.highlights),
      card_hint: p?.card_hint || p?.cardHint || "",
      card_subtitle: p?.card_subtitle || p?.cardSubtitle || "",
      cta_text: p?.cta_text || p?.ctaText || "Buy via WhatsApp",
      detail_subtitle: p?.detail_subtitle || p?.detailSubtitle || "",
      detail_footer: p?.detail_footer || p?.detailFooter || "",
      show_whatsapp_icon:
        p?.show_whatsapp_icon !== false && p?.showWhatsappIcon !== false,
      show_details_icon:
        p?.show_details_icon !== false && p?.showDetailsIcon !== false,
      card_icon: p?.card_icon || p?.cardIcon || "",
    };
  },

  normalizePlanFeature(item, index) {
    if (typeof item === "string") {
      return { icon: "✓", title: item, text: "" };
    }
    if (!item || typeof item !== "object") return null;
    const title = item.title || item.label || item.name || item.text || "";
    if (!title) return null;
    return {
      icon: item.icon || item.emoji || "✓",
      title,
      text: item.text || item.description || item.detail || "",
    };
  },

  parsePlanFeatures(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((f, i) => this.normalizePlanFeature(f, i))
      .filter(Boolean);
  },

  parsePlanDetailSections(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s, i) => {
        if (!s || typeof s !== "object") return null;
        const title = s.title || s.heading || s.label || "";
        const body = s.body || s.text || s.content || "";
        const items = Array.isArray(s.items)
          ? s.items.map((x) => String(x)).filter(Boolean)
          : [];
        if (!title && !body && !items.length) return null;
        return {
          title: title || `Details ${i + 1}`,
          body,
          items,
        };
      })
      .filter(Boolean);
  },

  parsePlanHighlights(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((h) => String(h)).filter(Boolean);
  },

  normalizeSupportUser(u, idFallback, index) {
    if (!u || typeof u !== "object") return null;
    const id = this.slugifyPlanId(u.id || idFallback || `user_${index}`);
    const number =
      u.whatsapp_number ||
      u.whatsappNumber ||
      u.phone ||
      u.mobile ||
      "";
    if (!number && !u.name) return null;
    return {
      id: id || `user_${index}`,
      name: u.name || u.title || "Support",
      role: u.role || u.department || "",
      label: u.label || u.topic || u.description || "",
      whatsapp_number: this.normalizeWhatsAppNumber(number),
      whatsapp_message: u.whatsapp_message || u.whatsappMessage || "",
      active: u.active !== false,
      order: u.order != null ? Number(u.order) : index,
    };
  },

  normalizeWhatsAppNumber(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  },

  parseSupportConfig(app) {
    const raw =
      app?.support ||
      app?.support_users ||
      app?.supportUsers ||
      {};
    const usersRaw =
      raw.users ||
      raw.contacts ||
      raw.list ||
      (Array.isArray(raw) ? raw : null);
    let users = [];
    if (Array.isArray(usersRaw)) {
      users = usersRaw
        .map((u, i) => this.normalizeSupportUser(u, u?.id || `user_${i}`, i))
        .filter(Boolean);
    } else if (usersRaw && typeof usersRaw === "object") {
      users = Object.entries(usersRaw)
        .map(([id, u]) => this.normalizeSupportUser({ ...u, id }, id, 0))
        .filter(Boolean);
    }
    users = this.sortPlans(users);
    return {
      enabled: raw.enabled !== false,
      title: raw.title || "Support team",
      page_size: Math.max(1, Number(raw.page_size ?? raw.pageSize ?? 5) || 5),
      users,
    };
  },

  async getSupportConfig(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    return this.parseSupportConfig(app || {});
  },

  getSupportUsersPage(config, page) {
    const users = (config?.users || []).filter((u) => u.active !== false);
    const pageSize = Math.max(1, Number(config?.page_size) || 5);
    const totalPages = Math.max(1, Math.ceil(users.length / pageSize) || 1);
    const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (p - 1) * pageSize;
    return {
      users: users.slice(start, start + pageSize),
      page: p,
      totalPages,
      total: users.length,
      pageSize,
      hasPrev: p > 1,
      hasNext: p < totalPages,
    };
  },

  buildDefaultPlanFeatures(plan) {
    const out = [];
    const duration = this.formatPlanDurationLabel(plan);
    const devices = this.formatPlanDevicesLabel(plan);
    if (plan.unlimited_time || plan.days === 0) {
      out.push({ icon: "♾️", title: "Never expires", text: "Lifetime access" });
    } else if (duration) {
      out.push({ icon: "📅", title: duration, text: "" });
    }
    if (devices) out.push({ icon: "📱", title: devices, text: "" });
    if (plan.included_credits > 0) {
      out.push({
        icon: "⚡",
        title: `${plan.included_credits} credits included`,
        text: "",
      });
    }
    if (plan.unlimited_credits) {
      out.push({ icon: "∞", title: "Unlimited credits", text: "" });
    }
    const mode = plan.billing_mode || "subscription";
    if (mode === "hybrid") {
      out.push({
        icon: "💳",
        title: "Plan + credits",
        text: "Time-based access with credit balance",
      });
    } else if (mode === "credits") {
      out.push({
        icon: "💳",
        title: "Credits only",
        text: "Pay as you go",
      });
    }
    return out;
  },

  renderPlanDetailHtml(plan, options = {}) {
    if (!plan) {
      return '<p style="font-size:12px;color:#6b7280;">Plan not found.</p>';
    }
    const duration = this.formatPlanDurationLabel(plan);
    const devices = this.formatPlanDevicesLabel(plan);
    const features = (plan.features || []).length > 0 ? plan.features : [];
    const highlights = (plan.highlights || []).filter(
      (h) => h !== duration && h !== devices,
    );
    const sections = plan.detail_sections || [];
    const addons = this.getPlanCreditAddons(plan);
    const bestTag = plan.best
      ? '<span class="plan-detail-badge">BEST VALUE</span>'
      : "";
    const save = plan.save
      ? `<div class="plan-detail-save">${this.escapeHtml(plan.save)}</div>`
      : "";
    const cta = plan.cta_text || "Buy via WhatsApp";

    let html = `<div class="plan-detail-card">
      <div class="plan-detail-header">
      ${bestTag}
      <h2 class="plan-detail-name">${this.escapeHtml(plan.name)}</h2>
      ${plan.detail_subtitle ? `<p class="plan-detail-subtitle">${this.escapeHtml(plan.detail_subtitle)}</p>` : ""}
      <div class="plan-detail-price">₹${plan.price}</div>
      ${save}
      <p class="plan-detail-meta">${this.escapeHtml(duration)} · ${this.escapeHtml(devices)}</p>
    </div>`;

    if (plan.description) {
      html += `<p class="plan-detail-desc">${this.escapeHtml(plan.description)}</p>`;
    }

    if (highlights.length) {
      html += `<div class="plan-detail-highlights">${highlights
        .map(
          (h) =>
            `<span class="plan-detail-pill">${this.escapeHtml(h)}</span>`,
        )
        .join("")}</div>`;
    }

    if (features.length) {
      html += `<div class="plan-detail-features">${features
        .map(
          (f) => `<div class="plan-detail-feature">
          <span class="plan-detail-feature-icon">${this.escapeHtml(f.icon || "✓")}</span>
          <div>
            <div class="plan-detail-feature-title">${this.escapeHtml(f.title)}</div>
            ${f.text ? `<div class="plan-detail-feature-text">${this.escapeHtml(f.text)}</div>` : ""}
          </div>
        </div>`,
        )
        .join("")}</div>`;
    }

    sections.forEach((sec) => {
      html += `<div class="plan-detail-section">
        <div class="plan-detail-section-title">${this.escapeHtml(sec.title)}</div>`;
      if (sec.body) {
        html += `<p class="plan-detail-section-body">${this.escapeHtml(sec.body)}</p>`;
      }
      if (sec.items?.length) {
        html += `<ul class="plan-detail-list">${sec.items
          .map((item) => `<li>${this.escapeHtml(item)}</li>`)
          .join("")}</ul>`;
      }
      html += `</div>`;
    });

    if (addons.length) {
      const max = Number(plan.max_addon_selections) || 0;
      const hint =
        max === 1
          ? "Pick one add-on"
          : max > 1
            ? `Pick up to ${max}`
            : "Optional credit add-ons";
      html += `<div class="plan-detail-addons" data-plan="${this.escapeAttr(plan.id)}">
        <div class="plan-detail-section-title">⚡ ${hint}</div>
        <div class="plan-addons-chips" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px;">
          ${addons
            .map((a) => {
              const sel = !!a.default_selected;
              return `<button type="button" class="plan-addon-btn" data-plan="${this.escapeAttr(plan.id)}" data-addon-id="${this.escapeAttr(a.id)}" data-addon-credits="${a.credits}" data-addon-price="${a.price}" data-addon-label="${this.escapeAttr(a.label)}" data-addon-max="${max}" aria-pressed="${sel ? "true" : "false"}" style="font-size:10px;padding:6px 10px;border-radius:8px;cursor:pointer;background:${sel ? "linear-gradient(135deg,#ffd700,#e67e22)" : "#fff"};color:${sel ? "#3d2914" : "#c45f12"};border:1px solid ${sel ? "#e67e22" : "#f0e0c8"};font-weight:${sel ? "700" : "600"};">+${a.credits} credits · ₹${a.price}</button>`;
            })
            .join("")}
        </div>
      </div>`;
    }

    html += this.planDetailWhatsAppBtnHtml(
      cta,
      `data-plan="${this.escapeAttr(plan.id)}"`,
    );
    if (plan.detail_footer) {
      html += `<p class="plan-detail-footer">${this.escapeHtml(plan.detail_footer)}</p>`;
    }
    html += `</div>`;

    return html;
  },

  renderCreditPackDetailHtml(pack, options = {}) {
    if (!pack) {
      return '<p style="font-size:12px;color:#6b7280;">Credit pack not found.</p>';
    }
    const label = pack.label || `${pack.credits} Credits`;
    const features = pack.features || [];
    const highlights = pack.highlights || [];
    const sections = pack.detail_sections || [];
    const cta = pack.cta_text || "Buy via WhatsApp";
    const perCredit =
      pack.credits > 0
        ? (Number(pack.price) / Number(pack.credits)).toFixed(1)
        : "0";

    let html = `<div class="plan-detail-card">
      <div class="plan-detail-header">
        <span class="plan-detail-badge" style="background:linear-gradient(135deg,#ffd700,#e67e22);">CREDIT PACK</span>
        <h2 class="plan-detail-name">${this.escapeHtml(label)}</h2>
        ${pack.detail_subtitle ? `<p class="plan-detail-subtitle">${this.escapeHtml(pack.detail_subtitle)}</p>` : ""}
        <div class="plan-detail-price">₹${pack.price}</div>
        <p class="plan-detail-meta">${pack.credits} credits · ~₹${perCredit}/credit</p>
      </div>`;

    if (pack.description) {
      html += `<p class="plan-detail-desc">${this.escapeHtml(pack.description)}</p>`;
    }

    if (highlights.length) {
      html += `<div class="plan-detail-highlights">${highlights
        .map(
          (h) =>
            `<span class="plan-detail-pill">${this.escapeHtml(h)}</span>`,
        )
        .join("")}</div>`;
    }

    if (features.length) {
      html += `<div class="plan-detail-features">${features
        .map(
          (f) => `<div class="plan-detail-feature">
          <span class="plan-detail-feature-icon">${this.escapeHtml(f.icon || "✓")}</span>
          <div>
            <div class="plan-detail-feature-title">${this.escapeHtml(f.title)}</div>
            ${f.text ? `<div class="plan-detail-feature-text">${this.escapeHtml(f.text)}</div>` : ""}
          </div>
        </div>`,
        )
        .join("")}</div>`;
    }

    sections.forEach((sec) => {
      html += `<div class="plan-detail-section">
        <div class="plan-detail-section-title">${this.escapeHtml(sec.title)}</div>`;
      if (sec.body) {
        html += `<p class="plan-detail-section-body">${this.escapeHtml(sec.body)}</p>`;
      }
      if (sec.items?.length) {
        html += `<ul class="plan-detail-list">${sec.items
          .map((item) => `<li>${this.escapeHtml(item)}</li>`)
          .join("")}</ul>`;
      }
      html += `</div>`;
    });

    html += this.planDetailWhatsAppBtnHtml(
      cta,
      `data-pack="${this.escapeAttr(pack.id)}"`,
      "credit-pack-detail-buy-btn",
    );
    if (pack.detail_footer) {
      html += `<p class="plan-detail-footer">${this.escapeHtml(pack.detail_footer)}</p>`;
    }
    html += `</div>`;
    return html;
  },

  async getCreditPackById(packId) {
    const packs = await this.getCreditPacks(true);
    const id = this.slugifyPlanId(packId);
    return packs.find((p) => p.id === id || p.id === packId) || null;
  },

  buildCreditPackPurchaseMessage(packOrId, productName) {
    const pack =
      typeof packOrId === "object" && packOrId
        ? packOrId
        : { id: packOrId, label: String(packOrId || "Credits") };
    const label = pack.label || `${pack.credits || ""} Credits`;
    return `Hi! I want to buy credits for ${productName || "Shipping Optimizer"}.

⚡ *Credit Pack:* ${label}
💰 *Price:* ₹${pack.price ?? "—"}
🎫 *Credits:* ${pack.credits ?? "—"}

Please share payment details.`;
  },

  renderSupportUsersHtml(pageData, options = {}) {
    const { users, page, totalPages, total, hasPrev, hasNext } =
      pageData || {};
    const title = options.title || "Support team";
    if (!users?.length) {
      return `<p style="font-size:12px;color:#6b7280;text-align:center;padding:16px 0;">No support contacts configured.</p>`;
    }
    const rows = users
      .map((u) => {
        const role = u.role
          ? `<div class="support-user-role">${this.escapeHtml(u.role)}</div>`
          : "";
        const label = u.label
          ? `<div class="support-user-label">${this.escapeHtml(u.label)}</div>`
          : "";
        return `<button type="button" class="support-user-row" data-support-id="${this.escapeAttr(u.id)}" data-support-number="${this.escapeAttr(u.whatsapp_number)}" data-support-message="${this.escapeAttr(u.whatsapp_message || options.defaultMessage || "")}">
          <div class="support-user-avatar">💬</div>
          <div class="support-user-info">
            <div class="support-user-name">${this.escapeHtml(u.name)}</div>
            ${role}
            ${label}
          </div>
          <span class="support-user-chevron">›</span>
        </button>`;
      })
      .join("");

    const pager =
      totalPages > 1
        ? `<div class="support-pager">
          <button type="button" class="support-page-btn" data-support-page="${page - 1}" ${hasPrev ? "" : "disabled"}>← Prev</button>
          <span class="support-page-label">Page ${page} / ${totalPages} · ${total} contacts</span>
          <button type="button" class="support-page-btn" data-support-page="${page + 1}" ${hasNext ? "" : "disabled"}>Next →</button>
        </div>`
        : `<div class="support-page-label" style="text-align:center;margin-top:8px;">${total} contact${total === 1 ? "" : "s"}</div>`;

    return `<div class="support-users-wrap">
      <p class="support-users-intro">${this.escapeHtml(title)} — tap to chat on WhatsApp</p>
      <div class="support-users-list">${rows}</div>
      ${pager}
    </div>`;
  },

  normalizeCreditAddon(a, idFallback, index) {
    const id = this.slugifyPlanId(a?.id || idFallback || `addon_${index}`);
    const credits = Number(a?.credits ?? a?.credit ?? 0) || 0;
    return {
      id: id || `addon_${index}`,
      credits,
      price: Number(a?.price) || 0,
      label: a?.label || a?.name || `+${credits} credits`,
      active: a?.active !== false,
      default_selected: this.isUnlimitedFlag(
        a?.default_selected ?? a?.defaultSelected,
      ),
      order: a?.order != null ? Number(a.order) : index,
    };
  },

  parseCreditAddons(raw) {
    if (!raw) return [];
    let list = [];
    if (Array.isArray(raw)) {
      list = raw
        .filter((a) => a && typeof a === "object")
        .map((a, i) => this.normalizeCreditAddon(a, a.id || `addon_${i}`, i));
    } else if (typeof raw === "object") {
      list = Object.entries(raw).map(([id, a], i) =>
        this.normalizeCreditAddon({ ...a, id: a?.id || id }, id, i),
      );
    }
    return this.sortPlans(list);
  },

  /** Active add-ons for a plan (empty when unlimited credits or not allowed). */
  getPlanCreditAddons(plan) {
    if (!plan || plan.unlimited_credits) return [];
    if (plan.allow_credit_addons === false) return [];
    const list = (plan.credit_addons || []).filter((a) => a.active !== false);
    if (!list.length) return [];
    return this.sortPlans(list);
  },

  /** Credits + price for a plan given selected add-on ids. */
  calculatePlanCredits(plan, selectedAddonIds) {
    const included = Number(plan?.included_credits || 0) || 0;
    const addons = this.getPlanCreditAddons(plan);
    const selected = new Set((selectedAddonIds || []).map((x) => String(x)));
    let addon = 0;
    let addonPrice = 0;
    addons.forEach((a) => {
      if (selected.has(String(a.id))) {
        addon += Number(a.credits) || 0;
        addonPrice += Number(a.price) || 0;
      }
    });
    return { included, addon, total: included + addon, addonPrice };
  },

  getLicenseAddonIds(lic) {
    const ids = lic?.addon_credit_ids || lic?.addonCreditIds;
    if (Array.isArray(ids)) return ids.filter(Boolean).map((x) => String(x));
    return [];
  },

  /** Resolve credits to grant a license: existing balance, else included + addon. */
  resolveLicenseCredits(lic, plan) {
    const existingBalance = this.resolveCreditsBalance(lic);
    const addonIds = this.getLicenseAddonIds(lic);
    const hasLicIncluded =
      lic?.included_credits != null || lic?.includedCredits != null;
    const hasLicAddon =
      lic?.addon_credits != null || lic?.addonCredits != null;
    const included = hasLicIncluded
      ? Number(lic.included_credits ?? lic.includedCredits) || 0
      : Number(plan?.included_credits || 0) || 0;
    const addon = hasLicAddon
      ? Number(lic.addon_credits ?? lic.addonCredits) || 0
      : this.calculatePlanCredits(plan, addonIds).addon;
    const total = existingBalance > 0 ? existingBalance : included + addon;
    return { included, addon, total, addonIds, existingBalance };
  },

  escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  escapeHtml(value) {
    return this.escapeAttr(value);
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
      description: p?.description || p?.note || "",
      detail_subtitle: p?.detail_subtitle || p?.detailSubtitle || "",
      detail_footer: p?.detail_footer || p?.detailFooter || "",
      cta_text: p?.cta_text || p?.ctaText || "Buy via WhatsApp",
      highlights: this.parsePlanHighlights(p?.highlights),
      features: this.parsePlanFeatures(p?.features),
      detail_sections: this.parsePlanDetailSections(
        p?.detail_sections ?? p?.detailSections,
      ),
      show_whatsapp_icon:
        p?.show_whatsapp_icon !== false && p?.showWhatsappIcon !== false,
      show_details_icon:
        p?.show_details_icon !== false && p?.showDetailsIcon !== false,
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
      image_generation: this.normalizeImageGenConfig(
        raw.image_generation ?? raw.imageGeneration,
      ),
    };
  },

  /** Normalize the credits.image_generation admin config. */
  normalizeImageGenConfig(raw) {
    const configured = !!raw && typeof raw === "object";
    const r = configured ? raw : {};
    return {
      configured,
      enabled: r.enabled !== false,
      credits_per_image:
        Math.max(0, Number(r.credits_per_image ?? r.creditsPerImage ?? 0) || 0),
      daily_limit:
        Math.max(0, Number(r.daily_limit ?? r.dailyLimit ?? 0) || 0),
      monthly_limit:
        Math.max(0, Number(r.monthly_limit ?? r.monthlyLimit ?? 0) || 0),
      max_batch_size:
        Math.max(0, Number(r.max_batch_size ?? r.maxBatchSize ?? 0) || 0),
    };
  },

  /** Extract normalized image_generation config from a config object. */
  getImageGenConfig(config) {
    const raw =
      config?.image_generation ??
      config?.imageGeneration ??
      config?.credits?.image_generation ??
      config?.credits?.imageGeneration;
    return this.normalizeImageGenConfig(raw);
  },

  async getImageGenerationConfig(forceFresh = false) {
    const credits = await this.getCreditsConfig(forceFresh);
    return this.getImageGenConfig(credits);
  },

  defaultSmartModeConfig() {
    const values = [20, 50, 100, 200];
    return {
      configured: false,
      variant_options: values.map((value, order) => ({
        value,
        label: String(value),
        active: true,
        order,
      })),
      default_variant: 20,
      max_variants_cap: 200,
      label: "Max Variants",
      hint: "⚡ Live Meesho shipping checks — finds the lowest ₹ from generated variants",
    };
  },

  normalizeVariantOption(raw, index) {
    if (typeof raw === "number" || typeof raw === "string") {
      const value = Math.max(1, Number(raw) || 0);
      if (!value) return null;
      return { value, label: String(value), active: true, order: index };
    }
    if (!raw || typeof raw !== "object") return null;
    const value = Math.max(
      1,
      Number(raw.value ?? raw.variants ?? raw.count ?? raw.max) || 0,
    );
    if (!value) return null;
    return {
      value,
      label: String(raw.label || raw.name || value),
      active: raw.active !== false,
      order: raw.order != null ? Number(raw.order) : index,
    };
  },

  parseVariantOptions(raw) {
    if (!Array.isArray(raw)) return null;
    return raw
      .map((item, i) => this.normalizeVariantOption(item, i))
      .filter(Boolean)
      .filter((o) => o.active)
      .sort((a, b) => a.order - b.order || a.value - b.value);
  },

  normalizeSmartModeConfig(raw) {
    const configured = !!raw && typeof raw === "object";
    const defaults = this.defaultSmartModeConfig();
    const r = configured ? raw : {};
    const parsed =
      this.parseVariantOptions(
        r.variant_options ?? r.variantOptions ?? r.options,
      ) || defaults.variant_options;
    const maxCap = Math.max(
      1,
      Number(
        r.max_variants_cap ?? r.maxVariantsCap ?? defaults.max_variants_cap,
      ) || defaults.max_variants_cap,
    );
    let options = parsed.filter((o) => o.value <= maxCap);
    if (!options.length) {
      options = defaults.variant_options.filter((o) => o.value <= maxCap);
    }
    const requestedDefault = Math.max(
      1,
      Number(r.default_variant ?? r.defaultVariant ?? defaults.default_variant) ||
        defaults.default_variant,
    );
    const defaultVariant =
      options.find((o) => o.value === requestedDefault)?.value ||
      options[0]?.value ||
      Math.min(requestedDefault, maxCap);
    return {
      configured,
      variant_options: options,
      default_variant: defaultVariant,
      max_variants_cap: maxCap,
      label: r.label || r.variant_label || defaults.label,
      hint: r.hint || r.help_text || r.helpText || defaults.hint,
    };
  },

  async getSmartModeConfig(forceFresh = false) {
    const app = await this.getAppConfig(forceFresh);
    const raw =
      app?.smart_mode ??
      app?.smartMode ??
      app?.credits?.smart_mode ??
      app?.credits?.smartMode;
    return this.normalizeSmartModeConfig(raw);
  },

  applySmartModeRuntime(config, imageGenConfig) {
    const cfg = config || this.defaultSmartModeConfig();
    let options = [...(cfg.variant_options || [])];
    const batchMax = Number(imageGenConfig?.max_batch_size) || 0;
    if (batchMax > 0) {
      options = options.filter((o) => o.value <= batchMax);
    }
    if (!options.length) {
      options = this.defaultSmartModeConfig().variant_options.filter(
        (o) => !batchMax || o.value <= batchMax,
      );
    }
    let defaultVariant = cfg.default_variant;
    if (!options.some((o) => o.value === defaultVariant)) {
      defaultVariant = options[0]?.value || defaultVariant;
    }
    const resolved = {
      ...cfg,
      variant_options: options,
      default_variant: defaultVariant,
      max_variants_cap: Math.max(
        cfg.max_variants_cap,
        ...options.map((o) => o.value),
        defaultVariant,
      ),
    };
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.setMaxResultVariants) {
      MeeshoAPI.setMaxResultVariants(resolved.max_variants_cap);
    }
    if (typeof globalThis !== "undefined") {
      globalThis.__smartModeConfig = resolved;
    }
    return resolved;
  },

  fillMaxAttemptsSelect(selectEl, config) {
    if (!selectEl || !config) return;
    const options = config.variant_options || [];
    if (!options.length) return;
    const prev = Number(selectEl.value);
    const hasPrev = options.some((o) => o.value === prev);
    const selectedValue = hasPrev ? prev : config.default_variant;
    selectEl.innerHTML = options
      .map((o) => {
        const selected = o.value === selectedValue;
        return `<option value="${o.value}"${selected ? " selected" : ""}>${this.escapeHtml(o.label)}</option>`;
      })
      .join("");
    selectEl.value = String(selectedValue);
  },

  updateSmartModeLabels(root, config) {
    const scope = root || document;
    const label = scope.querySelector('label[for="max-attempts"]');
    if (label && config?.label) label.textContent = config.label;
    const hint = scope.querySelector("#smart-mode-hint");
    if (hint && config?.hint) hint.textContent = config.hint;
  },

  planWhatsAppIconSvg(size = 14) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
  },

  planDetailsIconSvg(size = 12) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/></svg>`;
  },

  showPlanCornerDetails(item) {
    if (!item || typeof item !== "object") return true;
    if (item.show_details_icon === false || item.showDetailsIcon === false) {
      return false;
    }
    if (item.show_whatsapp_icon === false || item.showWhatsappIcon === false) {
      return false;
    }
    return true;
  },

  planCardFooterHtml(plan) {
    if (!plan.card_hint) return "";
    return `<div class="plan-card-foot">${this.escapeHtml(plan.card_hint)}</div>`;
  },

  planCardShell(mainHtml, item, kind = "plan") {
    if (!this.showPlanCornerDetails(item)) return mainHtml;
    const id = item.id;
    const dataAttr =
      kind === "pack"
        ? `data-pack="${this.escapeAttr(id)}"`
        : `data-plan="${this.escapeAttr(id)}"`;
    const cornerClass =
      kind === "pack"
        ? "credit-pack-detail-corner-btn"
        : "plan-detail-corner-btn";
    const detailBtn = `<button type="button" class="plan-detail-corner ${cornerClass}" ${dataAttr} title="View details" aria-label="View details">${this.planDetailsIconSvg(12)}</button>`;
    return `<div class="plan-card-shell">${mainHtml}${detailBtn}</div>`;
  },

  planDetailWhatsAppBtnHtml(label, dataAttr, extraClass = "") {
    const cls = `plan-detail-buy-btn${extraClass ? ` ${extraClass}` : ""}`;
    return `<button type="button" class="${cls}" ${dataAttr} style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:12px 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#25d366 0%,#128c7e 100%);color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(37,211,102,0.28);">
      ${this.planWhatsAppIconSvg(16)}<span>${this.escapeHtml(label)}</span>
    </button>`;
  },

  /** Local-date period keys for daily/monthly counters. */
  getImageGenPeriodKeys(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { todayDate: `${y}-${m}-${d}`, monthKey: `${y}-${m}` };
  },

  /** Return counters with today/month reset when the period key changed. */
  normalizeImageGenCounters(counters) {
    const { todayDate, monthKey } = this.getImageGenPeriodKeys();
    const c = counters || {};
    const total =
      Number(
        c.total ?? c.images_generated_total ?? c.imagesGeneratedTotal ?? 0,
      ) || 0;
    let today =
      Number(
        c.today ?? c.images_generated_today ?? c.imagesGeneratedToday ?? 0,
      ) || 0;
    let month =
      Number(
        c.month ?? c.images_generated_month ?? c.imagesGeneratedMonth ?? 0,
      ) || 0;
    const savedTodayDate =
      c.todayDate ??
      c.images_generated_today_date ??
      c.imagesGeneratedTodayDate ??
      "";
    const savedMonthKey =
      c.monthKey ??
      c.images_generated_month_key ??
      c.imagesGeneratedMonthKey ??
      "";
    if (savedTodayDate !== todayDate) today = 0;
    if (savedMonthKey !== monthKey) month = 0;
    return { total, today, todayDate, month, monthKey };
  },

  /** Increment generation-run counters on a license doc (count is runs, not variants). */
  async recordImageGeneration(licenseKey, count) {
    if (!this.isEnabled()) {
      return { ok: false, reason: "Firebase unavailable" };
    }
    const key = this.normalizeKey(licenseKey);
    const lic = await this.fetchDoc("licenses", key);
    if (!lic) return { ok: false, reason: "License not found" };

    const cur = this.normalizeImageGenCounters({
      total: lic.images_generated_total,
      today: lic.images_generated_today,
      todayDate: lic.images_generated_today_date,
      month: lic.images_generated_month,
      monthKey: lic.images_generated_month_key,
    });
    const n = Math.max(0, Number(count) || 0);
    const next = {
      total: cur.total + n,
      today: cur.today + n,
      todayDate: cur.todayDate,
      month: cur.month + n,
      monthKey: cur.monthKey,
    };
    const ok = await this.patchDoc(
      "licenses",
      key,
      {
        images_generated_total: next.total,
        images_generated_today: next.today,
        images_generated_today_date: next.todayDate,
        images_generated_month: next.month,
        images_generated_month_key: next.monthKey,
      },
      [
        "images_generated_total",
        "images_generated_today",
        "images_generated_today_date",
        "images_generated_month",
        "images_generated_month_key",
      ],
    );
    return { ok, counters: next };
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

  describeLicenseAccess(lic, plan, resolvedExpiresAt) {
    const mode = this.resolveBillingMode(lic, plan);
    const unlimitedTime = this.resolveUnlimitedTime(lic, plan);
    const credits = this.resolveCreditsBalance(lic);
    const expired =
      !unlimitedTime &&
      resolvedExpiresAt &&
      new Date() > new Date(resolvedExpiresAt);

    if (this.licenseHasAccess(lic, plan, resolvedExpiresAt)) {
      return {
        accessStatus: "active",
        reason: "",
        needsTopUp: false,
        needsRenewal: false,
        reactivatable: true,
      };
    }

    if (mode === "credits" || (mode === "hybrid" && credits <= 0 && !expired)) {
      return {
        accessStatus: "credits_exhausted",
        reason: "Credits exhausted — buy more credits to continue",
        needsTopUp: true,
        needsRenewal: false,
        reactivatable: true,
      };
    }

    if (expired) {
      return {
        accessStatus: "expired",
        reason: "License expired — renew to continue with the same key",
        needsTopUp: false,
        needsRenewal: true,
        reactivatable: true,
      };
    }

    return {
      accessStatus: "inactive",
      reason: "License inactive — contact support or renew",
      needsTopUp: this.isCreditsBilling(mode),
      needsRenewal: true,
      reactivatable: true,
    };
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

    if (mode === "credits") {
      return unlimitedCredits || credits > 0;
    }
    if (mode === "hybrid") {
      if (expired) return false;
      return unlimitedCredits || credits > 0;
    }
    // subscription — never expires, open-ended, or not past expiry
    if (unlimitedTime) return true;
    if (!resolvedExpiresAt) return true;
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
      includedCredits:
        extras.includedCredits ??
        (Number(lic.included_credits ?? lic.includedCredits ?? 0) || 0),
      addonCredits:
        extras.addonCredits ??
        (Number(lic.addon_credits ?? lic.addonCredits ?? 0) || 0),
      addonCreditIds: extras.addonCreditIds ?? this.getLicenseAddonIds(lic),
      creditsUsed: Number(lic.credits_used ?? lic.creditsUsed ?? 0) || 0,
      imagesGeneratedTotal:
        Number(lic.images_generated_total ?? lic.imagesGeneratedTotal ?? 0) || 0,
      imagesGeneratedToday:
        Number(lic.images_generated_today ?? lic.imagesGeneratedToday ?? 0) || 0,
      imagesGeneratedTodayDate:
        lic.images_generated_today_date || lic.imagesGeneratedTodayDate || "",
      imagesGeneratedMonth:
        Number(lic.images_generated_month ?? lic.imagesGeneratedMonth ?? 0) || 0,
      imagesGeneratedMonthKey:
        lic.images_generated_month_key || lic.imagesGeneratedMonthKey || "",
      expiresAt: unlimitedTime
        ? null
        : extras.expiresAt || lic.expiresAt || lic.expires_at || null,
      activatedAt:
        extras.activatedAt || lic.activatedAt || lic.activated_at || null,
      accessStatus: extras.accessStatus || lic.access_status || lic.accessStatus || "active",
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
    const merged = {};
    const app = await this.getAppConfig();

    const ingestInline = (raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      for (const [rawKey, row] of Object.entries(raw)) {
        const key = CONFIG.normalizeLicenseKey
          ? CONFIG.normalizeLicenseKey(rawKey)
          : String(rawKey || "").toUpperCase();
        if (!key) continue;
        merged[key] = this.normalizeDemoKeyEntry(row);
      }
    };

    for (const [rawKey, row] of Object.entries(CONFIG.BUILTIN_DEMO_KEYS || {})) {
      const key = CONFIG.normalizeLicenseKey
        ? CONFIG.normalizeLicenseKey(rawKey)
        : String(rawKey || "").toUpperCase();
      if (!key) continue;
      merged[key] = this.normalizeDemoKeyEntry(row);
    }

    ingestInline(app?.demo_keys);
    ingestInline(app?.demoKeys);

    const docs = await this.listDocs("demo_keys");
    for (const row of docs) {
      if (row.active === false) continue;
      const key = CONFIG.normalizeLicenseKey
        ? CONFIG.normalizeLicenseKey(row.id)
        : String(row.id || "").toUpperCase();
      if (!key) continue;
      merged[key] = this.normalizeDemoKeyEntry(row);
    }
    return merged;
  },

  normalizeDemoKeyEntry(row) {
    const src = row && typeof row === "object" ? row : {};
    const unlimited_time = this.isUnlimitedFlag(
      src.unlimited_time ?? src.unlimitedTime,
    );
    const daysRaw = src.days;
    const days =
      unlimited_time && (daysRaw === 0 || daysRaw === "0")
        ? 0
        : Number(daysRaw) || 30;
    return {
      days,
      label: src.label || src.name || "",
      unlimited_time,
    };
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

      // Grant credits on first activation from included + selected add-ons.
      // Priority: existing balance > lic included+addon > plan + lic addon ids.
      const creditInfo = this.resolveLicenseCredits(lic, plan);
      const grantCredits =
        this.resolveCreditsBalance(lic) <= 0 && creditInfo.total > 0;
      if (grantCredits && !unlimitedCredits) {
        creditsBalance = creditInfo.total;
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
      if (grantCredits && !unlimitedCredits) {
        // Store the credit breakdown so subscription plans can still expose
        // add-on credits for hybrid use, and display can show base + addon.
        patch.included_credits = creditInfo.included;
        patch.addon_credits = creditInfo.addon;
        patch.addon_credit_ids = creditInfo.addonIds;
        patch.credits_balance = creditInfo.total;
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
      const access = this.describeLicenseAccess(
        { ...lic, credits_balance: creditsBalance },
        plan,
        resolvedExpiresAt,
      );
      const finalCreditInfo = this.resolveLicenseCredits(
        { ...lic, credits_balance: creditsBalance },
        plan,
      );
      return {
        valid: false,
        reactivatable: true,
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
          includedCredits: finalCreditInfo.included,
          addonCredits: finalCreditInfo.addon,
          addonCreditIds: finalCreditInfo.addonIds,
          expiresAt: resolvedExpiresAt,
          activatedAt: resolvedActivatedAt,
          accessStatus: access.accessStatus,
        }),
        reason: access.reason,
        needsTopUp: access.needsTopUp,
        needsRenewal: access.needsRenewal,
        accessStatus: access.accessStatus,
        creditsBalance,
      };
    }

    const finalCreditInfo = this.resolveLicenseCredits(
      { ...lic, credits_balance: creditsBalance },
      plan,
    );

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
        includedCredits: finalCreditInfo.included,
        addonCredits: finalCreditInfo.addon,
        addonCreditIds: finalCreditInfo.addonIds,
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
    const payloadExtras = {
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
    };
    const creditInfo = this.resolveLicenseCredits(lic, plan);
    payloadExtras.includedCredits = creditInfo.included;
    payloadExtras.addonCredits = creditInfo.addon;
    payloadExtras.addonCreditIds = creditInfo.addonIds;

    if (!this.licenseHasAccess(lic, plan, resolvedExpiresAt)) {
      const access = this.describeLicenseAccess(lic, plan, resolvedExpiresAt);
      return {
        valid: false,
        reactivatable: true,
        license: this.buildLicensePayload(lic, plan, {
          ...payloadExtras,
          accessStatus: access.accessStatus,
        }),
        reason: access.reason,
        needsTopUp: access.needsTopUp,
        needsRenewal: access.needsRenewal,
        accessStatus: access.accessStatus,
      };
    }
    return {
      valid: true,
      license: this.buildLicensePayload(lic, plan, {
        ...payloadExtras,
        accessStatus: "active",
      }),
      accessStatus: "active",
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
          const subtitle = p.card_subtitle
            ? `<div class="plan-note" style="color:var(--mso-muted);">${this.escapeHtml(p.card_subtitle)}</div>`
            : "";
          const save = p.save
            ? `<div class="plan-note">${p.save}</div>`
            : subtitle ||
              `<div class="plan-note" style="color:var(--mso-muted);">${durationLabel} · ${devicesLabel}</div>`;
          const nameStyle = p.best ? ' style="margin-top:4px;"' : "";
          const priceStyle = p.best
            ? ' style="color:var(--mso-success);"'
            : "";
          const btn = `<button type="button" class="plan-btn plan-buy-btn plan-card-main${bestClass}" ${this.planDataAttrs(p, durationLabel)}>
            ${tag}
            <div class="plan-name"${nameStyle}>${p.name}</div>
            <div class="plan-price"${priceStyle}>₹${p.price}</div>
            ${save}
            ${this.planCardFooterHtml(p)}
          </button>`;
          return this.planCellWrap(this.planCardShell(btn, p, "plan"), p);
        })
        .join("");
      this.wirePlanAddonSelection(container);
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
        const subtitle = p.card_subtitle
          ? `<div style="font-size:9px;color:#6b7280;">${this.escapeHtml(p.card_subtitle)}</div>`
          : "";
        const save = p.save
          ? `<div style="font-size:9px;color:#10b981;">${p.save}</div>`
          : subtitle ||
            `<div style="font-size:9px;color:#6b7280;">${durationLabel} · ${devicesLabel}</div>`;
        const btn = `<button type="button" class="plan-buy-btn plan-card-main" ${this.planDataAttrs(p, durationLabel)} style="${best}border-radius:8px;padding:10px 28px 10px 10px;text-align:center;cursor:pointer;color:#1f2937;width:100%;">
          ${tag}
          <div style="font-size:11px;color:#6b7280;${p.best ? "margin-top:4px;" : ""}">${p.name}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          ${save}
          ${this.planCardFooterHtml(p)}
        </button>`;
        return this.planCellWrap(this.planCardShell(btn, p, "plan"), p);
      })
      .join("");

    this.wirePlanAddonSelection(container);
  },

  /** Shared data attributes on a plan buy button. */
  planDataAttrs(p, durationLabel) {
    return [
      `data-plan="${this.escapeAttr(p.id)}"`,
      `data-price="${p.price}"`,
      `data-days="${p.days}"`,
      `data-duration="${this.escapeAttr(p.duration || durationLabel)}"`,
      `data-plan-name="${this.escapeAttr(p.name)}"`,
      `data-plan-kind="${this.escapeAttr(p.plan_kind || "")}"`,
      `data-included-credits="${Number(p.included_credits) || 0}"`,
      `data-billing-mode="${this.escapeAttr(p.billing_mode || "subscription")}"`,
      `data-unlimited-credits="${p.unlimited_credits ? "true" : "false"}"`,
    ].join(" ");
  },

  /** Wrap a plan button with its credit add-on chips (if any). */
  planCellWrap(buttonHtml, p) {
    const addons = this.getPlanCreditAddons(p);
    if (!addons.length) return buttonHtml;
    const max = Number(p.max_addon_selections) || 0;
    const chips = addons
      .map((a) => {
        const sel = !!a.default_selected;
        return `<button type="button" class="plan-addon-btn" data-plan="${this.escapeAttr(p.id)}" data-addon-id="${this.escapeAttr(a.id)}" data-addon-credits="${a.credits}" data-addon-price="${a.price}" data-addon-label="${this.escapeAttr(a.label)}" data-addon-max="${max}" aria-pressed="${sel ? "true" : "false"}" style="font-size:9px;padding:4px 7px;border-radius:8px;cursor:pointer;white-space:nowrap;background:${sel ? "linear-gradient(135deg,#ffd700,#e67e22)" : "#fff"};color:${sel ? "#3d2914" : "#c45f12"};border:1px solid ${sel ? "#e67e22" : "#f0e0c8"};font-weight:${sel ? "700" : "600"};">+${a.credits} · ₹${a.price}</button>`;
      })
      .join("");
    const hint =
      max === 1
        ? "Pick one add-on"
        : max > 1
          ? `Pick up to ${max}`
          : "Add extra credits";
    return `<div class="plan-cell" style="display:flex;flex-direction:column;">
      ${buttonHtml}
      <div class="plan-addons" data-plan="${this.escapeAttr(p.id)}" style="margin-top:6px;">
        <div style="font-size:8px;color:#9ca3af;text-align:center;margin-bottom:3px;">⚡ ${hint}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;">${chips}</div>
      </div>
    </div>`;
  },

  styleAddonChip(chip) {
    if (!chip) return;
    const sel = chip.getAttribute("aria-pressed") === "true";
    chip.style.background = sel
      ? "linear-gradient(135deg,#ffd700,#e67e22)"
      : "#fff";
    chip.style.color = sel ? "#3d2914" : "#c45f12";
    chip.style.border = sel ? "1px solid #e67e22" : "1px solid #f0e0c8";
    chip.style.fontWeight = sel ? "700" : "600";
  },

  addonChipsForPlan(planId, root) {
    const scope = root || document;
    return Array.from(
      scope.querySelectorAll(".plan-addon-btn"),
    ).filter((c) => c.dataset.plan === String(planId));
  },

  toggleAddonChip(chip, root) {
    if (!chip) return;
    const planId = chip.dataset.plan;
    const max = Number(chip.dataset.addonMax) || 0;
    const isSel = chip.getAttribute("aria-pressed") === "true";
    const siblings = this.addonChipsForPlan(planId, root);

    if (!isSel && max === 1) {
      siblings.forEach((c) => {
        if (c !== chip) {
          c.setAttribute("aria-pressed", "false");
          this.styleAddonChip(c);
        }
      });
    }
    if (!isSel && max > 1) {
      const selectedCount = siblings.filter(
        (c) => c.getAttribute("aria-pressed") === "true",
      ).length;
      if (selectedCount >= max) return;
    }
    chip.setAttribute("aria-pressed", isSel ? "false" : "true");
    this.styleAddonChip(chip);
  },

  /** Wire add-on chip toggling within a root; safe to call repeatedly. */
  wirePlanAddonSelection(root) {
    const scope = root || document;
    scope.querySelectorAll(".plan-addon-btn").forEach((chip) => {
      this.styleAddonChip(chip);
      if (chip.dataset.wired === "1") return;
      chip.dataset.wired = "1";
      const handler = (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        this.toggleAddonChip(chip, root);
      };
      chip.addEventListener("click", handler);
    });
  },

  getSelectedAddonIds(planId, root) {
    return this.addonChipsForPlan(planId, root)
      .filter((c) => c.getAttribute("aria-pressed") === "true")
      .map((c) => c.dataset.addonId);
  },

  /** Build a WhatsApp purchase message from the selected plan + add-ons. */
  buildPlanPurchaseMessage(planId, productName, root) {
    const scope = root || document;
    const btn = Array.from(scope.querySelectorAll(".plan-buy-btn")).find(
      (b) => b.dataset.plan === String(planId),
    );
    const name =
      btn?.dataset.planName || btn?.dataset.duration || "Plan";
    const price = Number(btn?.dataset.price) || 0;
    const included = Number(btn?.dataset.includedCredits) || 0;
    const unlimitedCredits = btn?.dataset.unlimitedCredits === "true";

    const selChips = this.addonChipsForPlan(planId, root).filter(
      (c) => c.getAttribute("aria-pressed") === "true",
    );
    let addonCredits = 0;
    let addonPrice = 0;
    const labels = [];
    selChips.forEach((c) => {
      addonCredits += Number(c.dataset.addonCredits) || 0;
      addonPrice += Number(c.dataset.addonPrice) || 0;
      labels.push(
        c.dataset.addonLabel || `${c.dataset.addonCredits} credits`,
      );
    });
    const total = price + addonPrice;

    let msg = `Hi! I want to purchase ${productName || "Shipping Optimizer"}.\n\n📦 *Plan:* ${name} — ₹${price}`;
    if (labels.length) {
      msg += `\n⚡ *Add-ons:* ${labels.join(", ")} — +₹${addonPrice}`;
    }
    msg += `\n💳 *Total:* ₹${total}`;
    if (!unlimitedCredits && (included > 0 || addonCredits > 0)) {
      msg += `\n🎫 *Credits:* ${included} base`;
      if (addonCredits > 0) {
        msg += ` + ${addonCredits} addon = ${included + addonCredits}`;
      }
    }
    msg += `\n\nPlease share payment details and license key.`;
    return msg;
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
        .map((p) => {
          const btn = `<button type="button" class="plan-btn credit-pack-open-btn plan-card-main" data-pack="${this.escapeAttr(p.id)}" data-credits="${p.credits}" data-price="${p.price}" data-label="${this.escapeAttr(p.label)}">
            <div class="plan-name">${this.escapeHtml(p.label || p.credits + " Credits")}</div>
            <div class="plan-price">₹${p.price}</div>
            <div class="plan-note" style="color:var(--mso-muted);">${p.credits} credits</div>
          </button>`;
          return this.planCardShell(btn, p, "pack");
        })
        .join("");
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const btn = `<button type="button" class="credit-pack-open-btn plan-card-main" data-pack="${this.escapeAttr(p.id)}" data-credits="${p.credits}" data-price="${p.price}" data-label="${this.escapeAttr(p.label)}" style="border:1px solid #f0e0c8;background:#fff;border-radius:8px;padding:10px 28px 10px 10px;text-align:center;cursor:pointer;color:#1f2937;width:100%;">
          <div style="font-size:11px;color:#6b7280;">${this.escapeHtml(p.label || p.credits + " Credits")}</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22;">₹${p.price}</div>
          <div style="font-size:9px;color:#6b7280;">${p.credits} credits</div>
        </button>`;
        return this.planCardShell(btn, p, "pack");
      })
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
    const hint =
      root.querySelector("#license-device-hint") ||
      root.querySelector("#license-demo-hint");

    const [plans, creditPacks, creditsCfg, wa] = await Promise.all([
      this.getPricingPlans(true),
      this.getCreditPacks(true),
      this.getCreditsConfig(true),
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
      hint.textContent =
        "1 device per license by default · Family/Friends plans allow more devices";
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

    return { plans, creditPacks, creditsConfig: creditsCfg, whatsapp: wa, announcement };
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FirebaseLicense = FirebaseLicense;
}
