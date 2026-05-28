import type { ButtonId, OrientationLayout, ButtonLayout } from "./settings";

export const DEFAULT_PORTRAIT: OrientationLayout = {
  opacity: 0.85,
  buttons: {
    dpad:   { x: 20, y: 75, size: 1.0 },
    a:      { x: 85, y: 70, size: 1.0 },
    b:      { x: 72, y: 78, size: 1.0 },
    l:      { x: 10, y: 60, size: 0.8 },
    r:      { x: 90, y: 60, size: 0.8 },
    start:  { x: 60, y: 92, size: 0.7 },
    select: { x: 40, y: 92, size: 0.7 },
  },
};

export const DEFAULT_LANDSCAPE: OrientationLayout = {
  opacity: 0.85,
  buttons: {
    dpad:   { x: 10, y: 60, size: 1.0 },
    a:      { x: 92, y: 55, size: 1.0 },
    b:      { x: 82, y: 65, size: 1.0 },
    l:      { x: 6,  y: 18, size: 0.8 },
    r:      { x: 94, y: 18, size: 0.8 },
    start:  { x: 60, y: 92, size: 0.7 },
    select: { x: 40, y: 92, size: 0.7 },
  },
};

export const DEFAULT_BUTTON_LAYOUT: ButtonLayout = {
  schemaVersion: 1,
  orientations: {
    portrait: DEFAULT_PORTRAIT,
    landscape: DEFAULT_LANDSCAPE,
  },
};

export interface SafeArea { top: number; bottom: number; left: number; right: number; }

export function clampToSafeArea(
  pos: { x: number; y: number; size: number },
  safe: SafeArea,
): { x: number; y: number; size: number } {
  // x/y are percentages of viewport short-axis. Safe area insets are px,
  // so we convert to approximate % using a 400px short-axis baseline.
  const approxShort = 400;
  const leftPct  = (safe.left  / approxShort) * 100;
  const rightPct = 100 - (safe.right  / approxShort) * 100;
  const topPct   = (safe.top   / approxShort) * 100;
  const botPct   = 100 - (safe.bottom / approxShort) * 100;
  return {
    x: Math.max(leftPct, Math.min(rightPct, pos.x)),
    y: Math.max(topPct,  Math.min(botPct,   pos.y)),
    size: Math.max(0.5, Math.min(2.0, pos.size)),
  };
}

export function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export type { ButtonId, ButtonLayout, OrientationLayout };
