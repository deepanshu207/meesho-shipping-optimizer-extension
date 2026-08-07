const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const CONFIG_COLLECTION = "shipping_optimizer_config";
const LICENSES_COLLECTION = "shipping_optimizer_licenses";
const TRIALS_COLLECTION = "shipping_optimizer_google_trials";

function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function normalizeTrialConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const enabled = src.enabled !== false && src.enabled !== "false";
  return {
    enabled,
    days: Math.max(1, Number(src.days) || 7),
    credits: Math.max(0, Number(src.credits) || 0),
    max_devices: Math.max(1, Number(src.max_devices ?? src.maxDevices) || 1),
    label: src.label || src.name || "Google free trial",
    plan_id: String(src.plan_id || src.planId || "google_trial"),
  };
}

function buildLicenseKey(uid) {
  const short = String(uid || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GTRIAL-${short || "USER"}-${rand}`;
}

function trialIsExpired(trial, license) {
  const exp =
    trial?.expires_at ||
    trial?.expiresAt ||
    license?.expiresAt ||
    license?.expires_at;
  if (!exp) return false;
  return new Date(exp).getTime() < Date.now();
}

exports.claimGoogleTrial = functions.https.onRequest(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!idToken) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";
    if (!email) {
      return res.status(403).json({
        error: "Google account must have a verified email.",
        code: "email_required",
      });
    }

    const machineId = String(req.body?.machineId || req.body?.machine_id || "").trim();

    const configSnap = await db.collection(CONFIG_COLLECTION).doc("app").get();
    const trialCfg = normalizeTrialConfig(
      configSnap.exists ? configSnap.data()?.google_trial : null,
    );

    if (!trialCfg.enabled) {
      return res.status(403).json({
        error: "Google free trial is disabled.",
        code: "trial_disabled",
      });
    }

    const trialRef = db.collection(TRIALS_COLLECTION).doc(uid);
    const existingTrial = await trialRef.get();

    if (existingTrial.exists) {
      const trial = existingTrial.data() || {};
      const licenseKey = trial.license_key || trial.licenseKey;
      if (!licenseKey) {
        return res.status(409).json({
          error: "Trial record is corrupted. Contact support.",
          code: "trial_corrupt",
        });
      }

      const licenseRef = db.collection(LICENSES_COLLECTION).doc(licenseKey);
      const licenseSnap = await licenseRef.get();
      const license = licenseSnap.exists ? licenseSnap.data() || {} : {};

      if (trialIsExpired(trial, license)) {
        return res.status(403).json({
          error: "Your Google free trial has expired. Purchase a plan to continue.",
          code: "trial_expired",
          trialExpired: true,
          licenseKey,
        });
      }

      if (license.active === false) {
        return res.status(403).json({
          error: "Your trial license was revoked. Contact support.",
          code: "trial_revoked",
        });
      }

      const patch = { lastVerifiedAt: new Date().toISOString() };
      const deviceIds = Array.isArray(license.device_ids)
        ? [...license.device_ids]
        : license.machineId
          ? [license.machineId]
          : [];

      if (machineId && !deviceIds.includes(machineId)) {
        const maxDevices = Number(license.max_devices) || trialCfg.max_devices;
        if (maxDevices > 0 && deviceIds.length >= maxDevices) {
          return res.status(403).json({
            error: "Trial device limit reached for this Google account.",
            code: "device_limit",
          });
        }
        deviceIds.push(machineId);
        patch.device_ids = deviceIds;
        patch.machineId = deviceIds[0] || machineId;
      }

      if (Object.keys(patch).length > 1) {
        await licenseRef.set(patch, { merge: true });
      }

      return res.status(200).json({
        success: true,
        existing: true,
        licenseKey,
        email,
        uid,
      });
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + trialCfg.days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const licenseKey = buildLicenseKey(uid);
    const billingMode = trialCfg.credits > 0 ? "hybrid" : "subscription";

    const licenseData = {
      active: true,
      plan_id: trialCfg.plan_id,
      plan_type: "google_trial",
      plan_kind: "trial",
      billing_mode: billingMode,
      google_uid: uid,
      customer_email: email,
      planDays: trialCfg.days,
      max_devices: trialCfg.max_devices,
      unlimited_time: false,
      unlimited_devices: false,
      unlimited_credits: false,
      included_credits: trialCfg.credits,
      credits_balance: trialCfg.credits,
      credits_used: 0,
      expiry_starts_on_activation: false,
      expiresAt,
      activatedAt: now.toISOString(),
      lastVerifiedAt: now.toISOString(),
      device_ids: machineId ? [machineId] : [],
      machineId: machineId || "",
      trial: true,
      source: "google_auth",
      label: trialCfg.label,
    };

    const trialData = {
      google_uid: uid,
      email,
      license_key: licenseKey,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      days_granted: trialCfg.days,
      credits_granted: trialCfg.credits,
      machine_ids: machineId ? [machineId] : [],
    };

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(trialRef);
      if (snap.exists) {
        throw new functions.https.HttpsError(
          "already-exists",
          "Trial already claimed",
        );
      }
      tx.set(db.collection(LICENSES_COLLECTION).doc(licenseKey), licenseData);
      tx.set(trialRef, trialData);
    });

    return res.status(200).json({
      success: true,
      existing: false,
      licenseKey,
      email,
      uid,
      expiresAt,
      credits: trialCfg.credits,
      days: trialCfg.days,
    });
  } catch (err) {
    if (err?.code === "already-exists") {
      return res.status(409).json({
        error: "Trial already claimed for this Google account.",
        code: "trial_exists",
      });
    }
    console.error("claimGoogleTrial error:", err);
    return res.status(500).json({
      error: err.message || "Internal error",
    });
  }
});
