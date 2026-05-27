// Home / Join screen — pick a ROM (and later, a session). For M1 this just
// launches the local emulator. M2+ adds session id and roster.

import { useEffect, useState } from "react";
import { listRoms, type RomMeta } from "../lib/api";
import { navigate } from "../lib/router";

export function HomePage() {
  const [roms, setRoms] = useState<RomMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string>(() => localStorage.getItem("name") ?? "");

  useEffect(() => {
    listRoms()
      .then(setRoms)
      .catch((e) => setErr(e.message));
  }, []);

  const onPlay = (romId: string) => {
    if (name.trim()) localStorage.setItem("name", name.trim());
    const params = new URLSearchParams({ rom: romId });
    if (name.trim()) params.set("name", name.trim());
    navigate(`/play?${params.toString()}`);
  };

  return (
    <div className="home">
      <h1>Watch-Together GBA</h1>
      <p style={{ color: "var(--muted)" }}>
        Pick a ROM to play locally. Once Milestone 2 lands, you'll be able to share a session URL with others.
      </p>

      {err && <div className="error">{err}</div>}

      <div className="field">
        <label htmlFor="name">Your name (optional)</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Robin"
        />
      </div>

      <h2 style={{ fontSize: 16, color: "var(--muted)", marginTop: 24 }}>ROMs</h2>
      {!roms && !err && <div>Loading…</div>}
      {roms && roms.length === 0 && (
        <div className="error">
          No ROMs found. Drop a `.gba` file into <code>/server/roms/</code> and reload.
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
              <button onClick={() => onPlay(r.id)}>Play</button>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: "var(--muted)" }}>
        Need diagnostics? See the{" "}
        <a href="/spike" style={{ color: "var(--accent)" }}>determinism spike</a>.
      </p>
    </div>
  );
}
