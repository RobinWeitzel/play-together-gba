import { useEffect, useState } from "react";

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const readInset = (side: "top" | "bottom" | "left" | "right"): number => {
  if (typeof window === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;left:0;top:0;padding-${side}:env(safe-area-inset-${side},0px);visibility:hidden;`;
  document.body.appendChild(probe);
  const v = parseFloat(getComputedStyle(probe).paddingTop || "0");
  // Re-read from the correct side after appending.
  const computed = parseFloat(
    getComputedStyle(probe).getPropertyValue(`padding-${side}`) || "0",
  );
  document.body.removeChild(probe);
  return Number.isFinite(computed) ? computed : v;
};

export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => ({
    top: 0, bottom: 0, left: 0, right: 0,
  }));
  useEffect(() => {
    const read = () => {
      setInsets({
        top: readInset("top"),
        bottom: readInset("bottom"),
        left: readInset("left"),
        right: readInset("right"),
      });
    };
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
  return insets;
}
