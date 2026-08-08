// ============================================
// Firebase Google Auth for Chrome extension
// Uses chrome.identity + Identity Toolkit REST (no SDK — MV3 CSP safe)
// ============================================

const FirebaseAuth = {
  STORAGE_KEY: "firebaseAuthSession",
  OAUTH_DEBUG_KEY: "oauthDebugInfo",

  get firebase() {
    return typeof CONFIG !== "undefined" ? CONFIG.FIREBASE : null;
  },

  isEnabled() {
    return !!(
      this.firebase?.apiKey &&
      this.firebase?.authDomain &&
      CONFIG?.USE_FIREBASE_LICENSE !== false
    );
  },

  getExtensionId() {
    return typeof chrome !== "undefined" ? chrome.runtime?.id || "" : "";
  },

  getManifestOAuthClientId() {
    try {
      return chrome.runtime?.getManifest?.()?.oauth2?.client_id || "";
    } catch (_) {
      return "";
    }
  },

  /** All redirect URIs this build may use — register every one in Google Cloud (Web client). */
  getRedirectUriCandidates() {
    const id = this.getExtensionId();
    const candidates = [];
    if (typeof chrome !== "undefined" && chrome.identity?.getRedirectURL) {
      candidates.push(chrome.identity.getRedirectURL());
      const slash = chrome.identity.getRedirectURL();
      if (slash.endsWith("/")) {
        candidates.push(slash.slice(0, -1));
      } else {
        candidates.push(`${slash}/`);
      }
    }
    if (id) {
      candidates.push(`https://${id}.chromiumapp.org/`);
      candidates.push(`https://${id}.chromiumapp.org`);
    }
    return [...new Set(candidates.filter(Boolean))];
  },

  getRedirectUri() {
    const list = this.getRedirectUriCandidates();
    if (list.length) return list[0];
    return `https://${this.firebase?.authDomain || "localhost"}/__/auth/handler`;
  },

  getOAuthSetupHint() {
    const redirectUris = this.getRedirectUriCandidates();
    const extId = this.getExtensionId();
    return {
      redirectUri: redirectUris[0] || "",
      redirectNoSlash: (redirectUris[0] || "").replace(/\/$/, ""),
      redirectUris,
      extensionId: extId || null,
      manifestClientId: this.getManifestOAuthClientId(),
      instruction:
        "Best for Kiwi/mobile: create OAuth client type CHROME EXTENSION with your extension ID. " +
        "Fallback: add redirect URIs to Web client 1.",
    };
  },

  async saveOAuthDebug(extra = {}) {
    try {
      const clientId = await this.getOAuthClientId();
      const hint = this.getOAuthSetupHint();
      await chrome.storage.local.set({
        [this.OAUTH_DEBUG_KEY]: {
          ...hint,
          clientId,
          clientSource: this._lastClientSource || "",
          ...extra,
          timestamp: Date.now(),
        },
      });
    } catch (_) {}
  },

  async getOAuthDiagnostics() {
    const clientId = await this.getOAuthClientId();
    const hint = this.getOAuthSetupHint();
    const stored = await chrome.storage.local.get([this.OAUTH_DEBUG_KEY]);
    return {
      clientId,
      clientSource: this._lastClientSource || "",
      lastAttempt: stored[this.OAUTH_DEBUG_KEY] || null,
      ...hint,
    };
  },

  formatRedirectMismatchHelp(err, diagnostics) {
    const hint = diagnostics || this.getOAuthSetupHint();
    const msg = String(err?.message || err || "");
    if (!/redirect_uri_mismatch/i.test(msg)) return msg;
    const uris = (hint.redirectUris || []).filter(Boolean).join("\n");
    const clientLine = hint.clientId
      ? `OAuth client in use:\n${hint.clientId}\n\n`
      : "";
    const extId = hint.extensionId || "unknown";
    return (
      `Google OAuth redirect mismatch.\n\n` +
      clientLine +
      `FIX FOR KIWI (recommended):\n` +
      `Google Cloud → Create Credentials → OAuth client ID → type CHROME EXTENSION → Application ID:\n${extId}\n` +
      `Put that new client ID in Firestore oauth_client_id + manifest oauth2 + Firebase Auth Google.\n\n` +
      `OR add these redirect URIs to Web client 1 (9djj...):\n${uris}\n\n` +
      `Extension ID: ${extId}`
    );
  },

  async getOAuthClientId() {
    const manifestId = this.getManifestOAuthClientId();
    if (manifestId) {
      this._lastClientSource = "manifest.oauth2";
      return manifestId;
    }
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.getGoogleTrialPublicConfig
    ) {
      try {
        const cfg = await FirebaseLicense.getGoogleTrialPublicConfig(true);
        if (cfg?.oauth_client_id || cfg?.oauthClientId) {
          this._lastClientSource = "firebase";
          return cfg.oauth_client_id || cfg.oauthClientId;
        }
      } catch (_) {}
    }
    if (this.firebase?.oauthClientId) {
      this._lastClientSource = "config.js";
      return this.firebase.oauthClientId;
    }
    this._lastClientSource = "";
    return "";
  },

  parseFragmentParams(url) {
    const hash = (url || "").split("#")[1] || "";
    const params = new URLSearchParams(hash);
    const out = {};
    params.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  },

  async getGoogleAccessTokenViaAuthToken() {
    if (!chrome?.identity?.getAuthToken) {
      throw new Error("getAuthToken unavailable");
    }
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!token) {
          reject(new Error("Google did not return an access token."));
          return;
        }
        resolve(token);
      });
    });
  },

  async removeCachedGoogleToken() {
    if (!chrome?.identity?.getAuthToken || !chrome?.identity?.removeCachedAuthToken) {
      return;
    }
    try {
      const token = await new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (t) => resolve(t || null));
      });
      if (token) {
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, () => resolve());
        });
      }
    } catch (_) {}
  },

  async launchGoogleOAuthWithRedirect(clientId, redirectUri) {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");

    await this.saveOAuthDebug({
      method: "launchWebAuthFlow",
      authUrl: authUrl.toString(),
      redirectUri,
      clientId,
    });

    console.info("[Shipping Optimizer] Google OAuth attempt", {
      clientId,
      redirectUri,
      extensionId: this.getExtensionId(),
    });

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!callbackUrl) {
            reject(new Error("Google sign-in was cancelled."));
            return;
          }
          resolve(callbackUrl);
        },
      );
    });

    const params = this.parseFragmentParams(responseUrl);
    if (params.error) {
      throw new Error(params.error_description || params.error);
    }
    const accessToken = params.access_token;
    if (!accessToken) {
      throw new Error("Google did not return an access token.");
    }
    return { accessToken, redirectUri, method: "launchWebAuthFlow" };
  },

  async launchGoogleOAuth(clientId) {
    if (!clientId) {
      throw new Error(
        "Google sign-in is not configured yet. Ask admin to set google_trial.oauth_client_id in Firebase.",
      );
    }

    const diagnostics = await this.getOAuthDiagnostics();
    const redirectUri = this.getRedirectUri();

    // Preferred on Chrome/Kiwi extensions — no manual redirect URI in Google Cloud when using Chrome Extension OAuth client type.
    if (chrome?.identity?.getAuthToken && this.getManifestOAuthClientId()) {
      try {
        await this.saveOAuthDebug({
          method: "getAuthToken",
          clientId,
          redirectUri,
        });
        const accessToken = await this.getGoogleAccessTokenViaAuthToken();
        return { accessToken, redirectUri, method: "getAuthToken" };
      } catch (e) {
        console.warn("[Shipping Optimizer] getAuthToken failed:", e.message);
        const msg = String(e.message || "");
        if (!/redirect_uri|bad client id|invalid_client/i.test(msg)) {
          // Non-redirect errors may still be recoverable via web flow
        }
      }
    }

    if (!chrome?.identity?.launchWebAuthFlow) {
      throw new Error(
        "Google sign-in needs Chrome or Kiwi with identity support. Use a license key instead.",
      );
    }

    const redirects = this.getRedirectUriCandidates();
    let lastError = null;

    for (const uri of redirects) {
      try {
        return await this.launchGoogleOAuthWithRedirect(clientId, uri);
      } catch (e) {
        lastError = e;
        const msg = String(e?.message || e || "");
        if (!/redirect_uri_mismatch/i.test(msg)) {
          throw new Error(this.formatRedirectMismatchHelp(e, diagnostics));
        }
      }
    }

    throw new Error(
      this.formatRedirectMismatchHelp(lastError || "redirect_uri_mismatch", diagnostics),
    );
  },

  async signInWithGoogleAccessToken(accessToken, requestUri) {
    const apiKey = this.firebase.apiKey;
    const uri = requestUri || this.getRedirectUri();
    const postBody = `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody,
          requestUri: uri,
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data?.error?.message || "Firebase Google sign-in failed.",
      );
    }
    return this.normalizeSession(data);
  },

  normalizeSession(data) {
    const expiresIn = Number(data.expiresIn) || 3600;
    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email || "",
      displayName: data.displayName || "",
      photoUrl: data.photoUrl || "",
      provider: "google.com",
      obtainedAt: Date.now(),
      expiresAt: Date.now() + expiresIn * 1000,
    };
  },

  async saveSession(session) {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: session });
    return session;
  },

  async getSession() {
    const stored = await chrome.storage.local.get([this.STORAGE_KEY]);
    return stored[this.STORAGE_KEY] || null;
  },

  async clearSession() {
    await this.removeCachedGoogleToken();
    await chrome.storage.local.remove([this.STORAGE_KEY]);
  },

  async refreshIdToken(refreshToken) {
    const apiKey = this.firebase.apiKey;
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "Token refresh failed.");
    }
    const prev = (await this.getSession()) || {};
    const session = {
      ...prev,
      idToken: data.id_token,
      refreshToken: data.refresh_token || prev.refreshToken,
      obtainedAt: Date.now(),
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    await this.saveSession(session);
    return session;
  },

  async getIdToken(forceRefresh) {
    let session = await this.getSession();
    if (!session?.idToken) return null;
    const stale =
      forceRefresh ||
      !session.expiresAt ||
      Date.now() > session.expiresAt - 60 * 1000;
    if (stale && session.refreshToken) {
      try {
        session = await this.refreshIdToken(session.refreshToken);
      } catch (e) {
        await this.clearSession();
        return null;
      }
    }
    return session.idToken;
  },

  async getCurrentUser() {
    const session = await this.getSession();
    if (!session?.localId) return null;
    return {
      uid: session.localId,
      email: session.email || "",
      displayName: session.displayName || "",
      photoUrl: session.photoUrl || "",
    };
  },

  async signInWithGoogle() {
    if (!this.isEnabled()) {
      throw new Error("Firebase auth is not enabled.");
    }
    const clientId = await this.getOAuthClientId();
    const { accessToken, redirectUri } = await this.launchGoogleOAuth(clientId);
    const session = await this.signInWithGoogleAccessToken(
      accessToken,
      redirectUri,
    );
    await this.saveSession(session);
    return {
      uid: session.localId,
      email: session.email,
      displayName: session.displayName,
      photoUrl: session.photoUrl,
      idToken: session.idToken,
    };
  },

  async signOut() {
    await this.clearSession();
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FirebaseAuth = FirebaseAuth;
}
