import { useRoute } from "./lib/router";
import { HomePage } from "./ui/HomePage";
import { PlayPage } from "./ui/PlayPage";
import { SessionPage } from "./ui/SessionPage";
import { SpikePage } from "./spike/SpikePage";
import { PrimitivesShowcase } from "./ui/PrimitivesShowcase";
import { SettingsPage } from "./ui/SettingsPage";
import { PerGameSettingsPage } from "./ui/PerGameSettingsPage";
import { ButtonEditor } from "./ui/ButtonEditor";
import { M0DiagPage } from "./ui/M0DiagPage";
import { JoinPage } from "./ui/JoinPage";

export function App() {
  const route = useRoute();
  if (route.path === "/m0") return <M0DiagPage />;
  if (route.path === "/join") return <JoinPage />;
  if (route.path === "/spike") return <SpikePage />;
  if (route.path === "/play") return <PlayPage />;
  if (route.path === "/primitives") return <PrimitivesShowcase />;
  if (route.path === "/edit-controls") return <ButtonEditor />;
  if (route.path === "/settings/per-game") return <PerGameSettingsPage />;
  if (route.path === "/settings") return <SettingsPage />;
  if (route.path.startsWith("/s/")) return <SessionPage />;
  return <HomePage />;
}
