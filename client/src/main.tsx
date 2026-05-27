import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./ui/styles.css";

const rootEl = document.getElementById("root")!;
// No StrictMode: in dev StrictMode double-mounts components, which would
// boot the emulator twice and break frame counting + audio.
createRoot(rootEl).render(<App />);
