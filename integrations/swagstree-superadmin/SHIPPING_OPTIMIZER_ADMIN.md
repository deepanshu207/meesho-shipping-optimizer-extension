# Shipping Optimizer — Superadmin panel

Manage the Meesho **Shipping Optimizer** Chrome extension from Swagstree without touching the storefront.

**Where:** Log in as `superadmin@swagstree.com` → **Superadmin** tab → **Shipping Optimizer Extension**

## What you can manage

| Tab | Firebase location | Actions |
|-----|-------------------|---------|
| Config & Pricing | `shipping_optimizer_config/app` | WhatsApp, plans, inline demo keys, announcement, enable/disable extension |
| Demo / Promo Keys | `shipping_optimizer_demo_keys/{KEY}` | Extra promo codes (optional; inline keys in Config tab are enough for most cases) |
| Paid Licenses | `shipping_optimizer_licenses/{KEY}` | Create keys after payment, revoke, reset device binding, delete |

## Typical workflow

1. Customer taps a plan in the extension → WhatsApp opens with plan + price.
2. After payment, go to **Paid Licenses** → **Create** (or generate key with 🎲).
3. Send the license key to the customer on WhatsApp.
4. Customer activates in the extension popup.

## Firestore rules

Superadmin writes require merged rules — see `FIREBASE_SETUP.md` in the extension repo (or Firebase Console). The superadmin email must match `superadmin@swagstree.com`.

## Isolation

All data uses the `shipping_optimizer_*` collection prefix. Swagstree products, orders, and settings are **not** modified.
