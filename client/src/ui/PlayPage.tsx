// Play screen for M1 — single-player local emulator with touch controls.
// Layout: header (back/info), canvas (centered, pixelated, scaled), gamepad.

import { useEffect, useRef, useState } from "react";
import { createMgba, type MgbaCore } from "../emulator/loadMgba";
import { fetchRom, listRoms } from "../lib/api";
import { sha256Hex } from "../lib/hash";
import { acquireWakeLock } from "../lib/wake";
import { Gamepad } from "./Gamepad";
import { navigate, useRoute } from "../lib/router";
import { useControlLayout } from "../lib/settings";
import { SettingsMenu } from "./SettingsMenu";

type Status = "loading" | "needs-tap" | "running" | "error";

export function PlayPage() {
  const route = useRoute();
  const romId = route.search.get("rom");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<MgbaCore | null>(null);
  const wakeRef = useRef<{ release(): void } | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [romName, setRomName] = useState<string>("");
  const { layout, pref: layoutPref, setPref: setLayoutPref } = useControlLayout();

  // Boot the core + load the ROM once we have a canvas.
  useEffect(() => {
    if (!romId) {
      setErr("No ROM selected.");
      setStatus("error");
      return;
    }
    let disposed = false;

    (async () => {
      try {
        // Look up display name + verify hash for integrity (SPEC §15).
        const roms = await listRoms();
        const meta = roms.find((r) => r.id === romId);
        if (!meta) throw new Error(`ROM ${romId} not in /api/roms`);
        setRomName(meta.name);

        const bytes = await fetchRom(romId);
        const actualHash = await sha256Hex(bytes);
        if (actualHash !== meta.hash) {
          throw new Error(`ROM hash mismatch (expected ${meta.hash.slice(0, 8)}…, got ${actualHash.slice(0, 8)}…)`);
        }

        // Need the canvas in the DOM at proper size before booting the core,
        // otherwise mGBA never starts producing video frames.
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("canvas not mounted");
        const core = await createMgba(canvas);
        if (disposed) {
          core.dispose();
          return;
        }
        coreRef.current = core;

        await core.loadRomBytes(romId, bytes);
        // Persistent save callback: when mGBA writes save data, flush to IDBFS.
        // addCoreCallbacks merges with existing callbacks — passing undefined
        // for videoFrameEndedCallback leaves the wrapper's frame counter
        // intact (see mgba.js addCoreCallbacks).
        core.module.addCoreCallbacks({
          saveDataUpdatedCallback: () => {
            try {
              core.module.FSSync?.();
            } catch (e) {
              console.warn("FSSync failed:", e);
            }
          },
        });
        // Followers will mute by default; M1 single-player keeps audio on.
        core.setVolume(1);
        // Pause until user taps Start (audio + wake lock + fullscreen need a gesture).
        core.pause();
        setStatus("needs-tap");
      } catch (e: any) {
        console.error("PlayPage init failed:", e);
        setErr(e?.message ?? String(e));
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      try { wakeRef.current?.release(); } catch { /* ignore */ }
      try { coreRef.current?.dispose(); } catch { /* ignore */ }
      coreRef.current = null;
    };
  }, [romId]);

  const onTapStart = async () => {
    const core = coreRef.current;
    if (!core) return;
    // Unlock the audio context (Android Chrome + iOS Safari both gate audio
    // behind a user gesture).
    try { await core.module.SDL2?.audioContext?.resume?.(); } catch { /* ignore */ }
    // Fullscreen + landscape lock (Android Chrome supports both reliably).
    try { await document.documentElement.requestFullscreen?.(); } catch { /* iOS Safari may reject */ }
    try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* not all devices */ }
    // Wake lock — keep screen on while playing.
    try { wakeRef.current = await acquireWakeLock(); } catch { /* ignore */ }
    core.resume();
    setStatus("running");
  };

  const onBack = () => {
    try { wakeRef.current?.release(); } catch { /* ignore */ }
    try { coreRef.current?.dispose(); } catch { /* ignore */ }
    if (document.fullscreenElement) document.exitFullscreen?.();
    navigate("/");
  };

  const onPress = (b: any) => coreRef.current?.pressButton(b);
  const onRelease = (b: any) => coreRef.current?.releaseButton(b);

  if (status === "error") {
    return (
      <div className="home">
        <div className="error">{err}</div>
        <button onClick={onBack}>Back to home</button>
      </div>
    );
  }

  return (
    <div className="play-shell" data-status={status} data-layout={layout}>
      <div className="play-header">
        <button onClick={onBack}>← Back</button>
        <div className="role-indicator">{romName || "Loading…"}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SettingsMenu pref={layoutPref} effective={layout} onChange={setLayoutPref} />
        </div>
      </div>
      <div className="play-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={240}
          height={160}
          className="play-canvas"
        />
      </div>
      <Gamepad onPress={onPress} onRelease={onRelease} />

      {status === "needs-tap" && (
        <div className="start-overlay" data-testid="start-overlay">
          <h1>{romName}</h1>
          <p>
            Tap below to start. We need the tap to unlock audio, enter
            fullscreen, and lock landscape on mobile.
          </p>
          <button onClick={onTapStart} data-testid="tap-to-start">Tap to start</button>
        </div>
      )}
      {status === "loading" && (
        <div className="start-overlay">
          <h1>Loading…</h1>
        </div>
      )}
    </div>
  );
}
