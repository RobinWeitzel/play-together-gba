// Layout picker dropdown rendered in the session header.

import { useEffect, useRef, useState } from "react";
import type { ControlLayout } from "../lib/settings";
import { resolveLayout, useOrientation } from "../lib/settings";

interface Props {
  pref: ControlLayout | null;
  effective: ControlLayout;
  onChange: (p: ControlLayout | null) => void;
}

const OPTIONS: { value: ControlLayout; label: string; hint: string }[] = [
  { value: "flanking", label: "Side controls", hint: "Pads flank the screen (GBA-style)" },
  { value: "overlay", label: "Overlay on screen", hint: "Translucent pads on the corners" },
  { value: "stacked", label: "Stacked below", hint: "Pads under the screen (portrait default)" },
];

export function SettingsMenu({ pref, effective, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const isLandscape = useOrientation();
  const autoResolved = resolveLayout(null, isLandscape);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div className="settings-menu-wrap" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="settings-btn"
        title="Control layout"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-menu" role="menu" data-testid="settings-menu">
          <div className="settings-menu-section">Control layout</div>
          {OPTIONS.map((opt) => {
            const isActive = (pref ?? autoResolved) === opt.value;
            return (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={isActive}
                className={`settings-menu-item${isActive ? " active" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                data-testid={`layout-${opt.value}`}
                title={opt.hint}
              >
                <span className="check">{isActive ? "✓" : ""}</span>
                <span style={{ flex: 1 }}>{opt.label}</span>
              </button>
            );
          })}
          {pref && (
            <>
              <div style={{ height: 1, background: "#2a2a2a", margin: "4px 6px" }} />
              <button
                className="settings-menu-item"
                onClick={() => { onChange(null); setOpen(false); }}
                data-testid="layout-auto"
                title={`Reset to automatic (${autoResolved} for the current orientation)`}
              >
                <span className="check" />
                <span style={{ flex: 1, color: "var(--muted)" }}>Use automatic ({autoResolved})</span>
              </button>
            </>
          )}
          <div className="settings-menu-section" style={{ paddingTop: 8 }}>
            Active: <span style={{ color: "var(--fg)" }}>{effective}</span>
          </div>
        </div>
      )}
    </div>
  );
}
