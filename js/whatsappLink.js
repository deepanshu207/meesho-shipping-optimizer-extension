// Shared WhatsApp opener — mobile must launch synchronously on user tap (gesture chain)

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

  buildUrls(number, message) {
    const phone = this.normalizeNumber(number);
    const text = encodeURIComponent(message || "");
    return {
      phone,
      scheme: `whatsapp://send?phone=${phone}&text=${text}`,
      waMe: `https://wa.me/${phone}?text=${text}`,
    };
  },

  buildMobileDeepLink(number, message) {
    const phone = this.normalizeNumber(number);
    const text = encodeURIComponent(message || "");
    if (this.isAndroid()) {
      return `intent://send?phone=${phone}&text=${text}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }
    return `whatsapp://send?phone=${phone}&text=${text}`;
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

  clickDeepLink(url) {
    if (!url) return false;
    try {
      const link = document.createElement("a");
      link.href = url;
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
   * Open WhatsApp on mobile — MUST run synchronously inside the user click handler.
   * Async calls (background messaging) lose the user-gesture chain on Android/Kiwi.
   */
  openMobileSync(number, message) {
    const urls = this.buildUrls(number, message);
    if (this.clickDeepLink(urls.scheme)) return true;
    if (this.isAndroid() && this.clickDeepLink(this.buildMobileDeepLink(number, message))) {
      return true;
    }
    try {
      window.location.href = urls.scheme;
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Open WhatsApp chat.
   * Mobile: synchronous deep link (call from click handler).
   * Desktop: wa.me in new tab.
   */
  open(number, message) {
    const urls = this.buildUrls(number, message);

    if (this.isMobile()) {
      return Promise.resolve(this.openMobileSync(number, message));
    }

    if (this.canMessageBackground()) {
      return this.sendBackground("OPEN_WHATSAPP", {
        phone: urls.phone,
        message: message || "",
      }).then((res) => !!res?.ok);
    }

    return this.openTab(urls.waMe);
  },
};

window.WhatsAppLink = WhatsAppLink;
