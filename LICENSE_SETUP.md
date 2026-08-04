# License validation — Firebase only

All license, pricing, demo promo codes, and WhatsApp settings are managed in **Firebase** (`swagstree-web` project).

See **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** for the full schema, security rules, and seed data.

No Hostinger or custom API server is required.

---

## How validation works

### 1. Demo / promo keys

Built-in fallbacks in `config.js` → `BUILTIN_DEMO_KEYS`:

| Key | Trial length |
|-----|----------------|
| `MEESHO-DEMOFREE` | 30 days |
| `MEESHO-DEMOFREE-PROMO` | 30 days |
| `MEESHO-DEMO-PROMO` | 30 days |
| `MEESHO-DEMO999` | 7 days |

**Flow:**
1. User enters key in popup or optimizer modal
2. Extension checks demo keys (Firebase `shipping_optimizer_config/app` → `demo_keys`, plus `shipping_optimizer_demo_keys` collection, merged with built-ins)
3. If matched → saved to `chrome.storage.sync` with expiry → active immediately

### 2. Paid keys — Firebase Firestore

**Flow:**
1. User buys via WhatsApp (plan buttons open WhatsApp with plan + price)
2. You create a document in `shipping_optimizer_licenses/{LICENSE_KEY}` in Firebase Console
3. User activates in popup or modal
4. Extension verifies via Firestore REST API and binds `machineId` on first use
5. Background worker re-checks stored keys every ~5 minutes

**Code locations:**
- `js/firebaseLicense.js` — Firestore reads/writes
- `js/license.js` — `verifyLicenseKey()`, `checkLicense()`
- `popup.js` — activation UI
- `background.js` — `verifyLicenseKey()`, `autoLicenseCheck()`
- `content.js` — `checkLicense()`, gates Generate / Apply

### 3. WhatsApp payment — manual

Plans open WhatsApp with pre-filled plan and price. You confirm payment and create the license document in Firebase.

WhatsApp number and message are set in `shipping_optimizer_config/app`.

---

## What you need to do

| Task | Where |
|------|--------|
| Set pricing & WhatsApp | Firebase → `shipping_optimizer_config/app` |
| Add demo promo codes | `app.demo_keys` map or `shipping_optimizer_demo_keys` collection |
| Issue paid licenses | Firebase → `shipping_optimizer_licenses/{KEY}` |
| Quick trial test | Use `MEESHO-DEMOFREE` (works even before Firebase is seeded) |

---

## Quick test

1. Seed Firebase (see `FIREBASE_SETUP.md`)
2. Reload extension
3. Open popup → enter `MEESHO-DEMOFREE` → **Activate License**
4. Status should show **Active**
5. Open optimizer on Meesho → Generate should work

For paid keys, create the license document in Firebase before the user activates.
