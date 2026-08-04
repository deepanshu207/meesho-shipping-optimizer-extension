// ==========================================
// SWAG STREE | SHIPPING OPTIMIZER ADMIN (SUPERADMIN)
// Manages shipping_optimizer_* Firestore collections for the Chrome extension.
// Does NOT touch Swagstree storefront collections.
// ==========================================

(function initShippingOptimizerAdmin() {
    const CONFIG_DOC = 'app';
    const COL_CONFIG = 'shipping_optimizer_config';
    const COL_DEMO = 'shipping_optimizer_demo_keys';
    const COL_LICENSES = 'shipping_optimizer_licenses';

    let _state = {
        config: null,
        demoDocs: [],
        licenseDocs: [],
        activeTab: 'config',
        licenseFilter: '',
    };

    function assertSuperAdmin(actionLabel) {
        if (typeof isSuperAdmin !== 'undefined' && isSuperAdmin) return true;
        if (typeof showToast === 'function') {
            showToast(actionLabel || 'Only superadmin can manage Shipping Optimizer.');
        }
        return false;
    }

    function normalizeKey(key) {
        return String(key || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '-');
    }

    function defaultPlans() {
        return [
            { id: 'monthly', name: 'Monthly', price: 599, days: 30, duration: '1 Month', save: '', best: false, active: true, order: 0 },
            { id: 'quarterly', name: '3 Months', price: 1399, days: 90, duration: '3 Months', save: 'Save ₹1000', best: false, active: true, order: 1 },
            { id: 'halfyearly', name: '6 Months', price: 2299, days: 180, duration: '6 Months', save: 'Save ₹3000', best: false, active: true, order: 2 },
            { id: 'yearly', name: 'Yearly', price: 3099, days: 365, duration: '1 Year', save: 'Save ₹8000', best: true, active: true, order: 3 },
        ];
    }

    function slugifyPlanId(id) {
        return String(id || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_-]/g, '');
    }

    function sortPlans(plans) {
        return [...plans].sort(
            (a, b) =>
                (a.order ?? 0) - (b.order ?? 0) ||
                String(a.name || '').localeCompare(String(b.name || '')),
        );
    }

    function validatePlans(plans) {
        if (!plans.length) return 'Add at least one pricing plan.';
        const ids = new Set();
        for (const p of plans) {
            const id = slugifyPlanId(p.id);
            if (!id) return 'Each plan needs a valid ID (letters, numbers, underscore).';
            if (ids.has(id)) return `Duplicate plan ID "${id}" — IDs must be unique.`;
            ids.add(id);
            if (!String(p.name || '').trim()) return `Plan "${id}" needs a display name.`;
            if (Number(p.price) < 0) return `Plan "${id}" price cannot be negative.`;
            if (!Number(p.days) || Number(p.days) < 1) return `Plan "${id}" needs at least 1 day.`;
        }
        return null;
    }

    function defaultConfig() {
        return {
            whatsapp_number: '919654414891',
            whatsapp_message: 'Hi! I want to purchase Shipping Optimizer license.',
            extension_enabled: true,
            min_extension_version: '1.0.0',
            announcement: '',
            plans: defaultPlans(),
            demo_keys: {
                'MEESHO-DEMOFREE': { days: 30, label: 'Free 30-day trial' },
            },
        };
    }

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '—';
            return d.toLocaleString();
        } catch (_) {
            return '—';
        }
    }

    function generateLicenseKey() {
        const seg = () => {
            let s = Math.random().toString(36).substring(2, 6).toUpperCase();
            while (s.length < 4) s += 'X';
            return s.substring(0, 4);
        };
        return `MEESHO-${seg()}-${seg()}-${seg()}`;
    }

    async function licenseKeyExists(key) {
        const id = normalizeKey(key);
        if (!id) return true;
        const licSnap = await db.collection(COL_LICENSES).doc(id).get();
        if (licSnap.exists) return true;
        const demoSnap = await db.collection(COL_DEMO).doc(id).get();
        if (demoSnap.exists) return true;
        const cfg = _state.config || {};
        const inline = cfg.demo_keys || cfg.demoKeys || {};
        return !!inline[id];
    }

    async function generateUniqueLicenseKey(maxAttempts = 12) {
        for (let i = 0; i < maxAttempts; i++) {
            const key = generateLicenseKey();
            if (!(await licenseKeyExists(key))) return key;
        }
        const tail = Date.now().toString(36).toUpperCase().slice(-8);
        return `MEESHO-${tail.slice(0, 4)}-${tail.slice(4)}-UNIQ`;
    }

    function getPlansForSelect() {
        const plans = readPlansFromDom().filter((p) => p.active !== false);
        if (plans.length) return plans;
        const fromState = _state.config?.plans;
        if (Array.isArray(fromState)) return fromState.filter((p) => p.active !== false);
        return defaultPlans();
    }

    function renderLicensePlanSelect() {
        const sel = document.getElementById('so-new-license-plan');
        if (!sel) return;
        const plans = getPlansForSelect();
        sel.innerHTML = plans
            .map((p) => `<option value="${escHtml(p.id)}" data-days="${Number(p.days) || 30}">${escHtml(p.name)} — ${Number(p.days) || 30} days · ₹${p.price}</option>`)
            .join('');
        updateLicenseExpiryHint();
    }

    function updateLicenseExpiryHint() {
        const hint = document.getElementById('so-license-expiry-hint');
        const sel = document.getElementById('so-new-license-plan');
        if (!hint || !sel) return;
        const opt = sel.options[sel.selectedIndex];
        const days = opt ? Number(opt.dataset.days) || 30 : 30;
        hint.textContent = `Expiry starts when customer activates: ${days} days from activation date.`;
    }

    function readPlansFromDom() {
        const rows = document.querySelectorAll('#so-plans-editor .so-plan-row');
        const plans = [];
        rows.forEach((row, i) => {
            const rawId = (row.querySelector('[data-field="id"]')?.value || `plan_${i}`).trim();
            const id = slugifyPlanId(rawId) || `plan_${i}`;
            plans.push({
                id,
                name: (row.querySelector('[data-field="name"]')?.value || 'Plan').trim(),
                price: Number(row.querySelector('[data-field="price"]')?.value) || 0,
                days: Number(row.querySelector('[data-field="days"]')?.value) || 30,
                duration: (row.querySelector('[data-field="duration"]')?.value || 'Plan').trim(),
                save: (row.querySelector('[data-field="save"]')?.value || '').trim(),
                best: !!row.querySelector('[data-field="best"]')?.checked,
                active: row.querySelector('[data-field="active"]')?.checked !== false,
                order: i,
            });
        });
        return plans.filter((p) => p.id);
    }

    function readInlineDemoKeysFromDom() {
        const out = {};
        document.querySelectorAll('#so-inline-demo-keys .so-demo-row').forEach((row) => {
            const key = normalizeKey(row.querySelector('[data-field="key"]')?.value);
            if (!key || key.length < 6) return;
            out[key] = {
                days: Number(row.querySelector('[data-field="days"]')?.value) || 30,
                label: (row.querySelector('[data-field="label"]')?.value || '').trim(),
            };
        });
        return out;
    }

    function renderPlansEditor(plans) {
        const host = document.getElementById('so-plans-editor');
        if (!host) return;
        const list = sortPlans(Array.isArray(plans) && plans.length ? plans : defaultPlans());
        host.innerHTML = list
            .map(
                (p, i) => {
                    const inactive = p.active === false;
                    const rowStyle = inactive
                        ? 'opacity:0.55;border-color:#442222;background:#141414;'
                        : 'border-color:#333;background:#1a1a1a;';
                    return `
            <div class="so-plan-row" style="display:grid; grid-template-columns:28px repeat(4,1fr) auto auto auto; gap:8px; align-items:end; padding:10px; border:1px solid; border-radius:10px; margin-bottom:8px; ${rowStyle}">
                <div style="display:flex;flex-direction:column;gap:2px;align-self:center;">
                    <button type="button" title="Move up" ${i === 0 ? 'disabled' : ''} style="width:24px;height:20px;padding:0;font-size:10px;background:#222;border:1px solid #444;color:#aaa;border-radius:4px;cursor:pointer;" onclick="moveShippingOptimizerPlanRow(this,-1)">▲</button>
                    <button type="button" title="Move down" ${i === list.length - 1 ? 'disabled' : ''} style="width:24px;height:20px;padding:0;font-size:10px;background:#222;border:1px solid #444;color:#aaa;border-radius:4px;cursor:pointer;" onclick="moveShippingOptimizerPlanRow(this,1)">▼</button>
                </div>
                <label style="font-size:10px;color:#888;">ID <span style="color:#555;">(stable)</span><input data-field="id" type="text" value="${escHtml(p.id)}" placeholder="yearly" style="margin-top:4px;font-size:11px;font-family:monospace;"></label>
                <label style="font-size:10px;color:#888;">Name<input data-field="name" type="text" value="${escHtml(p.name)}" style="margin-top:4px;font-size:11px;"></label>
                <label style="font-size:10px;color:#888;">Price (₹)<input data-field="price" type="number" min="0" value="${Number(p.price) || 0}" style="margin-top:4px;font-size:11px;"></label>
                <label style="font-size:10px;color:#888;">Days<input data-field="days" type="number" min="1" value="${Number(p.days) || 30}" style="margin-top:4px;font-size:11px;"></label>
                <label style="font-size:10px;color:#888;display:flex;align-items:center;gap:4px;white-space:nowrap;"><input data-field="best" type="checkbox" ${p.best ? 'checked' : ''}> Best</label>
                <label style="font-size:10px;color:#888;display:flex;align-items:center;gap:4px;white-space:nowrap;" title="Uncheck to hide from extension without deleting"><input data-field="active" type="checkbox" ${p.active !== false ? 'checked' : ''}> Show</label>
                <label style="grid-column:2/5;font-size:10px;color:#888;">Duration label<input data-field="duration" type="text" value="${escHtml(p.duration || p.name)}" style="margin-top:4px;font-size:11px;"></label>
                <label style="grid-column:5/8;font-size:10px;color:#888;">Save badge (optional)<input data-field="save" type="text" value="${escHtml(p.save || '')}" placeholder="Save ₹1000" style="margin-top:4px;font-size:11px;"></label>
                <button type="button" class="btn-gold" style="grid-column:8;width:auto;padding:8px 10px;font-size:10px;background:#331111;border-color:#552222;color:#ff8888;" title="Remove plan from config" onclick="removeShippingOptimizerPlanRow(this)">✕</button>
            </div>`;
                },
            )
            .join('');
    }

    function renderInlineDemoKeys(demoKeys) {
        const host = document.getElementById('so-inline-demo-keys');
        if (!host) return;
        const entries = Object.entries(demoKeys || {});
        if (!entries.length) entries.push(['MEESHO-DEMOFREE', { days: 30, label: '' }]);
        host.innerHTML = entries
            .map(
                ([key, info]) => `
            <div class="so-demo-row" style="display:grid; grid-template-columns:2fr 80px 1fr auto; gap:8px; align-items:end; margin-bottom:8px;">
                <label style="font-size:10px;color:#888;">Key<input data-field="key" type="text" value="${escHtml(key)}" style="margin-top:4px;font-size:11px;font-family:monospace;"></label>
                <label style="font-size:10px;color:#888;">Days<input data-field="days" type="number" min="1" value="${Number(info?.days) || 30}" style="margin-top:4px;font-size:11px;"></label>
                <label style="font-size:10px;color:#888;">Label<input data-field="label" type="text" value="${escHtml(info?.label || '')}" style="margin-top:4px;font-size:11px;"></label>
                <button type="button" class="btn-gold" style="width:auto;padding:8px 10px;font-size:10px;background:#331111;border-color:#552222;color:#ff8888;" onclick="removeShippingOptimizerDemoRow(this)">✕</button>
            </div>`,
            )
            .join('');
    }

    function renderDemoCollectionList() {
        const host = document.getElementById('so-demo-collection-list');
        if (!host) return;
        if (!_state.demoDocs.length) {
            host.innerHTML = '<p style="font-size:11px;color:#666;margin:0;">No extra promo documents in collection (inline keys above are enough for most cases).</p>';
            return;
        }
        host.innerHTML = _state.demoDocs
            .map((row) => {
                const active = row.active !== false;
                return `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;background:#1a1a1a;border:1px solid #333;border-radius:10px;margin-bottom:8px;">
                    <div>
                        <div style="font-family:monospace;font-size:12px;color:#fff;">${escHtml(row.id)}</div>
                        <div style="font-size:10px;color:#888;">${Number(row.days) || 30} days · ${escHtml(row.label || '')} · ${active ? '<span style="color:#10b981">Active</span>' : '<span style="color:#ef4444">Disabled</span>'}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button type="button" class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;" onclick="toggleShippingOptimizerDemoDoc('${escHtml(row.id)}', ${!active})">${active ? 'Disable' : 'Enable'}</button>
                        <button type="button" class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;background:#331111;border-color:#552222;color:#ff8888;" onclick="deleteShippingOptimizerDemoDoc('${escHtml(row.id)}')">Delete</button>
                    </div>
                </div>`;
            })
            .join('');
    }

    function renderLicenseList() {
        const host = document.getElementById('so-license-list');
        if (!host) return;
        const q = (_state.licenseFilter || '').toLowerCase();
        const rows = _state.licenseDocs.filter((row) => {
            if (!q) return true;
            return (
                String(row.id || '').toLowerCase().includes(q) ||
                String(row.machineId || '').toLowerCase().includes(q) ||
                String(row.planType || '').toLowerCase().includes(q)
            );
        });
        if (!rows.length) {
            host.innerHTML = '<p style="font-size:11px;color:#666;margin:0;">No paid licenses yet. Create one after a customer pays.</p>';
            return;
        }
        host.innerHTML = rows
            .map((row) => {
                const active = row.active !== false;
                const expired = row.expiresAt && new Date(row.expiresAt) < new Date();
                const pending = !row.activatedAt && !row.machineId;
                const customer = [row.customer_name, row.customer_phone].filter(Boolean).join(' · ');
                return `
                <div style="padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:10px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <div>
                            <div style="font-family:monospace;font-size:12px;color:#fff;">${escHtml(row.id)}</div>
                            ${customer ? `<div style="font-size:10px;color:#c45f12;margin-top:2px;">${escHtml(customer)}</div>` : ''}
                            ${row.support_notes ? `<div style="font-size:10px;color:#888;margin-top:2px;">${escHtml(row.support_notes)}</div>` : ''}
                            <div style="font-size:10px;color:#888;margin-top:4px;">
                                Plan: <b>${escHtml(row.planId || row.planType || '—')}</b> (${Number(row.planDays || row.plan_days) || '—'} days) ·
                                ${pending ? '<span style="color:#f59e0b">Not activated yet</span>' : `Activated: ${formatDate(row.activatedAt)}`}<br>
                                Expires: ${row.expiresAt ? formatDate(row.expiresAt) : '— on first activation —'} ${expired ? '<span style="color:#ef4444">(expired)</span>' : ''}<br>
                                Device: <span style="font-family:monospace;">${escHtml(row.machineId || '—')}</span>
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;">
                            <span style="font-size:10px;padding:4px 8px;border-radius:6px;${active ? 'background:rgba(16,185,129,0.15);color:#10b981' : 'background:rgba(239,68,68,0.15);color:#ef4444'}">${active ? 'Active' : 'Revoked'}</span>
                            <button type="button" class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;" onclick="toggleShippingOptimizerLicense('${escHtml(row.id)}', ${!active})">${active ? 'Revoke' : 'Activate'}</button>
                            <button type="button" class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;" onclick="resetShippingOptimizerLicenseDevice('${escHtml(row.id)}')" ${row.machineId ? '' : 'disabled'}>Reset device</button>
                            <button type="button" class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;background:#331111;border-color:#552222;color:#ff8888;" onclick="deleteShippingOptimizerLicense('${escHtml(row.id)}')">Delete</button>
                        </div>
                    </div>
                </div>`;
            })
            .join('');
    }

    function fillConfigForm(cfg) {
        const c = { ...defaultConfig(), ...(cfg || {}) };
        const wa = document.getElementById('so-whatsapp-number');
        const wm = document.getElementById('so-whatsapp-message');
        const en = document.getElementById('so-extension-enabled');
        const mv = document.getElementById('so-min-version');
        const ann = document.getElementById('so-announcement');
        if (wa) wa.value = c.whatsapp_number || c.whatsappNumber || '919654414891';
        if (wm) wm.value = c.whatsapp_message || c.whatsappMessage || '';
        if (en) en.checked = c.extension_enabled !== false;
        if (mv) mv.value = c.min_extension_version || c.minExtensionVersion || '1.0.0';
        if (ann) ann.value = c.announcement || '';
        const rawPlans = c.plans || c.pricing;
        const parsed = Array.isArray(rawPlans)
            ? rawPlans
            : rawPlans && typeof rawPlans === 'object'
              ? Object.entries(rawPlans).map(([id, p]) => ({ ...p, id: p.id || id }))
              : defaultPlans();
        renderPlansEditor(sortPlans(parsed.map((p, i) => ({ ...p, order: p.order ?? i }))));
        renderInlineDemoKeys(c.demo_keys || c.demoKeys || {});
    }

    function switchTab(tab) {
        _state.activeTab = tab;
        ['config', 'demo', 'licenses'].forEach((id) => {
            const panel = document.getElementById(`so-tab-${id}`);
            const btn = document.querySelector(`[data-so-tab="${id}"]`);
            if (panel) panel.style.display = id === tab ? 'block' : 'none';
            if (btn) {
                btn.style.background = id === tab ? 'var(--gold)' : '#222';
                btn.style.color = id === tab ? '#111' : '#ccc';
            }
        });
    }

    async function loadShippingOptimizerAdmin() {
        if (!assertSuperAdmin()) return;
        const panel = document.getElementById('shipping-optimizer-admin-panel');
        if (!panel) return;

        try {
            const status = document.getElementById('so-admin-status');
            if (status) status.textContent = 'Loading from Firebase…';

            const [configSnap, demoSnap, licenseSnap] = await Promise.all([
                db.collection(COL_CONFIG).doc(CONFIG_DOC).get(),
                db.collection(COL_DEMO).get(),
                db.collection(COL_LICENSES).orderBy('expiresAt', 'desc').limit(200).get().catch(() => db.collection(COL_LICENSES).limit(200).get()),
            ]);

            _state.config = configSnap.exists ? configSnap.data() : defaultConfig();
            _state.demoDocs = [];
            demoSnap.forEach((doc) => _state.demoDocs.push({ id: doc.id, ...doc.data() }));
            _state.licenseDocs = [];
            licenseSnap.forEach((doc) => _state.licenseDocs.push({ id: doc.id, ...doc.data() }));

            fillConfigForm(_state.config);
            renderDemoCollectionList();
            renderLicensePlanSelect();
            renderLicenseList();
            switchTab(_state.activeTab || 'config');

            if (status) {
                status.textContent = `Loaded · ${_state.licenseDocs.length} license(s) · ${_state.demoDocs.length} collection promo(s)`;
            }
        } catch (e) {
            console.error('loadShippingOptimizerAdmin error:', e);
            if (typeof showToast === 'function') {
                showToast('Failed to load Shipping Optimizer config. Check Firestore rules for superadmin write access.');
            }
        }
    }

    async function saveShippingOptimizerConfig() {
        if (!assertSuperAdmin('Only superadmin can save Shipping Optimizer config.')) return;

        const plans = readPlansFromDom().map((p) => ({
            ...p,
            id: slugifyPlanId(p.id) || p.id,
        }));
        const planError = validatePlans(plans);
        if (planError) return showToast(planError);

        const payload = {
            whatsapp_number: (document.getElementById('so-whatsapp-number')?.value || '919654414891').replace(/\D/g, ''),
            whatsapp_message: (document.getElementById('so-whatsapp-message')?.value || '').trim(),
            extension_enabled: !!document.getElementById('so-extension-enabled')?.checked,
            min_extension_version: (document.getElementById('so-min-version')?.value || '1.0.0').trim(),
            announcement: (document.getElementById('so-announcement')?.value || '').trim(),
            plans,
            plans_version: Date.now(),
            demo_keys: readInlineDemoKeysFromDom(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: (typeof auth !== 'undefined' && auth.currentUser?.email) || 'superadmin',
        };

        if (!payload.whatsapp_number || payload.whatsapp_number.length < 10) {
            return showToast('Enter a valid WhatsApp number (with country code).');
        }

        try {
            await db.collection(COL_CONFIG).doc(CONFIG_DOC).set(payload, { merge: true });
            _state.config = { ..._state.config, ...payload };
            renderLicensePlanSelect();
            showToast('✅ Shipping Optimizer config saved — extension will pick up within ~5 min.');
            const status = document.getElementById('so-admin-status');
            if (status) status.textContent = 'Saved just now';
        } catch (e) {
            console.error('saveShippingOptimizerConfig error:', e);
            showToast('Failed to save. Update Firestore rules for superadmin (see FIREBASE_SETUP.md).');
        }
    }

    async function addShippingOptimizerDemoDoc() {
        if (!assertSuperAdmin()) return;
        const keyInput = document.getElementById('so-new-demo-key');
        const daysInput = document.getElementById('so-new-demo-days');
        const labelInput = document.getElementById('so-new-demo-label');
        const key = normalizeKey(keyInput?.value);
        if (!key || key.length < 6) return showToast('Enter a valid promo key (min 6 chars).');
        const days = Number(daysInput?.value) || 30;
        const label = (labelInput?.value || '').trim();
        try {
            await db.collection(COL_DEMO).doc(key).set({
                days,
                label,
                active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            if (keyInput) keyInput.value = '';
            showToast('Promo key added to collection.');
            await loadShippingOptimizerAdmin();
            switchTab('demo');
        } catch (e) {
            console.error(e);
            showToast('Failed to add promo key.');
        }
    }

    async function toggleShippingOptimizerDemoDoc(key, makeActive) {
        if (!assertSuperAdmin()) return;
        const id = normalizeKey(key);
        const active = makeActive === true || makeActive === 'true';
        try {
            await db.collection(COL_DEMO).doc(id).set({ active: !!active }, { merge: true });
            showToast(active ? 'Promo key enabled.' : 'Promo key disabled.');
            await loadShippingOptimizerAdmin();
        } catch (e) {
            showToast('Failed to update promo key.');
        }
    }

    async function deleteShippingOptimizerDemoDoc(key) {
        if (!assertSuperAdmin()) return;
        const id = normalizeKey(key);
        if (!confirm(`Delete promo key "${id}" from collection?`)) return;
        try {
            await db.collection(COL_DEMO).doc(id).delete();
            showToast('Promo key deleted.');
            await loadShippingOptimizerAdmin();
        } catch (e) {
            showToast('Failed to delete promo key.');
        }
    }

    async function createShippingOptimizerLicense() {
        if (!assertSuperAdmin()) return;
        const keyInput = document.getElementById('so-new-license-key');
        const planSelect = document.getElementById('so-new-license-plan');
        const nameInput = document.getElementById('so-new-customer-name');
        const phoneInput = document.getElementById('so-new-customer-phone');
        const emailInput = document.getElementById('so-new-customer-email');
        const notesInput = document.getElementById('so-new-support-notes');

        let key = normalizeKey(keyInput?.value);
        if (!key) key = await generateUniqueLicenseKey();
        else if (await licenseKeyExists(key)) {
            return showToast('License key already exists — use Generate or pick another.');
        }
        if (key.length < 10) return showToast('License key too short (min 10 chars).');

        const planId = planSelect?.value || 'yearly';
        const planOpt = planSelect?.options[planSelect.selectedIndex];
        const planDays = planOpt ? Number(planOpt.dataset.days) || 365 : 365;

        const payload = {
            active: true,
            planId,
            planType: planId,
            planDays,
            expiry_starts_on_activation: true,
            expiresAt: '',
            machineId: '',
            activatedAt: '',
            customer_name: (nameInput?.value || '').trim(),
            customer_phone: (phoneInput?.value || '').trim().replace(/\D/g, ''),
            customer_email: (emailInput?.value || '').trim(),
            support_notes: (notesInput?.value || '').trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser?.email || 'superadmin',
        };

        try {
            await db.collection(COL_LICENSES).doc(key).set(payload);
            if (keyInput) keyInput.value = key;
            showToast(`✅ License ${key} created — ${planDays} days start on activation. Send via WhatsApp.`);
            await loadShippingOptimizerAdmin();
            switchTab('licenses');
        } catch (e) {
            console.error(e);
            showToast('Failed to create license.');
        }
    }

    async function toggleShippingOptimizerLicense(key, makeActive) {
        if (!assertSuperAdmin()) return;
        const id = normalizeKey(key);
        const active = makeActive === true || makeActive === 'true';
        if (!active && !confirm(`Revoke license "${id}"? Customer will lose access on next check.`)) return;
        try {
            await db.collection(COL_LICENSES).doc(id).set({ active: !!active }, { merge: true });
            showToast(active ? 'License activated.' : 'License revoked.');
            await loadShippingOptimizerAdmin();
        } catch (e) {
            showToast('Failed to update license.');
        }
    }

    async function resetShippingOptimizerLicenseDevice(key) {
        if (!assertSuperAdmin()) return;
        const id = normalizeKey(key);
        if (!confirm(`Reset device binding for "${id}"?\n\nCustomer can activate on a new device.`)) return;
        try {
            await db.collection(COL_LICENSES).doc(id).set({
                machineId: '',
                activatedAt: '',
            }, { merge: true });
            showToast('Device binding cleared.');
            await loadShippingOptimizerAdmin();
        } catch (e) {
            showToast('Failed to reset device.');
        }
    }

    async function deleteShippingOptimizerLicense(key) {
        if (!assertSuperAdmin()) return;
        const id = normalizeKey(key);
        if (!confirm(`Permanently delete license "${id}"?`)) return;
        if (prompt("Type DELETE to confirm:") !== 'DELETE') return showToast('Cancelled.');
        try {
            await db.collection(COL_LICENSES).doc(id).delete();
            showToast('License deleted.');
            await loadShippingOptimizerAdmin();
        } catch (e) {
            showToast('Failed to delete license.');
        }
    }

    window.loadShippingOptimizerAdmin = loadShippingOptimizerAdmin;
    window.saveShippingOptimizerConfig = saveShippingOptimizerConfig;
    window.addShippingOptimizerPlanRow = function addShippingOptimizerPlanRow() {
        const plans = readPlansFromDom();
        const nextOrder = plans.length ? Math.max(...plans.map((p) => p.order ?? 0)) + 1 : 0;
        plans.push({
            id: `plan_${nextOrder + 1}`,
            name: 'New Plan',
            price: 0,
            days: 30,
            duration: '30 Days',
            save: '',
            best: false,
            active: true,
            order: nextOrder,
        });
        renderPlansEditor(plans);
    };
    window.removeShippingOptimizerPlanRow = function removeShippingOptimizerPlanRow(btn) {
        btn?.closest('.so-plan-row')?.remove();
    };
    window.moveShippingOptimizerPlanRow = function moveShippingOptimizerPlanRow(btn, dir) {
        const row = btn?.closest('.so-plan-row');
        const host = document.getElementById('so-plans-editor');
        if (!row || !host) return;
        const plans = readPlansFromDom();
        const idx = [...host.querySelectorAll('.so-plan-row')].indexOf(row);
        if (idx < 0) return;
        const swap = idx + dir;
        if (swap < 0 || swap >= plans.length) return;
        [plans[idx], plans[swap]] = [plans[swap], plans[idx]];
        plans.forEach((p, i) => {
            p.order = i;
        });
        renderPlansEditor(plans);
    };
    window.addShippingOptimizerDemoRow = function addShippingOptimizerDemoRow() {
        const keys = readInlineDemoKeysFromDom();
        keys[`MEESHO-PROMO-${Object.keys(keys).length + 1}`] = { days: 30, label: '' };
        renderInlineDemoKeys(keys);
    };
    window.removeShippingOptimizerDemoRow = function removeShippingOptimizerDemoRow(btn) {
        btn?.closest('.so-demo-row')?.remove();
    };
    window.switchShippingOptimizerTab = function switchShippingOptimizerTab(tab) {
        switchTab(tab);
    };
    window.generateShippingOptimizerLicenseKey = async function generateShippingOptimizerLicenseKey() {
        const el = document.getElementById('so-new-license-key');
        const key = await generateUniqueLicenseKey();
        if (el) el.value = key;
        showToast('Unique key generated.');
    };
    window.addShippingOptimizerDemoDoc = addShippingOptimizerDemoDoc;
    window.toggleShippingOptimizerDemoDoc = toggleShippingOptimizerDemoDoc;
    window.deleteShippingOptimizerDemoDoc = deleteShippingOptimizerDemoDoc;
    window.createShippingOptimizerLicense = createShippingOptimizerLicense;
    window.toggleShippingOptimizerLicense = toggleShippingOptimizerLicense;
    window.resetShippingOptimizerLicenseDevice = resetShippingOptimizerLicenseDevice;
    window.deleteShippingOptimizerLicense = deleteShippingOptimizerLicense;
    window.filterShippingOptimizerLicenses = function filterShippingOptimizerLicenses(val) {
        _state.licenseFilter = val || '';
        renderLicenseList();
    };

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'so-new-license-plan') updateLicenseExpiryHint();
    });
})();
