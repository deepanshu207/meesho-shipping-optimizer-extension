// License management for Shipping Optimizer v1.0.0

const LicenseManager = {
  isLicensed: false,
  licenseKey: null,
  licenseInfo: null,

  // Check license status from storage
  checkLicense: async function () {
    try {
      const result = await chrome.storage.sync.get([
        "licenseKey",
        "licenseStatus",
        "licenseInfo",
      ]);
      this.licenseKey = result.licenseKey;
      this.licenseInfo = result.licenseInfo;

      if (!this.licenseKey) {
        this.isLicensed = false;
        return false;
      }

      // Check expiry (subscription / hybrid) — skip if unlimited time
      const billingMode = result.licenseInfo?.billingMode || "subscription";
      const unlimitedTime = !!result.licenseInfo?.unlimitedTime;
      if (
        !unlimitedTime &&
        billingMode !== "credits" &&
        result.licenseInfo &&
        result.licenseInfo.expiresAt
      ) {
        const expiresAt = new Date(result.licenseInfo.expiresAt);
        if (new Date() > expiresAt) {
          console.log("License expired");
          await this.clearLicense("expired");
          return false;
        }
      }

      // Check credits (credits / hybrid) — skip if unlimited credits
      if (
        (billingMode === "credits" || billingMode === "hybrid") &&
        !result.licenseInfo?.unlimitedCredits
      ) {
        const balance = Number(result.licenseInfo?.creditsBalance ?? 0);
        if (balance <= 0) {
          console.log("Credits exhausted");
          this.isLicensed = false;
          return false;
        }
      }

      this.isLicensed = result.licenseStatus === "active";
      console.log("License check:", this.isLicensed ? "Active" : "Inactive");
      return this.isLicensed;
    } catch (error) {
      console.error("License check error:", error);
      return this.isLicensed;
    }
  },

  // Get or create machine ID
  getMachineId: async function () {
    if (typeof MachineId !== "undefined" && MachineId.get) {
      return MachineId.get();
    }
    return "M" + Date.now().toString(36).toUpperCase();
  },

  // Demo keys fetched from server
  demoKeys: null,

  // Fetch demo keys from server
  fetchDemoKeys: async function () {
    if (this.demoKeys) return this.demoKeys;
    this.demoKeys = await CONFIG.getDemoKeys();
    return this.demoKeys;
  },

  async refreshLicenseInfoFromFirebase() {
    if (!this.licenseKey) return null;
    const machineId = await this.getMachineId();
    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      const refreshed = await FirebaseLicense.refreshLicenseFromFirebase(
        this.licenseKey,
        machineId,
      );
      if (refreshed.valid && refreshed.license) {
        this.licenseInfo = refreshed.license;
        await chrome.storage.sync.set({
          licenseInfo: refreshed.license,
          lastVerified: Date.now(),
        });
        return refreshed.license;
      }
    }
    return this.licenseInfo;
  },

  async consumeCredits(amount) {
    if (!this.licenseKey || this.licenseInfo?.planType === "demo") {
      return { ok: true, skipped: true };
    }
    const mode = this.licenseInfo?.billingMode || "subscription";
    if (mode === "subscription") return { ok: true, skipped: true };
    if (this.licenseInfo?.unlimitedCredits) {
      return { ok: true, skipped: true, unlimited: true };
    }

    if (
      CONFIG?.USE_FIREBASE_LICENSE &&
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.isEnabled()
    ) {
      const result = await FirebaseLicense.deductCredits(
        this.licenseKey,
        amount,
      );
      if (result.ok) {
        this.licenseInfo = {
          ...this.licenseInfo,
          creditsBalance: result.balance,
          creditsUsed: result.used,
        };
        await chrome.storage.sync.set({ licenseInfo: this.licenseInfo });
      }
      return result;
    }
    return { ok: false, reason: "Credits sync unavailable" };
  },

  async ensureCanOperate(actionLabel) {
    await this.checkLicense();
    if (!this.isLicensed) return { ok: false, reason: "License required" };

    const mode = this.licenseInfo?.billingMode || "subscription";
    if (mode === "credits" || mode === "hybrid") {
      if (this.licenseInfo?.unlimitedCredits) {
        return { ok: true };
      }
      const balance = Number(this.licenseInfo?.creditsBalance ?? 0);
      if (balance <= 0) {
        return {
          ok: false,
          reason: actionLabel
            ? `${actionLabel} requires credits — buy a credit pack`
            : "Insufficient credits",
          needsTopUp: true,
        };
      }
      const consumed = await this.consumeCredits();
      if (!consumed.ok && !consumed.skipped) {
        return consumed;
      }
    }
    return { ok: true };
  },

  // Verify license key with server
  verifyLicenseKey: async function (key) {
    if (!key || key.length < 10) {
      return { success: false, message: "Invalid license key format" };
    }

    const trimmedKey = CONFIG.normalizeLicenseKey
      ? CONFIG.normalizeLicenseKey(key)
      : key.trim().toUpperCase().replace(/\s+/g, "-");
    console.log("🔑 Verifying key:", trimmedKey);

    // Fetch demo keys from server first (built-ins always included)
    const demoKeys = await this.fetchDemoKeys();
    console.log("🔑 Available demo keys:", Object.keys(demoKeys));

    // Check demo keys (case-insensitive)
    const demoKeyMatch = Object.keys(demoKeys).find(
      (k) => k.toUpperCase() === trimmedKey
    );

    if (demoKeyMatch) {
      const demoInfo = demoKeys[demoKeyMatch];
      const expiresAt = new Date(
        Date.now() + demoInfo.days * 24 * 60 * 60 * 1000
      );

      console.log("✅ Demo key found:", demoKeyMatch, demoInfo);

      try {
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

        this.isLicensed = true;
        this.licenseKey = trimmedKey;
        console.log("✅ Demo key activated successfully:", trimmedKey);
        return { success: true };
      } catch (storageError) {
        console.error("❌ Storage error:", storageError);
        return {
          success: false,
          message: "Failed to save license: " + storageError.message,
        };
      }
    }

    console.log("🔍 Not a demo key, checking Firebase...");

    const machineId = await this.getMachineId();
    console.log("Machine ID:", machineId);

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

          this.isLicensed = true;
          this.licenseKey = trimmedKey;
          this.licenseInfo = fbResult.license;
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
  },

  // Clear license
  clearLicense: async function (reason = "cleared") {
    this.isLicensed = false;
    this.licenseKey = null;
    this.licenseInfo = null;

    await chrome.storage.sync.set({
      licenseStatus: reason,
      licenseKey: null,
      licenseInfo: null,
    });
  },

  // Get WhatsApp settings from Firebase (or local defaults)
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

  // Open WhatsApp
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
      console.error("WhatsApp error:", error);
      const phone = String(CONFIG.DEFAULT_WHATSAPP || "919654414891").replace(/\D/g, "");
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(
          CONFIG.DEFAULT_WHATSAPP_MESSAGE ||
            "Hi! I want to purchase Shipping Optimizer license.",
        )}`,
        "_blank"
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
