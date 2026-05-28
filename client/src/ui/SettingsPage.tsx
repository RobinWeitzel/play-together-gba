import { useState } from "react";
import { navigate } from "../lib/router";
import { useGlobalSettings, type ControlLayout, type HapticsMode } from "../lib/settings";
import { getPlayerName, setPlayerName } from "../lib/player";
import { Avatar } from "./Avatar";
import { Prompt, SegmentedControl } from "./primitives";
import { IconBack } from "./icons";

export function SettingsPage() {
  const { settings, patch } = useGlobalSettings();
  const [name, setName] = useState<string>(getPlayerName());
  const [editingName, setEditingName] = useState(false);

  const commitName = (n: string) => {
    setPlayerName(n);
    setName(n);
    setEditingName(false);
  };

  return (
    <div className="settings-shell">
      <div className="settings-inner">
        <div className="settings-header">
          <button className="back" onClick={() => navigate("/")} aria-label="Back" data-testid="settings-back">
            <IconBack size={14} />
          </button>
          <h1>Settings</h1>
        </div>

        {/* ===== Player ===== */}
        <section className="settings-section">
          <h2>Player</h2>
          <button className="settings-row" onClick={() => setEditingName(true)} data-testid="row-player">
            <Avatar name={name || "?"} size={28} />
            <span className="label">{name || "Set your name"}</span>
            <span className="chevron">›</span>
          </button>
        </section>

        {/* ===== Defaults ===== */}
        <section className="settings-section">
          <h2>Defaults</h2>
          <div className="settings-row">
            <span className="label">Control layout</span>
            <span className="segmented-wrap">
              <SegmentedControl<ControlLayout | "auto">
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "flanking", label: "Side" },
                  { value: "overlay", label: "Overlay" },
                  { value: "stacked", label: "Stacked" },
                ]}
                value={settings.controlLayout}
                onChange={(v) => patch({ controlLayout: v })}
                testId="seg-control-layout"
              />
            </span>
          </div>
          <button
            className="settings-row"
            onClick={() => navigate("/edit-controls?scope=global")}
            data-testid="row-button-layout-default"
          >
            <span className="label">Default button layout</span>
            <span className="value">{settings.buttonLayout ? "Customized" : "Default"}</span>
            <span className="chevron">›</span>
          </button>
          <div className="settings-row">
            <span className="label">Haptics</span>
            <span className="segmented-wrap">
              <SegmentedControl<HapticsMode>
                options={[
                  { value: "off", label: "Off" },
                  { value: "light", label: "Light" },
                  { value: "strong", label: "Strong" },
                ]}
                value={settings.haptics}
                onChange={(v) => patch({ haptics: v })}
                testId="seg-haptics"
              />
            </span>
          </div>
          <button
            className="settings-row toggle"
            onClick={() => patch({ soundFeedback: !settings.soundFeedback })}
            data-testid="row-sound-feedback"
          >
            <span className="label">Sound feedback on tap</span>
            <span className="value">{settings.soundFeedback ? "On" : "Off"}</span>
          </button>
          <button
            className="settings-row"
            onClick={() => navigate("/settings/per-game")}
            data-testid="row-per-game"
          >
            <span className="label">Per-game customizations</span>
            <span className="chevron">›</span>
          </button>
        </section>

        {/* ===== Archived (placeholder — wired in M2.5) ===== */}
        <section className="settings-section">
          <h2>Archived saves</h2>
          <div className="settings-row">
            <span className="label" style={{ color: "var(--fg-muted)" }}>Loading…</span>
          </div>
        </section>

        {/* ===== About ===== */}
        <section className="settings-section">
          <h2>About</h2>
          <a className="settings-row" href="/spike">
            <span className="label">Determinism spike</span>
            <span className="chevron">›</span>
          </a>
          <a
            className="settings-row"
            href={`https://github.com/RobinWeitzel/play-together-gba/commit/${__APP_VERSION__}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="label">Build</span>
            <span className="value">#{__APP_VERSION__}</span>
            <span className="chevron">›</span>
          </a>
        </section>
      </div>

      <Prompt
        open={editingName}
        title="Your name"
        description="Shown to other players and tracks your contribution to each save. Stored on this device."
        initialValue={name}
        placeholder="e.g. Robin"
        cta="Save"
        maxLength={32}
        onSubmit={commitName}
        onCancel={() => setEditingName(false)}
      />
    </div>
  );
}
