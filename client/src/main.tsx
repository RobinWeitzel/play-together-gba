import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./ui/tokens.css";
import "./ui/primitives/primitives.css";
import "./ui/styles.css";
import "./ui/settings.css";
import "./ui/home.css";
import "./ui/session.css";
import "./ui/editor.css";

const rootEl = document.getElementById("root")!;
// No StrictMode: in dev StrictMode double-mounts components, which would
// boot the emulator twice and break frame counting + audio.
createRoot(rootEl).render(<App />);

// Service worker: in the serverless build the COOP/COEP shim
// (coi-serviceworker.js, loaded from index.html) IS the service worker. It
// registers itself, so we no longer register a separate pass-through SW here.
// App-shell caching for offline/installability is layered onto that same SW
// in Milestone 5.
