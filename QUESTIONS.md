# Open Questions

Human-judgement items deferred during the autonomous build. Each carries enough context for a quick decision later. Build continues around them.

## Things to verify on a real device (Android Chrome especially)

I built and verified everything in headless Playwright on macOS. The following are architecturally correct per SPEC and should "just work", but they truly want a real-device smoke test:

1. **Multi-touch:** holding the D-pad with the left thumb while pressing A/B with the right. Implementation uses `setPointerCapture` per button, so each pointer is owned independently — but Android's actual touch behaviour under odd conditions (e.g. scrolling kicked in for a half-second before we install handlers) deserves a real check.
2. **`screen.orientation.lock('landscape')`:** Android Chrome supports this on phones; some tablets refuse. Wrapped in try/catch so failure is silent — but visually, what happens when refused, on the human's actual hardware?
3. **Audio unlock + AudioContext on tap-to-start:** verified the code path executes without errors, but not that sound is audibly produced in Android Chrome with the controller's role assigned.
4. **Wake lock:** acquired in code; Android Chrome may deny it in battery-saver mode. The hook handles re-acquisition on `visibilitychange` but doesn't surface a UI hint when refused.
5. **`dvh`/`dvw` viewport sizing** with Android Chrome's collapsing address bar — verify the canvas doesn't get clipped/zoomed mid-scroll.
6. **Pull-to-refresh / overscroll:** set `touch-action: none` and `overscroll-behavior: none` on the play shell. Should suffice on Android Chrome 100+, but real verification welcome.

## ROM determinism on a real game

The M0 spike used `test-arm.gba` (jsmolka), which is a synthetic CPU-test ROM. For a real game (Pokémon Emerald, FireRed, etc.) the controller→follower sync model in §12.4 mode (always reload every snapshot) should be fine for turn-based gameplay, but if the human plays Pokémon and notices visible "popping" on the follower's screen every 1.5 s, the snapshot interval can be reduced (`SNAPSHOT_INTERVAL_MS` in `shared/src/index.ts`).

## Cloudflare Tunnel header pass-through

The README documents this prominently. The single most likely deploy footgun is Cloudflare stripping or replacing `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` — e.g., via a Worker, a Page Rule, or some Transform Rule. The app surfaces `crossOriginIsolated === false` in the spike page; running `/spike` against the prod URL is the fastest debug path.

## Out-of-scope thoughts (not asked, just noting)

- **PWA install-to-home-screen:** SPEC §M5 nice-to-have, not implemented. Would need a service worker that explicitly forwards COOP/COEP (a SW that proxies fetches will strip them by default), per SPEC §20.
- **Per-game persistent snapshot slots / lobby polish:** also §M5 nice-to-have; not implemented.
- **Worker isolation of mGBA:** per DECISIONS.md, mGBA runs on the main thread (the core itself uses pthreads internally so heavy work is off-thread anyway). If the main thread feels janky on low-end Android, we'd revisit OffscreenCanvas + worker-driven init. SPEC §5 explicitly allows the main-thread fallback for v1.
