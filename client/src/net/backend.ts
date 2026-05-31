// Single shared backend adapter instance for the app (§16: BACKEND =
// "firebase-rtdb"). Lazily initialised from the runtime firebase-config.json
// (DECISIONS D3). The UI calls getBackend(); a MissingConfigError surfaces the
// setup-needed state instead of crashing.

import { createBackendAdapter } from "./firebaseAdapter";
import { loadFirebaseConfig, MissingConfigError } from "./config";
import type { BackendAdapter } from "./adapter";

export { MissingConfigError };

let adapter: BackendAdapter | null = null;
let initPromise: Promise<BackendAdapter> | null = null;

export function getBackend(): Promise<BackendAdapter> {
  if (!initPromise) {
    initPromise = (async () => {
      const a = createBackendAdapter();
      const cfg = await loadFirebaseConfig();
      await a.init(cfg);
      await a.signInAnonymously();
      adapter = a;
      return a;
    })().catch((e) => {
      // Allow a later retry (e.g. after the user adds the config).
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

// Already-initialised instance, or null. Lets components read currentMemberId()
// synchronously once the app has connected.
export function maybeBackend(): BackendAdapter | null {
  return adapter;
}
