// Shared device ID for license binding (one ID per browser profile)

const MachineId = {
  async get() {
    try {
      const stored = await chrome.storage.local.get(["machineId"]);
      if (stored.machineId) return stored.machineId;

      const id = await this.generate();
      await chrome.storage.local.set({ machineId: id });
      return id;
    } catch (e) {
      console.error("MachineId error:", e);
      return "M" + Date.now().toString(36).toUpperCase().substring(0, 12);
    }
  },

  async generate() {
    let fingerprintParts = [
      navigator.userAgent || "",
      navigator.language || "",
      typeof screen !== "undefined"
        ? screen.width + "x" + screen.height
        : "sw",
      typeof screen !== "undefined" ? screen.colorDepth : 0,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ];

    if (typeof document !== "undefined") {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("MeeshoOpt", 2, 15);
        fingerprintParts.unshift(canvas.toDataURL());
      } catch (_) {}
    } else {
      fingerprintParts.unshift("shipping-optimizer-sw");
    }

    const fingerprint = fingerprintParts.join("|");
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = (hash << 5) - hash + fingerprint.charCodeAt(i);
      hash &= hash;
    }

    return "M" + Math.abs(hash).toString(36).toUpperCase().substring(0, 12);
  },

  async copySupportBundle(licenseKey, licenseInfo) {
    const machineId = await this.get();
    const version = typeof CONFIG !== "undefined" ? CONFIG.VERSION : "?";
    const info = licenseInfo || {};
    const lines = [
      "Shipping Optimizer — Support Info",
      "Key: " + (licenseKey || "—"),
      "Device ID: " + machineId,
      "Plan: " + (info.planType || "—"),
      "Activated: " + (info.activatedAt || "—"),
      "Expires: " + (info.expiresAt || "—"),
      "Version: " + version,
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.MachineId = MachineId;
}
