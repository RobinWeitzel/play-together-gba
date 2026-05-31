// Serverless home / lobby (SPEC-SERVERLESS). Replaces the old server-saves
// home. From here you:
//   - start a new game: pick your LOCAL ROM (hashed, kept on-device) and create
//     a session (you become the owner);
//   - rejoin a session you already belong to (durable credential, no invite);
//   - open an invite link someone sent you (handled by JoinPage at #/join).
//
// ROMs are never uploaded (§8). The Firebase web config is loaded at runtime;
// if it's missing we show setup guidance instead of crashing (§4, DECISIONS D3).

import { useEffect, useRef, useState } from "react";
import { navigate } from "../lib/router";
import { getBackend, MissingConfigError } from "../net/backend";
import { importRom } from "../lib/romStore";
import { listMySessions, rememberSession, forgetSession, type MySession } from "../lib/sessionStore";
import { getPlayerName, setPlayerName, formatRelTime } from "../lib/player";
import { gradientForName } from "../lib/gradient";
import { IconSettings } from "./icons";

export function HomePage() {
  const [name, setName] = useState<string>(getPlayerName());
  const [mySessions, setMySessions] = useState<MySession[]>(listMySessions());
  const [uid, setUid] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getBackend()
      .then((a) => setUid(a.currentMemberId()))
      .catch((e) => {
        if (e instanceof MissingConfigError) setConfigError(e.message);
        else setErr(`Couldn't connect: ${e?.message ?? e}`);
      });
  }, []);

  const saveName = (n: string) => { setName(n); setPlayerName(n); };

  const onStartNewGame = () => {
    if (!name.trim()) { setErr("Enter your name first."); return; }
    setErr(null);
    fileRef.current?.click();
  };

  const onRomChosen = async (file: File) => {
    setBusy("Setting up your game…");
    setErr(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const romHash = await importRom(file.name, bytes);
      const romName = file.name.replace(/\.(gba|gbc|gb)$/i, "");
      const adapter = await getBackend();
      const { sessionId } = await adapter.createSession({ romHash, romName, name: name.trim() });
      rememberSession({ sessionId, romName, romHash, role: "owner" });
      navigate(`/s/${sessionId}`);
    } catch (e: any) {
      setErr(e instanceof MissingConfigError ? e.message : (e?.message ?? String(e)));
      setBusy(null);
    }
  };

  const onPasteInvite = () => {
    const link = window.prompt("Paste the invite link you were sent:");
    if (!link) return;
    try {
      const hashIdx = link.indexOf("#");
      const frag = hashIdx >= 0 ? link.slice(hashIdx + 1) : link;
      const qIdx = frag.indexOf("?");
      const params = new URLSearchParams(qIdx >= 0 ? frag.slice(qIdx + 1) : frag);
      const s = params.get("s"); const i = params.get("i");
      if (!s || !i) { setErr("That doesn't look like a valid invite link."); return; }
      navigate(`/join?s=${encodeURIComponent(s)}&i=${encodeURIComponent(i)}`);
    } catch {
      setErr("Couldn't read that invite link.");
    }
  };

  if (configError) {
    return (
      <div className="home" data-testid="config-needed">
        <h1>Almost there — add your Firebase config</h1>
        <p style={{ color: "var(--fg-muted)" }}>{configError}</p>
        <p style={{ color: "var(--fg-muted)" }}>
          See the README → “Firebase setup”. Copy <code>firebase-config.example.json</code> to{" "}
          <code>firebase-config.json</code> next to it and fill in your project’s values, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="home" data-testid="home">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ marginBottom: 4 }}>Play-Together GBA</h1>
        <button aria-label="Settings" onClick={() => navigate("/settings")}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--fg)" }}>
          <IconSettings />
        </button>
      </div>
      <p style={{ color: "var(--fg-muted)", marginTop: 0 }}>
        Play your Game Boy Advance games together — everyone runs their own copy of the ROM, perfectly in sync.
      </p>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="name">Your name</label>
        <input id="name" data-testid="home-name" placeholder="e.g. Robin" maxLength={32}
          value={name} onChange={(e) => saveName(e.target.value)} />
      </div>

      {err && <div className="error" data-testid="home-error" style={{ marginTop: 8 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="primary" data-testid="start-new-game" onClick={onStartNewGame} disabled={!!busy}>
          {busy ? busy : "Start a new game"}
        </button>
        <button data-testid="open-invite" onClick={onPasteInvite} disabled={!!busy}>Open an invite link</button>
      </div>
      <input ref={fileRef} type="file" accept=".gba,.gb,.gbc,application/octet-stream"
        data-testid="new-game-rom-input" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onRomChosen(f); }} />

      {mySessions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Your games</h3>
          {mySessions.map((s) => (
            <div key={s.sessionId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: gradientForName(s.romName) }} aria-hidden />
              <button onClick={() => navigate(`/s/${s.sessionId}`)} data-testid="rejoin-session"
                style={{ flex: 1, textAlign: "left", background: "none", border: 0, color: "var(--fg)", cursor: "pointer" }}>
                <div style={{ fontWeight: 600 }}>{s.romName}</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                  {s.role === "owner" ? "You host" : "Member"} · played {formatRelTime(s.lastPlayed)}
                </div>
              </button>
              <button aria-label="Forget" onClick={() => { forgetSession(s.sessionId); setMySessions(listMySessions()); }}
                style={{ background: "none", border: 0, color: "var(--fg-muted)", cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {uid && (
        <div style={{ marginTop: 28, fontSize: 11, color: "var(--fg-dim)" }}>
          <div>Your device ID (for owner recovery — see README):</div>
          <code data-testid="home-uid" style={{ fontSize: 11 }}>{uid}</code>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--fg-dim)" }}>
        Build {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}
      </div>
    </div>
  );
}
