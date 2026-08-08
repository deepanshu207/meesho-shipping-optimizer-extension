# Firebase setup — Shipping Optimizer (extension-e6e32)

The extension uses the dedicated **extension-e6e32** Firebase project for license verification, pricing, demo promo codes, and WhatsApp settings.

**Important:** All data lives in collections prefixed with `shipping_optimizer_`. The extension does **not** read or write any other project's data. The old `swagstree-web` project is no longer used.

## Project config (in `config.js`)

```javascript
FIREBASE: {
  apiKey: "AIzaSyDJd0Ufed0zwCHYmakz-WcncU_NSWxkJ1U",
  authDomain: "extension-e6e32.firebaseapp.com",
  projectId: "extension-e6e32",
  storageBucket: "extension-e6e32.firebasestorage.app",
  messagingSenderId: "860976240598",
  appId: "1:860976240598:web:e5d903d52db5b71e48b677",
  measurementId: "G-WCTXFCDXLT",
}
```

The Firestore REST base URL is derived automatically from `projectId`, so this block is the single source of truth.

## Collections

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `shipping_optimizer_config` | `app` | Pricing plans, WhatsApp number/message, optional inline demo keys, **google_trial** settings |
| `shipping_optimizer_demo_keys` | License key (e.g. `MEESHO-DEMOFREE`) | Promo / demo keys with expiry days |
| `shipping_optimizer_licenses` | Paid license key | Activation, machine binding, expiry |
| `shipping_optimizer_google_trials` | Firebase Auth `uid` | One Google trial per account (email + uid stored; image run limits) |

## Google free trial (v1.6.3+) — Spark plan (no Cloud Function)

Users sign in with **Google (Gmail)**. The extension writes to `shipping_optimizer_google_trials/{uid}` using the user's **Firebase ID token**. **Firestore security rules** enforce one trial per Google account, trial length, trial credits, and device limits — works on the **free Spark plan** (no Blaze / Cloud Functions required).

**Trial credits vs paid credits:** Google trial grants a separate pool of **trial credits** (e.g. 3 free generation runs). Those are consumed **first**. After trial credits are used up, the extension charges **paid plan credits** from any activated license on the same device. Google trial stacks with paid keys — it does not replace them.

### OAuth redirect URIs (Chrome + Kiwi mobile)

Google sign-in uses `chrome.identity.getRedirectURL()`:

```
https://<EXTENSION_ID>.chromiumapp.org/
```

### Chrome Extension OAuth client (recommended — Kiwi / mobile)

**Current Kiwi dev client (v1.6.9+):**

| Setting | Value |
|---------|--------|
| OAuth client type | **Chrome extension** |
| Item ID | `dhhlaikkdfkaofbiacpoaadfademdmne` |
| Client ID | `860976240598-lfncv478meb0hel45vr3elf8fu5muv17.apps.googleusercontent.com` |

Set in:
- `manifest.json` → `oauth2.client_id`
- Firestore `google_trial.oauth_client_id`
- Firebase Console → Authentication → Google → Web client ID

**OAuth consent screen:** If app is in **Testing**, add each Gmail as a **test user** — otherwise sign-in is blocked even with a correct OAuth client.

Extension v1.6.8+ uses `chrome.identity.getAuthToken` (Chrome extension client) then falls back to `launchWebAuthFlow` (Web client + redirect URIs).

**You do NOT add a redirect URI per user.** Every customer who installs the **same** extension build shares the same extension ID.

| Install method | Extension ID | Who shares it |
|----------------|--------------|---------------|
| **Chrome Web Store** (recommended) | One fixed store ID | **All** Chrome + Kiwi users who install from the store |
| Unpacked / dev load on desktop | e.g. `kgnmnoaobnpfaaipnjkkidekbajpldlm` | Only that dev install |
| Unpacked / dev load on Kiwi | e.g. `dhhlaikkdfkaofbiacpoaadfademdmne` | Only that Kiwi install |

**For production (all mobile users):** publish to Chrome Web Store, then add **one** redirect URI for the store extension ID.

**For your current Kiwi dev install**, add this redirect URI in Google Cloud → Credentials → OAuth **Web application** client → **Authorized redirect URIs**:

```
https://dhhlaikkdfkaofbiacpoaadfademdmne.chromiumapp.org/
```

If you also test on desktop dev build, add both (trailing slash required):

```
https://kgnmnoaobnpfaaipnjkkidekbajpldlm.chromiumapp.org/
https://dhhlaikkdfkaofbiacpoaadfademdmne.chromiumapp.org/
```

After saving in Google Cloud, wait **1–2 minutes** before retrying sign-in.

The extension popup shows **OAuth redirect (admin)** under the Google button so you can copy the exact URI for the device you are on.

### Prerequisites

1. **Firebase Authentication** → enable **Google** provider.
2. **Google Cloud OAuth** → Web application client + redirect URI `https://<EXTENSION_ID>.chromiumapp.org/`
3. Firestore `shipping_optimizer_config/app` → `google_trial.oauth_client_id`
4. **Deploy Firestore rules** from repo `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules --project extension-e6e32
   ```

### App config — `google_trial`

```json
{
  "google_trial": {
    "google_login_enabled": true,
    "enabled": true,
    "days": 7,
    "trial_credits": 3,
    "image_run_limit": 3,
    "max_increment_per_run": 10,
    "max_devices": 1,
    "label": "Google free trial",
    "oauth_client_id": "860976240598-lfncv478meb0hel45vr3elf8fu5muv17.apps.googleusercontent.com",
    "chrome_extension_id": "dhhlaikkdfkaofbiacpoaadfademdmne"
  }
}
```

| Field | Notes |
|-------|-------|
| `google_login_enabled` | `false` hides **Continue with Google** in extension (independent toggle) |
| `enabled` | `false` blocks **new** trial claims; existing trials still refresh |
| `days` | Trial validity (rules enforce max expiry window) |
| `trial_credits` | Free generation runs per Google account (preferred field; default **3**) |
| `image_run_limit` | Alias for `trial_credits` (legacy) |
| `credits` | Legacy alias for `trial_credits` |
| `max_increment_per_run` | Max runs deducted per request (anti-cheat; default 10) |
| `max_devices` | Devices per trial (enforced in rules + extension) |
| `oauth_client_id` | **Chrome Extension** OAuth client ID (not Web client) — must match `manifest.json` `oauth2.client_id` |
| `chrome_extension_id` | Extension Item ID used when creating the Chrome Extension OAuth client (admin reference) |

### Trial document (`shipping_optimizer_google_trials/{uid}`)

| Field | Notes |
|-------|-------|
| `google_uid` | Firebase Auth uid (doc id) |
| `email` | Gmail from Google sign-in |
| `images_limit` | Copied from `trial_credits` / config at create (immutable) |
| `trial_credits` | Same value stored at create for admin clarity |
| `images_used` | Trial credits consumed (incremented per generation run) |
| `expires_at` | Set at first sign-in + `days` |
| `machine_ids` | Devices used |

**Misuse prevention:** Rules block second trial doc for same uid, block changing `images_limit` / `expires_at`, only allow `images_used` to increase (capped per request). Admin can list trials in Firebase Console or Swagstree admin.

### Optional Cloud Function (Blaze only)

Repo `functions/claimGoogleTrial` is optional if you upgrade to Blaze later. Extension v1.6.3+ uses Firestore rules path by default.

### Trial license documents (legacy / optional)

Created automatically by the function at `shipping_optimizer_licenses/GTRIAL-…`:

- `plan_type`: `google_trial`
- `google_uid`, `customer_email` — bound to Google account
- `expiresAt` — set at claim time from `google_trial.days`
- `trial`: `true`, `source`: `google_auth`
- One row per Google UID in `shipping_optimizer_google_trials/{uid}`

**Security:** Clients cannot create trial licenses directly. Only the Cloud Function (Admin SDK) writes trial + license docs. Re-claim returns the same license if still valid; expired trials return `trialExpired: true`.

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

You can change prices, add/remove plans, or update WhatsApp in Firebase Console or your admin panel — the extension popup and license modal fetch fresh plans on each open; background checks use a 5‑minute config cache.

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
| `order` | No | Sort order (lower first) |
| `max_devices` | No | Device limit (`1` default; `0` = unlimited devices) |
| `device_tier` | No | `standard` \| `family` \| `friends` \| `unlimited` |
| `billing_mode` | No | `subscription` \| `credits` \| `hybrid` |
| `plan_kind` | No | Free label: `subscription`, `lifetime`, `unlimited`, `enterprise`, `custom`, etc. |
| `included_credits` | No | Starting credits for credits/hybrid plans |
| `unlimited_time` | No | `true` = never expires (or set `days: 0`) |
| `unlimited_devices` | No | `true` = no device cap (or `max_devices: 0`) |
| `unlimited_credits` | No | `true` = never deduct credits |
| `allow_credit_addons` | No | `true` = show per-plan credit add-on chips under the plan |
| `max_addon_selections` | No | Max add-ons a customer can pick (`1` = radio/pick one, `0` = unlimited multi-select) |
| `credit_addons` | No | Array of add-on objects (see below) |
| `description` | No | Short text on plan detail screen |
| `highlights` | No | String array — pills on plan detail |
| `features` | No | Array of `{ icon, title, text }` or strings |
| `detail_sections` | No | Array of `{ title, body, items[] }` for extra blocks |

**Plan detail screen:** Tapping a plan in the popup or license modal opens a detail view (with ← Back) showing all fields above plus add-ons and **Buy via WhatsApp**.

### Support team list (`support` on app doc)

Paginated contact list for WhatsApp support/upgrade:

```json
"support": {
  "enabled": true,
  "title": "Support team",
  "page_size": 5,
  "users": [
    {
      "id": "sales",
      "name": "Deepanshu",
      "role": "Sales",
      "label": "Plans & upgrades",
      "whatsapp_number": "919654414891",
      "whatsapp_message": "Hi! I need help with Shipping Optimizer.",
      "active": true,
      "order": 0
    }
  ]
}
```

When `support.users` is configured, **WhatsApp Support** and **Upgrade** open this list with Prev/Next pagination. Each row opens WhatsApp (mobile: app via `whatsapp://`; desktop: `wa.me`).

### Per-plan credit add-ons

A plan can offer optional credit top-ups the customer selects **before** buying. Add-ons appear as chips under the plan; selections are included in the WhatsApp purchase message and, once you create the license, granted on activation.

Each entry in `credit_addons[]`:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Stable slug (e.g. `addon_25`) |
| `credits` | Yes | Credits this add-on grants |
| `price` | Yes | INR price added to the plan total |
| `label` | No | Chip/label text (default `+{credits} credits`) |
| `active` | No | `false` hides it; default `true` |
| `default_selected` | No | `true` pre-selects the chip in the UI |
| `order` | No | Sort order (lower first) |

**Example plan with add-ons:**
```json
{
  "id": "yearly",
  "name": "Yearly",
  "price": 3099,
  "days": 365,
  "billing_mode": "hybrid",
  "included_credits": 100,
  "allow_credit_addons": true,
  "max_addon_selections": 2,
  "credit_addons": [
    { "id": "addon_25", "credits": 25, "price": 40, "label": "+25 credits", "order": 0, "default_selected": false },
    { "id": "addon_50", "credits": 50, "price": 70, "label": "+50 credits", "order": 1 },
    { "id": "addon_100", "credits": 100, "price": 130, "label": "+100 credits", "order": 2 }
  ]
}
```

**Rules & edge cases:**
- `unlimited_credits: true` → add-ons are hidden (nothing to add).
- `subscription` plans may still define add-ons; the add-on credits are stored on the license (`addon_credits`) for hybrid use.
- Credits-only plan with `included_credits: 0` but add-ons allowed → balance = selected add-on total.
- Inactive add-ons are never shown.
- `default_selected` chips are pre-highlighted.

**On the license doc**, you (or the admin panel) can pre-set which add-ons the customer paid for so activation grants the right balance:
```json
{
  "planId": "yearly",
  "billing_mode": "hybrid",
  "included_credits": 100,
  "addon_credit_ids": ["addon_50"],
  "addon_credits": 50,
  "credits_balance": 0
}
```
On first activation the extension resolves credits in priority order:
1. `credits_balance` if already > 0
2. `included_credits` + `addon_credits` (if set on the license)
3. `plan.included_credits` + sum of add-ons in `addon_credit_ids`
4. `plan.included_credits` only

It then patches `included_credits`, `addon_credits`, `addon_credit_ids`, and `credits_balance` onto the license.

### Custom & unlimited plans

Add **any** plan to the `plans[]` array — the extension does not hardcode plan IDs. Examples:

**Lifetime / unlimited time:**
```json
{
  "id": "lifetime",
  "name": "Lifetime",
  "price": 9999,
  "days": 0,
  "duration": "Forever",
  "unlimited_time": true,
  "plan_kind": "lifetime",
  "billing_mode": "subscription",
  "max_devices": 1,
  "active": true
}
```

**Unlimited devices (enterprise):**
```json
{
  "id": "enterprise_unlimited",
  "name": "Enterprise Unlimited",
  "price": 14999,
  "days": 365,
  "unlimited_devices": true,
  "max_devices": 0,
  "plan_kind": "enterprise",
  "active": true
}
```

**Unlimited everything:**
```json
{
  "id": "unlimited_all",
  "name": "Unlimited Pro",
  "price": 19999,
  "days": 0,
  "unlimited_time": true,
  "unlimited_devices": true,
  "unlimited_credits": true,
  "plan_kind": "unlimited",
  "billing_mode": "hybrid",
  "active": true
}
```

**Custom pay-as-you-go plan:**
```json
{
  "id": "credits_starter",
  "name": "Credits Starter",
  "price": 99,
  "days": 0,
  "billing_mode": "credits",
  "included_credits": 50,
  "plan_kind": "custom",
  "active": true
}
```

License documents can **override** any plan field (`max_devices`, `unlimited_*`, `credits_balance`, `billing_mode`) per customer.

**Update a plan:** change `price`, `name`, `days`, etc. Existing licenses keep their stored `planDays` from creation time.

**Remove a plan:** either set `active: false` (recommended — hides from UI, keeps legacy `planId` lookups working) or delete the row from the array (only if no licenses use that `planId`).

Legacy object-shaped `pricing` maps are still supported: `{ "yearly": { "price": 3099, ... } }` — prefer the `plans` array for new configs.

### Device limits (multi-device plans)

| Plan field | Default | Description |
|------------|---------|-------------|
| `max_devices` | `1` | How many devices can use one license key |
| `device_tier` | `standard` | Label: `standard` (1), `family` (e.g. 3), `friends` (e.g. 5) — cosmetic; `max_devices` is what counts |

**Standard plan:** 1 device (default). **Family / Friends plans:** set `max_devices` to 3, 5, etc. in Firebase.

On activation the extension stores registered devices in `device_ids[]` (legacy `machineId` still supported for old licenses).

**Device ID on Kiwi mobile:** The extension generates a stable ID per browser profile (e.g. `M1A2B3C4D5E6`) stored in `chrome.storage.local`. Kiwi on Android uses the same check — same Kiwi profile = same ID; different browser or cleared data = new ID.

### Credits (pay-as-you-go)

Add to `shipping_optimizer_config/app`:

```json
{
  "credits": {
    "enabled": true,
    "price_per_credit": 2,
    "min_purchase": 10,
    "cost_per_operation": 1,
    "packs": [
      { "id": "pack_10", "credits": 10, "price": 20, "label": "10 Credits", "active": true, "order": 0 },
      { "id": "pack_20", "credits": 20, "price": 38, "label": "20 Credits", "active": true, "order": 1 },
      { "id": "pack_50", "credits": 50, "price": 90, "label": "50 Credits", "active": true, "order": 2 },
      { "id": "pack_100", "credits": 100, "price": 170, "label": "100 Credits", "active": true, "order": 3 }
    ]
  }
}
```

| Field | Description |
|-------|-------------|
| `price_per_credit` | Default ₹2/credit (for custom amounts, min `min_purchase`) |
| `min_purchase` | Minimum credits per top-up (default 10) |
| `cost_per_operation` | Credits deducted per optimize/apply (default 1) |
| `packs[]` | Top-up bundles — each with `credits`, `price`, `active`, `order` |

**Billing modes** on license (`billing_mode`):

| Mode | Access rule |
|------|-------------|
| `subscription` | Valid while not expired — **never expires** when `unlimited_time: true`, `plan_kind: lifetime`, plan `days: 0`, or `expiresAt` left empty |
| `credits` | Valid while `credits_balance` > 0 (or `unlimited_credits`) |
| `hybrid` | Valid while **(not expired OR unlimited_time)** AND **(has credits OR unlimited_credits)** |

**Never-expiring licenses** — any of:
- `unlimited_time: true` on plan or license (clears/ignores `expiresAt`)
- `plan_kind: "lifetime"` or `"unlimited"`
- Plan `days: 0`
- Admin leaves `expiresAt` empty on a subscription license (open-ended)

Extension shows **Never expires** / **Lifetime** badge — no expiry countdown.

**Stacked keys:** A lifetime `subscription` key stays active even if a separate credit top-up key runs out of balance.

When credits run out on a hybrid plan, user buys a pack via WhatsApp → admin adds to `credits_balance` on their license.

### AI image generation limits (`credits.image_generation`)

Control how many **generation runs** users can start and whether each run costs credits. One run = one upload → variant generation (20, 50, or 100 variants still count as **1** run; stopping mid-run also counts as **1**).

Add an `image_generation` object inside `credits` on `shipping_optimizer_config/app`:

```json
{
  "credits": {
    "enabled": true,
    "image_generation": {
      "enabled": true,
      "credits_per_image": 2,
      "daily_limit": 20,
      "monthly_limit": 0,
      "max_batch_size": 100
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `enabled` | `false` blocks all AI image generation with a message. Default `true`. |
| `credits_per_image` | Credits charged **per generation run** (`0` = free). Only applies to `credits`/`hybrid` licenses — subscription/unlimited plans generate free. Field name kept for compatibility. |
| `daily_limit` | Max **runs** per day per license (`0` = unlimited). Resets at local midnight. |
| `monthly_limit` | Max **runs** per calendar month (`0` = unlimited). Resets on the 1st. |
| `max_batch_size` | Max **variants** allowed in a single run (`0` = unlimited). Does not affect how runs are counted. |

**Behavior & flexibility:**
- If the whole `image_generation` object is **absent**, nothing changes — the extension keeps its existing behavior (1 credit per operation for credit plans).
- Once present, the extension enforces these limits client-side **before** generating and persists counters **after** each run starts (including stopped runs with zero results).
- Fully flexible: set every value to `0` (and `enabled: true`) for unlimited free generation; tighten any field to throttle.
- `unlimited_credits` licenses never pay per run (quota/limit checks still apply).

**Counters written to the license doc** (`shipping_optimizer_licenses/{key}`) after each run:

| Field | Description |
|-------|-------------|
| `images_generated_total` | Lifetime generation runs (field name kept for compatibility) |
| `images_generated_today` | Runs today (reset when the date changes) |
| `images_generated_today_date` | `YYYY-MM-DD` of the current day counter |
| `images_generated_month` | Runs this month (reset when the month changes) |
| `images_generated_month_key` | `YYYY-MM` of the current month counter |

Credits are deducted from `credits_balance` (→ `credits_used`) at `credits_per_image` **per run** (not per variant). The extension shows remaining quota and the credit cost before generating, and blocks with a clear message when a limit is hit or credits are insufficient.

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
  "billing_mode": "subscription",
  "max_devices": 1,
  "device_ids": [],
  "credits_balance": 0,
  "credits_used": 0,
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

**Credits-only license example:**

```json
{
  "active": true,
  "planId": "credits_50",
  "billing_mode": "credits",
  "max_devices": 1,
  "credits_balance": 50,
  "credits_used": 0,
  "device_ids": [],
  "expiresAt": "",
  "machineId": "",
  "activatedAt": ""
}
```

**Family plan example** (`max_devices: 3`):

```json
{
  "planId": "family_yearly",
  "max_devices": 3,
  "billing_mode": "subscription",
  "planDays": 365
}
```

- **`planDays`** — copied from the plan at creation; expiry = activation time + this many days.
- **`max_devices`** — copied from plan; default `1`. Family/friends plans use 3, 5, etc.
- **`device_ids`** — array of registered device IDs; extension appends on activation until limit reached.
- **`billing_mode`** — `subscription` | `credits` | `hybrid`.
- **`credits_balance`** / **`credits_used`** — for pay-as-you-go; admin tops up after payment.
- **`expiry_starts_on_activation`** — default `true`: `expiresAt` is set when the user first activates (not when you create the key).
- **`expiresAt`** — leave empty until activation (recommended), or set a fixed date to override.
- **Optional support fields:** `customer_name`, `customer_phone`, `customer_email`, `support_notes` (extension ignores these; for your admin UI only).
- Legacy `machineId` (single string) still works — treated as one device in `device_ids`.
- Set `active: false` to revoke a license.

## Firestore security rules

These are the full rules for the dedicated **extension-e6e32** project (it only hosts `shipping_optimizer_*` data).

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isShippingOptimizerSuperAdmin() {
      return request.auth != null
        && request.auth.token.email == 'superadmin@swagstree.com';
    }

    // Shipping Optimizer — extension reads; admin panel writes config/licenses
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
        .hasOnly([
          'machineId', 'device_ids', 'max_devices', 'billing_mode',
          'unlimited_time', 'unlimited_devices', 'unlimited_credits',
          'activatedAt', 'lastVerifiedAt', 'expiresAt',
          'credits_balance', 'credits_used',
          'included_credits', 'addon_credits', 'addon_credit_ids',
          'images_generated_total', 'images_generated_today',
          'images_generated_today_date', 'images_generated_month',
          'images_generated_month_key'
        ]);
    }

    // Google trials — admin read; writes only via Cloud Function (Admin SDK bypasses rules)
    match /shipping_optimizer_google_trials/{uid} {
      allow read: if isShippingOptimizerSuperAdmin();
      allow write: if false;
    }
  }
}
```

Your admin panel (or Firebase Console) manages config, demo keys, and licenses on **extension-e6e32**. The extension patches device binding, activation timestamps, expiry, and credit usage on paid licenses.

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

## Project summary

- **Project:** `extension-e6e32` (dedicated to the extension)
- **Collections prefix:** `shipping_optimizer_*` only
- **No Analytics SDK** in the extension (Firestore REST API only)
- **Admin writes:** `superadmin@swagstree.com` only
