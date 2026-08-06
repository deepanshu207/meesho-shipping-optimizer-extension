// Shared WhatsApp opener — mobile launches via background + MAIN-world page click

const WhatsAppLink = {
  normalizeNumber(number) {
    let digits = String(number || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    return digits;
  },

  isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  },

  buildUrls(number, message) {
    const phone = this.normalizeNumber(number);
    const text = encodeURIComponent(message || "");
    return {
      phone,
      scheme: `whatsapp://send?phone=${phone}&text=${text}`,
      waMe: `https://wa.me/${phone}?text=${text}`,
    };
  },

  canMessageBackground() {
    try {
      return !!(chrome?.runtime?.sendMessage && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  },

  sendBackground(type, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, ...payload }, (res) => {
          resolve(chrome.runtime.lastError ? { ok: false } : res || { ok: false });
        });
      } catch (e) {
        resolve({ ok: false });
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
        resolve(!!window.open(url, "_blank"));
      } catch (e) {
        resolve(false);
      }
    });
  },

  /**
   * Open WhatsApp chat.
   * Mobile: background focuses Meesho tab + MAIN-world deep link (no browser tab).
   * Desktop: wa.me in new tab.
   */
  async open(number, message) {
    const urls = this.buildUrls(number, message);
    const web = urls.waMe;

    if (this.isMobile()) {
      if (this.canMessageBackground()) {
        const res = await this.sendBackground("OPEN_WHATSAPP_MOBILE", {
          phone: urls.phone,
          message: message || "",
        });
        if (res?.ok) return true;
      }
      return false;
    }

    if (this.canMessageBackground()) {
      const res = await this.sendBackground("OPEN_WHATSAPP", {
        phone: urls.phone,
        message: message || "",
      });
      if (res?.ok) return true;
    }

    return this.openTab(web);
  },
};

window.WhatsAppLink = WhatsAppLink;
