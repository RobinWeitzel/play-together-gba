export type HapticsMode = "off" | "light" | "strong";
export type HapticsEvent = "tap" | "snap" | "success" | "warn";

const PATTERNS: Record<HapticsMode, Record<HapticsEvent, number | number[]>> = {
  off: { tap: 0, snap: 0, success: 0, warn: 0 },
  light: { tap: 8, snap: 6, success: 12, warn: [10, 40, 10] },
  strong: { tap: 15, snap: 12, success: 20, warn: [20, 60, 20] },
};

export function vibrate(mode: HapticsMode, event: HapticsEvent): void {
  if (mode === "off") return;
  const v = (navigator as any).vibrate;
  if (typeof v !== "function") return;
  const pattern = PATTERNS[mode][event];
  if (!pattern) return;
  try { v.call(navigator, pattern); } catch { /* ignore */ }
}
