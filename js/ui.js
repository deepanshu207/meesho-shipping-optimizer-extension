// UI components for Meesho Shipping Optimizer v6.0.0

const OptimizerUI = {
  frozenEstShipping: function (r) {
    return (
      r?._frozenPricing?.estShipping ??
      r?._frozenPricing?.metaEstInr ??
      r?.meta?.estInr ??
      r?.estShipping ??
      0
    );
  },

  // Create modal HTML
  createModalHTML: function () {
    const styles = `
            <style>
                .opt-modal * { box-sizing: border-box; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; }
                .opt-modal {  color: black; border-radius: 16px; }
                .opt-header { background: linear-gradient(135deg, #FFD700, #C9A227); padding: 18px 22px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
                .opt-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: white; display: flex; align-items: center; gap: 10px; }
                .opt-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; }
                .opt-close:hover { background: rgba(255,255,255,0.3); }
                .opt-body { padding: 20px;background:white; }
                .opt-section { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 15px; margin-bottom: 15px; }
                .opt-section-title { font-size: 13px; font-weight: 600; color: #a78bfa; margin-bottom: 10px; }
                .opt-label { display: block; font-size: 11px; color: #9ca3af; margin-bottom: 5px; }
                .opt-select, .opt-input { width: 100%; padding: 10px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: black; font-size: 13px; }
                .opt-select:focus, .opt-input:focus { outline: none; border-color: #667eea; }
                .opt-select option { background: #ffffff; }
                .opt-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .opt-btn { padding: 12px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
                .opt-btn-primary { background: linear-gradient(135deg, #FFD700, #C9A227); color: white; }
                .opt-btn-success { background: linear-gradient(135deg, #FFD700, #C9A227); color: white; }
                .opt-btn-danger { background: #ef4444; color: white; }
                .opt-btn-secondary { background: rgba(255,255,255,0.1); color: black; }
                .opt-btn-whatsapp { background: linear-gradient(135deg, #FFD700, #C9A227); color: white; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .opt-btn-whatsapp:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(37,211,102,0.4); }
                .opt-range { width: 100%; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); -webkit-appearance: none; }
                .opt-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #667eea; cursor: pointer; }
                .opt-badge-pos { display: flex; flex-wrap: wrap; gap: 6px; }
                .opt-badge-item { padding: 6px 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; font-size: 11px; }
                .opt-badge-item.active { background: rgba(102,126,234,0.2); border-color: #667eea; }
                .opt-shipping { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 12px; text-align: center; margin-bottom: 15px; }
                .opt-shipping-value { font-size: 24px; font-weight: 700; color: #10b981; }
                .opt-upload-box { border: 2px dashed rgba(102,126,234,0.5); border-radius: 10px; padding: 25px; text-align: center; background: rgba(102,126,234,0.05); margin-bottom: 15px; }
                .opt-upload-box:hover { border-color: #667eea; background: rgba(102,126,234,0.1); }
                .opt-file-btn { display: inline-block; background: linear-gradient(135deg, #FFD700, #C9A227); color: white; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; margin-top: 10px; }
                .opt-preview { margin-top: 12px; display: none; }
                .opt-preview img { max-width: 120px; max-height: 120px; border-radius: 8px; border: 2px solid #10b981; }
                .opt-divider { display: flex; align-items: center; margin: 15px 0; color: #0f0f10; font-size: 12px; }
                .opt-divider::before, .opt-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
                .opt-divider span { padding: 0 10px; }
                .opt-tabs { display: flex; border-bottom: 2px solid #eee; background: #fafafa; }
                .opt-tab { flex: 1; padding: 12px 10px; border: none; background: transparent; font-size: 13px; font-weight: 700; color: #666; cursor: pointer; min-height: 44px; }
                .opt-tab.active { color: #047857; background: #fff; box-shadow: inset 0 -3px 0 #C9A227; }
                .opt-tab-panel { display: none; }
                .opt-tab-panel.active { display: block; }
                .test-lab-note { font-size: 11px; color: #666; margin-top: 8px; padding: 8px; background: #eff6ff; border-radius: 6px; line-height: 1.45; border: 1px solid #dbeafe; }
                .generate-btn { width: 100%; padding: 14px; font-size: 16px; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; background: linear-gradient(135deg, #FFD700, #C9A227); color: #fff; min-height: 48px; }
                .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .generate-sticky { padding: 8px 0 4px; margin-top: 8px; }
                .session-hint { font-size: 11px; color: #666; line-height: 1.4; }
                .session-status.ok { color: #047857; }
                .session-status.warn { color: #b45309; }
                .optimizer-chrome-hidden { display: none !important; }
                .category-picker-hint { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.4; }
                #category-ac-wrap { position: relative; z-index: 10000; }
                #category-search {
                    touch-action: manipulation;
                    -webkit-user-select: text; user-select: text;
                    font-size: 16px !important;
                    min-height: 44px;
                    width: 100%;
                    padding-right: 32px;
                    color: #111827;
                    background: #fff;
                    border-color: #d1d5db;
                }
                #category-clear {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    cursor: pointer;
                    color: #9ca3af;
                    display: none;
                    z-index: 2;
                    padding: 4px;
                    line-height: 1;
                }
                .category-ac-list {
                    display: none;
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 100%;
                    margin-top: 2px;
                    max-height: 260px;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    background: #fff;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    box-shadow: 0 10px 28px rgba(0,0,0,0.15);
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    z-index: 10001;
                }
                .category-ac-list.open { display: block; }
                .category-ac-item {
                    padding: 10px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #f3f4f6;
                    font-size: 12px;
                    content-visibility: auto;
                    contain-intrinsic-size: auto 44px;
                }
                .category-ac-item:hover,
                .category-ac-item.active {
                    background: rgba(102,126,234,0.12);
                }
                .category-ac-item-name {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    color: #111827;
                    font-weight: 600;
                }
                .category-ac-item-id { font-size: 10px; color: #6b7280; font-weight: 500; white-space: nowrap; }
                .category-ac-item-path { font-size: 10px; color: #4b5563; margin-top: 2px; line-height: 1.35; }
                .category-ac-header,
                .category-ac-footer {
                    padding: 8px 12px;
                    font-size: 10px;
                    color: #6b7280;
                    background: #f9fafb;
                    border-bottom: 1px solid #f3f4f6;
                }
                .category-ac-footer { border-bottom: none; border-top: 1px solid #f3f4f6; }
                .category-ac-empty { padding: 12px; color: #6b7280; font-size: 12px; }
                @media (max-width: 640px) {
                    .opt-modal-ext { border-radius: 0 !important; min-height: 100vh; }
                    .opt-modal-ext .opt-header { border-radius: 0 !important; }
                    .opt-tab { font-size: 14px; padding: 14px 8px; }
                    .opt-body { padding: 14px !important; }
                    .opt-row { grid-template-columns: 1fr !important; }
                }
            </style>
        `;

    if (window.WEB_OPTIMIZER_MODE) {
      return styles + this.getWebHTML();
    }

    return styles + this.getMainHTML();
  },

  /** Shared local price panel — used in extension modal and web fallback HTML. */
  getLocalPricePanelHTML: function () {
    return `
                    <div class="local-price-panel" style="margin-top:10px;padding:10px;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;">
                        <div style="font-size:11px;font-weight:700;color:#047857;margin-bottom:6px;">📦 Local Price History</div>
                        <p id="local-price-hint" style="font-size:10px;color:#6b7280;margin:0 0 8px;line-height:1.4;">Floor band (e.g. ₹59+60) for new images even if live showed ₹68. Use 4 variants for two ₹59 + two ₹60 uploads.</p>
                        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                            <label style="font-size:10px;color:#047857;flex:1;">Variants to show</label>
                            <select id="local-price-pick-count" class="opt-select" style="flex:1;font-size:12px;padding:6px 8px;">
                                <option value="2" selected>2 lowest</option>
                                <option value="3">3 lowest</option>
                                <option value="4">4 lowest</option>
                                <option value="5">5 lowest</option>
                                <option value="6">6 lowest</option>
                                <option value="8">8 lowest</option>
                                <option value="10">10 lowest</option>
                            </select>
                        </div>
                        <button type="button" id="local-price-generate-btn" disabled style="width:100%;padding:10px 8px;font-size:13px;font-weight:700;border:none;border-radius:8px;background:#047857;color:#fff;cursor:pointer;min-height:44px;touch-action:manipulation;margin-bottom:6px;">📍 Generate 2 Local Variants</button>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
                            <button type="button" id="local-price-save-btn" style="flex:1;min-width:72px;padding:8px 6px;font-size:12px;font-weight:600;border:none;border-radius:8px;background:linear-gradient(135deg,#FFD700,#C9A227);color:#fff;cursor:pointer;min-height:40px;touch-action:manipulation;">💾 Save</button>
                            <button type="button" id="local-price-view-btn" style="flex:1;min-width:72px;padding:8px 6px;font-size:12px;font-weight:600;border:none;border-radius:8px;background:#065f46;color:#fff;cursor:pointer;min-height:40px;touch-action:manipulation;">📊 View</button>
                            <button type="button" id="local-price-download-btn" style="flex:1;min-width:72px;padding:8px 4px;font-size:11px;font-weight:600;border:1px solid #a7f3d0;border-radius:8px;background:#fff;color:#047857;cursor:pointer;min-height:40px;touch-action:manipulation;">📥 CSV</button>
                            <button type="button" id="local-price-import-btn" style="flex:1;min-width:72px;padding:8px 4px;font-size:11px;font-weight:600;border:1px solid #a7f3d0;border-radius:8px;background:#fff;color:#047857;cursor:pointer;min-height:40px;touch-action:manipulation;">📤 Import</button>
                            <button type="button" id="local-price-clear-btn" style="flex:0 0 auto;padding:8px;font-size:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;cursor:pointer;min-height:40px;">🗑️</button>
                        </div>
                        <input type="file" id="local-price-import-input" accept=".csv,text/csv" style="display:none;">
                    </div>`;
  },

  // Simplified web UI — upload only, no session/category setup
  getWebHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2><span>🚀</span> Upload & Optimize</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, #FFD700, #C9A227),rgba(102,126,234,0.1));border:1px solid rgba(16,185,129,0.3);">
                        <div class="opt-section-title" style="color:#10b981;">🎯 Smart Mode <span style="font-size:9px;font-weight:500;color:#9ca3af;">(🚀 Generate Variants)</span></div>
                        <div class="opt-row" style="margin-bottom:10px;">
                            <div>
                                <label class="opt-label">Target Shipping</label>
                                <select id="target-shipping" class="opt-select" style="font-size:13px;font-weight:600;">
                                    <option value="30">≤ ₹30</option>
                                    <option value="40">≤ ₹40</option>
                                    <option value="50">≤ ₹50</option>
                                    <option value="60">≤ ₹60</option>
                                    <option value="70">≤ ₹70</option>
                                    <option value="80" selected>≤ ₹80</option>
                                    <option value="90">≤ ₹90</option>
                                    <option value="100">≤ ₹100</option>
                                </select>
                            </div>
                            <div>
                                <label class="opt-label">Max Variants</label>
                                <select id="max-attempts" class="opt-select">
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="50" selected>50</option>
                                    <option value="80">80</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div style="font-size:10px;color:#6b7280;margin-top:6px;">For 🚀 Generate Variants only · Local uses pick count below</div>
                    </div>

                    <div class="opt-section" style="padding:10px;">
                        <div class="opt-section-title">✏️ Text on image (optional)</div>
                        <input type="text" id="custom-text" class="opt-input" placeholder="e.g. FREE SHIPPING" style="font-size:12px;">
                    </div>

                    <div class="opt-upload-box" id="upload-area">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <div style="font-size:15px;font-weight:600;margin-bottom:5px;">Tap to upload product image</div>
                        <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;">JPG, PNG, WebP</div>
                        <label class="opt-file-btn" for="image-input">Choose Image</label>
                        <input type="file" id="image-input" accept="image/*" style="display:none;">
                        <div class="opt-preview" id="preview-box">
                            <img id="preview-img" alt="Preview">
                            <div style="color:#10b981;font-size:11px;margin-top:5px;">Ready</div>
                            <button type="button" id="clear-upload-btn" style="margin-top:8px;padding:8px 14px;font-size:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;cursor:pointer;">Cancel &amp; upload again</button>
                        </div>
                    </div>

                    <div class="generate-sticky" id="generate-sticky">
                        <button type="button" id="generate-btn" class="generate-btn" disabled>🚀 Generate Variants</button>
                    </div>

                    ${this.getLocalPricePanelHTML()}

                    <div id="processing-area" style="display:none;"></div>
                    <div id="results-area" style="display:none;"></div>
                </div>
            </div>
        `;
  },

  // License activation HTML with WhatsApp button and pricing plans
  getLicenseHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2><span>🔐</span> License Required</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div style="text-align:center;padding:10px 0;">
                        <div style="font-size:40px;margin-bottom:8px;">🚀</div>
                        <h3 style="margin:0 0 5px 0;color:black;">Meesho Shipping Cost AI Optimizer</h3>
                        <p style="color:#9ca3af;font-size:12px;margin-bottom:10px;">Reduce shipping costs by up to 40%</p>
                    </div>
                    
                    <!-- Pricing Plans -->
                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="text-align:center;margin-bottom:12px;">💎 Click Plan to Buy</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <!-- Monthly -->
                            <button class="plan-buy-btn" data-plan="monthly" data-price="599" data-duration="1 Month" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">Monthly</div>
                                <div style="font-size:20px;font-weight:700;color:#667eea;">₹599</div>
                                <div style="font-size:9px;color:#0f0f10;">30 days</div>
                            </button>
                            <!-- 3 Months -->
                            <button class="plan-buy-btn" data-plan="quarterly" data-price="1399" data-duration="3 Months" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">3 Months</div>
                                <div style="font-size:20px;font-weight:700;color:#667eea;">₹1399</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹1000</div>
                            </button>
                            <!-- 6 Months -->
                            <button class="plan-buy-btn" data-plan="halfyearly" data-price="2299" data-duration="6 Months" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">6 Months</div>
                                <div style="font-size:20px;font-weight:700;color:#667eea;">₹2299</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹3000</div>
                            </button>
                            <!-- Yearly - Best Value -->
                            <button class="plan-buy-btn" data-plan="yearly" data-price="3099" data-duration="1 Year" style="background:linear-gradient(135deg, #FFD700, #C9A227),rgba(118,75,162,0.15));border:2px solid #667eea;border-radius:8px;padding:10px;text-align:center;position:relative;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, #FFD700, #C9A227);color:white;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:700;">BEST VALUE</div>
                                <div style="font-size:11px;color:#a78bfa;margin-top:4px;">Yearly</div>
                                <div style="font-size:20px;font-weight:700;color:#10b981;">₹3099</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹8000</div>
                            </button>
                        </div>
                        <div style="margin-top:10px;padding:8px;background:rgba(167,139,250,0.1);border-radius:6px;border:1px solid rgba(167,139,250,0.2);">
                            <div style="font-size:10px;color:#a78bfa;font-weight:600;margin-bottom:4px;">✨ Yearly Plan Exclusive:</div>
                            <div style="font-size:9px;color:#9ca3af;line-height:1.4;">Beta Updates • Upcoming Features • Premium Badges • Priority Support • Advanced Analytics</div>
                        </div>
                    </div>
                    
                    <div class="opt-section" style="padding:12px;">
                        <label class="opt-label">Already have a License Key?</label>
                        <input type="text" id="license-key-input" class="opt-input" placeholder="Enter your license key" style="margin-bottom:10px;font-size:13px;">
                        <button id="activate-license-btn" class="opt-btn opt-btn-success" style="width:100%;padding:10px;">Activate License</button>
                    </div>
                    
                    <p style="margin-top:8px;font-size:10px;color:#0f0f10;text-align:center;">
                        Click on any plan to buy via WhatsApp • Instant activation
                    </p>
                </div>
            </div>
        `;
  },

  getTestLabPanelHTML: function (options = {}) {
    const ext = !!options.extension;
    const sessionNote = ext
      ? `<div id="test-lab-session-hint" class="session-hint session-status ok" style="margin-top:8px;display:block;">✅ Same Live pipeline + adaptive lowest-₹ hunt (skips higher once best is known)</div>`
      : `<div id="test-lab-session-hint" class="session-hint" style="margin-top:8px;display:none;"></div>`;
    return `
                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, rgba(4,120,87,0.12), rgba(102,126,234,0.08));border:1px solid rgba(4,120,87,0.25);">
                        <div class="opt-section-title" style="color:#047857;">🧪 Test Lab — Live logic + adaptive hunt</div>
                        <p class="test-lab-note" style="margin-bottom:10px;">Mirrors Live tab (same generate, analysis, editor). Once a best ₹ is found, higher shipping variants are skipped and next tries bias smaller borders / lower KB.</p>
                        ${sessionNote}
                        <div class="opt-row" style="margin-bottom:10px;">
                            <div>
                                <label class="opt-label" for="test-target-shipping">Target Shipping</label>
                                <select id="test-target-shipping" class="opt-select" style="font-size:13px;font-weight:600;">
                                    <option value="30">≤ ₹30</option>
                                    <option value="40">≤ ₹40</option>
                                    <option value="50" selected>≤ ₹50</option>
                                    <option value="60">≤ ₹60</option>
                                    <option value="70">≤ ₹70</option>
                                    <option value="80">≤ ₹80</option>
                                    <option value="90">≤ ₹90</option>
                                    <option value="100">≤ ₹100</option>
                                </select>
                            </div>
                            <div>
                                <label class="opt-label" for="test-max-attempts">Max Tries</label>
                                <select id="test-max-attempts" class="opt-select">
                                    <option value="50">50</option>
                                    <option value="100" selected>100</option>
                                    <option value="200">200</option>
                                </select>
                            </div>
                        </div>
                        <div style="font-size:10px;color:#047857;padding:6px;background:rgba(255,255,255,0.5);border-radius:4px;">
                            ⏭️ Skips ₹ above current best · biases next tries lower
                        </div>
                    </div>
                    <div class="opt-section" style="padding:10px;">
                        <div class="opt-section-title">✏️ Text (Optional)</div>
                        <input type="text" id="test-custom-text" class="opt-input" placeholder="e.g. FREE SHIPPING" style="font-size:12px;">
                    </div>`;
  },

  // Main optimizer HTML (after license) - Enhanced UI, Smart Mode Auto-Selected
  getMainHTML: function () {
    return `
            <div class="opt-modal opt-modal-ext">
                <div class="opt-header">
                    <h2><span>🚀</span> Meesho Shipping Cost AI Optimizer</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-tabs" id="optimizer-tabs" role="tablist">
                    <button type="button" class="opt-tab active" data-optimizer-tab="live" role="tab">Live</button>
                    <button type="button" class="opt-tab" data-optimizer-tab="test" role="tab">Test Lab</button>
                </div>
                <div class="opt-body">
                    <div id="live-tab-panel" class="opt-tab-panel active" data-optimizer-panel="live">
                    <div class="opt-shipping">
                        <div style="font-size:11px;color:#9ca3af;">Current Shipping</div>
                        <div class="opt-shipping-value" id="current-shipping">Detecting...</div>
                    </div>

                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>📁 Category (Required)</span>
                            <button id="refresh-categories" style="background:rgba(102,126,234,0.2);border:none;color:#a78bfa;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;display:none;" title="Refresh">🔄</button>
                        </div>
                        <div id="category-ac-wrap">
                            <input type="text" id="category-search" class="opt-input" placeholder="Search 3777 categories by name or ID…" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="category-ac-list" disabled>
                            <button type="button" id="category-clear" aria-label="Clear category" title="Clear">✕</button>
                            <ul id="category-ac-list" class="category-ac-list" role="listbox" aria-label="Category suggestions"></ul>
                        </div>
                        <input type="hidden" id="category-select" value="">
                        <p class="category-picker-hint" id="category-count-hint">Loading categories…</p>
                        <p class="category-picker-hint">Type to search all categories · quick picks when empty</p>
                        <div id="category-error" style="display:none;margin-top:8px;padding:8px;background:rgba(239,68,68,0.15);border-radius:6px;border:1px solid rgba(239,68,68,0.3);">
                            <span style="font-size:11px;color:#ef4444;">⚠️ Categories not loaded. Click 🔄 Refresh or reload page.</span>
                        </div>
                        <div id="selected-category" style="margin-top:8px;padding:8px;background:rgba(102,126,234,0.15);border-radius:6px;display:none;">
                            <span style="font-size:11px;color:#a78bfa;">✓ </span>
                            <span id="selected-category-name" style="font-size:12px;color:black;font-weight:600;"></span>
                            <div id="selected-category-detail" style="font-size:10px;color:#4b5563;margin-top:4px;line-height:1.4;"></div>
                        </div>
                        <div id="category-api-preview" style="font-size:10px;color:#9ca3af;margin-top:6px;line-height:1.4;display:none;"></div>
                    </div>

                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, #FFD700, #C9A227),rgba(102,126,234,0.1));border:1px solid rgba(16,185,129,0.3);">
                        <div class="opt-section-title" style="color:#10b981;">🎯 Smart Mode <span style="font-size:9px;font-weight:500;color:#9ca3af;">(🚀 Generate Variants)</span></div>
                        <div class="opt-row" style="margin-bottom:10px;">
                            <div>
                                <label class="opt-label">Target Shipping</label>
                                <select id="target-shipping" class="opt-select" style="font-size:13px;font-weight:600;">
                                    <option value="30" style="color:black">≤ ₹30</option>
                                    <option value="40" style="color:black">≤ ₹40</option>
                                    <option value="50" style="color:black">≤ ₹50</option>
                                    <option value="60" style="color:black">≤ ₹60</option>
                                    <option value="70" style="color:black">≤ ₹70</option>
                                    <option value="80" selected style="color:black">≤ ₹80</option>
                                    <option value="90" style="color:black">≤ ₹90</option>
                                    <option value="100" style="color:black">≤ ₹100</option>
                                </select>
                            </div>
                            <div>
                                <label class="opt-label">Max Variants</label>
                                <select id="max-attempts" class="opt-select">
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="80" selected>80</option>
                                    <option value="100">100</option>
                                    <option value="200">200</option>
                                </select>
                            </div>
                        </div>
                        <div style="font-size:10px;color:#9ca3af;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;">
                            ⚡ Uses Target + Max Variants above · Local pick count is separate
                        </div>
                    </div>

                    <div class="opt-section" style="padding:10px;">
                        <div class="opt-section-title">✏️ Text (Optional)</div>
                        <input type="text" id="custom-text" class="opt-input" placeholder="e.g. FREE SHIPPING" style="font-size:12px;">
                    </div>
                    </div>

                    <div id="test-tab-panel" class="opt-tab-panel" data-optimizer-panel="test">
                        ${this.getTestLabPanelHTML({ extension: true })}
                    </div>

                    <div class="opt-upload-box" id="upload-area">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <div style="font-size:15px;font-weight:600;margin-bottom:5px;">Upload Product Image</div>
                        <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;">JPG, PNG, WebP</div>
                        <label class="opt-file-btn" for="image-input">Choose File</label>
                        <input type="file" id="image-input" accept="image/*" style="display:none;">
                        <div class="opt-preview" id="preview-box">
                            <img id="preview-img" alt="Preview">
                            <div style="color:#10b981;font-size:11px;margin-top:5px;">Ready</div>
                            <button type="button" id="clear-upload-btn" style="margin-top:8px;padding:8px 14px;font-size:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;cursor:pointer;">Cancel &amp; upload again</button>
                        </div>
                    </div>

                    <div class="generate-sticky" id="generate-sticky">
                        <button type="button" id="generate-btn" class="generate-btn" disabled>🚀 Generate Variants</button>
                        <button type="button" id="test-generate-btn" class="generate-btn" disabled style="display:none;margin-top:8px;">🧪 Run Test Lab</button>
                    </div>

                    ${this.getLocalPricePanelHTML()}

                    <div id="processing-area" style="display:none;"></div>
                    <div id="results-area" style="display:none;"></div>
                </div>
            </div>
        `;
  },


  // Processing HTML
  getProcessingHTML: function (current, total, imgUrl) {
    const pct = Math.round((current / total) * 100);
    const remaining = total - current;
    const estSeconds = remaining * 5;
    let estText = "";
    if (estSeconds > 0) {
      if (estSeconds < 60) {
        estText = `~${estSeconds}s remaining`;
      } else {
        estText = `~${Math.ceil(estSeconds / 60)}m remaining`;
      }
    }

    return `
            <div style="text-align:center;padding:20px;">
                ${
                  imgUrl
                    ? '<img src="' +
                      imgUrl +
                      '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #667eea;margin-bottom:15px;">'
                    : ""
                }
                <div style="width:50px;height:50px;border:4px solid rgba(255,255,255,0.1);border-top:4px solid #667eea;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 15px;"></div>
                <h3 style="margin:0 0 8px 0;color:black;font-size:16px;">Processing Images</h3>
                <p style="color:#9ca3af;font-size:12px;margin-bottom:8px;">Testing variation ${current} of ${total}</p>
                <p style="color:#667eea;font-size:11px;margin-bottom:15px;">${estText}</p>
                <div style="background:rgba(255,255,255,0.1);border-radius:8px;height:10px;margin-bottom:8px;overflow:hidden;">
                    <div style="width:${pct}%;background:linear-gradient(135deg, #FFD700, #C9A227);height:100%;border-radius:8px;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:11px;color:#a78bfa;margin-bottom:15px;">${pct}% Complete</div>
                <button id="stop-btn" class="opt-btn opt-btn-danger" style="padding:8px 20px;font-size:12px;">Stop & Show Results</button>
            </div>
            <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
  },

  // Single result card — reused for main grid, framed extras, and Test Lab
  renderResultCard: function (r, i, options) {
    options = options || {};
    const baseline = options.baselineShipping || 0;
    const manualMode = !!options.manualMode;
    const testLabMode = !!options.testLabMode;
    const analysisMode = !!options.analysisMode || !!r.analysisMode;
    const localPriceMode = !!options.localPriceMode;
    const isWeb = !!window.WEB_OPTIMIZER_MODE;
    const applyLabel = isWeb ? "Save" : "Apply";
    const isLocalPick = !!r.localRecommended;
    const localTargetTier =
      Number(r.localEstShipping || r.meta?.localTier || 0) || 0;
    const isRecommended = !!r.recommended || !!r.meta?.recommended;
    const isBest = isLocalPick || !!options.isBest;
    const showPerCardApply = !isWeb && !isBest && !analysisMode;
    const staticEst =
      r.meta?.staticEst ??
      r._frozenPricing?.estShipping ??
      r._frozenPricing?.metaEstInr ??
      r.meta?.estInr ??
      r.estShipping ??
      0;
    const kbLabel =
      r.meta?.kb ||
      (r.blob?.size ? Math.ceil(r.blob.size / 1024) : null);
    const frozenShip = r._frozenPricing?.shippingCost ?? r.shippingCost ?? 0;
    const priceLabel = localPriceMode
      ? isLocalPick
        ? localTargetTier > 0
          ? "★ target ₹" + localTargetTier
          : "★ Local pick"
        : r.name || "Variant"
      : testLabMode || analysisMode
      ? frozenShip > 0
        ? "₹" + frozenShip
        : "est ₹" + staticEst
      : frozenShip > 0
      ? "₹" + frozenShip
      : staticEst > 0
      ? "est ₹" + staticEst
      : manualMode
      ? "—"
      : "Ready";
    const savings =
      baseline > 0 && r.shippingCost > 0 ? baseline - r.shippingCost : 0;
    const staticPromoEditor = OptimizerUI.isStaticPromoEditorRow(r);
    const canEdit =
      !testLabMode &&
      !!(r.layers && (r.layers.full || r.layers.productOnly || staticPromoEditor));
    const edited =
      r._badgesRepositioned ||
      r._staticAppearanceEdited ||
      r.editFlags?.stickersRemoved ||
      r.editFlags?.borderOnlyRemoved ||
      r.editFlags?.cleanProduct ||
      r.editFlags?.borderRemoved ||
      r.editFlags?.stickersAdded ||
      r.editFlags?.borderAdded ||
      r.editFlags?.fullDecorationsAdded;
    const vid = r.variantId || "var-" + i;
    const imgSrc = testLabMode
      ? OptimizerUI.pickResultImageSrc(r)
      : staticPromoEditor
      ? r.imageUrl || OptimizerUI.pickResultImageSrc(r)
      : analysisMode
      ? OptimizerUI.pickResultImageSrc(r)
      : r.imageUrl || OptimizerUI.pickResultImageSrc(r);
    const styleTag = testLabMode
      ? `<div style="font-size:8px;color:#2563eb;margin-bottom:2px;">${r.meta?.path || "test"} · ${r.meta?.kb || "?"}KB</div>`
      : r.variantStyle === "framed"
      ? `<div style="font-size:8px;color:#2563eb;margin-bottom:2px;">${r.meta?.productW || "?"}×${r.meta?.productH || "?"}px · ${r.meta?.actualKb || r.meta?.targetKb || "?"}KB</div>`
      : r.variantStyle === "product_only"
      ? `<div style="font-size:8px;color:#047857;margin-bottom:2px;">product only · ${r.meta?.kb || "?"}KB</div>`
      : r.variantStyle === "analysis" || r.analysisMode
      ? `<div style="font-size:8px;color:#2563eb;margin-bottom:2px;">${r.meta?.path || "analysis"} · ${r.meta?.kb || "?"}KB</div>`
      : localPriceMode
      ? `<div style="font-size:8px;color:#047857;margin-bottom:2px;">${r.meta?.path || "standard"} · ${kbLabel || "?"}KB</div>`
      : r.noPid
      ? `<div style="font-size:8px;color:#b45309;margin-bottom:2px;">no PID · kept</div>`
      : "";

    return `
                <div class="result-card" data-variant-id="${vid}" style="background:${
                  isBest ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)"
                };border:1px solid ${
      isBest ? "#10b981" : "rgba(255,255,255,0.1)"
    };border-radius:8px;padding:8px;text-align:center;position:relative;">
                    ${
                      isLocalPick
                        ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#047857;color:white;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">★ LOCAL PICK</div>'
                        : isBest
                        ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">🏆 BEST</div>'
                        : isRecommended
                        ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">★ RECOMMEND</div>'
                        : ""
                    }
                    <span class="result-edit-badge" data-variant-id="${vid}" style="display:${
      edited ? "block" : "none"
    };position:absolute;top:4px;right:4px;background:#667eea;color:#fff;font-size:8px;padding:2px 5px;border-radius:4px;">✂️</span>
                    <img src="${imgSrc}" class="result-img" data-variant-id="${vid}" title="${
      canEdit
        ? staticPromoEditor
          ? "Tap to edit colors, zoom, pan, and badges"
          : "Tap to edit border & stickers"
        : testLabMode
        ? "Tap to preview"
        : ""
    }" style="width:100%;height:55px;object-fit:contain;border-radius:4px;background:rgba(0,0,0,0.2);margin-bottom:4px;margin-top:${
      isBest ? "4px" : "0"
    };cursor:${canEdit || testLabMode ? "pointer" : "default"};" loading="lazy">
                    ${styleTag}
                    ${
                      canEdit
                        ? `<div style="font-size:9px;color:#6b7280;margin-bottom:2px;">${staticPromoEditor ? "Tap image to edit colors, zoom, pan, and badges" : "Tap image to edit"}</div>`
                        : ""
                    }
                    <div class="result-price-label" style="font-size:14px;font-weight:700;color:${
                      isBest ? "#10b981" : "black"
                    };">${priceLabel}</div>
                    ${
                      analysisMode
                        ? '<div style="font-size:8px;color:#2563eb;font-weight:600;">static est</div>'
                        : localPriceMode
                        ? localTargetTier > 0
                        ? '<div style="font-size:8px;color:#047857;font-weight:600;">floor band — verify on Meesho</div>'
                        : '<div style="font-size:8px;color:#047857;font-weight:600;">not live — verify on Meesho</div>'
                        : testLabMode && r.shippingCost > 0
                        ? '<div style="font-size:8px;color:#047857;font-weight:600;">✓ live Meesho</div>'
                        : testLabMode && r.liveChecked
                        ? '<div style="font-size:8px;color:#b45309;">checked</div>'
                        : ""
                    }
                    ${
                      savings > 0 && !localPriceMode
                        ? `<div style="font-size:9px;color:#10b981;">Save ₹${savings}</div>`
                        : ""
                    }
                    ${
                      manualMode
                        ? `<input type="number" class="manual-price-input opt-input" data-variant-id="${vid}" value="${
                            r.shippingCost > 0 ? r.shippingCost : ""
                          }" min="0" max="999" placeholder="₹" style="width:100%;margin-top:4px;padding:4px;font-size:12px;text-align:center;">`
                        : ""
                    }
                    <div style="display:flex;gap:4px;margin-top:4px;">
                        <button class="dl-btn" data-variant-id="${vid}" style="${
      showPerCardApply ? "flex:1;" : "width:100%;"
    }background:rgba(102,126,234,0.2);color:#a78bfa;border:none;padding:3px;border-radius:4px;cursor:pointer;font-size:9px;">Save</button>
                        ${
                          showPerCardApply
                            ? `<button class="apply-btn" data-variant-id="${vid}" style="flex:1;background:rgba(255,255,255,0.1);color:white;border:none;padding:3px;border-radius:4px;cursor:pointer;font-size:9px;">${applyLabel}</button>`
                            : ""
                        }
                    </div>
                </div>
            `;
  },


  formatAnalysisTypeLabel: function (analysis) {
    if (!analysis) return "Product image";
    const parts = [];
    if (analysis.tall) parts.push("Tall portrait");
    else if (analysis.collage) parts.push("Wide collage");
    else if (analysis.studioBg) parts.push("Studio background");
    else parts.push("Standard product");
    if (analysis.resolvedCategory) parts.push(analysis.resolvedCategory);
    if (analysis.width && analysis.height) {
      parts.push(`${analysis.width}×${analysis.height}px`);
    }
    if (analysis.aspect) parts.push(`aspect ${analysis.aspect}`);
    return parts.join(" · ");
  },

  renderAnalysisSection: function (options, sectionOptions) {
    sectionOptions = sectionOptions || {};
    const primary = options.analysisPrimary || [];
    const extras = options.analysisExtras || [];
    if (!primary.length) return "";

    const analysis = options.liveAnalysis || {};
    const showExtras = !!options.showAnalysisExtras;
    const baseline = options.baselineShipping || 0;
    const standalone = !!sectionOptions.standalone;
    const sorted = [...primary].sort(
      (a, b) =>
        (a.estShipping || a.meta?.estInr || 999) -
        (b.estShipping || b.meta?.estInr || 999),
    );
    const bestEst =
      sorted[0]?.estShipping || sorted[0]?.meta?.estInr || 0;
    const typeLabel = this.formatAnalysisTypeLabel(analysis);
    const tips = Array.isArray(analysis.smartTips)
      ? analysis.smartTips.join(" · ")
      : analysis.smartTips || analysis.suggested || "";
    const variantNote = analysis.variantCount
      ? `${analysis.variantCount} strategies ranked locally`
      : `${primary.length} preview options`;

    let html = `
            <div style="margin-bottom:15px;${
              standalone ? "" : "border-top:1px solid rgba(0,0,0,0.08);padding-top:12px;"
            }">
                <div style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">
                    <div style="font-size:11px;color:#2563eb;">📊 Static Analysis (no Meesho session)</div>
                    <div style="font-size:24px;font-weight:700;color:#1d4ed8;">est ₹${bestEst}</div>
                    <div style="font-size:10px;color:#2563eb;margin-top:2px;">${typeLabel}</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:4px;">${variantNote} · estimated ₹ only</div>
                    ${
                      tips
                        ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;">${tips}</div>`
                        : ""
                    }
                    ${
                      baseline > 0
                        ? `<div style="font-size:10px;color:#666;margin-top:4px;">Your current shipping: ₹${baseline}</div>`
                        : ""
                    }
                </div>
                <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;text-align:center;">6 analysis previews — tap image for 6 edit options (remove + add)</div>
                <div class="analysis-primary-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;max-height:480px;overflow-y:auto;">
        `;

    sorted.forEach((r, i) => {
      html += this.renderResultCard(r, i, {
        baselineShipping: baseline,
        manualMode: false,
        analysisMode: true,
        isBest: i === 0,
      });
    });

    html += `</div>`;

    if (extras.length > 0) {
      const extrasSorted = [...extras].sort(
        (a, b) =>
          (a.estShipping || a.meta?.estInr || 999) -
          (b.estShipping || b.meta?.estInr || 999),
      );
      const extrasBest =
        extrasSorted[0]?.estShipping || extrasSorted[0]?.meta?.estInr || 0;
      html += `
                <button type="button" id="toggle-analysis-extras" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;font-size:12px;margin-bottom:6px;">
                    ${showExtras ? "▼" : "▶"} See more analysis variants (${extras.length}) — best est ₹${extrasBest}
                </button>
                <p style="font-size:10px;color:#6b7280;margin-bottom:8px;text-align:center;">More image types from analysis — static est ₹, no live Meesho hit.</p>
                <div id="analysis-extras-panel" style="display:${showExtras ? "block" : "none"};">
                    <div class="analysis-extras-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:480px;overflow-y:auto;">
        `;
      extrasSorted.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode: false,
          analysisMode: true,
          isBest: false,
        });
      });
      html += `
                    </div>
                </div>
        `;
    }

    html += `</div>`;
    return html;
  },

  renderStaticPromoHub: function (options) {
    if (!window.WEB_OPTIMIZER_MODE || !options.staticPromoHubActive) return "";

    options = options || {};
    const showcase = options.showcaseResults || [];
    const promo = options.promoLifestyleResults || [];
    const tall = options.tallStaticResults || [];
    const gown = options.gownStaticResults || [];
    const genShowcase = !!options.isGeneratingShowcase;
    const genPromo = !!options.isGeneratingPromoLifestyle;
    const genTall = !!options.isGeneratingTallStatic;
    const genGown = !!options.isGeneratingGownStatic;
    const count = options.showcaseVariantCount || 25;

    const bestEst = (list) => {
      const s = [...list].sort(
        (a, b) =>
          (OptimizerUI.frozenEstShipping(a) || 999) -
          (OptimizerUI.frozenEstShipping(b) || 999),
      );
      return OptimizerUI.frozenEstShipping(s[0]);
    };

    const chip = (label, n, best, doneColor) =>
      n > 0
        ? `<span style="display:inline-block;padding:4px 8px;border-radius:6px;background:${doneColor};font-size:10px;font-weight:600;">${label}: ${n} variants · est ₹${best}</span>`
        : `<span style="display:inline-block;padding:4px 8px;border-radius:6px;background:#f3f4f6;color:#6b7280;font-size:10px;">${label}: not generated</span>`;

    const btnStyle = (bg, busy) =>
      `width:100%;padding:12px;font-size:13px;border:none;border-radius:8px;color:#fff;cursor:pointer;background:${bg};${
        busy ? "opacity:0.65;pointer-events:none;" : ""
      }`;

    return `
      <div id="static-promo-hub" style="margin-bottom:16px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:12px;background:linear-gradient(180deg,#fafafa,#fff);">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px;text-align:center;">🎨 Static Promo Studio</div>
        <p style="font-size:10px;color:#6b7280;text-align:center;margin:0 0 10px;">Generate showcase, lifestyle, tall, or gown promo — same image, no refresh needed</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">
          <button type="button" data-static-gen="showcase" class="generate-btn" style="${btnStyle("linear-gradient(135deg,#ff9800,#4caf50)", genShowcase)}" ${genShowcase ? "disabled" : ""}>
            ${genShowcase ? "Generating showcase frames…" : `🖼️ Generate Showcase Frames (${count})`}
          </button>
          <button type="button" data-static-gen="lifestyle" class="generate-btn" style="${btnStyle("#22c55e", genPromo)}" ${genPromo ? "disabled" : ""}>
            ${genPromo ? "Generating lifestyle promo…" : `🏷️ Generate Lifestyle Promo (${count})`}
          </button>
          <button type="button" data-static-gen="tall" class="generate-btn" style="${btnStyle("#7c3aed", genTall)}" ${genTall ? "disabled" : ""}>
            ${genTall ? "Generating tall promo…" : `📐 Generate Tall Promo (${count})`}
          </button>
          <button type="button" data-static-gen="gown" class="generate-btn" style="${btnStyle("#0d9488", genGown)}" ${genGown ? "disabled" : ""}>
            ${genGown ? "Generating gown promo…" : `👗 Generate Gown Promo (${count})`}
          </button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
          ${chip("Showcase", showcase.length, bestEst(showcase), "rgba(255,152,0,0.15)")}
          ${chip("Lifestyle", promo.length, bestEst(promo), "rgba(34,197,94,0.15)")}
          ${chip("Tall", tall.length, bestEst(tall), "rgba(124,58,237,0.15)")}
          ${chip("Gown", gown.length, bestEst(gown), "rgba(13,148,136,0.15)")}
        </div>
      </div>`;
  },

  renderShowcaseSection: function (options) {
    if (!window.WEB_OPTIMIZER_MODE) return "";

    options = options || {};
    const showcase = options.showcaseResults || [];
    const showPanel = !!options.showShowcaseResults;
    const generating = !!options.isGeneratingShowcase;
    const baseline = options.baselineShipping || 0;
    const count = options.showcaseVariantCount || 25;
    const sorted = [...showcase].sort(
      (a, b) =>
        (a.estShipping || a.meta?.estInr || 999) -
        (b.estShipping || b.meta?.estInr || 999),
    );
    const bestEst =
      sorted[0]?.estShipping || sorted[0]?.meta?.estInr || 0;

    let html = `
            <div style="margin-bottom:15px;border-top:1px solid rgba(0,0,0,0.08);padding-top:12px;">
                <div style="background:rgba(255,152,0,0.1);border:1px solid rgba(76,175,80,0.35);border-radius:10px;padding:12px;margin-bottom:10px;text-align:center;">
                    <div style="font-size:11px;color:#e65100;">🖼️ Showcase Promo Frames</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:4px;">Tight portrait frame · orange→green gradient · 3 quality badges</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">Static only — no Meesho session · tap image to edit colors, zoom, pan, and badges</div>
                </div>
        `;

    if (showcase.length > 0) {
      html += `
                <button type="button" id="toggle-showcase-results" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;font-size:12px;margin-bottom:6px;">
                    ${showPanel ? "▼" : "▶"} See more showcase variants (${showcase.length}) — best est ₹${bestEst}
                </button>
                <div id="showcase-results-panel" style="display:${showPanel ? "block" : "none"};">
                    <div class="showcase-results-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:520px;overflow-y:auto;">
        `;
      sorted.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode: false,
          analysisMode: true,
          isBest: i === 0,
        });
      });
      html += `
                    </div>
                </div>
        `;
    }

    html += `</div>`;
    return html;
  },

  renderPromoLifestyleSection: function (options) {
    if (!window.WEB_OPTIMIZER_MODE) return "";

    options = options || {};
    const promo = options.promoLifestyleResults || [];
    const showPanel = !!options.showPromoLifestyleResults;
    const generating = !!options.isGeneratingPromoLifestyle;
    const baseline = options.baselineShipping || 0;
    const count = options.promoLifestyleVariantCount || 25;
    const sorted = [...promo].sort(
      (a, b) =>
        (a.estShipping || a.meta?.estInr || 999) -
        (b.estShipping || b.meta?.estInr || 999),
    );
    const bestEst =
      sorted[0]?.estShipping || sorted[0]?.meta?.estInr || 0;

    let html = `
            <div style="margin-bottom:15px;border-top:1px solid rgba(0,0,0,0.08);padding-top:12px;">
                <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:12px;margin-bottom:10px;text-align:center;">
                    <div style="font-size:11px;color:#15803d;">🏷️ Lifestyle Promo (₹54 band)</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:4px;">Keeps trellis/lifestyle scene · solid green frame · HOT/FLASH sale</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">48–54 KB · competitor-style · tap image to edit colors, zoom, pan, and badges</div>
                </div>
        `;

    if (promo.length > 0) {
      html += `
                <button type="button" id="toggle-promo-lifestyle-results" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;font-size:12px;margin-bottom:6px;">
                    ${showPanel ? "▼" : "▶"} See lifestyle promo variants (${promo.length}) — best est ₹${bestEst}
                </button>
                <div id="promo-lifestyle-results-panel" style="display:${showPanel ? "block" : "none"};">
                    <div class="promo-lifestyle-results-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:520px;overflow-y:auto;">
        `;
      sorted.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode: false,
          analysisMode: true,
          isBest: i === 0,
        });
      });
      html += `
                    </div>
                </div>
        `;
    }

    html += `</div>`;
    return html;
  },

  renderTallStaticSection: function (options) {
    if (!window.WEB_OPTIMIZER_MODE) return "";

    options = options || {};
    const tall = options.tallStaticResults || [];
    const showPanel = !!options.showTallStaticResults;
    const generating = !!options.isGeneratingTallStatic;
    const baseline = options.baselineShipping || 0;
    const count = options.tallStaticVariantCount || 25;
    const sorted = [...tall].sort(
      (a, b) =>
        (a.estShipping || a.meta?.estInr || 999) -
        (b.estShipping || b.meta?.estInr || 999),
    );
    const bestEst =
      sorted[0]?.estShipping || sorted[0]?.meta?.estInr || 0;

    let html = `
            <div style="margin-bottom:15px;border-top:1px solid rgba(0,0,0,0.08);padding-top:12px;">
                <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(173,216,230,0.5);border-radius:10px;padding:12px;margin-bottom:10px;text-align:center;">
                    <div style="font-size:11px;color:#5b21b6;">📐 Tall Promo Frames</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:4px;">703×1024 · blue frame · price tag + arrow + truck</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">Static only — tap image to edit colors, zoom, pan, and badges · est ₹50 band</div>
                </div>
        `;

    if (tall.length > 0) {
      html += `
                <button type="button" id="toggle-tall-static-results" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;font-size:12px;margin-bottom:6px;">
                    ${showPanel ? "▼" : "▶"} See more tall promo variants (${tall.length}) — best est ₹${bestEst}
                </button>
                <div id="tall-static-results-panel" style="display:${showPanel ? "block" : "none"};">
                    <div class="tall-static-results-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:520px;overflow-y:auto;">
        `;
      sorted.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode: false,
          analysisMode: true,
          isBest: i === 0,
        });
      });
      html += `
                    </div>
                </div>
        `;
    }

    html += `</div>`;
    return html;
  },

  renderGownStaticSection: function (options) {
    if (!window.WEB_OPTIMIZER_MODE) return "";

    options = options || {};
    const gown = options.gownStaticResults || [];
    const showPanel = !!options.showGownStaticResults;
    const baseline = options.baselineShipping || 0;
    const sorted = [...gown].sort(
      (a, b) =>
        (OptimizerUI.frozenEstShipping(a) || 999) -
        (OptimizerUI.frozenEstShipping(b) || 999),
    );
    const bestEst = OptimizerUI.frozenEstShipping(sorted[0]);

    let html = `
            <div style="margin-bottom:15px;border-top:1px solid rgba(0,0,0,0.08);padding-top:12px;">
                <div style="background:rgba(13,148,136,0.1);border:1px solid rgba(94,196,200,0.5);border-radius:10px;padding:12px;margin-bottom:10px;text-align:center;">
                    <div style="font-size:11px;color:#0f766e;">👗 Gown Promo Frames</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:4px;">773×1094 · thin teal · lifestyle scene · thick white mat</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">38–48 KB · Best/Flash/Popular · tap image to edit colors, zoom, pan, and badges</div>
                </div>
        `;

    if (gown.length > 0) {
      html += `
                <button type="button" id="toggle-gown-static-results" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;font-size:12px;margin-bottom:6px;">
                    ${showPanel ? "▼" : "▶"} See more gown promo variants (${gown.length}) — best est ₹${bestEst}
                </button>
                <div id="gown-static-results-panel" style="display:${showPanel ? "block" : "none"};">
                    <div class="gown-static-results-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:520px;overflow-y:auto;">
        `;
      sorted.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode: false,
          analysisMode: true,
          isBest: i === 0,
        });
      });
      html += `
                    </div>
                </div>
        `;
    }

    html += `</div>`;
    return html;
  },

  // Results HTML - Only accurate results
  getResultsHTML: function (results, options) {
    options = options || {};
    const baseline = options.baselineShipping || 0;
    const analysisPrimary = options.analysisPrimary || [];
    const showcaseResults =
      window.WEB_OPTIMIZER_MODE ? options.showcaseResults || [] : [];
    const promoLifestyleResults =
      window.WEB_OPTIMIZER_MODE ? options.promoLifestyleResults || [] : [];
    const tallStaticResults =
      window.WEB_OPTIMIZER_MODE ? options.tallStaticResults || [] : [];
    const gownStaticResults =
      window.WEB_OPTIMIZER_MODE ? options.gownStaticResults || [] : [];
    const hasShowcase = showcaseResults.length > 0;
    const hasPromoLifestyle = promoLifestyleResults.length > 0;
    const hasTallStatic = tallStaticResults.length > 0;
    const hasGownStatic = gownStaticResults.length > 0;
    const hasLive = results.length > 0;
    const hasAnalysis = analysisPrimary.length > 0;

    const staticPromoHubActive = !!options.staticPromoHubActive;

    if (!hasLive && !hasAnalysis && !hasShowcase && !hasPromoLifestyle && !hasTallStatic && !hasGownStatic && !staticPromoHubActive) {
      return `
                <div style="text-align:center;padding:30px;">
                    <div style="font-size:50px;margin-bottom:15px;">😔</div>
                    <h3 style="color:#ef4444;margin:0 0 10px 0;">No Results Found</h3>
                    <p style="color:#9ca3af;font-size:12px;margin-bottom:15px;">Could not get accurate prices for this image.</p>
                    <p style="color:#0f0f10;font-size:11px;">Try with a different image or category.</p>
                    <button id="restart-btn" class="opt-btn opt-btn-primary" style="margin-top:15px;padding:10px 25px;">Try Again</button>
                </div>
            `;
    }

    const isWeb = !!window.WEB_OPTIMIZER_MODE;
    const manualMode = !!options.manualMode;
    const localPriceMode = !!options.localPriceMode;
    const localProfile = options.localPriceProfile || null;
    const livePricedResults = options.livePricedResults || [];
    let html = "";

    if (localPriceMode && results.length > 0) {
      const best = results[0];
      const bestKb =
        best.meta?.kb ||
        (best.blob?.size ? Math.ceil(best.blob.size / 1024) : "—");
      const liveTier =
        (localProfile?.tiers?.length
          ? Math.min(...localProfile.tiers.map((p) => Number(p)).filter((n) => n > 0))
          : null) ||
        LocalPriceDB.resolveLearnedTier(
          String(localProfile?.categoryId || ""),
        ) ||
        null;
      const tierText = liveTier
        ? `matched to live ₹${liveTier} pattern (KB/border)`
        : "run Live first to learn ₹ pattern";
      html += `
            <div style="background:rgba(4,120,87,0.12);border:1px solid rgba(4,120,87,0.35);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">
                <div style="font-size:11px;color:#047857;">📍 Local variants (from live learn — not a Meesho check)</div>
                <div style="font-size:22px;font-weight:700;color:#047857;">${results.length} picks · ~${bestKb} KB</div>
                <div style="font-size:10px;color:#666;margin-top:4px;">${tierText}</div>
                <div style="font-size:9px;color:#6b7280;margin-top:6px;line-height:1.35;">Same image + same live ₹ tier → we copy KB/border from your live winners. Confirm with Live generate.</div>
                ${
                  localProfile?.strategyReason
                    ? `<div style="font-size:9px;color:#6b7280;margin-top:4px;line-height:1.3;">${localProfile.strategyReason}</div>`
                    : ""
                }
            </div>`;
    }

    if (!hasLive && !hasAnalysis && hasShowcase && !hasPromoLifestyle && !hasTallStatic) {
      const sortedShowcase = [...showcaseResults].sort(
        (a, b) =>
          (a.estShipping || a.meta?.estInr || 999) -
          (b.estShipping || b.meta?.estInr || 999),
      );
      const bestShowcaseOnly =
        sortedShowcase[0]?.estShipping || sortedShowcase[0]?.meta?.estInr || 0;
      html += `
            <div style="background:rgba(255,152,0,0.12);border:1px solid rgba(76,175,80,0.35);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">
                <div style="font-size:11px;color:#e65100;">🖼️ Showcase Promo Frames</div>
                <div style="font-size:24px;font-weight:700;color:#047857;">est ₹${bestShowcaseOnly}</div>
                <div style="font-size:10px;color:#666;margin-top:4px;">${showcaseResults.length} static variants · tight frame · no Meesho session</div>
            </div>`;
    }

    if (!hasLive && !hasAnalysis && !hasShowcase && hasPromoLifestyle && !hasTallStatic) {
      const sortedPromo = [...promoLifestyleResults].sort(
        (a, b) =>
          (a.estShipping || a.meta?.estInr || 999) -
          (b.estShipping || b.meta?.estInr || 999),
      );
      const bestPromoOnly =
        sortedPromo[0]?.estShipping || sortedPromo[0]?.meta?.estInr || 0;
      html += `
            <div style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">
                <div style="font-size:11px;color:#15803d;">🏷️ Lifestyle Promo Frames</div>
                <div style="font-size:24px;font-weight:700;color:#047857;">est ₹${bestPromoOnly}</div>
                <div style="font-size:10px;color:#666;margin-top:4px;">${promoLifestyleResults.length} variants · green frame · 48–54 KB</div>
            </div>`;
    }

    if (!hasLive && !hasAnalysis && !hasShowcase && !hasPromoLifestyle && hasTallStatic) {
      const sortedTall = [...tallStaticResults].sort(
        (a, b) =>
          (a.estShipping || a.meta?.estInr || 999) -
          (b.estShipping || b.meta?.estInr || 999),
      );
      const bestTallOnly =
        sortedTall[0]?.estShipping || sortedTall[0]?.meta?.estInr || 0;
      html += `
            <div style="background:rgba(124,58,237,0.12);border:1px solid rgba(173,216,230,0.5);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">
                <div style="font-size:11px;color:#5b21b6;">📐 Tall Promo Frames</div>
                <div style="font-size:24px;font-weight:700;color:#047857;">est ₹${bestTallOnly}</div>
                <div style="font-size:10px;color:#666;margin-top:4px;">${tallStaticResults.length} variants · 703×1024 · ₹50 band</div>
            </div>`;
    }

    if (hasLive && !localPriceMode) {
      const pricedLive = results.filter((r) => Number(r.shippingCost) > 0);
      const lowestLivePrice = pricedLive.length
        ? Math.min(...pricedLive.map((r) => Number(r.shippingCost)))
        : null;
      const best =
        lowestLivePrice != null
          ? pricedLive.find((r) => Number(r.shippingCost) === lowestLivePrice) ||
            results[0]
          : results[0];
      const totalResults = results.length;
      const testedCount = pricedLive.length;
      const bestPrice =
        best.shippingCost > 0 ? best.shippingCost : null;
      const bestVariantId = best.variantId || "";

      html += `
            <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:15px;margin-bottom:15px;text-align:center;">
                <div style="font-size:11px;color:#9ca3af;">${
                  manualMode && !bestPrice
                    ? "📝 Enter prices from Meesho"
                    : !bestPrice
                    ? "✨ Variants Generated"
                    : "🏆 Best Shipping Rate"
                }</div>
                <div style="font-size:28px;font-weight:700;color:#10b981;">${
                  bestPrice
                    ? "₹" + bestPrice
                    : manualMode
                    ? testedCount + " / " + totalResults + " priced"
                    : totalResults + " ready"
                }</div>
                <div style="font-size:10px;color:#10b981;margin-top:2px;">${
                  manualMode
                    ? "Download → upload on Meesho → type ₹ below"
                    : bestPrice
                    ? best.liveVerified
                      ? "✓ Live customer shipping"
                      : "✓ Meesho price"
                    : "Tap Save to download"
                }</div>
                ${
                  baseline > 0
                    ? `<div style="font-size:10px;color:#666;margin-top:4px;">Your current shipping: ₹${baseline}</div>`
                    : ""
                }
                <div style="font-size:10px;color:#0f0f10;margin-top:4px;">${totalResults} live variants${
        results.filter((r) => r.noPid).length
          ? ` · ${results.filter((r) => r.noPid).length} kept without PID`
          : ""
      }</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px;max-height:480px;overflow-y:auto;">
        `;

      results.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode,
          isBest:
            lowestLivePrice != null &&
            Number(r.shippingCost) === lowestLivePrice &&
            (r.variantId === bestVariantId || (!bestVariantId && i === 0)),
        });
      });

      html += `</div>`;
    }

    if (hasLive && localPriceMode) {
      html += `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px;max-height:480px;overflow-y:auto;">
        `;
      results.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode,
          localPriceMode: true,
          isBest: r.localRecommended,
        });
      });
      html += `</div>`;
    }

    const framedExtras = options.framedExtras || [];
    if (framedExtras.length > 0) {
      const showFramed = !!options.showFramedExtras;
      const framedPriced = framedExtras.filter((r) => r.shippingCost > 0);
      const framedBest = framedPriced.length
        ? framedPriced.reduce((a, b) =>
            a.shippingCost <= b.shippingCost ? a : b,
          )
        : null;
      const framedHint = framedBest
        ? ` — best tested ₹${framedBest.shippingCost}`
        : " — tuned for ₹49–50";

      html += `
            <div style="margin-bottom:15px;border-top:1px solid rgba(0,0,0,0.08);padding-top:12px;">
                <button type="button" id="toggle-framed-extras" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;font-size:12px;margin-bottom:6px;">
                    ${showFramed ? "▼" : "▶"} See more low-shipping variants (${framedExtras.length})${framedHint}
                </button>
                <p style="font-size:10px;color:#6b7280;margin-bottom:8px;text-align:center;">16 variants: try <strong>low_38–48</strong> / <strong>low_*_tall</strong> first for ₹49. Full-size product + thick blue frame. Card shows actual file KB after compression.</p>
                <div id="framed-extras-panel" style="display:${showFramed ? "block" : "none"};">
                    <div class="framed-extras-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:480px;overflow-y:auto;">
        `;

      framedExtras.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode,
          isBest: i === 0 && r.shippingCost > 0,
        });
      });

      html += `
                    </div>
                </div>
            </div>
        `;
    }

    if (hasAnalysis && !localPriceMode) {
      html += this.renderAnalysisSection(options, { standalone: !hasLive });
    }

    if (staticPromoHubActive) {
      html += this.renderStaticPromoHub(options);
      html += this.renderShowcaseSection(options);
      html += this.renderPromoLifestyleSection(options);
      html += this.renderTallStaticSection(options);
      html += this.renderGownStaticSection(options);
    } else if (hasLive || hasAnalysis || hasShowcase || hasPromoLifestyle || hasTallStatic || hasGownStatic) {
      html += this.renderGownStaticSection(options);
      html += this.renderTallStaticSection(options);
      html += this.renderPromoLifestyleSection(options);
      html += this.renderShowcaseSection(options);
    }

    const bestTall = hasTallStatic
      ? [...tallStaticResults].sort(
          (a, b) =>
            (a.estShipping || a.meta?.estInr || 999) -
            (b.estShipping || b.meta?.estInr || 999),
        )[0]
      : null;
    const bestTallEst =
      bestTall?.estShipping || bestTall?.meta?.estInr || 0;

    const bestPromo = hasPromoLifestyle
      ? [...promoLifestyleResults].sort(
          (a, b) =>
            (a.estShipping || a.meta?.estInr || 999) -
            (b.estShipping || b.meta?.estInr || 999),
        )[0]
      : null;
    const bestPromoEst =
      bestPromo?.estShipping || bestPromo?.meta?.estInr || 0;

    const bestShowcase = hasShowcase
      ? [...showcaseResults].sort(
          (a, b) =>
            (a.estShipping || a.meta?.estInr || 999) -
            (b.estShipping || b.meta?.estInr || 999),
        )[0]
      : null;
    const bestShowcaseEst =
      bestShowcase?.estShipping || bestShowcase?.meta?.estInr || 0;

    const bestGown = hasGownStatic
      ? [...gownStaticResults].sort(
          (a, b) =>
            (a.estShipping || a.meta?.estInr || 999) -
            (b.estShipping || b.meta?.estInr || 999),
        )[0]
      : null;
    const bestGownEst = bestGown ? OptimizerUI.frozenEstShipping(bestGown) : 0;

    const bestLive = hasLive && results[0]?.shippingCost > 0 ? results[0].shippingCost : null;
    const analysisSorted = hasAnalysis
      ? [...analysisPrimary].sort(
          (a, b) =>
            (a.estShipping || a.meta?.estInr || 999) -
            (b.estShipping || b.meta?.estInr || 999),
        )
      : [];
    const bestEst = analysisSorted[0]
      ? analysisSorted[0].estShipping || analysisSorted[0].meta?.estInr || 0
      : 0;

    const bestStaticEst =
      bestGownEst || bestTallEst || bestPromoEst || bestShowcaseEst;

    const livePricedCount = hasLive
      ? results.filter((r) => r.shippingCost > 0).length
      : 0;
    const cachedLivePricedCount = (livePricedResults || []).filter(
      (r) => Number(r.shippingCost) > 0,
    ).length;
    const canCreateReport =
      livePricedCount > 0 || cachedLivePricedCount > 0;
    const localCsvBtn =
      localPriceMode && results.length > 0
        ? `<button id="local-price-download-btn" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;margin-bottom:8px;font-size:12px;">📥 Download Local CSV (full pool + picks)</button>`
        : "";
    const liveFromLocalBtn =
      localPriceMode && results.length > 0
        ? `<button id="generate-live-from-results-btn" class="opt-btn opt-btn-primary" style="width:100%;padding:12px;margin-bottom:8px;font-size:13px;font-weight:700;">🚀 Generate Live Variants (learn for local)</button>`
        : "";
    const reportBtn = canCreateReport
        ? `<button id="create-report-btn" class="opt-btn opt-btn-secondary" style="width:100%;padding:10px;margin-bottom:8px;font-size:12px;">📊 Create Report (from live ₹)</button>`
        : "";

    html += `
            ${liveFromLocalBtn}
            ${localCsvBtn}
            ${reportBtn}
            <div style="display:flex;gap:8px;">
                <button id="apply-best-btn" class="opt-btn opt-btn-success" style="flex:1;padding:10px;">${
                  localPriceMode
                    ? "Download Best Local Pick"
                    : bestLive
                    ? "Download Best ₹" + bestLive
                    : bestEst
                    ? "Download Best est ₹" + bestEst
                    : bestStaticEst
                    ? "Download Best est ₹" + bestStaticEst
                    : "Download Best Variant"
                }</button>
                <button id="restart-btn" class="opt-btn opt-btn-primary" style="flex:1;padding:10px;">New Search</button>
            </div>
        `;
    return html;
  },

  isStaticPromoEditorRow(r) {
    if (!r) return false;
    if (r.layers?._staticFrame || (r.layers?._badgePlacements || []).length) {
      return true;
    }
    const style = String(
      r.variantStyle || r.meta?.style || r.meta?.path || r.style || "",
    ).toLowerCase();
    return (
      style === "showcase" ||
      style === "lifestyle_promo" ||
      style === "tall_static" ||
      style === "gown_static" ||
      style === "live_standard" ||
      style === "live_framed"
    );
  },

  /** Prefer composed preview URL for static promo rows when available. */
  pickResultImageSrc: function (r) {
    if (!r) return "";
    const preferComposed =
      OptimizerUI.isStaticPromoEditorRow(r) ||
      r._staticAppearanceEdited ||
      r._badgesRepositioned;
    if (preferComposed && r.imageUrl) return r.imageUrl;
    if (r.dataUrl) return r.dataUrl;
    if (r.imageUrl) return r.imageUrl;
    if (r.pricingImageUrl) return r.pricingImageUrl;
    if (r.uploadedUrl) return r.uploadedUrl;
    if (r.blob) return URL.createObjectURL(r.blob);
    return "";
  },

  getTestLabResultsHTML: function (results, options) {
    options = options || {};
    const analysis = options.analysis || {};
    const baseline = options.baselineShipping || 0;

    if (!results.length) {
      return `
        <div style="text-align:center;padding:30px;">
          <div style="font-size:50px;margin-bottom:15px;">🧪</div>
          <h3 style="color:#ef4444;margin:0 0 10px 0;">No Test Lab Variants</h3>
          <p style="color:#9ca3af;font-size:12px;margin-bottom:15px;">Try Smart Auto or another category group.</p>
          <button id="restart-btn" class="opt-btn opt-btn-primary" style="margin-top:15px;padding:10px 25px;">Try Again</button>
        </div>`;
    }

    const best = results[0];
    const totalResults = results.length;
    const bestEst = best.meta?.estInr || best.estShipping || 0;
    const bestLive = best.shippingCost > 0 ? best.shippingCost : null;
    const liveCount = results.filter((r) => r.shippingCost > 0).length;
    const groupLabel = analysis.resolvedCategory || analysis.category || "auto";
    const phase2 = options.phase2 || {};
    const phase2Note =
      phase2.verifiedCount > 0
        ? ` · ${phase2.verifiedCount} live checked${
            phase2.refineCount > 0 ? ` · ${phase2.refineCount} refined` : ""
          }`
        : phase2.framedCount > 0
        ? ` · Phase 2: ${phase2.framedCount} ₹49 frames added`
        : liveCount
        ? ` · ${liveCount} live checked`
        : "";

    const livePriceNote = bestLive
      ? "✅ Live customer shipping (same at any Meesho Price)"
      : "Download → upload on Meesho → compare ₹";
    const panelGap =
      baseline > 0 && bestLive && baseline !== bestLive
        ? `<div style="font-size:10px;color:#047857;margin-top:4px;">Panel shows ₹${baseline} · best found ₹${bestLive}${
            bestLive < baseline ? ` (−₹${baseline - bestLive})` : ""
          }</div>`
        : "";

    let html = `
      <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:15px;margin-bottom:15px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;">🧪 Test Lab — live customer shipping ranking</div>
        <div style="font-size:28px;font-weight:700;color:#10b981;">${
          bestLive ? "₹" + bestLive : "est ₹" + bestEst
        }</div>
        <div style="font-size:10px;color:#10b981;margin-top:2px;">${livePriceNote}</div>
        ${panelGap}
        ${
          baseline > 0
            ? `<div style="font-size:10px;color:#666;margin-top:4px;">Your current shipping: ₹${baseline}</div>`
            : ""
        }
        <div style="font-size:10px;color:#0f0f10;margin-top:4px;">${totalResults} variants · ${groupLabel}${phase2Note}</div>
        ${
          analysis.suggested
            ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;">${analysis.suggested}${
                analysis.width ? ` · ${analysis.width}×${analysis.height}px` : ""
              }</div>`
            : ""
        }
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px;max-height:480px;overflow-y:auto;">
    `;

    results.forEach((r, i) => {
      html += this.renderResultCard(r, i, {
        baselineShipping: baseline,
        manualMode: false,
        testLabMode: true,
        isBest: i === 0,
      });
    });

    html += `
      </div>
      <div style="display:flex;gap:8px;">
        <button id="apply-best-btn" class="opt-btn opt-btn-success" style="flex:1;padding:10px;">${
          bestLive
            ? "Download Best ₹" + bestLive
            : "Download Best est ₹" + bestEst
        }</button>
        <button id="restart-btn" class="opt-btn opt-btn-primary" style="flex:1;padding:10px;">New Search</button>
      </div>
    `;
    return html;
  },
};

window.OptimizerUI = OptimizerUI;
