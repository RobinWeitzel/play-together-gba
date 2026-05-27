// Player name is required for everything (it's how contributions are
// credited). Persisted in localStorage so it sticks across visits.

const KEY = "player.name";

export function getPlayerName(): string {
  return (localStorage.getItem(KEY) ?? "").trim();
}

export function setPlayerName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) localStorage.setItem(KEY, trimmed);
  else localStorage.removeItem(KEY);
}

export function formatMs(ms: number): string {
  if (!ms || ms < 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "< 1m";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatRelTime(ms: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}
