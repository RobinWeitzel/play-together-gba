import { useEffect, useMemo, useState } from "react";
import { navigate, useRoute } from "../lib/router";
import {
  loadGlobal, saveGlobal, loadRom, saveRom,
  useOrientation,
  type ButtonLayout, type OrientationLayout, type ButtonId,
} from "../lib/settings";
import {
  DEFAULT_BUTTON_LAYOUT, DEFAULT_PORTRAIT, DEFAULT_LANDSCAPE, deepClone,
} from "../lib/buttonLayout";
import { listRoms, type RomMeta } from "../lib/api";
import { SegmentedControl, Slider } from "./primitives";

type Scope = { kind: "global" } | { kind: "rom"; romId: string };

function readScope(search: URLSearchParams): Scope {
  const raw = search.get("scope") ?? "global";
  if (raw.startsWith("rom:")) return { kind: "rom", romId: decodeURIComponent(raw.slice(4)) };
  return { kind: "global" };
}

function loadScopeLayout(scope: Scope): ButtonLayout {
  if (scope.kind === "global") {
    const g = loadGlobal();
    return g.buttonLayout ? deepClone(g.buttonLayout) : deepClone(DEFAULT_BUTTON_LAYOUT);
  }
  const r = loadRom(scope.romId);
  if (r.buttonLayout) return deepClone(r.buttonLayout);
  const g = loadGlobal();
  return g.buttonLayout ? deepClone(g.buttonLayout) : deepClone(DEFAULT_BUTTON_LAYOUT);
}

export function ButtonEditor() {
  const route = useRoute();
  const scope = useMemo(() => readScope(route.search), [route.search]);

  const isLandscape = useOrientation();
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    isLandscape ? "landscape" : "portrait",
  );

  const [layout, setLayout] = useState<ButtonLayout>(() => loadScopeLayout(scope));
  const [, setSelected] = useState<ButtonId | null>(null);
  const [gridSnap, setGridSnap] = useState(false);
  const [roms, setRoms] = useState<RomMeta[]>([]);

  useEffect(() => { listRoms().then(setRoms).catch(() => {}); }, []);
  const romName = scope.kind === "rom"
    ? (roms.find((r) => r.id === scope.romId)?.name ?? scope.romId)
    : "Default layout";

  const current = layout.orientations[orientation];

  const setOpacity = (v: number) => {
    setLayout((prev) => {
      const next = deepClone(prev);
      next.orientations[orientation].opacity = v;
      return next;
    });
  };

  const onReset = () => {
    setLayout((prev) => {
      const next = deepClone(prev);
      next.orientations[orientation] = orientation === "landscape"
        ? deepClone(DEFAULT_LANDSCAPE)
        : deepClone(DEFAULT_PORTRAIT);
      return next;
    });
    setSelected(null);
  };

  const onSave = () => {
    if (scope.kind === "global") {
      const g = loadGlobal();
      saveGlobal({ ...g, buttonLayout: layout });
    } else {
      const r = loadRom(scope.romId);
      saveRom(scope.romId, { ...r, buttonLayout: layout });
    }
    window.history.back();
  };

  const onCancel = () => {
    window.history.back();
  };

  return (
    <div className="editor-shell">
      <div className="editor-topbar">
        <div className="scope-label">{romName}</div>
        <span className="seg-wrap">
          <SegmentedControl<"portrait" | "landscape">
            options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]}
            value={orientation}
            onChange={setOrientation}
            testId="orient-toggle"
          />
        </span>
      </div>

      <EditorCanvasPlaceholder
        orientation={orientation}
        layout={current}
      />

      <div className="editor-bottombar">
        <Slider
          label="Opacity"
          value={current.opacity}
          min={0.3} max={1.0} step={0.05}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={setOpacity}
          testId="opacity"
        />
        <div className="row">
          <button
            onClick={() => setGridSnap(!gridSnap)}
            data-testid="grid-snap"
            style={{
              background: gridSnap ? "var(--accent)" : "var(--bg-3)",
              color: gridSnap ? "var(--accent-on)" : "var(--fg)",
              border: 0, borderRadius: "var(--r-md)",
              padding: "8px 12px", fontSize: 13, cursor: "pointer",
            }}
          >
            Grid snap {gridSnap ? "on" : "off"}
          </button>
          <button
            onClick={onReset}
            className="danger"
            data-testid="reset-orient"
            style={{
              background: "var(--bg-3)", color: "var(--danger)",
              border: 0, borderRadius: "var(--r-md)",
              padding: "8px 12px", fontSize: 13, cursor: "pointer",
            }}
          >
            Reset orientation
          </button>
        </div>
        <div className="actions">
          <button onClick={onCancel} data-testid="editor-cancel">Cancel</button>
          <button className="primary" onClick={onSave} data-testid="editor-save">Save</button>
        </div>
      </div>
    </div>
  );
}

// Placeholder — replaced in M5.4 with full drag/resize/alignment-guide logic.
function EditorCanvasPlaceholder({
  orientation, layout,
}: {
  orientation: "portrait" | "landscape";
  layout: OrientationLayout;
}) {
  const screenStyle = orientation === "landscape"
    ? { width: "min(48vw, 60vh * 1.5)", aspectRatio: "240/160" }
    : { width: "min(72vw, 50vh * 1.5)", aspectRatio: "240/160" };

  return (
    <div className="editor-canvas" style={{ opacity: layout.opacity }}>
      <div className="editor-screen" style={screenStyle as any} aria-label="GBA screen placeholder" />
      <div style={{ position: "absolute", top: 12, left: 12, fontSize: 11, color: "var(--fg-muted)" }}>
        Drag handles arrive in M5.4 — saving now persists the current orientation's opacity.
      </div>
    </div>
  );
}
