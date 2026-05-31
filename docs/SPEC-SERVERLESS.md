# Watch-Together GBA Emulator — Redesign Spec: Serverless Static PWA on Firebase

> **Save as `SPEC-SERVERLESS.md` in the project root.** This is a **re-platforming** of the existing, working server-based app to a fully static PWA (GitHub Pages) backed by a managed real-time service (Firebase Realtime Database). It reuses the existing sync, speed-control, handoff, reconciliation, touch-control, and vendored-mGBA logic unchanged — only the **transport, session state, identity/access, and ROM handling** change. Where this references "the existing app," it means the implemented `SPEC.md` + `SPEC-SPEED.md` + the persistence/handoff features already built.

---

## 0. How to use this document (Claude Code)

Implement autonomously; the human is away and cannot answer questions.

1. Read this whole document first. This is a migration, not a greenfield build — **preserve the existing emulator/sync/speed/handoff/reconciliation code; do not rewrite it.** Introduce a clean seam (the backend adapter, §3) and move the app onto it.
2. **Milestone 0 (cross-origin isolation on a static host) is make-or-break — do it first.** If it cannot be made to work even with the documented fallback, STOP and write the blocker to `QUESTIONS.md` with what you tried; do not proceed to build features on a foundation that can't run.
3. Follow the roadmap (§14) in order. Use the defaults in §16. For uncovered choices, pick the simplest robust option, record it in `DECISIONS.md`, continue. Never block on the human.
4. **Verify current external facts at build time** — Firebase Spark free-tier limits, current SDK API names, and RTDB security-rules syntax — by reading official Firebase docs and the installed SDK types. The numbers and rule snippets here reflect research as of mid-2026 and may have drifted. Do not invent SDK signatures or rule syntax.
5. The **security rules + atomic invite redemption (§6) are the single trickiest part.** Test them exhaustively with the Firebase Emulator Suite / Rules simulator before relying on them. A bug here = a publicly abusable app.
6. Commit per milestone; maintain `PROGRESS.md`, `DECISIONS.md`, `QUESTIONS.md`.

---

## 1. Goal, and what changes vs. stays

**Goal:** a fully static PWA the human can host on GitHub Pages with **no server they run or pay for**, made publicly available **without login**, where anyone with a **single-use invite** can join a session and any member can become the controller. The backend is a single managed product (Firebase Realtime Database, free "Spark" plan) configured-not-coded, with security enforced by declarative rules. No Cloud Functions (to stay credit-card-free with hard quota caps and zero surprise-bill risk).

**Stays unchanged (above the adapter seam):**
- The whole emulator layer: vendored mGBA WASM, local emulation in every client, the canvas/audio/input wrapper, save-state serialize/deserialize.
- The sync model: frame-tagged inputs + periodic snapshots + follower delay buffer + hash-based reconciliation.
- Synchronized speed control (frame-tagged speed events).
- Control handoff semantics (controller = write-lock; next-in-queue on departure; resume from latest snapshot).
- Touch controls, Android-first priority, wake lock, fullscreen, audio muting for followers.

**Changes (the re-platforming):**
- **Transport & session state:** WebSocket-to-our-server → Firebase RTDB listeners/writes. Roster, controller lock/queue, latest snapshot, and durable saves live in RTDB, not in a server's memory.
- **Identity & access:** no accounts; Firebase **Anonymous Auth** gives each device a durable UID (the "member credential"); a three-tier **capability model** (owner / single-use invite / member) enforced in rules.
- **ROMs:** the server no longer serves ROMs. **Each participant supplies their own local ROM file**, hash-gated to ensure everyone runs byte-identical content (the "same game version" model). ROMs are never hosted on GitHub Pages and never transmitted between peers (legal posture).
- **Hosting:** static build on GitHub Pages; PWA install; cross-origin isolation via a service-worker header shim (§9).
- **Removed:** the self-hosted WebSocket server, server-side ROM serving, STUN/TURN/WebRTC/P2P (all previously considered and dropped). Self-host and P2P adapters are explicitly **out of scope** for this build (§18).

---

## 2. Target architecture

```
        +-------------------------------------------------+
        |  GitHub Pages (static): PWA shell, app JS/WASM,  |
        |  vendored mGBA, coi-serviceworker (COOP/COEP)    |
        |  --- NO ROMs hosted here ---                     |
        +-------------------------------------------------+
                 |  (app loads in each participant's browser)
   +-------------+----------------+----------------+--------------------+
   | OWNER/CONTROLLER browser     | MEMBER browser  | MEMBER browser     |
   | runs mGBA locally            | runs mGBA       | runs mGBA          |
   | loads own local ROM file     | own local ROM   | own local ROM      |
   +------------------------------+-----------------+--------------------+
                 |  Firebase JS SDK (bundled, same-origin)  |
                 v                                          v
        +-------------------------------------------------------------+
        |  Firebase Realtime Database (Spark, no Cloud Functions)     |
        |   - relays inputs / speed / snapshot (write + onValue)      |
        |   - stores roster, controllerLock+queue, latest snapshot    |
        |   - stores durable long-term saves                          |
        |   - Anonymous Auth (durable per-device member UID)          |
        |   - Security Rules enforce owner/invite/member/controller   |
        |   - presence/departure via onDisconnect()                   |
        +-------------------------------------------------------------+
```

Everyone talks only to Firebase's edge — no peer-to-peer, so no NAT/TURN concerns; works on cellular. The controller's writes fan out to members via RTDB listeners.

---

## 3. Backend adapter interface (the seam — build this, implement one)

Define a transport-agnostic interface so the app is not hard-welded to Firebase and the existing sync code calls the adapter rather than a WebSocket. Implement exactly **one** adapter now (Firebase RTDB, §4–6). Design the interface so Supabase/Ably (the research backups) could be added later without touching app logic.

```ts
interface BackendAdapter {
  // identity / lifecycle
  init(config): Promise<void>;
  signInAnonymously(): Promise<MemberId>;          // durable per-device id
  getStoredMemberId(): MemberId | null;            // from local storage

  // sessions
  createSession(opts: { romHash, romName }): Promise<{ sessionId, ownerToken? }>;
  joinViaInvite(invite: InviteRef): Promise<{ sessionId, memberId }>;  // atomic redeem
  reconnect(sessionId): Promise<void>;             // uses stored member credential
  leaveSession(sessionId): Promise<void>;

  // capability (owner-only)
  mintInvite(sessionId): Promise<InviteRef>;       // single-use; owner only
  revokeMember(sessionId, memberId): Promise<void>;// owner only (stateful backends)

  // roster / presence
  onRoster(cb): Unsub;
  setPresence(): void;                             // heartbeat / onDisconnect

  // control
  claimControl(sessionId): Promise<boolean>;       // transaction; only if allowed
  onControlChanged(cb): Unsub;

  // sync relay (carries the EXISTING message payloads unchanged)
  sendInput(msg): void;
  sendSpeed(msg): void;
  publishSnapshot(snapshot): Promise<void>;        // stores latest + notifies
  onInput(cb): Unsub;
  onSpeed(cb): Unsub;
  onSnapshot(cb): Unsub;

  // persistence (durable long-term saves)
  saveDurable(slot, data): Promise<void>;
  loadDurable(slot): Promise<SaveData | null>;
  listSaves(): Promise<SaveMeta[]>;
}
```
The existing sync/speed/handoff modules should depend only on this interface. Keep the message *shapes* identical to the current app so the sync logic is untouched.

---

## 4. Firebase project setup (Spark, no Cloud Functions)

The human will do the one-time console steps; you write a **setup wizard doc** in README and code that reads a Firebase web config object (apiKey, authDomain, databaseURL, projectId, appId). Requirements:
- **Realtime Database** (not Firestore — Firestore's per-day write quota cannot sustain a relay; RTDB carries the 200–500 KB snapshot as a single write, no chunking).
- **Anonymous Authentication** enabled. Enable anonymous-account auto-cleanup (so stale anon UIDs don't accrue) if available.
- **Spark plan only — do NOT deploy any Cloud Function, and do NOT use Cloud Storage for Firebase** (both force the Blaze plan, which requires a credit card and removes the hard quota cap). All snapshot/save data lives in RTDB itself. This constraint is what guarantees no surprise bills.
- **Bundle the Firebase JS SDK locally** (via npm + the existing bundler), do NOT load it from a CDN — under COEP `require-corp` (§9), cross-origin CDN scripts/resources are blocked unless CORS/CORP-correct, so same-origin bundling is the reliable path.
- The Firebase web config is **not a secret** and may live in the public static bundle; security comes from the rules (§6), not from hiding the config.

---

## 5. RTDB data model

```
/sessions/{sessionId}/
  meta/
    owners/{uid}: true               // the owner uid(s) permitted to mint invites (normally one)
    romHash: string                  // SHA-256 the ROM must match
    romName: string                  // display label, e.g. "Pokemon Emerald (US)"
    createdAt: <ts>
    speedMultiplier: number          // current synced speed
  controllerLock/
    holder: <memberUid> | null
    queue/{index}: <memberUid>        // join order for handoff
    updatedAt: <ts>
  members/{memberUid}/
    name: string
    viaInvite: <inviteId>             // the invite this member redeemed (rules use this)
    joinedAt: <ts>
    lastSeen: <ts>                    // presence; cleared via onDisconnect()
  invites/{inviteId}/
    createdBy: <ownerUid>
    createdAt: <ts>
    redeemedBy: <memberUid>           // WRITE-ONCE; absent until redeemed
    redeemedAt: <ts>
  sync/
    inputs/{pushId}: { frame, button, pressed, by }   // ephemeral; pruned aggressively
    speed/{pushId}:  { frame, multiplier, by }        // ephemeral; pruned
    snapshot/                          // LATEST ONLY (overwritten each time)
      frame, data (base64+compressed save-state), multiplier, by, at
  saves/
    latest/  { data, frame, at, by }   // durable long-term save
    slots/{slotId}/ { data, frame, at, name }   // manual save slots (existing feature)
```

Notes: keep only the **latest** snapshot under `sync/snapshot` (overwrite, don't append) to bound storage/egress. Inputs/speed are transient relay traffic — prune them (§12). Durable multi-week progress lives under `saves/`.

---

## 6. Security rules (the heart — rules-only, no server code)

This enforces the entire capability model declaratively. **Verify exact RTDB rules syntax against current Firebase docs and TEST in the emulator.** The model:

- **Mint invite** (`/sessions/{s}/invites/{i}` create): allowed only if `auth.uid` is in `meta/owners`.
- **Redeem invite** (`/sessions/{s}/invites/{i}/redeemedBy` write): allowed only if it is currently **absent** (write-once) AND the value being written equals `auth.uid` (you can only redeem to yourself). Done client-side via a `transaction()` so two simultaneous redeemers resolve to exactly one winner.
- **Become a member** (`/sessions/{s}/members/{uid}` create where `uid === auth.uid`): allowed only if the invite named in `viaInvite` has `redeemedBy === auth.uid` in committed data. This cryptographically links membership to a consumed invite without any server.
- **Session writes** (sync/snapshot/etc.): allowed only if `/members/{auth.uid}` exists (you're a member).
- **Controller-only writes** (`sync/inputs`, `sync/speed`, `sync/snapshot`, `meta/speedMultiplier`): additionally require `controllerLock/holder === auth.uid`.
- **Claim control** (`controllerLock`): via `transaction()`; allowed if `holder` is null/absent (free) or per the handoff rule (the departing holder's `onDisconnect` clears it, then next-in-queue claims). A member may only set `holder` to their own uid.
- **Revoke** (`/members/{uid}` delete): allowed if `auth.uid` in `meta/owners`.

Illustrative shape (pseudo-rules — adapt to verified syntax, then emulator-test):
```jsonc
{
  "rules": {
    "sessions": {
      "$s": {
        "meta": {
          ".read": "auth != null",
          "owners": { ".write": "root.child('sessions/'+$s+'/meta/owners/'+auth.uid).val() === true || !data.exists()" },
          "speedMultiplier": { ".write": "root.child('sessions/'+$s+'/controllerLock/holder').val() === auth.uid" }
        },
        "invites": {
          "$i": {
            ".read": "auth != null",
            ".write": "(!data.exists() && root.child('sessions/'+$s+'/meta/owners/'+auth.uid).val() === true) || (data.exists() && !data.child('redeemedBy').exists() && newData.child('redeemedBy').val() === auth.uid)"
          }
        },
        "members": {
          "$uid": {
            ".read": "auth != null",
            ".write": "$uid === auth.uid && ( !newData.exists() || root.child('sessions/'+$s+'/invites/'+newData.child('viaInvite').val()+'/redeemedBy').val() === auth.uid || root.child('sessions/'+$s+'/meta/owners/'+auth.uid).val() === true )"
          }
        },
        "controllerLock": {
          ".read": "auth != null",
          ".write": "root.child('sessions/'+$s+'/members/'+auth.uid).exists() && (!data.child('holder').exists() || data.child('holder').val() === null || newData.child('holder').val() === auth.uid || newData.child('holder').val() === null)"
        },
        "sync": {
          ".read": "root.child('sessions/'+$s+'/members/'+auth.uid).exists()",
          ".write": "root.child('sessions/'+$s+'/members/'+auth.uid).exists() && root.child('sessions/'+$s+'/controllerLock/holder').val() === auth.uid"
        },
        "saves": {
          ".read": "root.child('sessions/'+$s+'/members/'+auth.uid).exists()",
          ".write": "root.child('sessions/'+$s+'/members/'+auth.uid).exists()"
        }
      }
    }
  }
}
```
Treat the above as a **starting point to be hardened and emulator-tested**, not as final. Confirm: an invite cannot be redeemed twice; a non-owner cannot mint; a non-member cannot read/write a session; a non-controller member cannot write inputs; a member can claim a free controller lock but not steal a held one.

---

## 7. Capability & identity lifecycle

- **Owner:** the creator's anonymous UID is written into `meta/owners` at session creation. Only owners mint invites and revoke members. **Footgun to document, not engineer around:** ownership is tied to the owner's device (its persisted anonymous credential). If the owner clears site data, their next visit mints a *new* UID and they lose minting ability for existing sessions. **Recovery is a documented manual step, not an in-app feature:** because the owner controls the Firebase project, they can open the Realtime Database in the Firebase console and add their current UID to `meta/owners/{newUid}: true` (console/admin writes bypass security rules, so this always works). To make this painless, **the app MUST surface the signed-in user's own anonymous UID somewhere visible** (e.g. an owner/settings/debug panel, copyable), so the owner can read their new UID and paste it into the console. Do NOT build a co-owner mechanism or crypto-token recovery — the manual console step is sufficient since the owner holds the Firebase project.
- **Invite:** an `inviteId` (random push id) created under `invites/`. The shareable invite is a URL/string encoding `{ sessionId, inviteId }` (and enough Firebase config/session pointer for a cold joiner to connect). Single-use, enforced atomically (§6).
- **Member credential:** on successful redemption, the client is signed in anonymously (durable UID) and has a `members/{uid}` record. The Firebase SDK persists the anonymous credential in the browser (IndexedDB); that persistence **is** the stored "key" — surviving reloads and reconnects. Clearing site data or using a second device means no credential → needs a fresh invite. This is exactly the desired behavior.
- **Reconnect:** uses the persisted anonymous credential + stored `sessionId`; no invite needed. Use RTDB `onDisconnect()` to clear `lastSeen`/release the controller lock on drop, so a flaky-cellular blip that drops the socket is handled cleanly and control can pass.
- **Single-use guarantee scope:** robustly enforced here because RTDB is a stateful authority (unlike the dropped P2P option). State this honestly in the UI/README — no false guarantees needed since the backend enforces it.

---

## 8. ROM handling (changed: local files, hash-gated)

- **No ROMs on the server or in the static site, ever** (legal posture). Each participant loads their **own local ROM file** via a file picker / drag-drop, stored in their browser (IndexedDB) for reuse.
- At session creation the owner's loaded ROM's **SHA-256** is written to `meta/romHash` (+ a human `romName`). Every joiner must load a byte-identical ROM; the client hashes the local file and compares to `meta/romHash`.
- **Mismatch / missing ROM UX:** block entry with a clear, friendly message — e.g. "This game needs the ROM file for {romName}. Your file doesn't match (or is missing). Ask whoever set up the game which exact version to use." This is the accepted "same game version, like a mod" model — make the failure legible, not cryptic.
- ROMs are never transmitted over the network or between peers.

---

## 9. Cross-origin isolation on a static host (MAKE-OR-BREAK — Milestone 0)

mGBA's threaded WASM needs `SharedArrayBuffer`, which requires cross-origin isolation (`COOP: same-origin`, `COEP: require-corp`). **GitHub Pages cannot set custom response headers**, so:

- **Primary approach:** ship `coi-serviceworker` (Guido Zuidhof's shim) — a service worker that re-serves responses with the COOP/COEP headers, enabling cross-origin isolation on static hosts. Since this is a PWA with its own service worker, **integrate the COOP/COEP header injection into the single app service worker** rather than running two competing workers (or load coi-serviceworker first and layer the PWA SW carefully — verify they cooperate).
- Because of COEP `require-corp`, **all subresources must be same-origin or CORP/CORS-correct** — hence bundling the Firebase SDK and all assets locally (§4). Verify the Firebase SDK's own network calls (to Google endpoints) function under cross-origin isolation; they should, as they're `fetch`/XHR rather than COEP-gated subresource loads, but confirm on a real device.
- **Verify `crossOriginIsolated === true` and `SharedArrayBuffer` is defined** on the actually-deployed GitHub Pages URL (not just localhost) on a real Android device.
- **Fallback if the shim can't be made to work:** use a **single-threaded mGBA WASM build** (no SharedArrayBuffer, no isolation needed). Confirm whether the vendored core offers/ can be built single-threaded; document the performance tradeoff. If neither threaded-via-shim nor single-threaded works on target devices, this is a hard blocker — record it in `QUESTIONS.md` and stop.

---

## 10. PWA setup
- Web app manifest (name, icons, `display: standalone`, theme color, landscape orientation hint).
- Service worker (integrating the COI header logic, §9) caching the app shell + vendored mGBA for offline-capable launch and installability on Android.
- Installable on Android Chrome with no store/cert/cost. (iOS best-effort, per existing Android-first priority.)
- Ensure the SW does not strip the COOP/COEP headers it must inject.

---

## 11. Wiring existing logic onto the adapter
Map the current message flow onto adapter calls, keeping payload shapes identical:
- Controller button press → `adapter.sendInput(msg)` → RTDB `sync/inputs` push → members' `onInput` listeners → existing frame scheduler applies at tagged frame. Prune applied inputs.
- Speed change → `adapter.sendSpeed(msg)` → `sync/speed` → `onSpeed` → existing synced-speed logic. Mirror current multiplier in `meta/speedMultiplier` for late joiners/handoff (matches SPEC-SPEED behavior).
- Periodic snapshot → `adapter.publishSnapshot()` → overwrite `sync/snapshot` → `onSnapshot` → existing hash-based reconciliation. Carry `multiplier` in the snapshot (existing behavior).
- Handoff → departing controller's `onDisconnect()` clears `controllerLock/holder`; next-in-queue `claimControl()` transaction; new controller loads latest snapshot from `sync/snapshot` (existing resume-from-snapshot logic) and adopts `meta/speedMultiplier`.
- Late join / bootstrap → read `sync/snapshot` (+ `meta/speedMultiplier`) on join, exactly like the existing `welcome` bootstrap.
- Durable saves → `adapter.saveDurable/loadDurable` against `saves/`.

The reconciliation, delay buffer, determinism safeguards, speed sync, and touch controls are **unchanged**.

---

## 12. Free-tier guardrails (Spark) and migration triggers
Spark RTDB limits to respect (verify current numbers): ~**100 simultaneous connections**, ~**10 GB/month download**, ~**1 GB stored**. Build with these in mind:
- **Snapshot cadence:** the dominant egress cost is snapshot fan-out. Default to the existing cadence but make it configurable; consider snapshotting less often, or primarily on handoff/resume, when sessions are large. (Inputs keep followers smooth between snapshots — existing design.)
- **Prune aggressively:** delete `sync/inputs`/`sync/speed` entries once superseded; keep only the latest `sync/snapshot`; don't accumulate history.
- **Storage:** keep only latest snapshot + durable saves; clean up ended/empty sessions (a member, on becoming last to leave, removes the session subtree; guard with rules).
- **Connection budget:** each open tab = 1 connection; ~100 total across all live sessions is the ceiling. Fine for family-of-family; surface a friendly "service busy" if rejected.
- **Migration triggers (record in DECISIONS.md if hit):** routinely nearing 100 connections, 10 GB/mo download, or 1 GB stored → time to evaluate the research's backups (Supabase: 200 conns + Postgres, but solve the 7-day idle-pause; Ably: 200 conns + capability tokens, but chunk snapshots and mind 5 KiB chunk-billing). The adapter interface (§3) is what makes that migration cheap — do not bypass it.

## 13. Abuse / public-exposure posture
- The Firebase web config in the public bundle is **not a secret**; **the rules are the fence** (§6). Ensure default-deny: no path is writable/readable except as explicitly allowed.
- Single-use invites + member-credential model mean a leaked session URL alone grants nothing without an unredeemed invite.
- **Optional hardening (M6, only if time):** Firebase **App Check** to attest requests come from your app (curbs anonymous-auth quota abuse). Adds setup; note it requires care to remain Spark-compatible. Do not block v1 on it; document it as the recommended next hardening step.
- Keep snapshot cadence conservative so a single abuser can't trivially exhaust egress.

## 14. Implementation roadmap (in order; check acceptance before advancing)

**Milestone 0 — Cross-origin isolation on a static host (DO FIRST, make-or-break).** Get the existing vendored mGBA running from a static build with COI via the service-worker shim; deploy to an actual GitHub Pages URL; verify `crossOriginIsolated === true`, `SharedArrayBuffer` defined, and the emulator runs **on a real Android device**. Try the single-threaded fallback if needed. **Acceptance:** emulator plays a locally-loaded ROM on the deployed static site on Android. If impossible, stop and report.

**Milestone 1 — Backend adapter + Firebase RTDB transport.** Define the §3 interface; implement the Firebase adapter (init, anonymous sign-in, create/join session, roster, presence via onDisconnect). Refactor the existing app to call the adapter instead of the WebSocket. No security model yet (open rules in emulator only). **Acceptance:** two tabs create/join a session via RTDB; roster syncs; departures detected via onDisconnect; no app-run server involved.

**Milestone 2 — Capability model + security rules.** Implement owner creation, owner-only `mintInvite`, atomic `joinViaInvite` (transaction), member-credential persistence, reconnect-without-invite. Author and **emulator-test the §6 rules** thoroughly. **Acceptance:** an invite redeems exactly once; a second redemption fails; a cleared-cache/second-device client needs a fresh invite; non-owner cannot mint; non-member cannot read/write; rules pass an adversarial test pass in the emulator.

**Milestone 3 — Wire sync/speed/handoff onto RTDB.** Route the existing input/speed/snapshot flow through the adapter (§11); controller lock via transaction; handoff via onDisconnect + next-in-queue; reconciliation unchanged. **Acceptance:** full play-together works end-to-end on RTDB across two devices, including synced speed and controller handoff on both graceful leave and ungraceful drop, resuming from the latest snapshot.

**Milestone 4 — Local ROM loading + hash gate.** File picker + IndexedDB storage; SHA-256 compare to `meta/romHash`; friendly mismatch/missing UX (§8). **Acceptance:** only a byte-matching local ROM permits joining play; mismatch and missing cases show clear guidance; no ROM ever leaves the device.

**Milestone 5 — Persistence, guardrails, PWA, deploy.** Durable saves in RTDB (`saves/`); free-tier guardrails (§12: cadence, pruning, session cleanup); PWA manifest + SW; deploy to GitHub Pages; write README with the Firebase setup wizard, the deploy steps, and the **owner-recovery procedure** (how to re-add your UID to `meta/owners` via the Firebase console if you lose owner access — §7). Ensure the app surfaces the signed-in user's own UID (per §7) so this is doable. **Acceptance:** a publicly-reachable static PWA on GitHub Pages runs the full flow on Android, durable saves persist across separate sessions, and a normal family-scale play session stays within Spark limits.

**Milestone 6 — Optional hardening.** App Check; a second backend adapter (Supabase or Ably) behind the §3 interface. Do not start until M0–M5 are solid.

## 15. Testing checklist
- COI true + emulator runs on the deployed GitHub Pages URL on a real Android device (M0).
- Invite redeems exactly once; double-redeem blocked; second-device needs new invite (M2).
- Non-owner cannot mint; non-member cannot access session; non-controller cannot write inputs (M2 rules, emulator).
- Full synced play + speed across two devices; handoff on graceful leave AND ungraceful drop (onDisconnect) resumes from latest snapshot (M3).
- ROM hash mismatch and missing-ROM both blocked with clear guidance; ROM never transmitted (M4).
- Durable save persists across separate sessions/days (M5).
- Reconnect after a simulated cellular drop rejoins without a new invite (M2/M3).
- A rough egress/connection estimate for a realistic family session stays within Spark caps (M5).

## 16. Config / defaults
- Reuse existing sync/speed/reconciliation defaults (snapshot cadence, follower delay, speed ladder, catch-up threshold).
- `BACKEND = "firebase-rtdb"` (only implemented adapter).
- Firebase plan: **Spark, no Cloud Functions, no Cloud Storage for Firebase.**
- `PRUNE_INPUTS = true`; keep latest snapshot only.
- Cross-origin isolation: service-worker shim primary, single-threaded mGBA fallback.
- For uncovered choices: simplest robust option, log in `DECISIONS.md`, continue.

## 17. Pitfalls
- **Do not enable Blaze / Cloud Functions / Cloud Storage for Firebase** — it removes the hard quota cap and the no-surprise-bill guarantee. Keep everything in RTDB on Spark.
- COEP `require-corp` blocks cross-origin subresources — **bundle Firebase SDK and all assets locally**; CDN loads will break under isolation.
- Don't run two competing service workers — integrate COI header injection into the single PWA SW (§9).
- RTDB **rules are subtle**; the invite-atomicity and member-link rules must be emulator-tested adversarially. A gap here makes the public app abusable.
- Keep only the **latest** snapshot (overwrite) and prune inputs, or storage/egress balloons against Spark caps.
- Verify Spark limits, SDK APIs, and rules syntax against current docs — they drift.
- `onDisconnect()` is the reliable departure signal; don't rely solely on heartbeats for handoff.
- Ownership is tied to the device credential — clearing site data loses it. Recovery is a manual Firebase-console edit of `meta/owners` (add the owner's current UID); the app must surface the user's own UID so this is easy. Do not build co-owner/token recovery.

## 18. Out of scope (this build)
- Self-hosted and P2P/WebRTC adapters (explicitly dropped; the interface should *allow* them later, but do not build them now).
- Cloud Functions / any server-side code.
- Hosting or transmitting ROMs.
- Accounts / passwords / email login.
- Additional vendors beyond the Firebase RTDB adapter (Supabase/Ably are M6-optional/future).
