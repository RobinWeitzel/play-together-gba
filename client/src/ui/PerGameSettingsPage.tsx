import { useEffect, useState } from "react";
import { listRoms, type RomMeta } from "../lib/api";
import { listRomOverrides, clearRom } from "../lib/settings";
import { navigate } from "../lib/router";
import { ActionSheet, type ActionItem } from "./primitives";
import { IconBack } from "./icons";

export function PerGameSettingsPage() {
  const [roms, setRoms] = useState<RomMeta[]>([]);
  const [overrides, setOverrides] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);

  const refresh = () => setOverrides(listRomOverrides());

  useEffect(() => {
    listRoms().then(setRoms).catch(() => {});
    refresh();
  }, []);

  const romName = (id: string) => roms.find((r) => r.id === id)?.name ?? id;

  const pickerItems: ActionItem[] = roms.map((r) => ({
    label: r.name,
    onSelect: () => navigate(`/edit-controls?scope=rom:${encodeURIComponent(r.id)}`),
    testId: `pick-rom-${r.id}`,
  }));

  return (
    <div className="settings-shell">
      <div className="settings-inner">
        <div className="settings-header">
          <button className="back" onClick={() => navigate("/settings")} aria-label="Back">
            <IconBack size={14} />
          </button>
          <h1>Per-game customizations</h1>
        </div>

        <section className="settings-section">
          {overrides.length === 0 ? (
            <div className="settings-row" style={{ color: "var(--fg-muted)" }}>
              No per-game customizations yet.
            </div>
          ) : overrides.map((id) => (
            <button
              key={id}
              className="settings-row"
              onClick={() => setRowMenuFor(id)}
              data-testid={`override-row-${id}`}
            >
              <span className="label">{romName(id)}</span>
              <span className="chevron">›</span>
            </button>
          ))}
          <button
            className="settings-row"
            onClick={() => setPickerOpen(true)}
            data-testid="add-override"
            style={{ color: "var(--accent)" }}
          >
            <span className="label">+ Customize another game</span>
          </button>
        </section>
      </div>

      <ActionSheet
        open={pickerOpen}
        title="Choose a game"
        items={pickerItems}
        onClose={() => setPickerOpen(false)}
      />

      <ActionSheet
        open={rowMenuFor !== null}
        title={rowMenuFor ? romName(rowMenuFor) : ""}
        items={rowMenuFor ? [
          {
            label: "Modify…",
            trailing: "chevron",
            onSelect: () => navigate(`/edit-controls?scope=rom:${encodeURIComponent(rowMenuFor!)}`),
          },
          {
            label: "Reset to defaults",
            destructive: true,
            onSelect: () => { clearRom(rowMenuFor!); refresh(); },
          },
        ] : []}
        onClose={() => setRowMenuFor(null)}
      />
    </div>
  );
}
