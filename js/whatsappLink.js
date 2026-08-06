// Shared WhatsApp opener — mobile: app only via page context (never api.whatsapp.com tab)

const WhatsAppLink = {
  normalizeNumber(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  },

  isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  },

  isAndroid() {
    return /Android/i.test(navigator.userAgent || "");
  },

  isExtensionPopup() {
    try {
      return /popup\.html$/i.test(window.location?.pathname || "");
    } catch (e) {
      return false;
    }
  },

  canUseBackground() {
    try {
      return !!(chrome?.runtime?.sendMessage && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  },

  buildUrls(number, message) {
    const phone = this.normalizeNumber(number);
    const text = encodeURIComponent(message || "");
    return {
      phone,
      scheme: `whatsapp://send?phone=${phone}&text=${text}`,
      api: `https://api.whatsapp.com/send?phone=${phone}&text=${text}`,
      waMe: `https://wa.me/${phone}?text=${text}`,
    };
  },

  /** Deep link for mobile app — intent on Android (page click), scheme on iOS. */
  buildMobileDeepLink(number, message) {
    const phone = this.normalizeNumber(number);
    const text = encodeURIComponent(message || "");
    if (this.isAndroid()) {
      return `intent://send?phone=${phone}&text=${text}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }
    return `whatsapp://send?phone=${phone}&text=${text}`;
  },

  tabsQuery(queryInfo) {
    return new Promise((resolve) => {
      try {
        if (!chrome?.tabs?.query) {
          resolve([]);
          return;
        }
        chrome.tabs.query(queryInfo, (tabs) => {
          resolve(chrome.runtime.lastError ? [] : tabs || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  },

  openTab(url) {
    if (!url) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        if (chrome?.tabs?.create) {
          chrome.tabs.create({ url }, () => {
            resolve(!chrome.runtime.lastError);
          });
          return;
        }
      } catch (e) {}
      try {
        const opened = window.open(url, "_blank");
        resolve(!!opened);
      } catch (e) {
        resolve(false);
      }
    });
  },

  /** Click deep link in DOM without navigating the host page away. */
  clickDeepLink(scheme) {
    if (!scheme) return false;
    try {
      const link = document.createElement("a");
      link.href = scheme;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Launch WhatsApp from the active Meesho tab (page context).
   * Avoids opening api.whatsapp.com in the browser — intent/scheme click opens the app.
   */
  async openViaActivePage(deepLink) {
    if (!chrome?.scripting?.executeScript || !deepLink) return false;

    let tabs = await this.tabsQuery({ active: true, lastFocusedWindow: true });
    let tab = tabs[0];

    const isMeesho = (url) =>
      (url || "").includes("supplier.meesho.com");

    if (!tab?.id || !isMeesho(tab.url)) {
      const meeshoTabs = await this.tabsQuery({
        url: "*://supplier.meesho.com/*",
      });
      tab =
        meeshoTabs.find((t) => isMeesho(t.url) && t.active) ||
        meeshoTabs[0] ||
        tab;
    }

    if (!tab?.id) return false;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (url) => {
          const link = document.createElement("a");
          link.href = url;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          link.remove();
        },
        args: [deepLink],
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  closePopupIfNeeded() {
    if (!this.isExtensionPopup()) return;
    try {
      window.close();
    } catch (e) {}
  },

  /** Desktop only — open wa.me in a new tab. */
  openViaBackground(phone, message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "OPEN_WHATSAPP",
            phone,
            message: message || "",
          },
          () => {
            resolve(!chrome.runtime.lastError);
          },
        );
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Open WhatsApp chat.
   * Mobile: deep link from Meesho page (or popup click) — NEVER opens api.whatsapp.com.
   * Desktop: wa.me in new tab.
   */
  async open(number, message) {
    const urls = this.buildUrls(number, message);
    const web = urls.waMe || urls.api;

    if (this.isMobile()) {
      const deepLink = this.buildMobileDeepLink(number, message);

      const viaPage = await this.openViaActivePage(deepLink);
      if (viaPage) {
        this.closePopupIfNeeded();
        return true;
      }

      this.clickDeepLink(deepLink);
      this.closePopupIfNeeded();
      return true;
    }

    if (this.canUseBackground()) {
      const ok = await this.openViaBackground(urls.phone, message);
      if (ok) return true;
    }

    return this.openTab(web);
  },
};

window.WhatsAppLink = WhatsAppLink;
