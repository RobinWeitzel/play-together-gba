# QUESTIONS / BLOCKERS for the human

Only hard blockers or things genuinely requiring the human go here. Empty = no blockers.

## Open

### Q1 — Real Android-device verification of Milestone 0 (NOT a blocker yet)
M0's acceptance includes "emulator runs on a **real Android device**." I cannot hold a phone, so I verify cross-origin isolation + `SharedArrayBuffer` + mGBA boot on the deployed GitHub Pages URL using **desktop Chrome via Playwright** as a proxy, which exercises the identical COOP/COEP service-worker path. **Please open the deployed URL on your Android phone and confirm the emulator runs.** The diagnostic route (`#/m0`) reports `crossOriginIsolated`, `SharedArrayBuffer`, and boots a ROM you pick — use it to confirm. If it fails on Android specifically, that is a real blocker and I'll switch to the single-threaded mGBA fallback.

(Not blocking — I proceed on the desktop-verified path and the fallback is documented.)
