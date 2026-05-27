// Home screen — pick a save (in-progress or fresh), keyed to a mandatory
// player name. All actions require a name; the name is persisted in
// localStorage so users only enter it once.

import { useEffect, useMemo, useState } from "react";
import { createSave, listRoms, listSaves, type RomMeta } from "../lib/api";
import { navigate } from "../lib/router";
import { formatMs, formatRelTime, getPlayerName, setPlayerName } from "../lib/player";
import type { SaveSummary } from "@gba/shared";

export function HomePage() {
  const [roms, setRoms] = useState<RomMeta[] | null>(null);
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string>(getPlayerName);
  const [newSaveName, setNewSaveName] = useState<string>("");
  const [newSaveRomId, setNewSaveRomId] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    listRoms()
      .then((r) => {
        setRoms(r);
        if (!newSaveRomId && r.length > 0) setNewSaveRomId(r[0].id);
      })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the saves list while we're on the home page.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      listSaves()
        .then((s) => { if (alive) setSaves(s); })
        .catch(() => { /* silent */ });
    };
    tick();
    const iv = window.setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Keep the localStorage in sync as the user types — but only commit on
  // blur or before navigation so we don't write on every keystroke.
  const persistName = () => {
    setPlayerName(name);
  };

  const trimmedName = name.trim();
  const nameOk = trimmedName.length > 0;

  const goToSave = (save: SaveSummary) => {
    if (!nameOk) return;
    setPlayerName(name);
    navigate(`/s/${save.id}`);
  };

  const onCreateSave = async () => {
    setErr(null);
    if (!nameOk) {
      setErr("Enter your player name first.");
      return;
    }
    if (!newSaveName.trim()) {
      setErr("Give the new save a name (e.g. 'Family Emerald run').");
      return;
    }
    if (!newSaveRomId) {
      setErr("Pick a ROM.");
      return;
    }
    setPlayerName(name);
    setCreating(true);
    try {
      const save = await createSave({ name: newSaveName.trim(), romId: newSaveRomId });
      setNewSaveName("");
      navigate(`/s/${save.id}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setCreating(false);
    }
  };

  const orderedSaves = useMemo(() => {
    return [...saves].sort((a, b) => {
      // Live saves first, then by updatedAt desc.
      const aLive = a.live ? 1 : 0;
      const bLive = b.live ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return b.updatedAt - a.updatedAt;
    });
  }, [saves]);

  return (
    <div className="home">
      <h1>Watch-Together GBA</h1>
      <p style={{ color: "var(--muted)" }}>
        Saves are shared. Pick one to keep playing — or watch someone else
        play, then take over when they hand off. Closing your tab leaves the
        game in the save where you (and others) left it.
      </p>

      {err && <div className="error" data-testid="home-error">{err}</div>}

      <div className="field">
        <label htmlFor="name">Your player name (required, remembered on this device)</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={persistName}
          placeholder="e.g. Robin"
          data-testid="name-input"
          autoComplete="off"
        />
        {!nameOk && (
          <div className="hint" style={{ marginTop: 6 }}>
            We track who contributed to each save by name. Enter yours to play.
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, color: "var(--muted)", marginTop: 24 }}>
        Saves {orderedSaves.length > 0 ? `(${orderedSaves.length})` : ""}
      </h2>

      {orderedSaves.length === 0 ? (
        <div className="hint" data-testid="empty-saves">
          No saves yet. Create one below and start a run — anyone with access
          to this server can join it.
        </div>
      ) : (
        <ul className="save-list" data-testid="save-list">
          {orderedSaves.map((s) => {
            const contributors = Object.entries(s.contributors)
              .sort((a, b) => b[1] - a[1]);
            return (
              <li key={s.id} data-save-id={s.id} className={s.live ? "save-live" : ""}>
                <div className="save-main">
                  <div className="save-title">
                    {s.name}
                    <span className="save-rom-chip">{s.romName}</span>
                    {s.live && (
                      <span className="live-pill" title={`${s.live.participantCount} in session`}>
                        ● LIVE
                      </span>
                    )}
                  </div>
                  <div className="save-meta">
                    {s.live ? (
                      <>
                        {s.live.controllerName ? `${s.live.controllerName} is playing` : "Waiting for controller"}
                        {" · "}
                        {s.live.participantCount} {s.live.participantCount === 1 ? "person" : "people"} in session
                      </>
                    ) : (
                      <>Last played {formatRelTime(s.updatedAt)}</>
                    )}
                  </div>
                  {contributors.length > 0 && (
                    <div className="save-contributors">
                      {contributors.map(([n, ms]) => (
                        <span key={n} className="contributor-chip" title={`${n}: ${formatMs(ms)}`}>
                          {n} <em>{formatMs(ms)}</em>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => goToSave(s)}
                  disabled={!nameOk}
                  data-testid="open-save"
                  className="primary"
                >
                  {s.live ? "Join" : "Continue"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* New-save form. */}
      <h2 style={{ fontSize: 16, color: "var(--muted)", marginTop: 32 }}>Start a new save</h2>
      {!roms && !err && <div>Loading ROMs…</div>}
      {roms && roms.length === 0 && (
        <div className="error">
          No ROMs found. Drop a <code>.gba</code> file into the mounted{" "}
          <code>/app/server/roms</code> volume and restart the container.
        </div>
      )}
      {roms && roms.length > 0 && (
        <div className="new-save-form">
          <div className="field">
            <label>Save name</label>
            <input
              value={newSaveName}
              onChange={(e) => setNewSaveName(e.target.value)}
              placeholder="e.g. Family Emerald run"
              data-testid="new-save-name"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label>ROM</label>
            <select
              value={newSaveRomId}
              onChange={(e) => setNewSaveRomId(e.target.value)}
              data-testid="new-save-rom"
            >
              {roms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onCreateSave}
            disabled={creating || !nameOk || !newSaveName.trim() || !newSaveRomId}
            data-testid="create-save"
            className="primary"
          >
            {creating ? "Creating…" : "Create save"}
          </button>
        </div>
      )}

      <p style={{ marginTop: 32, fontSize: 12, color: "var(--muted)" }}>
        Need diagnostics? See the{" "}
        <a href="/spike" style={{ color: "var(--accent)" }}>determinism spike</a>.
      </p>
    </div>
  );
}
