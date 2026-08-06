// Shared WhatsApp opener — mobile app via background (no popup navigation / no double-open)

const WhatsAppLink = {
  normalizeNumber(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  },

  isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
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

  /** Launch whatsapp:// without navigating the current page (content script / modal). */
  openMobileScheme(scheme) {
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

  /** Delegate to background — keeps extension popup intact; opens app only on mobile. */
  openViaBackground(phone, message, mobile) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "OPEN_WHATSAPP",
            phone,
            message: message || "",
            mobile: !!mobile,
          },
          () => {
            const ok = !chrome.runtime.lastError;
            if (this.isExtensionPopup()) {
              try {
                window.close();
              } catch (e) {}
            }
            resolve(ok);
          },
        );
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Open WhatsApp chat.
   * Mobile popup: background opens whatsapp:// (no web fallback timer).
   * Mobile content: hidden link click (does not navigate Meesho page).
   * Desktop: wa.me in new tab.
   */
  async open(number, message) {
    const urls = this.buildUrls(number, message);
    const web = urls.waMe || urls.api;
    const mobile = this.isMobile();

    if (this.canUseBackground()) {
      const ok = await this.openViaBackground(urls.phone, message, mobile);
      if (ok) return true;
    }

    if (mobile) {
      this.openMobileScheme(urls.scheme);
      if (this.isExtensionPopup()) {
        try {
          window.close();
        } catch (e) {}
      }
      return true;
    }

    return this.openTab(web);
  },
};

window.WhatsAppLink = WhatsAppLink;
