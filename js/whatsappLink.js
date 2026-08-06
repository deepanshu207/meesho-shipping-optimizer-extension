// Shared WhatsApp opener — mobile app deep link + web fallback (popup + content)

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

  /**
   * Open WhatsApp chat. Mobile uses whatsapp:// in the current context (popup/page);
   * never intent:// in a new tab (shows "open in app" page on Kiwi/Chrome Android).
   */
  open(number, message) {
    const urls = this.buildUrls(number, message);
    const web = urls.waMe || urls.api;

    if (this.isMobile()) {
      try {
        window.location.href = urls.scheme;
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => {
        this.openTab(web);
      }, 800);
      return Promise.resolve(true);
    }

    return this.openTab(web);
  },
};

window.WhatsAppLink = WhatsAppLink;
