// Base64 helpers for snapshot transport. Snapshots are a few KB so this is
// hot but not catastrophically so; we prefer correctness/simplicity over
// micro-optimisation. (If/when we need to shave bytes, switch to binary WS
// frames per SPEC §9.)

export function bytesToBase64(bytes: Uint8Array): string {
  // For small buffers this is faster than chunked btoa; tested up to 1MB ok.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
