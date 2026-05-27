// Home screen — pick a ROM (Solo or Watch-Together), browse active sessions,
// or paste a session URL/id to join.

import { useEffect, useState } from "react";
import { listRoms, listSessions, type RomMeta } from "../lib/api";
import { navigate } from "../lib/router";
import type { SessionSummary } from "@gba/shared";

function newSessionId(): string {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

function relTime(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function HomePage() {
  const [roms, setRoms] = useState<RomMeta[] | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string>(() => localStorage.getItem("name") ?? "");
  const [joinInput, setJoinInput] = useState<string>("");

  useEffect(() => {
    listRoms().then(setRoms).catch((e) => setErr(e.message));
  }, []);

  // Poll the session list every 3s while we're on the home page.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      listSessions()
        .then((s) => { if (alive) setSessions(s); })
        .catch(() => { /* silent — server might be momentarily unreachable */ });
    };
    tick();
    const iv = window.setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const onPlay = (romId: string) => {
    if (name.trim()) localStorage.setItem("name", name.trim());
    const params = new URLSearchParams({ rom: romId });
    if (name.trim()) params.set("name", name.trim());
    navigate(`/play?${params.toString()}`);
  };

  const onStartSession = (romId: string) => {
    if (name.trim()) localStorage.setItem("name", name.trim());
    const sessionId = newSessionId();
    const params = new URLSearchParams({ rom: romId });
    if (name.trim()) params.set("name", name.trim());
    navigate(`/s/${sessionId}?${params.toString()}`);
  };

  const goToSession = (s: SessionSummary) => {
    if (name.trim()) localStorage.setItem("name", name.trim());
    const params = new URLSearchParams({ rom: s.romId });
    if (name.trim()) params.set("name", name.trim());
    navigate(`/s/${s.id}?${params.toString()}`);
  };

  const onJoinFromInput = () => {
    if (name.trim()) localStorage.setItem("name", name.trim());
    let target = joinInput.trim();
    if (!target) return;
    if (target.startsWith("http")) {
      try {
        const u = new URL(target);
        target = u.pathname + u.search;
      } catch { /* leave as-is */ }
    }
    if (!target.startsWith("/s/")) target = `/s/${target.replace(/^\/+/, "")}`;
    navigate(target);
  };

  return (
    <div className="home">
      <h1>Watch-Together GBA</h1>
      <p style={{ color: "var(--muted)" }}>
        Pick a ROM and pick a mode. Sessions you create are visible to anyone
        else who can reach this server — share the URL when you want company.
      </p>

      {err && <div className="error">{err}</div>}

      <div className="field">
        <label htmlFor="name">Your name (shown in the roster)</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Robin"
          data-testid="name-input"
        />
      </div>

      {/* Active sessions — top-of-fold because joining one is the primary
          way to play together. */}
      <h2 style={{ fontSize: 16, color: "var(--muted)", marginTop: 24 }}>
        Active sessions {sessions.length > 0 ? `(${sessions.length})` : ""}
      </h2>
      {sessions.length === 0 ? (
        <div className="hint" data-testid="empty-sessions">
          No active sessions. Start one below to play together — anyone with
          a link (or this page) can join.
        </div>
      ) : (
        <ul className="session-list" data-testid="session-list">
          {sessions.map((s) => (
            <li key={s.id} data-session-id={s.id}>
              <div className="session-main">
                <div className="session-title">
                  {s.romName}
                  <span className="session-id-chip">#{s.id}</span>
                </div>
                <div className="session-meta">
                  {s.controllerName ? `${s.controllerName} is playing` : "Waiting for controller"}
                  {" · "}
                  {s.participantCount} {s.participantCount === 1 ? "person" : "people"} in session
                  {" · started "}
                  {relTime(s.createdAt)}
                </div>
              </div>
              <button onClick={() => goToSession(s)} data-testid="join-session">Join</button>
            </li>
          ))}
        </ul>
      )}

      {/* ROM picker — second now, since "join existing" is the common path. */}
      <h2 style={{ fontSize: 16, color: "var(--muted)", marginTop: 32 }}>Start a new game</h2>
      {!roms && !err && <div>Loading ROMs…</div>}
      {roms && roms.length === 0 && (
        <div className="error">
          No ROMs found. Drop a <code>.gba</code> file into the mounted{" "}
          <code>/app/server/roms</code> volume and restart the container.
        </div>
      )}
      {roms && roms.length > 0 && (
        <ul className="rom-list">
          {roms.map((r) => (
            <li key={r.id}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="rom-meta">
                  {(r.size / 1024).toFixed(1)} KB · sha256:{r.hash.slice(0, 12)}…
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onPlay(r.id)} title="Play locally with no session">Solo</button>
                <button
                  onClick={() => onStartSession(r.id)}
                  title="Create a session URL and start a multi-player game"
                  className="primary"
                  data-testid={`start-session-${r.id}`}
                >
                  Watch-Together
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Manual join via URL or id — useful when sharing across networks
          where the server URL itself isn't obvious. */}
      <h2 style={{ fontSize: 16, color: "var(--muted)", marginTop: 32 }}>
        Join by link or id
      </h2>
      <div className="join-by-input">
        <input
          value={joinInput}
          onChange={(e) => setJoinInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onJoinFromInput(); }}
          placeholder="https://…/s/abc12345  or just  abc12345"
          data-testid="join-input"
        />
        <button onClick={onJoinFromInput}>Join</button>
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: "var(--muted)" }}>
        Need diagnostics? See the{" "}
        <a href="/spike" style={{ color: "var(--accent)" }}>determinism spike</a>.
      </p>
    </div>
  );
}
