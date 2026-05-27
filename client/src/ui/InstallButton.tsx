import { useEffect, useState } from "react";

// Chrome fires beforeinstallprompt once it has decided the page meets all
// PWA install criteria. We stash the event so a user tap can trigger the
// native prompt — Chrome blocks calling prompt() outside a user gesture.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Status =
  | { kind: "checking" }
  | { kind: "ready"; e: BeforeInstallPromptEvent }
  | { kind: "installed" }
  | { kind: "blocked"; reason: string };

// Live PWA install status. Always renders so users see WHY install isn't
// offered (otherwise debugging on a phone is impossible without USB tools).
export function InstallButton() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setStatus({ kind: "installed" });
      return;
    }

    if (!("serviceWorker" in navigator)) {
      setStatus({ kind: "blocked", reason: "no service worker support" });
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setStatus({ kind: "ready", e: e as BeforeInstallPromptEvent });
    };
    const onInstalled = () => setStatus({ kind: "installed" });

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // If beforeinstallprompt hasn't fired after a few seconds, surface the
    // most likely culprit so the user can see something useful.
    const timer = window.setTimeout(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      const active = regs.find((r) => r.active);
      setStatus((prev) => {
        if (prev.kind !== "checking") return prev;
        if (regs.length === 0) return { kind: "blocked", reason: "SW not registered" };
        if (!active) return { kind: "blocked", reason: "SW not yet activated" };
        return { kind: "blocked", reason: "install criteria not met (open chrome://inspect for details)" };
      });
    }, 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  if (status.kind === "installed") return null;

  if (status.kind === "ready") {
    const onClick = async () => {
      await status.e.prompt();
      const choice = await status.e.userChoice;
      if (choice.outcome === "accepted") setStatus({ kind: "installed" });
    };
    return (
      <button className="install-btn" onClick={onClick} data-testid="install-btn">
        Install app
      </button>
    );
  }

  const label = status.kind === "checking" ? "Checking install…" : `Install n/a: ${status.reason}`;
  return (
    <span className="install-status" data-testid="install-status" title={label}>
      {label}
    </span>
  );
}
