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
  "extension_enabled": true,
  "min_extension_version": "1.0.0",
  "announcement": "",
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

You can change prices, add/remove plans, or update WhatsApp here — the extension popup and license modal fetch fresh plans on each open; background checks use a 5‑minute config cache.

**Easiest way to manage:** Swagstree → **Superadmin** tab → **Shipping Optimizer Extension** panel (Config & Pricing / Demo Keys / Paid Licenses).

### Flexible pricing plans

Plans live in the `plans` array on `shipping_optimizer_config/app`. The extension reads **active** plans only; inactive plans stay in Firebase for existing licenses that reference them.

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Stable slug (e.g. `yearly`, `lifetime`). Used in license `planId` — do not rename after customers have keys. |
| `name` | Yes | Display name in popup/modal |
| `price` | Yes | INR price shown on plan button |
| `days` | Yes | License duration in days (applied on activation) |
| `duration` | No | Short label (e.g. `1 Year`) |
| `save` | No | Badge text (e.g. `Save ₹8000`) |
| `best` | No | Highlight as "BEST VALUE" (only one shown) |
| `active` | No | `false` hides from extension; default `true` |
| `order` | No | Sort order (lower first); admin UI sets from row position |

**Add a plan:** append a new object to `plans` (or use **+ Add Plan** in superadmin) and save. Set `plans_version` to a new timestamp so clients refresh immediately.

**Update a plan:** change `price`, `name`, `days`, etc. Existing licenses keep their stored `planDays` from creation time.

**Remove a plan:** either set `active: false` (recommended — hides from UI, keeps legacy `planId` lookups working) or delete the row from the array (only if no licenses use that `planId`).

Legacy object-shaped `pricing` maps are still supported: `{ "yearly": { "price": 3099, ... } }` — prefer the `plans` array for new configs.

`plans_version` (number/timestamp) is optional but recommended — the extension bypasses its 5‑minute cache when this value changes.

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
  "planId": "yearly",
  "planType": "yearly",
  "planDays": 365,
  "expiry_starts_on_activation": true,
  "expiresAt": "",
  "machineId": "",
  "activatedAt": "",
  "customer_name": "Rahul Kumar",
  "customer_phone": "919876543210",
  "customer_email": "",
  "support_notes": "Paid UPI 4 Aug 2026 — yearly plan",
  "createdAt": "<timestamp>",
  "createdBy": "superadmin@swagstree.com"
}
```

- **`planDays`** — copied from the plan at creation; expiry = activation time + this many days.
- **`expiry_starts_on_activation`** — default `true`: `expiresAt` is set when the user first activates (not when you create the key).
- **`expiresAt`** — leave empty until activation (recommended), or set a fixed date to override.
- **Optional support fields:** `customer_name`, `customer_phone`, `customer_email`, `support_notes` (extension ignores these; for your admin UI only).
- If `machineId` is already set on another device, activation is rejected.
- Set `active: false` to revoke a license.

## Firestore security rules

**Merge** these rules into your existing Swagstree rules — do not replace the whole file.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isShippingOptimizerSuperAdmin() {
      return request.auth != null
        && request.auth.token.email == 'superadmin@swagstree.com';
    }

    // ... your existing Swagstree rules ...

    // Shipping Optimizer — extension reads; superadmin manages via Swagstree panel
    match /shipping_optimizer_config/{doc} {
      allow read: if true;
      allow write: if isShippingOptimizerSuperAdmin();
    }

    match /shipping_optimizer_demo_keys/{key} {
      allow read: if true;
      allow write: if isShippingOptimizerSuperAdmin();
    }

    match /shipping_optimizer_licenses/{key} {
      allow read: if true;
      allow create, update, delete: if isShippingOptimizerSuperAdmin();
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['machineId', 'activatedAt', 'lastVerifiedAt', 'expiresAt']);
    }
  }
}
```

Superadmin manages config, demo keys, and licenses from **Swagstree → Superadmin → Shipping Optimizer Extension**. The extension only patches `machineId` / `activatedAt` / `lastVerifiedAt` on paid licenses during customer activation.

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
