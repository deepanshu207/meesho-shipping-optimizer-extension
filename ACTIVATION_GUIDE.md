# Activation & support guide

How license keys work, how they are generated, and where data is saved.

## There is no user login

Authentication = **license key** + **device ID** (`machineId`). No email/password.

---

## How keys are generated (unique)

### Paid license keys (you create after payment)

**Format:** `MEESHO-XXXX-XXXX-XXXX`  
Each `XXXX` is 4 random uppercase letters/numbers.

**Examples:** `MEESHO-K7M2-P9X4-R3N8`, `MEESHO-A1B2-C3D4-E5F6`

**Uniqueness:**
1. Generate random key in format above
2. Check it does **not** already exist in:
   - `shipping_optimizer_licenses`
   - `shipping_optimizer_demo_keys`
   - `demo_keys` map in config
3. If collision → generate again (up to 12 tries)
4. Document ID in Firestore **is** the key → guaranteed unique per license

Use **Generate (🎲)** in admin UI or `FirebaseLicense.generateUniqueLicenseKey()` in code.

### Demo / promo keys (you choose the name)

You define the key string, e.g. `MEESHO-DEMOFREE`. Must not match an existing paid license key.

---

## Activation & expiry by plan

### Paid licenses

| Stage | `activatedAt` | `expiresAt` |
|-------|---------------|-------------|
| **You create key** (after payment) | empty | empty (recommended) |
| **Customer activates** | set to now | **now + planDays** |

**`planDays`** comes from the plan you select when creating the license (Monthly=30, Yearly=365, etc.).

Example: Yearly plan (`planDays: 365`)
- You create key on Aug 4 — customer is **not** active yet
- Customer activates on Aug 10 → `activatedAt: Aug 10`, `expiresAt: Aug 10 next year`

Set `expiry_starts_on_activation: false` and a fixed `expiresAt` only if you need a custom override.

### Demo keys

| Stage | `activatedAt` | `expiresAt` |
|-------|---------------|-------------|
| Customer enters demo key | now | now + demo `days` (e.g. 30) |

Saved locally only (no `shipping_optimizer_licenses` document).

---

## Optional customer fields (admin only)

Store on `shipping_optimizer_licenses/{KEY}` for your support — extension does not read these:

| Field | Example |
|-------|---------|
| `customer_name` | `Rahul Kumar` |
| `customer_phone` | `919876543210` |
| `customer_email` | `rahul@example.com` |
| `support_notes` | `Paid UPI 4 Aug, yearly plan` |

---

## Where data is saved

### User's browser (on Activate)

| Storage | Fields |
|---------|--------|
| `chrome.storage.sync` | `licenseKey`, `licenseStatus`, `licenseInfo`, `lastVerified` |
| `chrome.storage.local` | `machineId` |

### Firebase (paid keys)

Project: `extension-e6e32` · Path: `shipping_optimizer_licenses/{KEY}`

| Field | Who writes | When |
|-------|------------|------|
| `planId`, `planDays`, customer fields | **You** | Create license |
| `machineId`, `activatedAt`, `expiresAt` | **Extension** | First activation |
| `lastVerifiedAt` | **Extension** | Every ~5 min |

---

## Your workflow after WhatsApp payment

1. Customer taps plan → WhatsApp to you  
2. Confirm payment  
3. Admin: **Create license** — pick plan, optional customer name/phone/notes, generate unique key  
4. Send key on WhatsApp  
5. Customer taps **Activate** → active for `planDays` from that moment  

---

## Support

| Issue | Fix |
|-------|-----|
| Key already exists | Generate new unique key |
| Not activated yet | Normal — expires only after they activate |
| Wrong device | Reset `machineId` in Firebase |
| Customer help | Ask them to **Copy support info** in popup |

---

## License document template

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
  "support_notes": "Paid UPI — yearly"
}
```
