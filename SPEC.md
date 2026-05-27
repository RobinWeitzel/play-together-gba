# Play-Together GBA — Implementation Specification

> Note: the project was originally drafted as "Watch-Together GBA"; the
> name was later changed to "Play-Together GBA". The body of this spec
> still uses the old name in places but it refers to the same project.

> **Save this file as `SPEC.md` in the project root.** It is the single source of truth for the build. It is written to be implemented autonomously.

---

## 0. How to use this document (read first, Claude Code)

You are implementing this **autonomously while the human is away and cannot answer questions.** Therefore:

1. **Read this whole document before writing any code.**
2. **Follow the roadmap in §18 milestone by milestone, in order.** Do not skip ahead.
3. **Milestone 0 is a determinism spike. If it fails, do not abandon the project — switch to the documented fallback (§12.4) and continue.**
4. **Where this spec states a default, use it.** Where it leaves a genuine choice, pick the simplest robust option, record it in `DECISIONS.md`, and keep going.
5. **Do not invent external API signatures.** Before using `@thenick775/mgba-wasm`, read its README and TypeScript definitions in `node_modules` and confirm the real method names. The names used in this spec (e.g. `saveState`, `loadState`, `buttonPress`) are *likely-correct guides*, not guaranteed. Adapt to the real API.
6. **Commit after each milestone** with a clear message. Maintain `PROGRESS.md` (what's done) and `QUESTIONS.md` (anything needing human judgment — but keep building around it, don't block).
7. **Prefer boring, well-supported libraries.** This is a small private app, not a platform.

---

## 1. Project overview

A private, mobile-first, browser-based **Game Boy Advance** emulator for a family to **play turn-based games together** (Pokémon and similar). The model:

- Multiple people join a **session**.
- Exactly **one person at a time is the "controller"** and provides input. Everyone else are **followers** who see the game in sync and can discuss decisions. (Single controller is a deliberate choice to avoid input chaos — this is co-op decision-making, not spectating.)
- The **first person to join** a session is the controller. When the controller leaves, **control passes to the next person in join order.**
- Must work well on **phones and tablets** (touch controls), and run in a normal mobile browser.
- Must use an **existing open-source emulator core** (mGBA via WebAssembly). Do **not** write an emulator.

---

## 2. Core architecture decision (and the hard reason behind it)

**Every client runs its own copy of mGBA locally and renders the game itself. They are kept in sync by relaying the controller's inputs and periodic save-state snapshots over a WebSocket. The server is a referee + save-state cabinet; it does NOT run an emulator, and NO audio/video is ever streamed.**

This is mandatory, not a preference, because **the entire app is served behind a Cloudflare Tunnel.** A Cloudflare Tunnel only proxies HTTP/HTTPS (including WebSockets); it does **not** carry public UDP, and Cloudflare's terms restrict streaming externally-hosted video through it. WebRTC video streaming (both "controller streams its screen" and "server emulates and streams to all") is therefore **off the table.** The input + snapshot model uses only WebSocket traffic, which is exactly what the Tunnel supports.

Rejected alternatives (do not implement these): controller-streams-video via WebRTC; server-side emulation with video streaming; any approach requiring STUN/TURN/coturn or UDP.

---

## 3. System architecture

```
                          ┌──────────────────────────────────────────┐
                          │  Cloudflare Tunnel  (HTTP/HTTPS + WS only) │
                          │  handles auth + TLS; no UDP, no video      │
                          └───────────────────┬────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                  YOUR HOST (home server / VPS)     │
                    │                                                    │
                    │  ┌──────────────┐      ┌───────────────────────┐   │
                    │  │ Static web    │      │ Node.js server        │   │
                    │  │ assets (SPA)  │      │  - WebSocket hub      │   │
                    │  │ + COOP/COEP   │      │  - session state      │   │
                    │  │   headers     │      │  - controller queue   │   │
                    │  │ + ROM endpoint│      │  - latest snapshot     │   │
                    │  └──────────────┘      │    per session (RAM)  │   │
                    │                         └───────────────────────┘   │
                    └────────────────────────────────────────────────────┘
                                              │  WebSocket (inputs, snapshots, roster)
              ┌───────────────────────────────┼───────────────────────────────┐
              │                                │                               │
      ┌───────┴────────┐              ┌────────┴───────┐              ┌─────────┴──────┐
      │ CONTROLLER     │              │ FOLLOWER       │              │ FOLLOWER       │
      │ runs mGBA WASM │              │ runs mGBA WASM │              │ runs mGBA WASM │
      │ sends inputs + │  inputs +    │ applies inputs │              │ applies inputs │
      │ snapshots      │  snapshots   │ + reconciles   │              │ + reconciles   │
      │ touch controls │  ───────────▶│ to snapshots   │              │ to snapshots   │
      └────────────────┘              └────────────────┘              └────────────────┘
```

Key properties:
- The controller's input feels instant (local emulator).
- Followers stay in sync via the input stream (smooth motion) **and** periodic snapshots (drift correction + crash recovery).
- The server always holds the latest snapshot, so a sudden controller disconnect loses at most one snapshot interval (~1–2s) of progress.

---

## 4. Hard constraints

| # | Constraint | Why |
|---|---|---|
| C1 | **Only HTTP/HTTPS + WebSocket traffic.** No WebRTC, UDP, STUN/TURN, or media streaming. | Cloudflare Tunnel limitation (§2). |
| C2 | **No server-side emulation.** Server stores/relays only. | Keeps server cheap and Tunnel-compatible. |
| C3 | **Cross-origin isolation required** (`COOP: same-origin`, `COEP: require-corp`, plus `CORP: same-origin`/CORS on assets) so mGBA's threaded WASM `SharedArrayBuffer` works. Must hold in **both dev and prod.** | mGBA WASM uses threads. |
| C4 | **All clients must run the identical mGBA WASM build and identical ROM bytes.** Pin the package version; hash-check ROMs. | Sync correctness. |
| C5 | **Mobile-first.** Must be fully usable one-handed-ish on a phone in landscape and on a tablet. | Primary use case. |
| C6 | **Private use only.** Behind auth (handled by Cloudflare); add `X-Robots-Tag: noindex`; no public signup. ROMs are user-supplied and never publicly distributed. | Legal posture. |
| C7 | **Followers' audio defaults to muted** with tap-to-unmute; only the controller plays audio by default. | Avoids an out-of-phase chorus across devices. |

---

## 5. Tech stack

- **Language:** TypeScript everywhere.
- **Frontend:** React 18 + Vite. SPA. State via React hooks/context (no heavy state lib needed).
- **Emulator core:** `@thenick775/mgba-wasm` (mGBA compiled to threaded WASM; MPL-2.0). Pin an exact version. *(If threaded/cross-origin-isolated operation proves impossible in the target environment, check whether the package offers a single-threaded build and document the tradeoff — but try threaded first.)*
- **Emulator runs in a Web Worker** so the main thread stays responsive for touch input and UI. Communicate via `postMessage` with a typed message protocol. *(If the package's API makes worker isolation impractical, running on the main thread is an acceptable documented fallback for v1.)*
- **Backend:** Node.js (LTS) + TypeScript. WebSocket via the `ws` library (preferred for its simplicity) or `socket.io` (acceptable if its auto-reconnect/rooms save meaningful effort — record the choice in `DECISIONS.md`). Static file serving + ROM endpoint via a minimal framework (`express` or `fastify`).
- **Compression for snapshots:** use the browser's built-in `CompressionStream`/`DecompressionStream` (gzip) where available; otherwise `pako`. Snapshots are very compressible.
- **Touch UI:** custom React components for the gamepad (see §13). `nipplejs` only if an analog stick is ever needed (GBA is digital, so likely not).
- **Build/deploy target:** runs on the human's own host behind `cloudflared`. Provide a production build and a documented run command. Docker Compose is a nice-to-have, not required for v1.

Do not add: any video/WebRTC library, any TURN server, any database for v1 (in-memory session state is fine; see §10.4).

## §5 addendum — Emulator core: dependency hardening

The core is mGBA (the canonical, cycle-accurate GBA emulator), accessed via
thenick775's WASM fork — chosen because it provides the exact JS bindings our
sync model needs (frame counter, programmatic button press/release,
saveState/loadState byte arrays). EmulatorJS, despite more stars, is built to
consume input directly rather than be driven frame-by-frame, so it is a poorer
fit and is only a FALLBACK.

DEPENDENCY HARDENING (required): Do NOT rely on the live npm package at runtime.
mGBA is MPL-2.0, which permits redistribution, so VENDOR the core into the repo:
  1. Pin the exact version of @thenick775/mgba-wasm.
  2. Copy its compiled artifacts (mgba.js, mgba.wasm, mgba.d.ts) into
     /client/public/emulator/ (or /vendor/mgba/) and commit them, including the
     MPL-2.0 LICENSE and a NOTICE recording the source repo, commit/version, and
     date. Load the core from these vendored files, not from node_modules at
     runtime.
  3. Document in README.md how to regenerate the artifacts (npm version bump, or
     building from the fork's feature/wasm branch via its Docker image) so the
     build is reproducible without the maintainer.
This removes the single-maintainer bus-factor risk: the app builds forever from
files we own.

FALLBACK CORE: If the mGBA bindings prove inadequate for frame-tagged input
injection or save-state round-tripping (validate in Milestone 0), the documented
fallback is EmulatorJS (GPL-3.0; note the more viral license, fine for private
self-hosting). Record any switch and the reason in DECISIONS.md. Do not switch
pre-emptively — mGBA is the primary.

---

## 6. Repository structure

```
/
├── SPEC.md                  ← this file
├── README.md                ← how to run/deploy (you write this)
├── PROGRESS.md              ← you maintain
├── DECISIONS.md             ← you maintain
├── QUESTIONS.md             ← you maintain
├── package.json             ← workspaces (client + server) or two folders
├── /client
│   ├── index.html
│   ├── vite.config.ts       ← MUST set COOP/COEP dev headers
│   ├── /src
│   │   ├── main.tsx
│   │   ├── /emulator        ← mGBA worker wrapper, input map, save-state helpers
│   │   ├── /net             ← WebSocket client, message types, reconnection
│   │   ├── /sync            ← input scheduling, snapshot reconcile, frame clock
│   │   ├── /ui              ← Session screen, gamepad overlay, roster, controls
│   │   └── /lib             ← hashing, compression, wake-lock, fullscreen
│   └── /public              ← mGBA wasm assets if self-hosted
├── /server
│   ├── /src
│   │   ├── index.ts         ← http + ws bootstrap, header middleware
│   │   ├── sessions.ts      ← session store, controller queue
│   │   ├── protocol.ts      ← shared message types (import in client too)
│   │   └── roms.ts          ← ROM listing + authed serving + hashing
│   └── /roms                ← (gitignored) drop ROM files here; document this
└── /shared                  ← protocol types shared by client & server
```

Share the protocol/message TypeScript types between client and server (a `/shared` folder or a tiny workspace package). Do not duplicate them.

---

## 7. Emulator integration (mGBA WASM)

**Step 1 — verify the real API.** Install `@thenick775/mgba-wasm`, then read its README and `.d.ts` files. Confirm the actual methods for: initializing the module, mounting/writing a ROM into the virtual FS, starting/stepping the run loop, reading the current **frame counter**, pressing/releasing buttons, and serializing/deserializing **save states**. Record the confirmed API surface in `DECISIONS.md`.

## §7 addendum — Verify bindings against the VENDORED core

When confirming the real API (frame counter, button press/release, saveState/
loadState, FS/ROM loading, canvas, audio access), read the .d.ts of the VENDORED
core, and load the emulator from the vendored path in all code. Milestone 0 must
pass using the vendored artifacts, not a runtime npm import.

**Things the integration must provide (map these onto whatever the real API is):**

- `init()` → load WASM, set up the canvas, initialize the virtual filesystem.
- `loadRom(bytes: Uint8Array)` → write ROM into FS and boot it.
- `start()` / `pause()` → control the run loop.
- `getFrame(): number` → current emulated frame index (monotonic). **Required for input tagging.** If the package doesn't expose a frame counter, derive one by counting frames in the run loop.
- `pressButton(button: GbaButton)` / `releaseButton(button: GbaButton)`.
- `saveState(): Uint8Array` and `loadState(bytes: Uint8Array)`. **Required for snapshots and handoff.**
- The `<canvas>` element it renders into (for the visible display).
- Access to its audio so it can be muted/unmuted per client (followers muted by default — C7).

**GBA button set:** `Up, Down, Left, Right, A, B, L, R, Start, Select`. Define a `GbaButton` enum/type in `/shared`.

**ROM into FS:** `fetch` the ROM from the server endpoint (authed) into an `ArrayBuffer`, hash it (§15), then write to the emulator FS. Persist battery/SRAM saves to IndexedDB so a single player's progress survives reloads, independent of the session snapshot mechanism.

---

## 8. The sync model

There are two channels of truth flowing from the controller, both over the WebSocket via the server:

### 8.1 Inputs (high frequency, tiny)
On every button press/release, the controller sends `{ type: "input", frame, button, pressed }` where `frame` is the emulator frame at which it occurred. The server relays this to all followers. Followers **schedule** that input to apply at the same `frame` (see §8.3), so motion is smooth and identical.

### 8.2 Snapshots (low frequency, small)
Every **1500 ms (default; make it configurable)** the controller calls `saveState()`, compresses it, and sends `{ type: "snapshot", frame, data }`. The server (a) **stores it** as the session's latest snapshot, and (b) **relays it to all followers.** Followers reconcile to it (§12). Snapshots serve three jobs: drift correction, crash recovery, and bootstrapping new joiners / new controllers.

> **Bandwidth note:** snapshots are a few hundred KB raw, far less compressed. For a handful of followers every 1.5s this is modest WebSocket traffic — not video. Keep it lean; if you later prove determinism is solid, you may reduce follower snapshot frequency and rely more on inputs (the server must still keep a recent stored snapshot for handoff/join). This optimization is optional and post-v1.

### 8.3 Frame clock & follower delay
Followers run on a small fixed **delay buffer (default 120 ms)** behind the controller to absorb network jitter, so a relayed input arrives before its target frame. Implement a frame scheduler on followers: incoming inputs go into a queue keyed by `frame`; the follower applies them as its local emulation reaches that frame. If an input arrives late (target frame already passed), apply it immediately and let the next snapshot reconcile any resulting drift.

---

## 9. WebSocket protocol

All messages are JSON objects with a `type` field. Binary snapshot payloads may be sent as base64 inside JSON for simplicity, or as binary WS frames if cleanly separable — your choice, record it. Define all of these as discriminated-union TypeScript types in `/shared/protocol.ts`.

| Direction | `type` | Fields | Meaning |
|---|---|---|---|
| C→S | `join` | `sessionId, name` | Join (or create) a session. |
| S→C | `welcome` | `selfId, role, controllerId, roster, latestSnapshot?` | Bootstrap. `role` ∈ `controller`/`follower`. Snapshot present if the session already has one. |
| S→C | `roster` | `participants[], controllerId` | Sent on any membership/role change. |
| C→S | `input` | `frame, button, pressed` | **Server MUST ignore unless sender is the current controller.** |
| S→C | `input` | `frame, button, pressed` | Relayed to followers only. |
| C→S | `snapshot` | `frame, data` | Controller only. Server stores + relays. |
| S→C | `snapshot` | `frame, data` | Relayed to followers for reconciliation. |
| S→C | `becomeController` | `frame, data` | "You are now the controller; resume from this snapshot." |
| S→C | `controllerChanged` | `controllerId` | Notify everyone of new controller. |
| C→S | `heartbeat` | `—` | Liveness ping (~every 3s). |
| S→C | `heartbeatAck` | `—` | Optional. |
| C→S | `leave` | `—` | Clean departure. |
| S→C | `error` | `code, message` | Recoverable errors (e.g., ROM mismatch). |

Validation rules the server MUST enforce:
- Only the controller's `input`/`snapshot` messages are accepted; others are dropped silently (or `error`).
- A client cannot promote itself; role changes originate only from the server.

---

## 10. Server design

### 10.1 Session model
```
Session {
  id: string
  romId: string
  romHash: string                 // expected hash all clients must match
  participants: Map<connId, { name, joinedAt, lastHeartbeat, role }>
  controllerQueue: connId[]        // FIFO by join order; head = controller
  latestSnapshot?: { frame, data, receivedAt }
}
```
`controllerId = controllerQueue[0] ?? null`. Sessions are created on first `join` and destroyed when empty.

### 10.2 Join flow
1. On `join`, create the session if absent. Add participant; push connId to `controllerQueue`.
2. Assign role: `controller` if they're now head of the queue, else `follower`.
3. Reply `welcome` including `latestSnapshot` if one exists (so a late joiner / new follower starts correctly; followers loadState it on arrival).
4. Broadcast updated `roster`.

### 10.3 Disconnect & promotion
Detect departure via: WebSocket close event, **and** a heartbeat sweep (every ~2s) marking anyone whose `lastHeartbeat` is older than **10s** as gone. On departure:
1. Remove participant; remove from `controllerQueue`.
2. If the departed was the controller and the queue is non-empty: send the new head `becomeController` with `latestSnapshot`, then broadcast `controllerChanged` + `roster`.
3. If the session is now empty, delete it (keep `latestSnapshot` only if you want resume-after-everyone-left; for v1, dropping it is fine — document the choice).

### 10.4 State storage
In-memory is sufficient and preferred for v1 (a couple of concurrent sessions, family scale). Losing all sessions on a server restart is acceptable. Do **not** add a database unless a later milestone explicitly needs persistence; if you do, SQLite only.

---

## 11. Control handoff (the central feature — get this right)

Sequence when the controller leaves:
1. Server selects the next controller (head of queue after removal).
2. Server sends that client `becomeController { frame, data }` using the **latest stored snapshot.**
3. New controller: `pause()` → `loadState(data)` (this pins it exactly to authoritative state, erasing any follower drift) → `start()` running freely. Its touch controls activate; its input now feels instant. It begins emitting frame-tagged `input` and periodic `snapshot` messages.
4. New controller immediately emits one fresh `snapshot`; server relays to all followers, who `loadState` it — re-aligning everyone's frame clock to the new controller's clock. (Frame numbering may reset/jump on handoff; followers must treat a snapshot as the new authoritative origin, not assume monotonic continuity across a handoff.)
5. Followers switch their on-screen controls to disabled/hidden; UI shows who's now in control.

Edge cases:
- **Controller crashes with no recent snapshot:** fall back to the most recent stored snapshot regardless of age; if none exists at all (controller left before first snapshot), the new controller boots the ROM fresh from SRAM. Document this.
- **Two people join near-simultaneously:** the server's single-threaded event loop makes `controllerQueue.push` atomic — first message processed wins. No client-side claiming.
- **Controller leaves and rejoins:** they re-enter at the back of the queue (they're a follower again). This is correct and intended.

---

## 12. Determinism & reconciliation

### 12.1 The assumption
mGBA is deterministic given identical build + ROM + input timing. The input stream should keep followers visually in sync between snapshots.

### 12.2 Safeguards (implement all)
- Pin one `@thenick775/mgba-wasm` version (C4).
- Hash-check ROM bytes on every client against the session's `romHash`; on mismatch, send `error` and block joining (§15).
- Apply each relayed input at its tagged `frame` via the scheduler (§8.3).
- Run followers on the 120ms delay buffer.

### 12.3 Reconciliation (the robustness backstop — this is what makes determinism non-critical)
On every received `snapshot`, a follower reconciles. Default behavior: **compute a cheap hash of the follower's current save-state and compare to the incoming snapshot; if they differ, `loadState` the incoming snapshot;** if they match, do nothing (avoids a visible "pop"). Because this happens every ~1.5s, any drift is corrected within one interval. This means **frame-perfect determinism is NOT required for correctness** — it only affects how smooth the 1.5s between snapshots looks, which for turn-based games is forgiving.

### 12.4 Fallback if Milestone 0 determinism is poor
If two instances diverge badly even between snapshots (visible rubber-banding on normal play): reduce the snapshot interval (e.g. 500ms), and/or have followers always `loadState` every snapshot rather than only on hash mismatch. As a last resort, followers can render purely from snapshots at a higher cadence (a "choppy but correct" mode) — still WebSocket-only, still Tunnel-safe. Document whichever mode ships.

---

## 13. Frontend / UI

### 13.1 Screens
- **Home / Join:** enter a name, create or pick a session (session id in the URL, e.g. `/s/<uuid>`), pick a ROM from the server's list. Sharing the URL is how family joins.
- **Play screen:** the emulator canvas (scaled, pixelated rendering — `image-rendering: pixelated`), the gamepad overlay (controller only), a compact roster showing who's in control, and a mute/unmute toggle.

### 13.2 Gamepad overlay (controller only)
- **Left thumb:** 8-direction D-pad (support diagonals).
- **Right thumb:** A and B (A larger, lower-right per GBA convention).
- **Top corners:** L and R shoulder buttons.
- **Bottom center:** Start and Select (small pills).
- Use **Pointer Events** (`pointerdown`/`pointerup`/`pointercancel`) with `setPointerCapture` for reliable multitouch (D-pad + face button simultaneously).
- Attach listeners with `{ passive: false }` and `preventDefault()` to kill the 300ms tap delay, double-tap zoom, text selection, and scroll.
- **Do not route input through React's synthetic event system** — attach native listeners directly to the button DOM nodes to avoid batching jitter. Each press calls the local emulator press AND sends an `input` message (when controller).
- Optional: `navigator.vibrate(8)` haptic on press.
- Followers: hide or disable the gamepad; show a "watching — <name> is in control" indicator.

### 13.3 Layout & display
- `@media (orientation: landscape)`: controls flank the canvas. Portrait: canvas on top, controls below.
- Provide a fullscreen toggle (see §14 for iOS caveat).
- Render the GBA's 240×160 crisply scaled up; never blur.

---

## 14. Mobile & tablet specifics (Android-first)

> **Priority:** All users are on Android (phones and tablets). **Android Chrome is the primary, must-work target.** iOS Safari support is a nice-to-have, not a release blocker — implement the iOS-safe choices where they're free, but never spend a milestone or sacrifice Android quality for iOS.

- **Wake lock:** use the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) so the screen doesn't sleep mid-game; re-acquire on `visibilitychange` when returning to visible. Wrap in try/catch (can be denied on low battery). Fully supported on Android Chrome.
- **Fullscreen:** use the real Fullscreen API — `element.requestFullscreen()` works properly on Android Chrome. Trigger it from a user gesture (the "Join / Tap to start" tap). This is the primary path; the CSS "fake fullscreen" fallback is only a secondary safety net for browsers that reject it.
- **Orientation:** after entering fullscreen, lock to landscape with `screen.orientation.lock('landscape')` — this works on Android Chrome and gives the best play experience. Wrap in try/catch and fall back gracefully (some tablets/browsers refuse); show a "rotate to landscape" hint if the lock fails and the device is in portrait.
- **Audio:** Android Chrome also gates audio behind a user gesture, so still unlock the controller's `AudioContext` on the initial "Tap to start" tap. Followers stay muted by default (C7) with a tap-to-unmute control.
- **Touch input:** Pointer Events with `setPointerCapture` and `{ passive: false }` + `preventDefault()` (as in §13.2) are well-behaved on Android Chrome. Test specifically that **multitouch works** — D-pad held while pressing A/B simultaneously — on a real Android device, and that the browser's pull-to-refresh and overscroll don't fire on the play screen (set `overscroll-behavior: none` and `touch-action: none` on the game/controls container).
- **Viewport:** use `dvh`/`dvw` dynamic viewport units to handle Android Chrome's collapsing address bar. Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">` and a `manifest`/theme-color so it feels app-like.
- **Cleanup events:** Android Chrome fires both `pagehide` and `visibilitychange` reliably; use `pagehide` (and `visibilitychange` → hidden) to send `leave`/release the wake lock. (`beforeunload` is unreliable on mobile generally — don't depend on it.)
- **Install-to-home-screen (optional, M5):** Android Chrome has strong PWA support, so an installable PWA is a realistic nice-to-have here — but if you add a service worker, it must forward the COOP/COEP headers or it will break cross-origin isolation (§16).
- **iOS Safari (best-effort only):** where an iOS-safe choice costs nothing — using `dvh` units, gating audio behind a gesture, using `pagehide` — keep it. Where iOS needs _extra_ work (its lack of real fullscreen, no `orientation.lock`, WebRTC/PWA quirks), implement the graceful fallback but **do not let it block or complicate the Android path.** Log any iOS-specific gaps in `QUESTIONS.md` rather than solving them now.

---

## 15. ROM serving & auth

- ROMs live in `/server/roms` (gitignore the contents). Provide a `GET /api/roms` listing (id, display name, `hash`) and `GET /api/roms/:id` returning bytes as `application/octet-stream`.
- **Auth is handled upstream by the Cloudflare Tunnel / Cloudflare Access**, so the app itself can assume requests are already authenticated. Still: do not make the app publicly indexable (`X-Robots-Tag: noindex`), and don't implement public signup.
- **ROM hashing for sync integrity:** the server computes a hash (e.g. SHA-256) of each ROM at startup and includes it in the session (`romHash`) and the roms listing. Each client hashes the bytes it loaded and compares; mismatch → block + `error`. This guarantees C4.
- Do **not** ship or host any Nintendo BIOS file. mGBA includes an HLE BIOS — use it.
- For autonomous testing, you cannot supply a commercial ROM. Use a **public-domain / homebrew GBA ROM** (e.g. a known free homebrew demo) committed under `/server/roms` for tests, and document in README where the human drops their own legally-obtained ROMs.

---

## 16. Cross-origin isolation / headers (C3)

Every response that matters must enable cross-origin isolation:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
X-Robots-Tag: noindex
```
- **Dev:** set these in `vite.config.ts` (`server.headers`).
- **Prod:** set them in the Node server's static middleware and on the ROM endpoint.
- Verify `crossOriginIsolated === true` and `SharedArrayBuffer` is defined in the browser before initializing the threaded core. If it's false, surface a clear error and check header delivery through the Tunnel (the Tunnel must not strip them). Note any Cloudflare-side header handling needed in README.

---

## 17. Configuration

Centralize tunables (env vars or a config module), with these defaults:
- `SNAPSHOT_INTERVAL_MS = 1500`
- `FOLLOWER_DELAY_MS = 120`
- `HEARTBEAT_INTERVAL_MS = 3000`
- `HEARTBEAT_TIMEOUT_MS = 10000`
- `PORT = 8080` (or as needed behind the Tunnel)
- `RECONCILE_MODE = "hash"` (`hash` | `always`) — see §12.

---

## 18. Implementation roadmap (do these in order; check acceptance before moving on)

### Milestone 0 — Determinism spike (DO FIRST)
Stand up the bare minimum to run two mGBA WASM instances of the same ROM in two tabs. Feed both the *same* scripted sequence of frame-tagged inputs and confirm their save-state hashes match after N frames. Then confirm `saveState`/`loadState` round-trips and that loading one instance's state into the other makes their hashes match.
**Acceptance:** identical-input instances stay hash-identical for a sustained run (or are corrected to identical by a `loadState`). If they drift uncorrectably even with `loadState`, that's a real problem — record it and proceed under the §12.4 fallback assumptions. **Write findings to `PROGRESS.md`.**

### Milestone 1 — Single-player local emulator (mobile)
React/Vite app; mGBA in a worker; load a ROM from the server endpoint; touch gamepad; crisp scaled canvas; wake lock; landscape layout; IndexedDB SRAM persistence; COOP/COEP in dev.
**Acceptance:** you can play the test ROM start-to-finish on a mobile viewport with working touch controls and sound, and reload without losing battery-save progress.

### Milestone 2 — Sessions & roster (no sync yet)
Node WebSocket server; `join`/`welcome`/`roster`/`leave`/`heartbeat`; session creation by URL; first-joiner-is-controller role assignment; controller queue; disconnect + heartbeat-timeout detection; roster UI.
**Acceptance:** two tabs join the same session URL; the first shows role "controller", the second "follower"; closing the controller flips the follower to controller via `controllerChanged`; roster updates correctly on join/leave.

### Milestone 3 — Input + snapshot sync
Controller emits frame-tagged `input` and periodic `snapshot`; server relays + stores; followers schedule inputs (with delay buffer) and reconcile on snapshots (§12.3); followers muted by default with unmute.
**Acceptance:** with two tabs in one session, the follower mirrors the controller's gameplay in sync; deliberately closing the controller tab promotes the follower, which resumes from the latest snapshot within ~1 snapshot interval and continues playing with working controls.

### Milestone 4 — Robustness & mobile polish
Reconnect handling (WS drop/restore); iOS gesture/fullscreen/`pagehide`/`dvh` handling; ROM hash mismatch guard; clear in-control indicator; tap-to-start and tap-to-unmute overlays; production build serving COOP/COEP; README with run + Cloudflare-Tunnel deploy notes.
**Acceptance:** the production build runs behind a local `cloudflared` (or documented equivalent) with cross-origin isolation intact; a follower joining mid-game bootstraps correctly from `welcome.latestSnapshot`; handoff is smooth on real phones (test iOS Safari + Android Chrome).

### Milestone 5 — Optional (only if time remains)
Per-game persistent snapshot slots; "rotate to landscape" hint polish; PWA manifest + service worker (ensure the SW does not strip COOP/COEP); session list / nicer lobby. Do not start these until M0–M4 are solid.

---

## 19. Testing checklist
- Two-tab same-session sync (M0/M3).
- Controller-leaves handoff resumes correctly (M3).
- Mid-game join bootstraps from stored snapshot (M4).
- ROM hash mismatch is blocked with a clear error (M4).
- Cross-origin isolation true in dev and in prod build (M1/M4).
- Touch multitouch: D-pad + A simultaneously registers (M1).
- iOS Safari: audio unlocks on tap; no zoom/scroll on control taps; layout uses dynamic viewport (M4).
- Heartbeat-timeout promotes a silently-dead controller (M2).
- WebSocket reconnect rejoins cleanly (M4).

## 20. Known pitfalls
- `canvas.captureStream` is NOT used here (no video) — ignore any mGBA streaming examples.
- A WebGL canvas may need `preserveDrawingBuffer: true` only if you ever read pixels; not required for plain display.
- Service workers can break cross-origin isolation if they rewrite headers — if you add a PWA SW, forward COOP/COEP correctly.
- Frame numbering can reset across a handoff; treat each snapshot as a fresh authoritative origin (§11.4).
- React synthetic events add input latency — use native listeners on controls (§13.2).
- The Tunnel must pass COOP/COEP through unmodified; verify and document.

## 21. Out of scope / non-goals (v1)
- Any video/audio streaming, WebRTC, STUN/TURN, UDP.
- Server-side emulation.
- Multiple simultaneous controllers / true netplay co-op input.
- Public hosting, signup, accounts (Cloudflare handles auth).
- Non-GBA systems.
- A database (unless a milestone explicitly requires it).

## 22. Pre-made decisions (defaults — use these, don't ask)
- Emulator: `@thenick775/mgba-wasm`, pinned, threaded, in a Web Worker (main-thread fallback allowed if necessary).
- Sync: inputs + 1500ms snapshots, both relayed to followers; server stores latest snapshot; followers reconcile by hash.
- Server state: in-memory; no DB; sessions die when empty.
- Controller selection: FIFO by join order; first joiner controls; next-in-queue on departure.
- Auth: assumed handled by Cloudflare upstream; app adds `noindex` and no signup.
- Test ROM: a committed public-domain/homebrew GBA ROM; document where real ROMs go.
- Followers muted by default.
- If a choice isn't covered here: pick the simplest robust option, log it in `DECISIONS.md`, continue.
