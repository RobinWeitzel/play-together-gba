import { useCallback } from "react";
import { vibrate, type HapticsEvent, type HapticsMode } from "../../lib/haptics";

// Reads the current haptics mode from localStorage on every call. Cheap;
// no need to subscribe — settings rarely change at runtime, and a stale
// read just affects the very next event.
function readMode(): HapticsMode {
  try {
    const raw = localStorage.getItem("settings.global");
    if (!raw) return "light";
    const parsed = JSON.parse(raw);
    const m = parsed?.haptics;
    if (m === "off" || m === "light" || m === "strong") return m;
  } catch { /* ignore */ }
  return "light";
}

export function useHaptics(): (event: HapticsEvent) => void {
  return useCallback((event: HapticsEvent) => {
    vibrate(readMode(), event);
  }, []);
}
