// Serverless build: there is no Node server. This module used to call
// /api/roms and /api/saves; it is now a thin LOCAL shim so the secondary
// screens (per-game settings, button editor) keep working against the local
// ROM store. "Saves" (the old server concept) are replaced by sessions, which
// are managed from the home lobby — so the saves CRUD here degrades to no-ops.

import type { SaveSummary } from "@gba/shared";
import { listRoms as listLocalRoms, getRomBytes } from "./romStore";

export interface RomMeta {
  id: string; // = SHA-256 hash (the romHash key)
  name: string;
  hash: string;
  size: number;
}

export async function listRoms(): Promise<RomMeta[]> {
  const roms = await listLocalRoms();
  return roms.map((r) => ({ id: r.hash, name: r.name, hash: r.hash, size: r.size }));
}

export async function fetchRom(id: string): Promise<Uint8Array> {
  const bytes = await getRomBytes(id);
  if (!bytes) throw new Error(`ROM ${id} not present on this device`);
  return bytes;
}

// ---- "Saves" are sessions now; managed from the lobby. These degrade. ----
export async function listSaves(): Promise<SaveSummary[]> {
  return [];
}
export async function createSave(_input?: { name: string; romId: string }): Promise<SaveSummary> {
  throw new Error("Sessions are created from the home screen in the serverless build.");
}
export async function archiveSave(_id?: string): Promise<SaveSummary> {
  throw new Error("not supported in the serverless build");
}
export async function unarchiveSave(_id?: string): Promise<SaveSummary> {
  throw new Error("not supported in the serverless build");
}
export async function deleteSave(_id?: string): Promise<void> {
  /* no-op */
}
export async function renameSave(_id?: string, _name?: string): Promise<SaveSummary> {
  throw new Error("not supported in the serverless build");
}
