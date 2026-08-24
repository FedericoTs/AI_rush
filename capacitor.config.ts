import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shell.
 *
 * This app is a real website first — the leaderboard, the share links and the
 * seeded challenge URLs all only work if there is a server — so the shell
 * points at the deployment rather than bundling a static export. That makes
 * the native builds a chrome around the live game: one deploy updates the web,
 * the iOS app and the Android app at once, and a level fix does not need a
 * store review.
 *
 * The cost is honest and worth stating: with `server.url` set, the app needs a
 * network to *start*, even though a run needs none once it is running. The
 * service worker covers that gap — `public/sw.js` precaches the shell, so a
 * cold launch on a plane still reaches `/play`.
 *
 * See `docs/MOBILE.md` for what to run. The `@capacitor/*` packages are
 * deliberately not dependencies of this repository; they belong to whoever is
 * building the apps.
 */
const config: CapacitorConfig = {
  appId: "app.airush.game",
  appName: "AI Rush",
  webDir: "public",

  server: {
    url: process.env.CAP_SERVER_URL ?? "https://ai-rush.lol",
    /* Only ever plain HTTPS to our own origin. */
    cleartext: false,
  },

  ios: {
    /* The game is very dark and draws to the edges; a white bounce at the top
       of a scroll would be the only white pixel in the entire product. */
    backgroundColor: "#0b0e13",
    contentInset: "never",
    scrollEnabled: false,
  },

  android: {
    backgroundColor: "#0b0e13",
    /* The web layer already refuses to file a run it cannot verify, and every
       request goes to one HTTPS origin. Nothing here needs a debuggable
       webview in a release build. */
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 400,
      backgroundColor: "#0b0e13",
    },
  },
};

export default config;
