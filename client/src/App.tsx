import { useRoute } from "./lib/router";
import { HomePage } from "./ui/HomePage";
import { PlayPage } from "./ui/PlayPage";
import { SessionPage } from "./ui/SessionPage";
import { SpikePage } from "./spike/SpikePage";
import { PrimitivesShowcase } from "./ui/PrimitivesShowcase";
import { SettingsPage } from "./ui/SettingsPage";
import { PerGameSettingsPage } from "./ui/PerGameSettingsPage";

export function App() {
  const route = useRoute();
  if (route.path === "/spike") return <SpikePage />;
  if (route.path === "/play") return <PlayPage />;
  if (route.path === "/primitives") return <PrimitivesShowcase />;
  if (route.path === "/settings/per-game") return <PerGameSettingsPage />;
  if (route.path === "/settings") return <SettingsPage />;
  if (route.path.startsWith("/s/")) return <SessionPage />;
  return <HomePage />;
}
