# Shipping Optimizer — Superadmin panel

Manage the Meesho **Shipping Optimizer** Chrome extension from Swagstree without touching the storefront.

**Where:** Log in as `superadmin@swagstree.com` → **Superadmin** tab → **Shipping Optimizer Extension**

## What you can manage

| Tab | Firebase location | Actions |
|-----|-------------------|---------|
| Config & Pricing | `shipping_optimizer_config/app` | WhatsApp, plans (add/update/hide/remove), inline demo keys, announcement, enable/disable extension |
| Demo / Promo Keys | `shipping_optimizer_demo_keys/{KEY}` | Extra promo codes (optional; inline keys in Config tab are enough for most cases) |
| Paid Licenses | `shipping_optimizer_licenses/{KEY}` | Create keys after payment, revoke, reset device binding, delete |

## Pricing plans

In **Config & Pricing** you can fully manage plans without redeploying the extension:

- **+ Add Plan** — new row with default values; set ID, price, days, then save.
- **▲ / ▼** — reorder how plans appear in the extension popup.
- **Show** — uncheck to hide a plan from customers (`active: false`) while keeping it for existing licenses.
- **✕** — remove the plan from config (use only when no licenses reference that `planId`).
- **Best** — marks one plan as "BEST VALUE" in the UI.

Plan IDs should stay stable once you issue licenses (e.g. `yearly`). Changing price or days only affects new purchases; existing keys keep `planDays` from when they were created.

Saving config updates `plans_version` for audit trail. The extension popup fetches fresh plans every time it opens.

## Typical workflow

1. Customer taps a plan in the extension → WhatsApp opens with plan + price.
2. After payment, go to **Paid Licenses** → **Create** (or generate key with 🎲).
3. Send the license key to the customer on WhatsApp.
4. Customer activates in the extension popup.

## Firestore rules

Superadmin writes require merged rules — see `FIREBASE_SETUP.md` in the extension repo (or Firebase Console). The superadmin email must match `superadmin@swagstree.com`.

## Isolation

All data uses the `shipping_optimizer_*` collection prefix. Swagstree products, orders, and settings are **not** modified.
