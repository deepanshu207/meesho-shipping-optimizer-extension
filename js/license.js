// License checks disabled — extension is free to use directly.
const LicenseManager = {
  isLicensed: true,
  licenseKey: "FREE",
  licenseInfo: { planType: "free" },

  checkLicense: async function () {
    this.isLicensed = true;
    return true;
  },

  verifyLicenseKey: async function () {
    this.isLicensed = true;
    return { success: true, message: "Ready" };
  },

  clearLicense: async function () {
    this.isLicensed = true;
    return true;
  },

  getWhatsAppSettings: async function () {
    return { number: "", message: "" };
  },
};

window.LicenseManager = LicenseManager;
