import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./ui/tokens.css";
import "./ui/primitives/primitives.css";
import "./ui/styles.css";

const rootEl = document.getElementById("root")!;
// No StrictMode: in dev StrictMode double-mounts components, which would
// boot the emulator twice and break frame counting + audio.
createRoot(rootEl).render(<App />);

// Register a pass-through service worker so Android Chrome treats the site
// as an installable PWA (it requires a SW with a fetch handler). The SW
// itself does no caching — see /sw.js.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: install prompt won't appear, but the app still runs.
    });
  });
}
