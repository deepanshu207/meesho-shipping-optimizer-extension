// Meesho session storage for standalone web app
const WebSession = {
  KEY: "meesho_web_session_v1",

  ESSENTIAL_COOKIES: [
    "connect.sid",
    "browser_id",
    "browser_uid",
    "current_az_identifier",
    "mp_a66867feba42257f4b46689d52d48f86_mixpanel",
    "s_b",
  ],

  normalizeCookie(raw) {
    if (!raw) return "";
    let text = String(raw).trim();
    if (/^cookie\s*:/i.test(text)) {
      text = text.replace(/^cookie\s*:/i, "").trim();
    }
    text = text.replace(/[\r\n]+/g, "");

    const map = {};
    text.split(";").forEach((part) => {
      const piece = part.trim();
      if (!piece) return;
      const eq = piece.indexOf("=");
      if (eq <= 0) return;
      const key = piece.slice(0, eq).trim();
      const value = piece.slice(eq + 1).trim();
      if (key) map[key] = value;
    });

    const essential = this.ESSENTIAL_COOKIES.filter((k) => map[k]).map(
      (k) => `${k}=${map[k]}`
    );
    if (essential.length >= 2) return essential.join("; ");

    return text;
  },

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || "{}");
    } catch {
      return {};
    }
  },

  save(fields) {
    const next = { ...this.get(), ...fields };
    localStorage.setItem(this.KEY, JSON.stringify(next));
    if (typeof MeeshoAPI !== "undefined" && MeeshoAPI.syncFromSession) {
      MeeshoAPI.syncFromSession();
    }
    this.updateStatus();
    if (typeof MeeshoAPI !== "undefined") {
      MeeshoAPI.cache.categories = null;
      MeeshoAPI.syncFromSession();
    }
    if (window.meeshoOptimizer?.loadCategoryDropdown) {
      window.meeshoOptimizer.loadCategoryDropdown();
    }
    return next;
  },

  applyToForm() {
    const s = this.get();
    const map = {
      "session-supplier-id": s.supplierId,
      "session-browser-id": s.browserId,
      "session-identifier": s.identifier,
      "session-price": s.price,
      "session-cookie": s.cookie,
    };
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value != null) el.value = value;
    });
    this.updateStatus();
  },

  readFromForm() {
    const val = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };
    return this.save({
      supplierId: val("session-supplier-id"),
      browserId: val("session-browser-id"),
      identifier: val("session-identifier"),
      price: parseInt(val("session-price"), 10) || 100,
      cookie: this.normalizeCookie(val("session-cookie")),
    });
  },

  async testConnection() {
    if (typeof MeeshoAPI === "undefined") {
      return { ok: false, message: "API not loaded" };
    }
    MeeshoAPI.syncFromSession();
    const s = this.get();
    if (!s.supplierId || !s.browserId) {
      return { ok: false, message: "Add Supplier ID and Browser ID first" };
    }
    if (!s.cookie) {
      return { ok: false, message: "Paste Cookie from supplier.meesho.com" };
    }

    MeeshoAPI.cache.categories = null;
    const categories = await MeeshoAPI.fetchCategories(true);
    const live =
      categories &&
      categories.length > 0 &&
      !MeeshoAPI._lastCategoryFetchWasFallback;

    if (live) {
      return {
        ok: true,
        message: `Live API OK — ${categories.length} categories loaded`,
      };
    }

    return {
      ok: false,
      message:
        "Meesho blocked the request (403). Web proxy cannot reuse browser login reliably — use the Chrome extension on supplier.meesho.com for live shipping, or continue with built-in categories + local variants.",
    };
  },

  updateStatus() {
    const el = document.getElementById("session-status");
    if (!el) return;
    const s = this.get();
    const ok = s.supplierId && s.browserId;
    const cookieLen = s.cookie ? s.cookie.length : 0;
    if (ok && cookieLen > 0) {
      el.textContent = `✅ Session saved — cookie ${cookieLen} chars (Supplier ${s.supplierId})`;
      el.className = "session-status ok";
      return;
    }
    if (ok) {
      el.textContent =
        "⚠️ Session partial — add Cookie from supplier.meesho.com for live API";
      el.className = "session-status warn";
      return;
    }
    el.textContent =
      "⚠️ Add Supplier ID + Browser ID (login to supplier.meesho.com first)";
    el.className = "session-status warn";
  },

  wireForm() {
    if (this._wired) {
      this.applyToForm();
      return;
    }
    this._wired = true;

    const saveBtn = document.getElementById("save-session");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.readFromForm();
        OptimizerUtils?.showNotification("Meesho session saved", "success");
      });
    }
    const testBtn = document.getElementById("test-session");
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        testBtn.disabled = true;
        testBtn.textContent = "Testing…";
        this.readFromForm();
        const result = await this.testConnection();
        const status = document.getElementById("session-status");
        if (status) {
          status.textContent = (result.ok ? "✅ " : "⚠️ ") + result.message;
          status.className = result.ok ? "session-status ok" : "session-status warn";
        }
        OptimizerUtils?.showNotification(result.message, result.ok ? "success" : "info");
        testBtn.disabled = false;
        testBtn.textContent = "Test live connection";
      });
    }
    const toggle = document.getElementById("toggle-session");
    const panel = document.getElementById("session-panel");
    if (toggle && panel) {
      toggle.addEventListener("click", () => {
        panel.classList.toggle("collapsed");
        toggle.textContent = panel.classList.contains("collapsed")
          ? "Show Meesho session"
          : "Hide Meesho session";
      });
    }
    this.applyToForm();
  },
};

window.WebSession = WebSession;

// Legacy alias — embedded list loads from js/meeshoCategories.js
window.FALLBACK_CATEGORIES = window.MEESHO_EMBEDDED_CATEGORIES || [
  { id: 18044, name: "Women Kurtis", parentName: "Women Ethnic Wear" },
  { id: 18045, name: "Women Sarees", parentName: "Women Ethnic Wear" },
  { id: 10001, name: "Men T-Shirts", parentName: "Men Topwear" },
  { id: 10002, name: "Men Shirts", parentName: "Men Topwear" },
  { id: 12001, name: "Kids Clothing", parentName: "Kids" },
  { id: 15001, name: "Home Decor", parentName: "Home & Kitchen" },
  { id: 15002, name: "Kitchen Tools", parentName: "Home & Kitchen" },
  { id: 20001, name: "Women Leggings", parentName: "Women Bottomwear" },
  { id: 20002, name: "Women Jeans", parentName: "Women Bottomwear" },
  { id: 30001, name: "Jewellery Sets", parentName: "Fashion Jewellery" },
];
