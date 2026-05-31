# PROGRESS — Serverless re-platforming

Branch: `serverless`. The pre-existing server-based app is preserved on `server-version` (pushed to origin).

Tracking: this file (status), `DECISIONS.md` (choices + rationale), `QUESTIONS.md` (blockers for the human).

## Status legend
- ⬜ not started · 🟦 in progress · ✅ done · ⚠️ done-with-caveat (see notes) · 🛑 blocked (see QUESTIONS.md)

## Milestones (§14)

### M0 — Cross-origin isolation on a static host (make-or-break) — ⚠️ (desktop-verified; Android pending human)
Get vendored mGBA (threaded build) running under cross-origin isolation from a static host via a service-worker COOP/COEP shim. Verify `crossOriginIsolated === true`, `SharedArrayBuffer` defined, emulator boots a locally-loaded ROM.
- [x] Static Vite build with correct base path for project-page subpath (`VITE_BASE`, hash routing, `BASE_URL` for runtime URLs)
- [x] coi-serviceworker COOP/COEP shim vendored + wired in index.html (require-corp, auto-degrade)
- [x] GitHub Pages deploy via Actions workflow (`.github/workflows/pages.yml`); Pages enabled via API (build_type=workflow)
- [x] **Verified COI + SAB + threaded mGBA boots a locally-uploaded ROM** on a GitHub-Pages-equivalent host (no COOP/COEP headers, `/play-together-gba/` subpath) via Playwright/Chromium — isolation came solely from the SW shim. `#/m0` diagnostic route.
- [ ] **Real Android device verification — REQUIRES THE HUMAN** (QUESTIONS.md Q1; shim path is identical to the desktop-verified one)
- [ ] Confirm the *live* deployed URL (custom domain `robinweitzel.de`) serves over HTTPS so the SW registers (verify post-deploy)

### M1 — Backend adapter + Firebase RTDB transport — ⬜
### M2 — Capability model + security rules — ⬜
### M3 — Wire sync/speed/handoff onto RTDB — ⬜
### M4 — Local ROM loading + hash gate — ⬜
### M5 — Persistence, guardrails, PWA, deploy, README — ⬜
### M6 — Optional hardening (App Check, 2nd adapter) — ⬜ (not started until M0–M5 solid)

## Notes / log
- (init) Read SPEC-SERVERLESS.md fully. Surveyed existing app: Vite + React client, Node WS server, shared protocol types. Sync heart = `client/src/ui/SessionPage.tsx`; transport = `client/src/net/ws.ts`; protocol = `shared/src/index.ts`. mGBA is a **threaded** build (pthreads/SharedArrayBuffer) → COI genuinely required.
- (init) Dispatched background research agent to verify Firebase Spark limits, modular SDK API, RTDB rules syntax, coi-serviceworker status, and GitHub Pages Actions deploy (per spec §0.4 "verify external facts at build time").
