// Milestone 0 diagnostic (SPEC §9). Self-contained, no backend. Verifies the
// make-or-break foundation: cross-origin isolation on the deployed static host
// and that the vendored (threaded) mGBA core boots a LOCALLY-loaded ROM.
//
// Route: #/m0. Open it on the deployed GitHub Pages URL (desktop and a real
// Android device) and confirm:
//   - crossOriginIsolated === true
//   - typeof SharedArrayBuffer === "function"
//   - pick a .gba ROM → frame counter climbs (emulator running)
//
// It deliberately uses a file picker (no ROM is hosted, per SPEC §8). For
// automated verification, Playwright uploads a test ROM into the file input.

import { useEffect, useRef, useState } from "react";
import { createMgba, type MgbaCore } from "../emulator/loadMgba";
import { sha256Hex } from "../lib/hash";

type Boot = "idle" | "booting" | "running" | "error";

function Row({ label, ok, value }: { label: string; ok: boolean | null; value: string }) {
  const color = ok === null ? "#888" : ok ? "#2ea866" : "#e0533d";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ffffff14", fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ color, fontFamily: "ui-monospace, monospace" }} data-testid={`diag-${label}`}>{value}</span>
    </div>
  );
}

export function M0DiagPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<MgbaCore | null>(null);
  const [coi, setCoi] = useState<boolean>(false);
  const [hasSab, setHasSab] = useState<boolean>(false);
  const [secure, setSecure] = useState<boolean>(false);
  const [swController, setSwController] = useState<boolean>(false);
  const [boot, setBoot] = useState<Boot>("idle");
  const [frame, setFrame] = useState<number>(0);
  const [romInfo, setRomInfo] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    setCoi(typeof crossOriginIsolated !== "undefined" && crossOriginIsolated === true);
    setHasSab(typeof SharedArrayBuffer === "function");
    setSecure(window.isSecureContext === true);
    setSwController(!!navigator.serviceWorker?.controller);
    return () => {
      try { coreRef.current?.dispose(); } catch { /* ignore */ }
    };
  }, []);

  // Poll the running core's frame counter so we can SEE it advancing.
  useEffect(() => {
    if (boot !== "running") return;
    const iv = window.setInterval(() => {
      const c = coreRef.current;
      if (c) setFrame(c.getFrame());
    }, 200);
    return () => clearInterval(iv);
  }, [boot]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setBoot("booting");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = await sha256Hex(bytes);
      setRomInfo(`${file.name} · ${bytes.length.toLocaleString()} bytes · sha256 ${hash.slice(0, 12)}…`);
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("canvas not mounted");
      const core = await createMgba(canvas);
      coreRef.current = core;
      await core.loadRomBytes(file.name, bytes);
      core.setVolume(0);
      core.resume();
      setBoot("running");
    } catch (e: any) {
      console.error("[m0] boot failed", e);
      setErr(e?.message ?? String(e));
      setBoot("error");
    }
  };

  const allGreen = coi && hasSab && secure;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24, color: "#f1f1f7" }}>
      <h1 style={{ fontSize: 22 }}>Milestone 0 — Cross-origin isolation</h1>
      <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.5 }}>
        Make-or-break check: the threaded mGBA core needs SharedArrayBuffer,
        which needs cross-origin isolation. GitHub Pages can’t set the headers,
        so a service worker injects them. This page reports whether that worked
        on the actual deployed URL — open it on your Android phone too.
      </p>

      <div style={{ margin: "16px 0", padding: 16, background: "#ffffff0a", borderRadius: 12 }}>
        <Row label="isSecureContext" ok={secure} value={String(secure)} />
        <Row label="serviceWorkerControlling" ok={swController} value={String(swController)} />
        <Row label="crossOriginIsolated" ok={coi} value={String(coi)} />
        <Row label="SharedArrayBuffer" ok={hasSab} value={hasSab ? "available" : "MISSING"} />
      </div>

      <div
        data-testid="m0-overall"
        data-ok={String(allGreen)}
        style={{ padding: 12, borderRadius: 10, marginBottom: 16, background: allGreen ? "#2ea86622" : "#e0533d22", color: allGreen ? "#7be0a4" : "#ff9b8a", fontSize: 14 }}
      >
        {allGreen ? "✓ Isolation OK — threaded mGBA can run." : "✗ Not isolated — would need the single-threaded fallback."}
      </div>

      <div style={{ margin: "16px 0" }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
          Pick a local .gba ROM to boot the emulator:
        </label>
        <input type="file" accept=".gba,.gb,.gbc,application/octet-stream" data-testid="m0-rom-input" onChange={onPick} />
      </div>

      {romInfo && <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>{romInfo}</div>}

      <div style={{ position: "relative", width: 240, height: 160, margin: "8px 0", background: "#000", borderRadius: 6, overflow: "hidden" }}>
        <canvas ref={canvasRef} width={240} height={160} style={{ width: 240, height: 160, imageRendering: "pixelated" }} />
      </div>

      <Row label="bootStatus" ok={boot === "running" ? true : boot === "error" ? false : null} value={boot} />
      <Row label="emulatorFrame" ok={boot === "running" && frame > 0 ? true : null} value={String(frame)} />
      <div data-testid="m0-frame" style={{ position: "absolute", left: -9999 }}>{frame}</div>

      {err && <div style={{ color: "#ff9b8a", fontSize: 13, marginTop: 8 }} data-testid="m0-error">{err}</div>}

      <p style={{ color: "#666", fontSize: 11, marginTop: 24 }}>
        Build {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}
      </p>
    </div>
  );
}
