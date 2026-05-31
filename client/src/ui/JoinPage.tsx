// Invite redemption (SPEC-SERVERLESS §6/§7). Route: #/join?s=<sessionId>&i=<inviteId>.
//
// Redeems the single-use invite atomically (adapter transaction), persists the
// membership locally, then forwards to the session. The ROM hash-gate happens
// in SessionPage. Re-clicking your own already-redeemed link is idempotent.

import { useEffect, useState } from "react";
import { navigate, useRoute } from "../lib/router";
import { getBackend, MissingConfigError } from "../net/backend";
import { rememberSession } from "../lib/sessionStore";
import { getPlayerName, setPlayerName } from "../lib/player";

type Phase = "need-name" | "joining" | "error";

export function JoinPage() {
  const route = useRoute();
  const sessionId = route.search.get("s") ?? "";
  const inviteId = route.search.get("i") ?? "";

  const [phase, setPhase] = useState<Phase>(getPlayerName().trim() ? "joining" : "need-name");
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string>(getPlayerName());

  useEffect(() => {
    if (phase !== "joining") return;
    if (!sessionId || !inviteId) { setErr("This invite link is incomplete."); setPhase("error"); return; }
    let cancelled = false;
    (async () => {
      try {
        const adapter = await getBackend();
        await adapter.joinViaInvite({ sessionId, inviteId }, { name: getPlayerName().trim() || "Player" });
        const meta = await adapter.getSessionMeta(sessionId);
        rememberSession({
          sessionId,
          romName: meta?.romName ?? "Game",
          romHash: meta?.romHash ?? "",
          role: adapter.isOwner() ? "owner" : "member",
        });
        if (!cancelled) navigate(`/s/${sessionId}`);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e instanceof MissingConfigError ? e.message : (e?.message ?? String(e)));
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [phase, sessionId, inviteId]);

  if (phase === "need-name") {
    const ok = name.trim().length > 0;
    return (
      <div className="home" data-testid="join-need-name">
        <h1>You're invited!</h1>
        <p style={{ color: "var(--fg-muted)" }}>Pick a name to join the game.</p>
        <div className="field">
          <label htmlFor="jn">Your name</label>
          <input id="jn" data-testid="join-name" autoFocus maxLength={32} placeholder="e.g. Robin"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ok) { setPlayerName(name.trim()); setPhase("joining"); } }} />
        </div>
        <button className="primary" data-testid="join-continue" disabled={!ok}
          onClick={() => { setPlayerName(name.trim()); setPhase("joining"); }}>
          Join the game
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="home">
        <div className="error" data-testid="join-error">{err}</div>
        <button onClick={() => navigate("/")}>Back to home</button>
      </div>
    );
  }

  return (
    <div className="home" data-testid="join-joining">
      <h1>Joining…</h1>
      <p style={{ color: "var(--fg-muted)" }}>Redeeming your invite.</p>
    </div>
  );
}
