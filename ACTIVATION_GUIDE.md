# Activation & support guide

How license keys work, where data is saved, and how to help customers.

## There is no user login

The extension does **not** use email/password or Google sign-in. Authentication is:

```
License key  +  Device ID (machineId)  →  access granted
```

| Piece | What it is |
|-------|------------|
| **License key** | What you send after payment (`MEESHO-XXXX-…`) or a demo key (`MEESHO-DEMOFREE`) |
| **Device ID** | Auto-generated per Chrome profile, e.g. `M7K2F9A3B1C4` — shown in extension popup |

One paid key = **one device** unless you **Reset device** in Firebase admin.

---

## When and where the key is saved

### 1. On the user's computer (Chrome extension storage)

Saved **immediately** when they tap **Activate License** and verification succeeds.

| Storage | Keys | Synced across PCs? |
|---------|------|-------------------|
| `chrome.storage.sync` | `licenseKey`, `licenseStatus`, `licenseInfo`, `lastVerified` | Yes (same Google account) |
| `chrome.storage.local` | `machineId` | No — per browser profile |

**`licenseInfo` example (local copy):**

```json
{
  "key": "MEESHO-A1B2-C3D4-E5F6",
  "planType": "yearly",
  "expiresAt": "2027-08-04T23:59:59.000Z",
  "activatedAt": "2026-08-04T20:15:00.000Z"
}
```

- **Demo keys:** `activatedAt` and `expiresAt` are set at activation (`expiresAt` = now + demo days).
- **Paid keys:** `expiresAt` comes from Firebase; `activatedAt` is set on first successful activation.

### 2. In Firebase (source of truth for paid keys)

Path: `shipping_optimizer_licenses/{LICENSE_KEY}`

| Field | When set | Who sets it |
|-------|----------|-------------|
| Document created | After you confirm payment | **You** (admin UI / Console) |
| `machineId`, `activatedAt`, `lastVerifiedAt` | First time user activates on a device | **Extension** (automatic) |
| `lastVerifiedAt` | Every successful re-check (~5 min) | **Extension** |

Before activation: `machineId` is empty → key is valid but **not bound** to any device yet.

---

## Step-by-step: paid customer

```
1. User taps plan        → WhatsApp only (no key yet)
2. User pays you         → You create license in Firebase
3. You send key on WA    → User still NOT active
4. User enters key       → Extension verifies Firebase
5. First activation      → Firebase gets machineId + timestamps
6. Extension unlocks     → Generate / Apply work
```

**User is active at step 4–5**, not after WhatsApp alone.

---

## Step-by-step: demo customer

```
1. User enters MEESHO-DEMOFREE
2. Extension matches demo_keys (Firebase or built-in)
3. Saves to chrome.storage.sync immediately
4. Active — no Firebase license document needed
```

---

## Support scenarios

| Customer says | You do |
|---------------|--------|
| "Paid but no key" | Create `shipping_optimizer_licenses/{KEY}` in Firebase, send key |
| "Key invalid" | Check key exists, `active: true`, not expired |
| "Already on another device" | Firebase → **Reset device** (clear `machineId`) |
| "Was working, stopped" | Check `active`, expiry; ask them to **Copy support info** from popup |
| "New laptop" | Reset device, they activate again with same key |

Ask customer to tap **Copy support info** in the popup — it includes key, Device ID, plan, dates, extension version.

### Optional Firebase fields (for your admin UI)

Add to license documents for your own notes (extension ignores these):

```json
{
  "customer_name": "Rahul",
  "customer_phone": "919876543210",
  "support_notes": "Paid UPI 4 Aug, yearly plan"
}
```

---

## Background re-check

- Runs ~3 seconds after extension load, then every **5 minutes**
- Re-reads Firebase for paid keys
- If revoked/expired → sets `licenseStatus: inactive` locally

Demo keys are checked by **local expiry** in `licenseInfo.expiresAt`.

---

## Quick reference

| Question | Answer |
|----------|--------|
| Login? | No — license key only |
| When saved locally? | On successful Activate |
| When saved in Firebase? | You create doc; extension writes device fields on activate |
| One key, two PCs? | No — reset device or issue second key |
| WhatsApp = activated? | No — only starts sale |
