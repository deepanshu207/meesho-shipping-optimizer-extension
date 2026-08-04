# Firebase setup — Shipping Optimizer (swagstree-web)

The extension uses your existing **swagstree-web** Firebase project for license verification, pricing, demo promo codes, and WhatsApp settings.

**Important:** All data lives in collections prefixed with `shipping_optimizer_`. This does **not** read or write Swagstree app collections.

## Collections

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `shipping_optimizer_config` | `app` | Pricing plans, WhatsApp number/message, optional inline demo keys |
| `shipping_optimizer_demo_keys` | License key (e.g. `MEESHO-DEMOFREE`) | Promo / demo keys with expiry days |
| `shipping_optimizer_licenses` | Paid license key | Activation, machine binding, expiry |

## 1. App config (`shipping_optimizer_config/app`)

Create document **`app`** with fields:

```json
{
  "whatsapp_number": "919654414891",
  "whatsapp_message": "Hi! I want to purchase Shipping Optimizer license.",
  "plans": [
    {
      "id": "monthly",
      "name": "Monthly",
      "price": 599,
      "days": 30,
      "duration": "1 Month",
      "active": true
    },
    {
      "id": "quarterly",
      "name": "3 Months",
      "price": 1399,
      "days": 90,
      "duration": "3 Months",
      "save": "Save ₹1000",
      "active": true
    },
    {
      "id": "halfyearly",
      "name": "6 Months",
      "price": 2299,
      "days": 180,
      "duration": "6 Months",
      "save": "Save ₹3000",
      "active": true
    },
    {
      "id": "yearly",
      "name": "Yearly",
      "price": 3099,
      "days": 365,
      "duration": "1 Year",
      "save": "Save ₹8000",
      "best": true,
      "active": true
    }
  ],
  "demo_keys": {
    "MEESHO-DEMOFREE": { "days": 30 }
  }
}
```

You can change prices, add/remove plans, or update WhatsApp here — the extension popup and license modal refresh from Firebase (5‑minute cache).

## 2. Demo / promo keys (`shipping_optimizer_demo_keys/{KEY}`)

One document per promo code. Document ID = the key (uppercase recommended).

Example document ID: `MEESHO-DEMOFREE`

```json
{
  "days": 30,
  "active": true,
  "label": "Free 30-day trial"
}
```

Set `active: false` to disable a key without deleting it.

## 3. Paid licenses (`shipping_optimizer_licenses/{LICENSE_KEY}`)

Create a document when a customer pays. Document ID = license key.

```json
{
  "active": true,
  "planType": "yearly",
  "expiresAt": "2027-08-04T00:00:00.000Z",
  "machineId": "",
  "activatedAt": ""
}
```

- On first activation, the extension writes `machineId` and `activatedAt`.
- If `machineId` is already set on another device, activation is rejected.
- Set `active: false` to revoke a license.

## Firestore security rules

**Merge** these rules into your existing Swagstree rules — do not replace the whole file.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ... your existing Swagstree rules ...

    // Shipping Optimizer — public read, limited client write for activation
    match /shipping_optimizer_config/{doc} {
      allow read: if true;
      allow write: if false;
    }

    match /shipping_optimizer_demo_keys/{key} {
      allow read: if true;
      allow write: if false;
    }

    match /shipping_optimizer_licenses/{key} {
      allow read: if true;
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['machineId', 'activatedAt', 'lastVerifiedAt']);
      allow create, delete: if false;
    }
  }
}
```

Manage config, demo keys, and new licenses from **Firebase Console** or **Admin SDK** (server). The extension only patches `machineId` / `activatedAt` / `lastVerifiedAt` on paid licenses.

## Fallback chain

If Firebase is unreachable or documents are missing:

1. **Demo keys** → built-in keys in `config.js` (`MEESHO-DEMOFREE`, etc.)
2. **Paid licenses** → verification fails until Firebase is reachable
3. **Pricing** → default plans in `js/firebaseLicense.js`
4. **WhatsApp** → `CONFIG.DEFAULT_WHATSAPP` (`919654414891`)

## Disable Firebase

In `config.js` set:

```javascript
USE_FIREBASE_LICENSE: false
```

Only built-in demo keys and local defaults will work. Paid license verification requires Firebase.

## Testing

1. Seed `shipping_optimizer_config/app` in Firebase Console.
2. Reload the extension (`chrome://extensions`).
3. Open popup — plans should match Firebase.
4. Activate demo key `MEESHO-DEMOFREE` (works even without Firebase).
5. Create a test license in `shipping_optimizer_licenses` and activate it.

## Project config (already in extension)

- **Project:** `swagstree-web`
- **Collections prefix:** `shipping_optimizer_*` only
- **No Analytics SDK** in the extension (Firestore REST API only)
