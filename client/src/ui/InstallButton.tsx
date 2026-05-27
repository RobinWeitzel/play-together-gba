import { useEffect, useState } from "react";

// Chrome fires beforeinstallprompt once it has decided the page meets all
// PWA install criteria. We stash the event so a user tap can trigger the
// native prompt — Chrome blocks calling prompt() outside a user gesture.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// In-app install pill. Lives in the hero so users don't have to hunt for
// "Install app" in Chrome's overflow menu (which sometimes hides it
// behind the more generic "Add to Home Screen" item).
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as an installed app — nothing to offer.
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const onClick = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDeferred(null);
  };

  return (
    <button className="install-btn" onClick={onClick} data-testid="install-btn">
      Install app
    </button>
  );
}
