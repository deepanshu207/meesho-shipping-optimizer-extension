/**
 * Load staticFrameCompose in the content-script isolated world (extension + web).
 * Classic content.js dynamic import() is unreliable on some Meesho/Kiwi hosts.
 */
const version = "129";
const urls = [
  `./staticFrameCompose.mjs?v=${version}`,
  "./staticFrameCompose.mjs",
];

(async () => {
  let loaded = false;
  for (const url of urls) {
    try {
      await import(url);
      if (window.StaticFrameCompose?.composeStaticPreview) {
        loaded = true;
        break;
      }
    } catch (e) {
      console.warn("staticComposeLoader:", url, e);
    }
  }

  if (loaded && typeof window !== "undefined") {
    window.dispatchEvent(new Event("static-compose-ready"));
  }
})();
