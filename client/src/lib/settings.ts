// User-tweakable client settings, persisted to localStorage.

import { useEffect, useState } from "react";

export type ControlLayout = "stacked" | "flanking" | "overlay";

const KEY = "settings.controlLayout";

export function loadLayoutPref(): ControlLayout | null {
  const v = localStorage.getItem(KEY);
  if (v === "stacked" || v === "flanking" || v === "overlay") return v;
  return null;
}

export function saveLayoutPref(layout: ControlLayout): void {
  localStorage.setItem(KEY, layout);
}

// Resolve a concrete layout from (user pref, orientation). Portrait always
// uses stacked unless the user explicitly overrides it; landscape defaults
// to flanking.
export function resolveLayout(pref: ControlLayout | null, isLandscape: boolean): ControlLayout {
  if (pref) return pref;
  return isLandscape ? "flanking" : "stacked";
}

export function useOrientation(): boolean {
  // True if landscape. Uses both matchMedia and a fallback resize listener
  // because some Android Chromes don't fire matchMedia until rotation
  // completes fully.
  const isLandscape = () => window.matchMedia("(orientation: landscape)").matches;
  const [v, setV] = useState<boolean>(isLandscape);
  useEffect(() => {
    const mm = window.matchMedia("(orientation: landscape)");
    const onChange = () => setV(mm.matches);
    mm.addEventListener?.("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mm.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);
  return v;
}

export function useControlLayout(): {
  layout: ControlLayout;
  pref: ControlLayout | null;
  setPref: (p: ControlLayout | null) => void;
} {
  const [pref, setPrefState] = useState<ControlLayout | null>(loadLayoutPref);
  const isLandscape = useOrientation();
  const layout = resolveLayout(pref, isLandscape);
  const setPref = (p: ControlLayout | null) => {
    if (p === null) localStorage.removeItem(KEY);
    else saveLayoutPref(p);
    setPrefState(p);
  };
  return { layout, pref, setPref };
}
