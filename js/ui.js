// UI components for Meesho Shipping Optimizer v6.0.0

const OptimizerUI = {
  brandLogoUrl: function () {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL("icons/icon48.png");
    }
    if (window.WEB_OPTIMIZER_MODE) return "/icons/icon48.png";
    return "";
  },

  brandHeaderHtml: function (title) {
    const safeTitle = title || "Shipping Optimizer";
    const url = this.brandLogoUrl();
    const logo = url
      ? `<img src="${url}" alt="" width="30" height="30" style="display:block;border-radius:9px;flex-shrink:0;box-shadow:0 2px 8px rgba(61,41,20,0.18);">`
      : `<span aria-hidden="true" style="font-size:24px;line-height:1;">📦</span>`;
    return `<div class="opt-brand-header">${logo}<h2>${safeTitle}</h2></div>`;
  },

  smartModeMaxVariantsHtml: function () {
    return `
                        <input type="hidden" id="target-shipping" value="100">
                        <div class="opt-row" style="margin-bottom:10px;">
                            <div style="grid-column:1 / -1;">
                                <label class="opt-label">Max Variants</label>
                                <select id="max-attempts" class="opt-select">
                                    <option value="10">10</option>
                                    <option value="20" selected>20</option>
                                    <option value="50">50</option>
                                    <option value="80">80</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                        <div style="font-size:10px;color:#6b7280;padding:8px;background:#fff8ee;border-radius:8px;border:1px solid #f0e0c8;">
                            ⚡ Live Meesho shipping checks — finds the lowest ₹ from generated variants
                        </div>
                        <div id="image-gen-quota" style="display:none;margin-top:8px;font-size:10px;color:#c45f12;padding:8px;background:rgba(255,215,0,0.12);border-radius:8px;border:1px solid #f0e0c8;line-height:1.5;"></div>`;
  },

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
  createModalHTML: function (isLicensed) {
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
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 18px;
                    background: linear-gradient(135deg, #ffd700 0%, #f5a623 55%, #e67e22 100%);
                    color: #3d2914;
                    border-radius: 12px 12px 0 0;
                }
                .opt-brand-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                }
                .opt-brand-header h2 {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 800;
                    color: #3d2914;
                    line-height: 1.2;
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
                .results-during-run { opacity: 1; pointer-events: auto; }
                .processing-banner {
                    margin-bottom: 10px;
                    border: 1px solid #f0e0c8;
                    border-radius: 12px;
                    background: linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,248,238,0.95) 100%);
                    box-shadow: 0 4px 14px rgba(196,95,18,0.1);
                }
                .result-card {
                    min-width: 0;
                    overflow: visible;
                    border-radius: 10px;
                    box-shadow: 0 2px 8px rgba(61,41,20,0.06);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    box-sizing: border-box;
                }
                .result-card-body {
                    display: flex;
                    flex-direction: column;
                    flex: 1 1 auto;
                    min-width: 0;
                    width: 100%;
                }
                .result-card-img-wrap {
                    width: 100%;
                    height: 78px;
                    border-radius: 6px;
                    background: #f3f4f6;
                    border: 1px solid #ece7df;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 6px;
                    box-sizing: border-box;
                }
                .result-card-img-wrap .result-img {
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    display: block;
                    cursor: pointer;
                }
                .result-card-foot {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-top: auto;
                    width: 100%;
                    box-sizing: border-box;
                }
                .result-card-price-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    min-height: 20px;
                    flex-wrap: nowrap;
                }
                .result-price-label {
                    font-size: 16px;
                    font-weight: 800;
                    line-height: 1;
                    white-space: nowrap;
                }
                .result-live-tag {
                    font-size: 9px;
                    font-weight: 700;
                    color: #059669;
                    background: rgba(5,150,105,0.12);
                    padding: 2px 6px;
                    border-radius: 999px;
                    white-space: nowrap;
                    line-height: 1.2;
                    flex-shrink: 0;
                }
                #opt-modal .result-card-save,
                .result-card-save {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    padding: 8px 4px !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    min-height: 30px;
                    border-radius: 6px !important;
                    background: rgba(230,126,34,0.15) !important;
                    color: #c45f12 !important;
                    border: none !important;
                    cursor: pointer;
                    box-sizing: border-box !important;
                    flex: none !important;
                    align-self: stretch !important;
                    margin: 0 !important;
                    text-align: center !important;
                }
                #opt-modal .result-card-actions,
                .result-card-actions {
                    display: flex;
                    gap: 4px;
                    width: 100%;
                    margin-top: 2px;
                    box-sizing: border-box;
                }
                #opt-modal .result-card-actions-single,
                .result-card-actions-single {
                    display: block !important;
                    width: 100% !important;
                }
                .result-card-badge-spacer {
                    display: block;
                    height: 17px;
                    margin: 0 auto 6px;
                }
                .result-card-best {
                    border-color: #10b981 !important;
                    box-shadow: 0 0 0 1px rgba(16,185,129,0.2), 0 3px 10px rgba(16,185,129,0.12);
                }
                .result-card-badge {
                    display: inline-block;
                    margin: 0 auto 6px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 9px;
                    font-weight: 700;
                    line-height: 1.35;
                    white-space: nowrap;
                }
                .result-card-badge-best {
                    background: #10b981;
                    color: #fff;
                }
                .result-card-badge-recommend {
                    background: #2563eb;
                    color: #fff;
                }
                .results-variant-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    margin-bottom: 15px;
                    max-height: 480px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding-top: 6px;
                    align-items: stretch;
                }
                .results-actions-bar {
                    display: flex;
                    gap: 8px;
                    padding-bottom: 4px;
                }
                @media (max-width: 520px) {
                    .results-variant-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 12px;
                    }
                    .result-card-hint-global {
                        font-size: 11px;
                        white-space: normal;
                    }
                    .results-actions-bar {
                        padding-bottom: 72px;
                    }
                }
                .result-card-selected {
                    border: 2px solid #e67e22 !important;
                    background: rgba(255,215,0,0.14) !important;
                    box-shadow: 0 0 0 2px rgba(230,126,34,0.18);
                }
                .result-card-hint-global {
                    font-size: 10px;
                    color: #6b7280;
                    margin: 0 0 10px;
                    text-align: center;
                    line-height: 1.35;
                    padding: 0 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .category-picker-hint { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.4; }
                #category-ac-wrap { position: relative; z-index: 10000; min-height: 44px; }
                #category-ac-wrap.category-loading { opacity: 0.72; }
                #category-ac-wrap.category-loading #category-search {
                    background: #fff8ee;
                    cursor: wait;
                }
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
                .category-ac-loading { font-style: italic; color: #9ca3af; }
                .category-ac-virtual-pad {
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                    pointer-events: none;
                    list-style: none;
                }
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

    if (!isLicensed) {
      return styles + this.getLicenseHTML();
    }

    return styles + this.getMainHTML();
  },


  // Simplified web UI — upload only, no session/category setup
  getWebHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    ${this.brandHeaderHtml("Shipping Optimizer")}
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, rgba(255,215,0,0.14) 0%, rgba(245,166,35,0.1) 55%, rgba(230,126,34,0.08) 100%);border:1px solid #f0e0c8;">
                        <div class="opt-section-title" style="color:#c45f12;">⚡ Smart Mode <span style="font-size:9px;font-weight:500;color:#9ca3af;">(Generate Variants)</span></div>
                        ${this.smartModeMaxVariantsHtml()}
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
                        <h3 style="margin:0 0 5px 0;color:#3d2914;">Shipping Optimizer</h3>
                        <p style="color:#6b7280;font-size:12px;margin-bottom:10px;">Reduce shipping with smart image variants</p>
                    </div>
                    
                    <!-- Pricing Plans (loaded from Firebase) -->
                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="text-align:center;margin-bottom:12px;">💎 Click Plan to Buy</div>
                        <div id="license-plans-grid" class="license-plans-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;min-height:120px;">
                            <div style="grid-column:1/-1;text-align:center;padding:16px;color:#9ca3af;font-size:11px;">Loading plans…</div>
                        </div>
                        <div id="license-announcement" class="license-announcement" style="display:none;margin-top:10px;padding:8px 10px;background:rgba(255,215,0,0.15);border:1px solid rgba(230,126,34,0.35);border-radius:8px;font-size:11px;color:#c45f12;text-align:center;"></div>
                    </div>

                    <div id="license-credits-section" class="license-credits-section opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="text-align:center;margin-bottom:12px;">⚡ Buy Credits (pay as you go)</div>
                        <div id="license-credits-grid" class="license-credits-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;min-height:80px;"></div>
                    </div>
                    
                    <div class="opt-section" style="padding:12px;">
                        <label class="opt-label">Already have a License Key?</label>
                        <input type="text" id="license-key-input" class="opt-input" placeholder="Enter your license key" style="margin-bottom:10px;font-size:13px;">
                        <button id="activate-license-btn" class="opt-btn opt-btn-success" style="width:100%;padding:10px;">Activate License</button>
                    </div>
                    
                    <p id="license-demo-hint" style="margin-top:8px;font-size:10px;color:#0f0f10;text-align:center;">
                        1 device per license · Family/Friends for more devices · Demo: <strong>MEESHO-DEMOFREE</strong>
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
                    ${this.brandHeaderHtml("Shipping Optimizer")}
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
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

                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, rgba(255,215,0,0.14) 0%, rgba(245,166,35,0.1) 55%, rgba(230,126,34,0.08) 100%);border:1px solid #f0e0c8;">
                        <div class="opt-section-title" style="color:#c45f12;">⚡ Smart Mode <span style="font-size:9px;font-weight:500;color:#9ca3af;">(Generate Variants)</span></div>
                        ${this.smartModeMaxVariantsHtml()}
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
    const isRecommended = !!r.recommended || !!r.meta?.recommended;
    const isBest = !!options.isBest;
    const vid = r.variantId || "var-" + i;
    const isSelected = options.selectedVariantId === vid;
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
      r._textOverlaysEdited ||
      r.editFlags?.stickersRemoved ||
      r.editFlags?.borderOnlyRemoved ||
      r.editFlags?.cleanProduct ||
      r.editFlags?.borderRemoved ||
      r.editFlags?.stickersAdded ||
      r.editFlags?.borderAdded ||
      r.editFlags?.fullDecorationsAdded;
    const cardClass = [
      "result-card",
      isSelected ? "result-card-selected" : "",
      isBest ? "result-card-best" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const cardBorder = isSelected
      ? "#e67e22"
      : isBest
      ? "#10b981"
      : "#e8d5b8";
    const cardBg = isSelected
      ? "rgba(255,215,0,0.14)"
      : isBest
      ? "rgba(16,185,129,0.12)"
      : "#fff";
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
                <div class="${cardClass}" data-variant-id="${vid}" style="background:${cardBg};border:1px solid ${cardBorder};border-radius:10px;padding:8px;text-align:center;position:relative;min-width:0;box-sizing:border-box;">
                    ${
                      isBest
                        ? '<div class="result-card-badge result-card-badge-best">🏆 BEST</div>'
                        : isRecommended
                        ? '<div class="result-card-badge result-card-badge-recommend">★ TOP</div>'
                        : '<div class="result-card-badge-spacer" aria-hidden="true"></div>'
                    }
                    <span class="result-edit-badge" data-variant-id="${vid}" style="display:${
      edited ? "block" : "none"
    };position:absolute;top:6px;right:6px;background:#e67e22;color:#fff;font-size:8px;padding:2px 5px;border-radius:4px;z-index:2;">✂️</span>
                    <div class="result-card-body">
                    <div class="result-card-img-wrap">
                    <img src="${imgSrc}" class="result-img" data-variant-id="${vid}" title="${
      canEdit
        ? staticPromoEditor
          ? "Tap to edit text, colors, zoom, pan, and badges"
          : "Tap to edit text, border & stickers"
        : "Tap to preview"
    }" loading="lazy">
                    </div>
                    ${styleTag}
                    </div>
                    <div class="result-card-foot">
                    <div class="result-card-price-row">
                    <div class="result-price-label" style="color:${
                      isBest ? "#059669" : "#1f2937"
                    };">${priceLabel}</div>
                    ${
                      !analysisMode && r.shippingCost > 0
                        ? '<span class="result-live-tag">live</span>'
                        : analysisMode
                        ? '<span class="result-live-tag" style="color:#2563eb;background:rgba(37,99,235,0.1);">est</span>'
                        : ""
                    }
                    </div>
                    ${
                      savings > 0
                        ? `<div style="font-size:9px;color:#10b981;white-space:nowrap;">Save ₹${savings}</div>`
                        : ""
                    }
                    ${
                      manualMode
                        ? `<input type="number" class="manual-price-input opt-input" data-variant-id="${vid}" value="${
                            r.shippingCost > 0 ? r.shippingCost : ""
                          }" min="0" max="999" placeholder="₹" style="width:100%;margin-top:0;padding:4px;font-size:12px;text-align:center;box-sizing:border-box;">`
                        : ""
                    }
                    <div class="result-card-actions result-card-actions-single">
                        <button type="button" class="result-card-save" data-variant-id="${vid}" style="display:block;width:100%;max-width:100%;box-sizing:border-box;">Save</button>
                    </div>
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
    const selectedVariantId = options.selectedVariantId || null;
    const analysisPrimary = options.analysisPrimary || [];
    const hasLive = results.length > 0;
    const hasAnalysis = analysisPrimary.length > 0;

    if (!hasLive && !hasAnalysis) {
      const empty = options.emptyState || {};
      const reason = empty.reason || "default";
      const attempts = Number(empty.attempts) || 0;
      const maxAttempts = Number(empty.maxAttempts) || 0;
      let icon = "😔";
      let title = "No Results Found";
      let message = "Could not get accurate prices for this image.";
      let submessage = "Try with a different image or category.";
      let detail = "";

      if (reason === "stopped") {
        icon = "⏹️";
        title = "Search Stopped";
        message = "Stopped before any variants were ready to show.";
        submessage = "You can try again with the same image or pick a different one.";
      } else if (reason === "exhausted") {
        icon = "🔍";
        title = "No Results Found";
        message = "Tried every variant — no shipping results came back.";
        submessage =
          "Try a different image or category, or check your Meesho session.";
      } else if (reason === "error") {
        icon = "⚠️";
        title = "Something Went Wrong";
        message = empty.errorMessage || "Generation failed unexpectedly.";
        submessage = "Please try again in a moment.";
      }

      if (empty.title) title = empty.title;
      if (empty.message) message = empty.message;
      if (empty.submessage) submessage = empty.submessage;

      if (attempts > 0 && maxAttempts > 0) {
        detail = `Searched ${attempts} of ${maxAttempts} variant${
          maxAttempts === 1 ? "" : "s"
        }.`;
      } else if (attempts > 0) {
        detail = `Searched ${attempts} variant${attempts === 1 ? "" : "s"}.`;
      }

      return `
                <div style="text-align:center;padding:24px 18px;">
                    <div style="background:linear-gradient(135deg, rgba(255,215,0,0.14) 0%, rgba(5,150,105,0.1) 100%);border:1px solid #f0e0c8;border-radius:14px;padding:22px 16px;">
                        <div style="font-size:46px;margin-bottom:12px;line-height:1;">${icon}</div>
                        <h3 style="color:#c45f12;margin:0 0 8px 0;font-size:17px;font-weight:700;">${title}</h3>
                        <p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;line-height:1.45;">${message}</p>
                        ${
                          detail
                            ? `<p style="color:#9ca3af;font-size:11px;margin:0 0 8px 0;">${detail}</p>`
                            : ""
                        }
                        <p style="color:#0f0f10;font-size:11px;margin:0;line-height:1.45;">${submessage}</p>
                        <button id="restart-btn" class="opt-btn opt-btn-primary" style="margin-top:16px;padding:10px 25px;">Try Again</button>
                    </div>
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
            <div style="background:linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(5,150,105,0.1) 100%);border:1px solid #f0e0c8;border-radius:12px;padding:15px;margin-bottom:10px;text-align:center;">
                <div style="font-size:11px;color:#6b7280;">${
                  manualMode && !bestPrice
                    ? "📝 Enter prices from Meesho"
                    : !bestPrice
                    ? "✨ Variants Generated"
                    : "🏆 Best Shipping Rate"
                }</div>
                <div style="font-size:28px;font-weight:700;color:#059669;">${
                  bestPrice
                    ? "₹" + bestPrice
                    : manualMode
                    ? testedCount + " / " + totalResults + " priced"
                    : totalResults + " ready"
                }</div>
                <div style="font-size:10px;color:#c45f12;margin-top:2px;">${
                  manualMode
                    ? "Download → upload on Meesho → type ₹ below"
                    : bestPrice
                    ? best.liveVerified
                      ? "✓ Live customer shipping"
                      : "✓ Meesho price"
                    : "Tap image to preview / edit"
                }</div>
                <div style="font-size:10px;color:#6b7280;margin-top:4px;">${totalResults} live variants${
        results.filter((r) => r.noPid).length
          ? ` · ${results.filter((r) => r.noPid).length} kept without PID`
          : ""
      }</div>
            </div>
            <p class="result-card-hint-global">Tap to select · tap image to edit</p>
            <div class="results-variant-grid">
        `;

      results.forEach((r, i) => {
        html += this.renderResultCard(r, i, {
          baselineShipping: baseline,
          manualMode,
          selectedVariantId,
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
          selectedVariantId,
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
            <div class="results-actions-bar">
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
    if (r.blob) {
      // Cache the object URL on the row so repeated renders reuse one URL
      // instead of leaking a new blob URL each time getResultsHTML runs.
      if (!r._previewObjectUrl || r._previewObjectUrlBlob !== r.blob) {
        if (r._previewObjectUrl) {
          try {
            URL.revokeObjectURL(r._previewObjectUrl);
          } catch (e) {
            /* ignore */
          }
        }
        r._previewObjectUrl = URL.createObjectURL(r.blob);
        r._previewObjectUrlBlob = r.blob;
      }
      return r._previewObjectUrl;
    }
    return "";
  },

};

window.OptimizerUI = OptimizerUI;
