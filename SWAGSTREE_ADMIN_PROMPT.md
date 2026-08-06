# Swagstree superadmin prompt — Shipping Optimizer extension (v1.2)

Copy everything below the line into Cursor in the **Swagstree** repo (`deepanshu207/swagstree`).

---

## Prompt (copy from here)

Build a **Shipping Optimizer Extension** admin panel in Swagstree **Superadmin** tab. Manages the Meesho Chrome extension license backend in the dedicated Firebase project `extension-e6e32` (NOT `swagstree-web`).

**CRITICAL:** Only read/write `shipping_optimizer_*` collections on the `extension-e6e32` project. Point this admin panel's Firebase access at `extension-e6e32`.

**Access:** `superadmin@swagstree.com` only — use existing `isSuperAdmin` gating.

**UI:** Superadmin → **Shipping Optimizer Extension** → 4 sub-tabs:
1. Config & Pricing
2. Credits & Packs
3. Demo / Promo Keys
4. Paid Licenses

Reference extension repo: `deepanshu207/meesho-shipping-optimizer-extension` → `FIREBASE_SETUP.md`, `ACTIVATION_GUIDE.md`

---

### Firestore collections

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `shipping_optimizer_config` | `app` | WhatsApp, plans[], credits{}, demo_keys{}, announcement |
| `shipping_optimizer_demo_keys` | `{KEY}` | Extra promo codes |
| `shipping_optimizer_licenses` | `{LICENSE_KEY}` | Paid licenses |

### Firestore rules (merge)

```javascript
function isShippingOptimizerSuperAdmin() {
  return request.auth != null && request.auth.token.email == 'superadmin@swagstree.com';
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
    .hasOnly([
      'machineId', 'device_ids', 'max_devices', 'billing_mode',
      'unlimited_time', 'unlimited_devices', 'unlimited_credits',
      'activatedAt', 'lastVerifiedAt', 'expiresAt',
      'credits_balance', 'credits_used'
    ]);
}
```

---

## TAB 1: Config & Pricing

Save to `shipping_optimizer_config/app`:

```json
{
  "whatsapp_number": "919654414891",
  "whatsapp_message": "Hi! I want to purchase Shipping Optimizer license.",
  "extension_enabled": true,
  "min_extension_version": "1.2.0",
  "announcement": "",
  "plans": [],
  "support": {
    "enabled": true,
    "title": "Support team",
    "page_size": 5,
    "users": [
      {
        "id": "sales",
        "name": "Deepanshu",
        "role": "Sales & licenses",
        "label": "New plans, upgrades, payments",
        "whatsapp_number": "919654414891",
        "whatsapp_message": "Hi! I need help with Shipping Optimizer.",
        "active": true,
        "order": 0
      }
    ]
  },
  "demo_keys": { "MEESHO-DEMOFREE": { "days": 30, "label": "Free trial" } }
}
```

**Plan detail screen (extension):** Tapping a plan opens a dedicated screen (popup + Meesho modal) with name, price, description, highlights, features, detail sections, add-ons, and **Buy via WhatsApp**. All fields above are read from Firebase — no extension update needed when you edit plans.

**Support team list (extension):** Footer **WhatsApp Support** and **Upgrade / WhatsApp** open a paginated contact list when `support.users` is configured. Each row opens WhatsApp to that person's number (mobile opens app directly; desktop opens wa.me). Admin controls `page_size` (default 5) for easy pagination.

### Support team editor (`support` on app doc)

| Field | Notes |
|-------|-------|
| `enabled` | `false` hides list — extension falls back to default `whatsapp_number` |
| `title` | Screen title e.g. "Support team" |
| `page_size` | Contacts per page in extension (`5` default) |
| `users[]` | Contact rows (see below) |

**User row fields:** `id`, `name`, `role`, `label` (subtitle), `whatsapp_number`, `whatsapp_message` (optional prefill), `active`, `order`

**Editor UI:** + Add contact, ▲/▼ reorder, Show toggle, ✕ remove. Preview pagination: "Page 1 of N". Extension shows ← Prev / Next → when more than `page_size` contacts.

```json
{
  "id": "billing",
  "name": "Billing",
  "role": "Payments",
  "label": "Invoices, UPI, credit top-ups",
  "whatsapp_number": "919654414891",
  "whatsapp_message": "Hi! I need billing help for Shipping Optimizer.",
  "active": true,
  "order": 1
}
```

**Example plan with detail fields:**

```json
{
  "id": "yearly",
  "name": "Yearly Hybrid",
  "price": 3099,
  "days": 365,
  "description": "Best for serious sellers — 1 year access plus credits for AI image runs.",
  "highlights": ["Live Meesho shipping", "Family device option"],
  "features": [
    { "icon": "📅", "title": "1 year access", "text": "Renews annually" },
    { "icon": "⚡", "title": "100 credits included", "text": "For AI generation runs" },
    "Unlimited variant previews"
  ],
  "detail_sections": [
    {
      "title": "What's included",
      "items": ["Smart mode up to 100 variants", "Apply best image to catalog", "Credit top-ups available"]
    }
  ],
  "billing_mode": "hybrid",
  "included_credits": 100,
  "allow_credit_addons": true,
  "credit_addons": [
    { "id": "addon_25", "credits": 25, "price": 40, "label": "+25 credits", "active": true, "order": 0 }
  ],
  "active": true,
  "order": 3,
  "best": true
}
```

### Plans editor — fully flexible `plans[]`

**+ Add Plan** for any custom plan (monthly, lifetime, unlimited, enterprise, credits-only, etc.). No hardcoded plan list in extension.

| Field | Required | Notes |
|-------|----------|-------|
| `id` | Yes | Stable slug — never rename after licenses issued |
| `name` | Yes | Display name |
| `price` | Yes | INR |
| `days` | Yes* | Duration days; `0` = unlimited/lifetime |
| `duration` | No | Label e.g. "1 Year", "Forever" |
| `save` | No | Badge e.g. "Save ₹8000" |
| `best` | No | One "BEST VALUE" in extension |
| `active` | No | `false` hides from UI |
| `order` | No | Sort order |
| `max_devices` | No | `1` default; `3` family; `5` friends; `0` = unlimited |
| `device_tier` | No | `standard` \| `family` \| `friends` \| `unlimited` |
| `billing_mode` | No | `subscription` \| `credits` \| `hybrid` |
| `plan_kind` | No | Free text: `lifetime`, `unlimited`, `enterprise`, `custom` |
| `included_credits` | No | Starting credits for credits/hybrid plans |
| `unlimited_time` | No | `true` = never expires |
| `unlimited_devices` | No | `true` = no device limit |
| `unlimited_credits` | No | `true` = never deduct credits |
| `allow_credit_addons` | No | `true` = show per-plan credit add-on chips |
| `max_addon_selections` | No | `1` = pick one; `0` = unlimited multi-select |
| `credit_addons` | No | Array: `{ id, credits, price, label, active, default_selected, order }` |
| `description` | No | Short text on plan detail screen |
| `highlights` | No | String array — pills on plan detail (e.g. `["Live shipping", "Unlimited variants"]`) |
| `features` | No | Array of `{ icon, title, text }` or plain strings — shown on plan detail screen |
| `detail_sections` | No | Array of `{ title, body, items[] }` — extra flexible blocks on plan detail |

**Editor actions:** + Add Plan, ▲/▼ reorder, Show (active), ✕ remove, validate unique IDs.

**Per-plan credit add-ons:** When `allow_credit_addons` is on, add a sub-editor for `credit_addons[]` (add/remove/reorder, set credits+price+label, mark default). The extension shows these as chips; the customer's selection is included in the WhatsApp message. When you create the license, set `addon_credit_ids` (and optionally `addon_credits`) so activation grants the right balance. Add-ons are hidden if `unlimited_credits` is true.

```json
{
  "id": "yearly", "name": "Yearly", "price": 3099, "days": 365,
  "billing_mode": "hybrid", "included_credits": 100,
  "allow_credit_addons": true, "max_addon_selections": 2,
  "credit_addons": [
    { "id": "addon_25", "credits": 25, "price": 40, "label": "+25 credits", "order": 0 },
    { "id": "addon_50", "credits": 50, "price": 70, "label": "+50 credits", "order": 1 }
  ]
}
```

**Preset templates (quick-add buttons):**
- Standard Monthly (1 device, 30 days)
- Family Yearly (3 devices, 365 days)
- Friends Yearly (5 devices, 365 days)
- Lifetime (unlimited time, 1 device)
- Unlimited Pro (unlimited time + devices + credits)
- Credits Starter (billing_mode: credits, included_credits: 50)

**Example custom plans in Firebase:**

```json
{ "id": "lifetime", "name": "Lifetime", "price": 9999, "days": 0, "unlimited_time": true, "plan_kind": "lifetime", "max_devices": 1, "active": true }
{ "id": "family_yearly", "name": "Family Yearly", "price": 4999, "days": 365, "max_devices": 3, "device_tier": "family", "active": true }
{ "id": "unlimited_pro", "name": "Unlimited Pro", "price": 19999, "days": 0, "unlimited_time": true, "unlimited_devices": true, "unlimited_credits": true, "plan_kind": "unlimited", "active": true }
```

### Inline demo keys (`demo_keys` map)
Key → { days, label } editor with + Add / ✕ Remove.

---

## TAB 2: Credits & Packs

Edit `credits` object on app doc:

```json
{
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
```

**Packs editor:** + Add Pack (any credits/price), ▲/▼ reorder, Show toggle, ✕ remove.
**Custom pack example:** `{ "id": "pack_250", "credits": 250, "price": 400, "label": "250 Credits" }`
**Custom amount:** show `price_per_credit` × amount (min `min_purchase`) for WhatsApp quote.

**AI image generation limits** — add an editor for `credits.image_generation`:

```json
{
  "image_generation": {
    "enabled": true,
    "credits_per_image": 2,
    "daily_limit": 20,
    "monthly_limit": 0,
    "max_batch_size": 100
  }
}
```

| Field | Meaning |
|-------|---------|
| `enabled` | Master on/off for AI image generation |
| `credits_per_image` | Credits charged **per generation run** (`0` = free; only for credits/hybrid plans). One run = one upload → variants (20/50/100 variants still = 1 run; stop mid-run still = 1 run). |
| `daily_limit` | **Runs**/day per license (`0` = unlimited) |
| `monthly_limit` | **Runs**/month (`0` = unlimited) |
| `max_batch_size` | Max **variants** per run (`0` = unlimited) — does not change how runs are counted |

The extension enforces these client-side and writes counters back to each license: `images_generated_total`, `images_generated_today`, `images_generated_today_date`, `images_generated_month`, `images_generated_month_key`. Counter field names say "images" for backward compatibility — they track **generation runs**, not individual variants. Your **Paid Licenses** view should label them "Generations today / this month / total" and display read-only. Leave the whole `image_generation` object out to keep legacy behavior (1 credit/operation).

**Admin UI for image generation limits (Credits & Packs tab):**

1. **Section title:** "AI image generation limits"
2. **Help text (always visible):** "One generation run = one upload in the extension, regardless of how many variants (20/50/100) are requested. Stopping mid-run still counts as 1 run. Daily/monthly limits count runs, not variants."
3. **Fields:**
   - `enabled` — toggle
   - `credits_per_image` — number input, label **"Credits per run"** (helper: "Charged once per upload/generation flow; field key stays `credits_per_image` for extension compatibility")
   - `daily_limit` — number input, label **"Daily run limit"** (`0` = unlimited)
   - `monthly_limit` — number input, label **"Monthly run limit"** (`0` = unlimited)
   - `max_batch_size` — number input, label **"Max variants per run"** (`0` = unlimited; blocks runs that request more variants than this)
4. **Preview card** under the form showing example: "Customer uploads 1 image, selects 50 variants → counts as **1 run**, costs **{credits_per_image}** credits (if credits plan), uses **1** from daily limit."
5. Save nested under `credits.image_generation` on `shipping_optimizer_config/app`.

**Paid Licenses tab — generation usage (read-only):**

Show on each license row / detail drawer:
- `images_generated_today` / `images_generated_today_date` → label **"Runs today"**
- `images_generated_month` / `images_generated_month_key` → label **"Runs this month"**
- `images_generated_total` → label **"Total runs"**

Optional admin action: **Reset today's runs** (sets `images_generated_today` to `0` and updates `images_generated_today_date` to today) — for support only, with confirm dialog.

---

## TAB 3: Demo / Promo Keys

Collection `shipping_optimizer_demo_keys/{KEY}` — list, add, enable/disable, delete.
Merged with inline `demo_keys` in config.

---

## TAB 4: Paid Licenses

### Create license form

| Field | Notes |
|-------|-------|
| License key | `MEESHO-XXXX-XXXX-XXXX` or Generate 🎲 |
| Plan | Dropdown from **all** plans (including custom/unlimited) |
| billing_mode | Auto from plan; allow override |
| max_devices | Auto from plan; allow override |
| credits_balance | For credits/hybrid; or use included_credits from plan |
| addon_credit_ids | Add-ons the customer paid for (ids from plan `credit_addons`) |
| addon_credits | Optional explicit add-on credit total (else summed from ids) |
| unlimited_time / unlimited_devices / unlimited_credits | Checkboxes; override plan |
| customer_name, customer_phone, customer_email, support_notes | Optional |

**On create** copy from plan: `planId`, `planType`, `planDays`, `max_devices`, `billing_mode`, `included_credits`, `addon_credit_ids` (selected add-ons), unlimited flags. Leave `credits_balance: 0` — the extension grants `included_credits + add-ons` on first activation.

```json
{
  "active": true,
  "planId": "yearly",
  "planDays": 365,
  "billing_mode": "subscription",
  "max_devices": 1,
  "device_ids": [],
  "credits_balance": 0,
  "credits_used": 0,
  "unlimited_time": false,
  "unlimited_devices": false,
  "unlimited_credits": false,
  "expiry_starts_on_activation": true,
  "expiresAt": "",
  "machineId": "",
  "activatedAt": ""
}
```

### License list & actions

Show: key, customer, plan, billing_mode, devices (2/3 or Unlimited), credits, expiry (or "Unlimited"), status.

| Action | Effect |
|--------|--------|
| Revoke/Activate | Toggle `active` |
| Reset devices | Clear `device_ids[]`, `machineId`, `activatedAt` |
| Add credits | `credits_balance += N` (top-up after pack purchase) |
| Edit overrides | Change unlimited flags, max_devices, billing_mode per customer |
| Delete | Confirm + type DELETE |

Search: key, phone, planId, machineId, device_ids.

---

## Device ID (Kiwi mobile)

Extension generates Device ID per browser profile (e.g. `M1A2B3C4D5E6`). Kiwi Android = same check as Chrome. Admin shows `device_ids[]` list per license.

| Plan | Devices |
|------|---------|
| Standard | 1 |
| Family | 3 (configurable) |
| Friends | 5 (configurable) |
| Unlimited | `max_devices: 0` or `unlimited_devices: true` |

---

## Billing modes

| Mode | Rule |
|------|------|
| `subscription` | Valid until `expiresAt` (or forever if `unlimited_time`) |
| `credits` | Valid while `credits_balance` > 0 (or `unlimited_credits`) |
| `hybrid` | Not expired AND has credits (unless unlimited flags) |

### Stacked licenses (plan + credit top-up)

The extension supports **multiple active keys on one device**:

| Key type | Example | Behavior |
|----------|---------|----------|
| Primary plan | Yearly hybrid / subscription | Grants time-based access |
| Credit top-up | Separate `billing_mode: credits` key | Stacks credits; deducted after hybrid plan credits |

**Admin workflow for credit pack purchase:**
1. Create a **new** paid license with `billing_mode: credits` and `credits_balance` = pack size (e.g. 50).
2. Send that key to the customer — they activate it **in addition to** their existing plan key.
3. Extension shows both licenses and combined credit balance.

**Sign-off:** Customer can remove a key from the device in popup/modal — extension unbinds their device ID from that license doc (`device_ids[]`).

---

## Technical

- Match Swagstree superadmin dark theme (`btn-gold`)
- Use existing `db`, `auth`, `showToast`, `isSuperAdmin`
- Files: `js/shipping-optimizer-admin.js`, HTML in `#super-view`, hook `loadShippingOptimizerAdmin()` on super tab
- Escape HTML in all renders

---

## Verify

1. Add custom plan "Lifetime" → shows in extension popup
2. Create family license (3 devices) → 3rd device works, 4th blocked
3. Create credits license → deduct on use → top-up adds balance
4. Create separate credit top-up key → customer stacks with plan → combined balance shown
5. Unlimited plan → no expiry, no device cap, no credit deduction
6. Kiwi mobile activation → device ID appears in `device_ids[]`
7. Sign-off in extension → device removed from `device_ids[]` for that key
8. Set `daily_limit: 2` → customer can run generation twice (any variant count) → 3rd upload blocked until tomorrow
9. Customer stops a run at 5/50 variants → still counts as 1 run toward daily limit and credits
10. Add 6 support users with `page_size: 5` → extension shows paginated list with Prev/Next
11. Edit plan `features` / `detail_sections` in Firebase → plan detail screen updates without extension release
12. Mobile Kiwi: WhatsApp Support opens app directly (not intent:// page)

---

## Reference

- `FIREBASE_SETUP.md` — complete schema
- `ACTIVATION_GUIDE.md` — workflows
