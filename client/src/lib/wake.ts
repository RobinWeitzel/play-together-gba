// Screen Wake Lock API helper. Re-acquires on visibilitychange. Failures
// (battery saver mode, unsupported browser) are surfaced via the returned
// status so the UI can decide whether to show a hint, but they never
// throw.

export interface WakeLockHandle {
  release(): void;
  isActive(): boolean;
}

export async function acquireWakeLock(): Promise<WakeLockHandle> {
  let sentinel: any = null;
  let releasedByCaller = false;

  const acquire = async () => {
    try {
      const wl: any = (navigator as any).wakeLock;
      if (!wl) return null;
      sentinel = await wl.request("screen");
      sentinel.addEventListener?.("release", () => {
        sentinel = null;
      });
      return sentinel;
    } catch (e) {
      console.warn("wakeLock request failed:", e);
      return null;
    }
  };

  await acquire();

  const onVisibility = async () => {
    if (releasedByCaller) return;
    if (document.visibilityState === "visible" && !sentinel) {
      await acquire();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    release() {
      releasedByCaller = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try { sentinel?.release?.(); } catch { /* ignore */ }
      sentinel = null;
    },
    isActive() {
      return !!sentinel;
    },
  };
}
