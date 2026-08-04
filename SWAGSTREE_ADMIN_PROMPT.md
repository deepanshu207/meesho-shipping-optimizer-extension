# Swagstree superadmin prompt — Shipping Optimizer extension

Copy everything below the line into Cursor (or your agent) in the **Swagstree** repo (`deepanshu207/swagstree`).

---

## Prompt (copy from here)

Build a **Shipping Optimizer Extension** admin panel inside the existing Swagstree **Superadmin** tab. This manages the Meesho Chrome extension license backend in Firebase. **Do not read or write any other Swagstree storefront collections** — only `shipping_optimizer_*` collections.

### Context

- **Firebase project:** `swagstree-web` (already used by Swagstree)
- **Extension repo (reference only):** `deepanshu207/meesho-shipping-optimizer-extension` — see `FIREBASE_SETUP.md` and `ACTIVATION_GUIDE.md` for schema and flows
- **Access:** Only `superadmin@swagstree.com` can write; match existing superadmin gating (`isSuperAdmin`)
- **UI location:** Superadmin tab → new section **"Shipping Optimizer Extension"** with 3 sub-tabs

### Firestore collections (isolated prefix)

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `shipping_optimizer_config` | `app` | WhatsApp, plans, inline demo keys, announcement, kill switch |
| `shipping_optimizer_demo_keys` | `{KEY}` uppercase | Extra promo codes (optional collection) |
| `shipping_optimizer_licenses` | `{LICENSE_KEY}` | Paid licenses + device binding |

### Firestore security rules (merge into existing rules)

```javascript
function isShippingOptimizerSuperAdmin() {
  return request.auth != null
    && request.auth.token.email == 'superadmin@swagstree.com';
}

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
```

The Chrome extension only patches `machineId`, `activatedAt`, `lastVerifiedAt`, `expiresAt` on paid licenses during customer activation.

---

## Tab 1: Config & Pricing

Load/save `shipping_optimizer_config/app`:

```json
{
  "whatsapp_number": "919654414891",
  "whatsapp_message": "Hi! I want to purchase Shipping Optimizer license.",
  "extension_enabled": true,
  "min_extension_version": "1.0.0",
  "announcement": "",
  "plans": [],
  "demo_keys": {
    "MEESHO-DEMOFREE": { "days": 30, "label": "Free 30-day trial" }
  },
  "updatedAt": "<serverTimestamp>",
  "updatedBy": "<auth email>"
}
```

### Config fields UI

- **WhatsApp number** — digits only, country code included (default `919654414891`)
- **WhatsApp message** — pre-filled text when user taps a plan in extension
- **Min extension version** — string, e.g. `1.0.0`
- **Announcement** — optional banner text shown in extension popup/modal
- **Extension enabled** — checkbox; when `false`, block new paid activations

### Pricing plans editor (`plans` array)

The extension reads **active** plans only. Inactive plans stay in Firebase for existing licenses that reference them.

Each plan object:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Stable slug (`yearly`, `monthly`). **Never rename** after licenses issued |
| `name` | Yes | Display name |
| `price` | Yes | INR integer |
| `days` | Yes | License duration; expiry = activation + days |
| `duration` | No | Short label, e.g. `1 Year` |
| `save` | No | Badge, e.g. `Save ₹8000` |
| `best` | No | One plan gets "BEST VALUE" in extension |
| `active` | No | `false` hides from extension; default `true` |
| `order` | No | Sort order (lower first); set from row position |

**Plan editor actions:**
- **+ Add Plan** — append row with defaults
- **▲ / ▼** — reorder (update `order` from index)
- **Show** checkbox — maps to `active` (soft hide)
- **✕** — remove row from array (only if no licenses use that `planId`)
- Validate: unique IDs, non-empty name, price ≥ 0, days ≥ 1

**Slugify plan IDs:** lowercase, spaces → `_`, strip invalid chars.

Default seed plans if empty:
- monthly ₹599 / 30d
- quarterly ₹1399 / 90d
- halfyearly ₹2299 / 180d
- yearly ₹3099 / 365d (best)

### Inline demo keys editor (`demo_keys` map on config doc)

Key-value editor for quick promo codes stored in config:
- Key: uppercase, e.g. `MEESHO-DEMOFREE`
- `days`: number
- `label`: optional string
- **+ Add Key** / **✕ Remove**

### Save button

- `db.collection('shipping_optimizer_config').doc('app').set(payload, { merge: true })`
- Show toast on success/error
- Set `updatedAt: firebase.firestore.FieldValue.serverTimestamp()`

---

## Tab 2: Demo / Promo Keys (collection)

Optional extra promos in `shipping_optimizer_demo_keys/{KEY}` (merged with inline `demo_keys` in extension).

**List** existing docs with: key, days, label, active status.

**Add form:**
- Key (uppercase, min 6 chars)
- Days
- Label
- `active: true` on create

**Per-row actions:**
- Enable / Disable (`active` toggle)
- Delete document

Document shape:
```json
{
  "days": 30,
  "label": "Summer promo",
  "active": true,
  "createdAt": "<timestamp>"
}
```

---

## Tab 3: Paid Licenses

Manage `shipping_optimizer_licenses/{LICENSE_KEY}`.

### Create license form

| Field | Required | Notes |
|-------|----------|-------|
| License key | Auto or manual | Format `MEESHO-XXXX-XXXX-XXXX` |
| Plan | Dropdown | From active `plans` in config; copies `planId` + `planDays` |
| Customer name | Optional | `customer_name` |
| Customer phone | Optional | `customer_phone` |
| Customer email | Optional | `customer_email` |
| Support notes | Optional | `support_notes` |

**Generate key (🎲):**
```
MEESHO-{4 random}-{4 random}-{4 random}
```
Uppercase alphanumeric segments. Check uniqueness against:
1. `shipping_optimizer_licenses`
2. `shipping_optimizer_demo_keys`
3. `demo_keys` map in config doc

Retry up to 12 times on collision.

**On create, write:**
```json
{
  "active": true,
  "planId": "<selected>",
  "planType": "<selected>",
  "planDays": <from plan.days>,
  "expiry_starts_on_activation": true,
  "expiresAt": "",
  "machineId": "",
  "activatedAt": "",
  "customer_name": "",
  "customer_phone": "",
  "customer_email": "",
  "support_notes": "",
  "createdAt": "<serverTimestamp>",
  "createdBy": "<auth email>"
}
```

Show hint: *"Expiry starts when customer activates: {planDays} days from activation date."*

### License list

Load up to 200 licenses, order by `expiresAt` desc (fallback: unsorted limit 200).

**Search/filter** by: key, `machineId`, `planId`/`planType`.

**Each row shows:**
- License key (monospace)
- Customer name + phone (if set)
- Support notes (if set)
- Plan + planDays
- Status: Not activated yet / Activated date / Expires date (expired badge if past)
- Device ID (`machineId` or `—`)
- Active / Revoked badge

**Per-row actions:**
- **Revoke / Activate** — toggle `active` (confirm on revoke)
- **Reset device** — clear `machineId` and `activatedAt` (confirm); lets customer activate on new device
- **Delete** — remove doc (confirm + type `DELETE`)

### Activation flow (for your reference in UI tooltips)

1. Customer taps plan in extension → WhatsApp opens
2. After payment, you create license here and send key
3. Customer enters key in extension → extension sets `machineId`, `activatedAt`, `expiresAt = now + planDays`
4. One device per key; reset device if they change PC

---

## Technical requirements

1. **Match existing Swagstree superadmin styling** — dark theme, `btn-gold`, same fonts/spacing as other superadmin sections
2. **Use existing Firebase `db` and `auth`** — same as rest of Swagstree app
3. **Gate all writes** behind superadmin check; show toast if unauthorized
4. **Load on superadmin tab open** — hook into existing `navigateToCore` when `id === 'super'`
5. **Files to add:**
   - `js/shipping-optimizer-admin.js` — all logic
   - HTML block in `index.html` inside `#super-view` (before other superadmin sections)
   - Script tag: `<script src="js/shipping-optimizer-admin.js?v=1.0"></script>` before `bind-globals.js`
   - In `js/app.js` super tab handler: `if (typeof loadShippingOptimizerAdmin === 'function') loadShippingOptimizerAdmin();`
6. **Do not touch** Swagstree products, orders, users, or any non-`shipping_optimizer_*` collections
7. **Escape HTML** in all dynamic renders to prevent XSS

---

## Default config seed (if `app` doc missing)

```javascript
{
  whatsapp_number: '919654414891',
  whatsapp_message: 'Hi! I want to purchase Shipping Optimizer license.',
  extension_enabled: true,
  min_extension_version: '1.0.0',
  announcement: '',
  plans: [
    { id: 'monthly', name: 'Monthly', price: 599, days: 30, duration: '1 Month', save: '', best: false, active: true, order: 0 },
    { id: 'quarterly', name: '3 Months', price: 1399, days: 90, duration: '3 Months', save: 'Save ₹1000', best: false, active: true, order: 1 },
    { id: 'halfyearly', name: '6 Months', price: 2299, days: 180, duration: '6 Months', save: 'Save ₹3000', best: false, active: true, order: 2 },
    { id: 'yearly', name: 'Yearly', price: 3099, days: 365, duration: '1 Year', save: 'Save ₹8000', best: true, active: true, order: 3 },
  ],
  demo_keys: {
    'MEESHO-DEMOFREE': { days: 30, label: 'Free 30-day trial' },
  },
}
```

---

## Verify after implementation

1. Log in as `superadmin@swagstree.com` → Superadmin → Shipping Optimizer
2. Save config with custom plan price → reload extension popup → price matches
3. Add plan, reorder, hide with `active: false` → only active plans show in extension
4. Create test license → activate in extension → `machineId` and `expiresAt` populate in Firebase
5. Reset device → customer can re-activate on new machine
6. Revoke license → extension rejects on next check

---

## Reference docs (extension repo)

- `FIREBASE_SETUP.md` — full schema + rules
- `ACTIVATION_GUIDE.md` — key generation, expiry, support workflow
