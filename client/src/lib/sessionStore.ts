// Local record of sessions THIS device belongs to, so the home screen can offer
// one-tap reconnect (the durable anonymous credential means no fresh invite is
// needed — §7). Stored in localStorage; purely a convenience cache, not
// authority (RTDB membership is the truth).

const KEY = "gba.mySessions";

export interface MySession {
  sessionId: string;
  romName: string;
  romHash: string;
  role: "owner" | "member";
  joinedAt: number;
  lastPlayed: number;
}

export function listMySessions(): MySession[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as MySession[]) : [];
    return arr.sort((a, b) => b.lastPlayed - a.lastPlayed);
  } catch {
    return [];
  }
}

function write(arr: MySession[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* ignore */ }
}

export function rememberSession(s: Omit<MySession, "joinedAt" | "lastPlayed"> & Partial<Pick<MySession, "joinedAt" | "lastPlayed">>): void {
  const arr = listMySessions();
  const now = Date.now();
  const existing = arr.find((x) => x.sessionId === s.sessionId);
  if (existing) {
    existing.romName = s.romName || existing.romName;
    existing.romHash = s.romHash || existing.romHash;
    existing.role = s.role || existing.role;
    existing.lastPlayed = now;
  } else {
    arr.push({ joinedAt: now, lastPlayed: now, ...s } as MySession);
  }
  write(arr);
}

export function touchSession(sessionId: string): void {
  const arr = listMySessions();
  const s = arr.find((x) => x.sessionId === sessionId);
  if (s) { s.lastPlayed = Date.now(); write(arr); }
}

export function forgetSession(sessionId: string): void {
  write(listMySessions().filter((x) => x.sessionId !== sessionId));
}
