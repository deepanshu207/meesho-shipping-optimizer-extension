# Apply Shipping Optimizer superadmin panel to Swagstree

These files add **Superadmin → Shipping Optimizer Extension** to the Swagstree web app.

## Files to copy into `deepanshu207/swagstree`

| From this folder | To Swagstree repo |
|------------------|-------------------|
| `shipping-optimizer-admin.js` | `js/shipping-optimizer-admin.js` |
| `SHIPPING_OPTIMIZER_ADMIN.md` | `SHIPPING_OPTIMIZER_ADMIN.md` |

## Manual edits in Swagstree `index.html`

1. **Before** `<!-- Section 1: Manage Admins -->` in `#super-view`, paste the HTML block from `superadmin-panel.html` in this folder.

2. **Before** `js/bind-globals.js`, add:
   ```html
   <script src="js/shipping-optimizer-admin.js?v=1.0"></script>
   ```

## Manual edit in Swagstree `js/app.js`

Inside `navigateToCore`, in the `if (id === 'super')` block, add:
```javascript
if (typeof loadShippingOptimizerAdmin === 'function') loadShippingOptimizerAdmin();
```

## Firestore rules

Update Firebase Console rules using the **superadmin write** section in `FIREBASE_SETUP.md` (extension repo root). Required for Save / Create license to work from Swagstree.

## Verify

1. Log in as `superadmin@swagstree.com`
2. Open **Superadmin** tab
3. **Shipping Optimizer Extension** panel loads
4. Save config → reload extension popup → pricing matches
