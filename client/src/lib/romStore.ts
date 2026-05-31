// Local ROM storage (SPEC-SERVERLESS §8). Each participant supplies their OWN
// ROM file; it is kept in IndexedDB on THIS device only — never hosted, never
// transmitted. ROMs are keyed by their SHA-256 so the hash-gate (§8) can find
// "do I already have the byte-identical ROM this session needs?".

import { sha256Hex } from "./hash";

const DB_NAME = "gba-roms";
const STORE = "roms";
const DB_VERSION = 1;

export interface StoredRom {
  hash: string; // SHA-256 hex (primary key)
  name: string; // display name (filename or game label)
  size: number;
  addedAt: number;
  bytes: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "hash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

// Hash + store a ROM file. Returns its hash (the session romHash key).
export async function importRom(name: string, bytes: Uint8Array): Promise<string> {
  const hash = await sha256Hex(bytes);
  // Copy into a standalone ArrayBuffer (the view may be a slice of a larger one).
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const rec: StoredRom = { hash, name, size: bytes.length, addedAt: Date.now(), bytes: buf };
  await tx("readwrite", (s) => s.put(rec));
  return hash;
}

export async function getRom(hash: string): Promise<StoredRom | null> {
  const rec = await tx<StoredRom | undefined>("readonly", (s) => s.get(hash));
  return rec ?? null;
}

export async function getRomBytes(hash: string): Promise<Uint8Array | null> {
  const rec = await getRom(hash);
  return rec ? new Uint8Array(rec.bytes) : null;
}

export async function listRoms(): Promise<StoredRom[]> {
  const all = await tx<StoredRom[]>("readonly", (s) => s.getAll() as IDBRequest<StoredRom[]>);
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function hasRom(hash: string): Promise<boolean> {
  return (await getRom(hash)) !== null;
}
