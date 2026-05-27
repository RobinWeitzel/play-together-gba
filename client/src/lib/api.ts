// Tiny client for the dev/prod /api/roms endpoint.

export interface RomMeta {
  id: string;
  name: string;
  hash: string;
  size: number;
}

export async function listRoms(): Promise<RomMeta[]> {
  const res = await fetch("/api/roms");
  if (!res.ok) throw new Error(`listRoms: ${res.status}`);
  const j = await res.json();
  return j.roms;
}

export async function fetchRom(id: string): Promise<Uint8Array> {
  const res = await fetch(`/api/roms/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`fetchRom(${id}): ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
