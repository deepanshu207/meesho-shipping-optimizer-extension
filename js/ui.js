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
                .opt-modal, .opt-modal * {
                    box-sizing: border-box;
                    font-family: "Trebuchet MS", "Lucida Grande", "Segoe UI", sans-serif;
                }
                .opt-modal {
                    color: #1f2937;
                    border-radius: 16px;
                    overflow: hidden;
                    background: #fff8ee;
                }
                .opt-header {
                    background: linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);
                    padding: 16px 18px;
                    border-radius: 16px 16px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                }
                .opt-header h2 {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 800;
                    color: #3d2914;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    letter-spacing: -0.01em;
                    line-height: 1.25;
                }
                .opt-close {
                    background: rgba(61,41,20,0.12);
                    border: none;
                    color: #3d2914;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 20px;
                    flex-shrink: 0;
                }
                .opt-close:hover { background: rgba(61,41,20,0.2); }
                .opt-body {
                    padding: 16px;
                    background:
                      radial-gradient(ellipse at top right, rgba(255,215,0,0.12), transparent 50%),
                      #fff8ee;
                }
                .opt-section {
                    background: #ffffff;
                    border: 1px solid #f0e0c8;
                    border-radius: 12px;
                    padding: 14px;
                    margin-bottom: 12px;
                }
                .opt-section-title {
                    font-size: 13px;
                    font-weight: 700;
                    color: #c45f12;
                    margin-bottom: 10px;
                }
                .opt-label {
                    display: block;
                    font-size: 11px;
                    color: #6b7280;
                    margin-bottom: 5px;
                    font-weight: 600;
                }
                .opt-select, .opt-input {
                    width: 100%;
                    padding: 10px 12px;
                    background: #ffffff;
                    border: 1px solid #e8d5b8;
                    border-radius: 10px;
                    color: #1f2937;
                    font-size: 13px;
                    font-family: inherit;
                }
                .opt-select:focus, .opt-input:focus {
                    outline: none;
                    border-color: #e67e22;
                    box-shadow: 0 0 0 3px rgba(230,126,34,0.15);
                }
                .opt-select option { background: #ffffff; color: #1f2937; }
                .opt-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .opt-btn {
                    padding: 12px 18px;
                    border: none;
                    border-radius: 10px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    font-family: inherit;
                }
                .opt-btn-primary,
                .opt-btn-success,
                .opt-btn-whatsapp,
                .opt-file-btn,
                .generate-btn {
                    background: linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);
                    color: #3d2914;
                }
                .opt-btn-danger { background: #dc2626; color: #fff; }
                .opt-btn-secondary {
                    background: #ffffff;
                    color: #3d2914;
                    border: 1px solid #f0e0c8;
                }
                .opt-btn-whatsapp {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .opt-range {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: #f0e0c8;
                    -webkit-appearance: none;
                }
                .opt-range::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #e67e22;
                    cursor: pointer;
                }
                .opt-badge-pos { display: flex; flex-wrap: wrap; gap: 6px; }
                .opt-badge-item {
                    padding: 6px 10px;
                    background: #fff8ee;
                    border: 1px solid #f0e0c8;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .opt-badge-item.active {
                    background: rgba(230,126,34,0.15);
                    border-color: #e67e22;
                    color: #c45f12;
                }
                .opt-shipping {
                    background: rgba(5,150,105,0.1);
                    border: 1px solid rgba(5,150,105,0.28);
                    border-radius: 12px;
                    padding: 12px;
                    text-align: center;
                    margin-bottom: 12px;
                }
                .opt-shipping-value {
                    font-size: 24px;
                    font-weight: 800;
                    color: #059669;
                }
                .opt-upload-box {
                    border: 2px dashed #e8c98a;
                    border-radius: 12px;
                    padding: 22px 16px;
                    text-align: center;
                    background: #fffdf7;
                    margin-bottom: 12px;
                }
                .opt-upload-box:hover {
                    border-color: #e67e22;
                    background: #fff6e8;
                }
                .opt-file-btn {
                    display: inline-block;
                    padding: 10px 22px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 13px;
                    margin-top: 10px;
                }
                .opt-preview { margin-top: 12px; display: none; }
                .opt-preview img {
                    max-width: 120px;
                    max-height: 120px;
                    border-radius: 8px;
                    border: 2px solid #059669;
                }
                .opt-divider {
                    display: flex;
                    align-items: center;
                    margin: 15px 0;
                    color: #6b7280;
                    font-size: 12px;
                }
                .opt-divider::before, .opt-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #f0e0c8;
                }
                .opt-divider span { padding: 0 10px; }
                .generate-btn {
                    width: 100%;
                    padding: 14px;
                    font-size: 16px;
                    font-weight: 800;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    min-height: 48px;
                    box-shadow: 0 6px 18px rgba(230,126,34,0.25);
                }
                .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
                .generate-sticky { padding: 8px 0 4px; margin-top: 8px; }
                .session-hint { font-size: 11px; color: #6b7280; line-height: 1.4; }
                .session-status.ok { color: #059669; }
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
                    color: #1f2937;
                    background: #fff;
                    border-color: #e8d5b8;
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
                    border: 1px solid #e8d5b8;
                    border-radius: 10px;
                    box-shadow: 0 10px 28px rgba(196,95,18,0.15);
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
                    background: rgba(245,166,35,0.14);
                }
                .category-ac-item-name {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    color: #1f2937;
                    font-weight: 600;
                }
                .category-ac-item-id { font-size: 10px; color: #6b7280; font-weight: 500; white-space: nowrap; }
                .category-ac-item-path { font-size: 10px; color: #4b5563; margin-top: 2px; line-height: 1.35; }
                .category-ac-header,
                .category-ac-footer {
                    padding: 8px 12px;
                    font-size: 10px;
                    color: #6b7280;
                    background: #fff8ee;
                    border-bottom: 1px solid #f0e0c8;
                }
                .category-ac-footer { border-bottom: none; border-top: 1px solid #f0e0c8; }
                .category-ac-empty { padding: 12px; color: #6b7280; font-size: 12px; }
                .opt-developer {
                    text-align: center;
                    font-size: 10px;
                    color: #6b7280;
                    margin-top: 8px;
                    padding-top: 8px;
                }
                .opt-developer strong { color: #c45f12; }
                @media (max-width: 640px) {
                    .opt-modal-ext { border-radius: 0 !important; min-height: 100vh; }
                    .opt-modal-ext .opt-header { border-radius: 0 !important; }
                    .opt-body { padding: 12px !important; }
                    .opt-row { grid-template-columns: 1fr !important; }
                    .opt-header h2 { font-size: 15px; }
                }
                @media (min-width: 900px) {
                    .opt-modal-ext { max-width: 520px; margin: 0 auto; }
                }
            </style>
        `;

    if (window.WEB_OPTIMIZER_MODE) {
      return styles + this.getWebHTML();
    }

    return styles + this.getMainHTML();
  },


  // Simplified web UI — upload only, no session/category setup
  getWebHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2>meesho. Upload &amp; Optimize</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%),rgba(230,126,34,0.1));border:1px solid rgba(16,185,129,0.3);">
                        <div class="opt-section-title" style="color:#c45f12;">🎯 Smart Mode <span style="font-size:9px;font-weight:500;color:#9ca3af;">(🚀 Generate Variants)</span></div>
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
                        <div style="font-size:10px;color:#6b7280;margin-top:6px;">Live Meesho shipping checks using Target + Max Variants</div>
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

                    <div id="processing-area" style="display:none;"></div>
                    <div id="results-area" style="display:none;"></div>
                    <div class="opt-developer">Built by <strong>Deepanshu Arora</strong></div>
                </div>
            </div>
        `;
  },

  // License activation HTML with WhatsApp button and pricing plans
  getLicenseHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2>License Required</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div style="text-align:center;padding:10px 0;">
                        <div style="font-size:40px;margin-bottom:8px;">🚀</div>
                        <h3 style="margin:0 0 5px 0;color:#3d2914;">meesho. Shipping Cost Optimizer</h3>
                        <p style="color:#6b7280;font-size:12px;margin-bottom:10px;">By Deepanshu Arora · Reduce shipping with smart image variants</p>
                    </div>
                    
                    <!-- Pricing Plans -->
                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="text-align:center;margin-bottom:12px;">💎 Click Plan to Buy</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <!-- Monthly -->
                            <button class="plan-buy-btn" data-plan="monthly" data-price="599" data-duration="1 Month" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">Monthly</div>
                                <div style="font-size:20px;font-weight:700;color:#e67e22;">₹599</div>
                                <div style="font-size:9px;color:#0f0f10;">30 days</div>
                            </button>
                            <!-- 3 Months -->
                            <button class="plan-buy-btn" data-plan="quarterly" data-price="1399" data-duration="3 Months" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">3 Months</div>
                                <div style="font-size:20px;font-weight:700;color:#e67e22;">₹1399</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹1000</div>
                            </button>
                            <!-- 6 Months -->
                            <button class="plan-buy-btn" data-plan="halfyearly" data-price="2299" data-duration="6 Months" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">6 Months</div>
                                <div style="font-size:20px;font-weight:700;color:#e67e22;">₹2299</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹3000</div>
                            </button>
                            <!-- Yearly - Best Value -->
                            <button class="plan-buy-btn" data-plan="yearly" data-price="3099" data-duration="1 Year" style="background:linear-gradient(180deg, #fff8ee, #ffffff);border:2px solid #e67e22;border-radius:8px;padding:10px;text-align:center;position:relative;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);color:white;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:700;">BEST VALUE</div>
                                <div style="font-size:11px;color:#c45f12;margin-top:4px;">Yearly</div>
                                <div style="font-size:20px;font-weight:700;color:#10b981;">₹3099</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹8000</div>
                            </button>
                        </div>
                        <div style="margin-top:10px;padding:8px;background:rgba(167,139,250,0.1);border-radius:6px;border:1px solid rgba(167,139,250,0.2);">
                            <div style="font-size:10px;color:#c45f12;font-weight:600;margin-bottom:4px;">✨ Yearly Plan Exclusive:</div>
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


  // Main optimizer HTML — Live generate + preview + apply
  getMainHTML: function () {
    return `
            <div class="opt-modal opt-modal-ext">
                <div class="opt-header">
                    <h2>meesho. Shipping Cost Optimizer</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div class="opt-shipping">
                        <div style="font-size:11px;color:#9ca3af;">Current Shipping</div>
                        <div class="opt-shipping-value" id="current-shipping">Detecting...</div>
                    </div>

                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>📁 Category (Required)</span>
                            <button id="refresh-categories" style="background:rgba(230,126,34,0.15);border:none;color:#c45f12;padding:4px 8px;border-radius:8px;cursor:pointer;font-size:10px;display:none;" title="Refresh">🔄</button>
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
                        <div id="selected-category" style="margin-top:8px;padding:8px;background:rgba(230,126,34,0.12);border:1px solid #f0e0c8;border-radius:8px;display:none;">
                            <span style="font-size:11px;color:#c45f12;">✓ </span>
                            <span id="selected-category-name" style="font-size:12px;color:black;font-weight:600;"></span>
                            <div id="selected-category-detail" style="font-size:10px;color:#4b5563;margin-top:4px;line-height:1.4;"></div>
                        </div>
                        <div id="category-api-preview" style="font-size:10px;color:#9ca3af;margin-top:6px;line-height:1.4;display:none;"></div>
                    </div>

                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%),rgba(230,126,34,0.1));border:1px solid rgba(16,185,129,0.3);">
                        <div class="opt-section-title" style="color:#c45f12;">🎯 Smart Mode <span style="font-size:9px;font-weight:500;color:#9ca3af;">(🚀 Generate Variants)</span></div>
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
                            ⚡ Live Meesho shipping checks using Target + Max Variants
                        </div>
                    </div>

                    <div class="opt-section" style="padding:10px;">
                        <div class="opt-section-title">✏️ Text (Optional)</div>
                        <input type="text" id="custom-text" class="opt-input" placeholder="e.g. FREE SHIPPING" style="font-size:12px;">
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
                    </div>

                    <div id="processing-area" style="display:none;"></div>
                    <div id="results-area" style="display:none;"></div>
                    <div class="opt-developer">Built by <strong>Deepanshu Arora</strong></div>
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
                      '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e67e22;margin-bottom:15px;">'
                    : ""
                }
                <div style="width:50px;height:50px;border:4px solid rgba(255,255,255,0.1);border-top:4px solid #e67e22;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 15px;"></div>
                <h3 style="margin:0 0 8px 0;color:black;font-size:16px;">Processing Images</h3>
                <p style="color:#9ca3af;font-size:12px;margin-bottom:8px;">Testing variation ${current} of ${total}</p>
                <p style="color:#e67e22;font-size:11px;margin-bottom:15px;">${estText}</p>
                <div style="background:rgba(255,255,255,0.1);border-radius:8px;height:10px;margin-bottom:8px;overflow:hidden;">
                    <div style="width:${pct}%;background:linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);height:100%;border-radius:8px;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:11px;color:#c45f12;margin-bottom:15px;">${pct}% Complete</div>
                <button id="stop-btn" class="opt-btn opt-btn-danger" style="padding:8px 20px;font-size:12px;">Stop & Show Results</button>
            </div>
            <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
  },

  // Single result card — live grid / framed extras
  renderResultCard: function (r, i, options) {
    options = options || {};
    const baseline = options.baselineShipping || 0;
    const manualMode = !!options.manualMode;
    const analysisMode = !!options.analysisMode || !!r.analysisMode;
    const isWeb = !!window.WEB_OPTIMIZER_MODE;
    const applyLabel = isWeb ? "Save" : "Apply";
    const isRecommended = !!r.recommended || !!r.meta?.recommended;
    const isBest = !!options.isBest;
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
    const priceLabel = analysisMode
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
    const imgSrc = staticPromoEditor
      ? r.imageUrl || OptimizerUI.pickResultImageSrc(r)
      : analysisMode
      ? OptimizerUI.pickResultImageSrc(r)
      : r.imageUrl || OptimizerUI.pickResultImageSrc(r);
    const styleTag = r.variantStyle === "framed"
      ? `<div style="font-size:8px;color:#2563eb;margin-bottom:2px;">${r.meta?.productW || "?"}×${r.meta?.productH || "?"}px · ${r.meta?.actualKb || r.meta?.targetKb || "?"}KB</div>`
      : r.variantStyle === "product_only"
      ? `<div style="font-size:8px;color:#047857;margin-bottom:2px;">product only · ${r.meta?.kb || "?"}KB</div>`
      : r.variantStyle === "analysis" || r.analysisMode
      ? `<div style="font-size:8px;color:#2563eb;margin-bottom:2px;">${r.meta?.path || "analysis"} · ${r.meta?.kb || "?"}KB</div>`
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
                      isBest
                        ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">🏆 BEST</div>'
                        : isRecommended
                        ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">★ RECOMMEND</div>'
                        : ""
                    }
                    <span class="result-edit-badge" data-variant-id="${vid}" style="display:${
      edited ? "block" : "none"
    };position:absolute;top:4px;right:4px;background:#e67e22;color:#fff;font-size:8px;padding:2px 5px;border-radius:4px;">✂️</span>
                    <img src="${imgSrc}" class="result-img" data-variant-id="${vid}" title="${
      canEdit
        ? staticPromoEditor
          ? "Tap to edit colors, zoom, pan, and badges"
          : "Tap to edit border & stickers"
        : "Tap to preview"
    }" style="width:100%;height:55px;object-fit:contain;border-radius:4px;background:rgba(0,0,0,0.2);margin-bottom:4px;margin-top:${
      isBest ? "4px" : "0"
    };cursor:pointer;" loading="lazy">
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
                        : r.shippingCost > 0
                        ? '<div style="font-size:8px;color:#047857;font-weight:600;">✓ live Meesho</div>'
                        : ""
                    }
                    ${
                      savings > 0
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
    }background:rgba(230,126,34,0.15);color:#c45f12;border:none;padding:3px;border-radius:4px;cursor:pointer;font-size:9px;">Save</button>
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






  // Results HTML — live variants + preview + apply/download
  getResultsHTML: function (results, options) {
    options = options || {};
    const baseline = options.baselineShipping || 0;
    const analysisPrimary = options.analysisPrimary || [];
    const hasLive = results.length > 0;
    const hasAnalysis = analysisPrimary.length > 0;

    if (!hasLive && !hasAnalysis) {
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
    let html = "";

    if (hasLive) {
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
      const bestPrice = best.shippingCost > 0 ? best.shippingCost : null;
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
                    : "Tap image to preview / edit"
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
                <p style="font-size:10px;color:#6b7280;margin-bottom:8px;text-align:center;">Extra framed variants for lower shipping. Tap image to preview or edit.</p>
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

    if (hasAnalysis) {
      html += this.renderAnalysisSection(options, { standalone: !hasLive });
    }

    const pricedForBest = hasLive
      ? results.filter((r) => Number(r.shippingCost) > 0)
      : [];
    const bestLive = pricedForBest.length
      ? Math.min(...pricedForBest.map((r) => Number(r.shippingCost)))
      : null;
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

    const applyLabel = isWeb
      ? bestLive
        ? "Download Best ₹" + bestLive
        : bestEst
        ? "Download Best est ₹" + bestEst
        : "Download Best Variant"
      : bestLive
      ? "Apply Best ₹" + bestLive
      : bestEst
      ? "Apply Best est ₹" + bestEst
      : "Apply Best Variant";

    html += `
            <div style="display:flex;gap:8px;">
                <button id="apply-best-btn" class="opt-btn opt-btn-success" style="flex:1;padding:10px;">${applyLabel}</button>
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

};

window.OptimizerUI = OptimizerUI;
