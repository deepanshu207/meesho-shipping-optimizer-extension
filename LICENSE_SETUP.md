# License validation — how it works

You **do not need to build new API endpoints** for basic use. The extension already points at the same license server used by the **optimize** project.

**Base URL (in `config.js`):**
```
https://darkviolet-ostrich-615182.hostingersite.com/api
```

---

## Where validation happens

### 1. Demo keys — mostly in the extension (no server required)

Built-in keys in `config.js` → `BUILTIN_DEMO_KEYS`:

| Key | Trial length |
|-----|----------------|
| `MEESHO-DEMOFREE` | 30 days |
| `MEESHO-DEMOFREE-PROMO` | 30 days |
| `MEESHO-DEMO-PROMO` | 30 days |
| `MEESHO-DEMO999` | 7 days |

**Flow:**
1. User enters key in **popup** or **optimizer modal**
2. Extension calls `LicenseManager.verifyLicenseKey()` (or popup `verifyLicenseWithServer()`)
3. Key is matched against built-in demo keys **first**
4. If matched → saved to `chrome.storage.sync` with expiry → **active immediately**
5. Server is **not** called for demo keys

Optional: `GET /demo-keys` merges extra promo keys from your server into the built-in list.

### 2. Paid keys — on your license server

**Flow:**
1. User buys via WhatsApp (plan buttons open WhatsApp with plan + price)
2. You send them a **paid license key** (created in your server admin / database)
3. User activates in popup or modal
4. Extension calls:

```
POST /verify-license
Content-Type: application/json

{
  "licenseKey": "MEESHO-XXXX-XXXX",
  "machineId": "MXXXXXXXXXXXX"
}
```

5. Server responds:

```json
{ "valid": true, "license": { "planType": "yearly", "expiresAt": "..." } }
```

or

```json
{ "valid": false, "reason": "License key not found" }
```

6. Background worker re-checks stored keys every ~5 minutes via the same endpoint.

**Code locations:**
- `js/license.js` — `verifyLicenseKey()`, `checkLicense()`
- `popup.js` — activation UI
- `background.js` — `verifyLicenseKey()`, `autoLicenseCheck()`
- `content.js` — `checkLicense()`, gates Generate / Apply

### 3. WhatsApp payment — not automatic

Plans do **not** charge or activate by themselves. They only open WhatsApp:

```
GET /settings  →  whatsapp_number, whatsapp_message
```

Then: `https://wa.me/<number>?text=<encoded message>`

You confirm payment manually and issue a license key from your admin.

---

## Endpoints already live (tested)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/demo-keys` | GET | Optional extra demo keys |
| `/api/verify-license` | POST | Validate paid keys + machine binding |
| `/api/settings` | GET | WhatsApp number & default message |

Example:

```bash
curl https://darkviolet-ostrich-615182.hostingersite.com/api/settings
curl https://darkviolet-ostrich-615182.hostingersite.com/api/demo-keys
curl -X POST https://darkviolet-ostrich-615182.hostingersite.com/api/verify-license \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"YOUR-PAID-KEY","machineId":"MTEST123"}'
```

---

## What you need to do

| Task | Required? |
|------|-----------|
| Create API endpoints | **No** — already on Hostinger |
| Change `SERVER_URL` in `config.js` | Only if you host your own API |
| Add paid keys on server admin | **Yes** — for paying customers |
| Use demo keys for trials | **No server work** — `MEESHO-DEMOFREE` works offline |
| Update WhatsApp number | Via server `/settings` or `DEFAULT_WHATSAPP` in `config.js` |

---

## Quick test (no paid key needed)

1. Reload extension
2. Open popup → enter `MEESHO-DEMOFREE` → **Activate License**
3. Status should show **Active** (30-day demo)
4. Open optimizer on Meesho → Generate should work

If paid keys fail with “License key not found”, the key is not in the server database yet — add it in your license admin panel (same backend as optimize), not in the extension repo.
