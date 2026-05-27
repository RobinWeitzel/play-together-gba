import { createRoot } from "react-dom/client";
import { SpikePage } from "./spike/SpikePage";

function App() {
  // M0 — until M1, the only thing the app does is the spike.
  // Later: /s/<sessionId> session screen, / home screen.
  return <SpikePage />;
}

const rootEl = document.getElementById("root")!;
// No StrictMode: in dev StrictMode double-mounts components, which would
// cause the spike to start the emulator twice and confuse the frame counter.
createRoot(rootEl).render(<App />);
