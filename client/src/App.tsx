import { useRoute } from "./lib/router";
import { HomePage } from "./ui/HomePage";
import { PlayPage } from "./ui/PlayPage";
import { SpikePage } from "./spike/SpikePage";

export function App() {
  const route = useRoute();
  if (route.path === "/spike") return <SpikePage />;
  if (route.path === "/play") return <PlayPage />;
  // /s/<sessionId> will be wired in M2; for now anything else is home.
  return <HomePage />;
}
