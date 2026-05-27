# Watch-Together GBA Emulator

A private, mobile-first, browser-based Game Boy Advance emulator that lets a family play turn-based games together. Each client runs its own local mGBA WASM core; one "controller" plays and the others "follow" in sync via WebSocket-relayed inputs + periodic save-state snapshots. **No video is streamed** — the design works behind a Cloudflare Tunnel (HTTP/WS only).

See [`SPEC.md`](./SPEC.md) for the architecture and rationale, [`PROGRESS.md`](./PROGRESS.md) for milestone status, and [`DECISIONS.md`](./DECISIONS.md) for non-obvious technical decisions.

---

## How it works (one-paragraph version)

The mGBA WebAssembly core is vendored under `/client/public/emulator/` (MPL-2.0). Every client downloads the ROM (gated by SHA-256 hash), boots its own emulator, and renders locally. A small Node WebSocket hub at `/ws` maintains the session roster and the FIFO controller queue (first-joiner controls, next-in-queue is promoted on departure). The controller emits frame-tagged input messages and a save-state snapshot every 1500 ms; followers apply inputs immediately and reload from snapshots (always — SPEC §12.4 "always reload" mode, validated in [`PROGRESS.md`](./PROGRESS.md) Milestone 0). The server never emulates, never streams audio/video — everything is HTTP + WebSocket, which is exactly what a Cloudflare Tunnel forwards.

---

## Dev quickstart

Requires Node 22+. From the repo root:

```bash
npm install
npm run dev
```

This launches:

- The Node server (WS hub + ROM endpoint) on `http://localhost:8080`.
- The Vite dev server (client) on `http://localhost:5173` with `/ws` proxied to the Node server.

Open two browser tabs at `http://localhost:5173/s/<any-id>?rom=test-arm.gba`. The first tab is the controller; the second mirrors it. Closing the controller hands control to the second tab and resumes from the latest snapshot.

The home page at `http://localhost:5173/` lists ROMs and offers a "Watch-Together" button that creates a session URL for sharing.

**Diagnostics:** the M0 determinism spike is preserved at `http://localhost:5173/spike`.

### Cross-origin isolation

mGBA's threaded WASM build requires `SharedArrayBuffer`, which the browser only exposes when the page is cross-origin-isolated. Both the Vite dev server and the prod Fastify server set:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
X-Robots-Tag:                 noindex
```

If the browser console complains about `SharedArrayBuffer` or `crossOriginIsolated === false`, verify the response headers include all three.

---

## Production build & run

```bash
npm run build       # builds /client/dist + typechecks /server
npm start           # serves the built client + WS hub on $PORT (default 8080)
```

That's it — one process serves both the static client and the WebSocket hub. Visit `http://localhost:8080/` to confirm.

### Docker (recommended for Unraid / any container host)

A multi-arch image is published to GHCR by the GitHub Actions workflow in [`.github/workflows/docker.yml`](.github/workflows/docker.yml):

- `ghcr.io/robinweitzel/remote-gba-emulator:latest` — head of `main`
- `ghcr.io/robinweitzel/remote-gba-emulator:vX.Y.Z` — tagged releases
- `ghcr.io/robinweitzel/remote-gba-emulator:sha-<short>` — every commit

The image bundles the test ROM. To use your own, bind-mount a host directory onto `/app/server/roms`.

#### Quickstart (any Docker host)

```bash
docker run -d \
  --name watch-together-gba \
  -p 8080:8080 \
  -v /path/to/your/roms:/app/server/roms \
  --restart unless-stopped \
  ghcr.io/robinweitzel/remote-gba-emulator:latest
```

Visit `http://<host>:8080`. The server hashes every `.gba` in the mounted roms directory at startup; if you add new ROMs, restart the container.

`docker-compose.yml` is provided as a more convenient starting point:

```bash
docker compose up -d
# or, with the published image:
sed -i 's|build: .|image: ghcr.io/robinweitzel/remote-gba-emulator:latest|' docker-compose.yml
docker compose up -d
```

#### Unraid

1. **Community Apps → Docker → Add Container.** Fill in:
   - **Repository:** `ghcr.io/robinweitzel/remote-gba-emulator:latest`
   - **Network Type:** Bridge (default)
   - **Port:** Container `8080` → Host `8080` (or whatever you prefer; map it through your reverse proxy after)
   - **Path:** Container `/app/server/roms` → Host `/mnt/user/appdata/watch-together-gba/roms` (Read/Write)
   - **Restart Policy:** unless-stopped
2. Apply. The first pull takes ~2 minutes (image is ~250 MB).
3. Copy your ROMs into `/mnt/user/appdata/watch-together-gba/roms/` and either restart the container or visit `http://<unraid-ip>:8080` once and reload (the server hashes ROMs on boot only).

**GHCR visibility:** the image is published to your GitHub account's container registry. By default GitHub makes packages **private**, which means Unraid won't be able to pull without auth. Either:

- **Make it public:** GitHub → your profile → Packages → `remote-gba-emulator` → Package settings → Change visibility → Public. (Recommended for a private self-hosted app on a private network — the *image* is just the code, no secrets.)
- **Or supply credentials:** create a personal access token with `read:packages` and run `docker login ghcr.io -u <username> -p <token>` on your Unraid host once.

### Behind Cloudflare Tunnel

1. **Run `cloudflared`** pointing the Tunnel at the local prod server:

   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```

   (or run a named Tunnel + DNS route per Cloudflare's docs).

2. **The Tunnel must pass `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` through unmodified.** Cloudflare proxies HTTP/HTTPS and WebSockets but does not pass UDP/WebRTC, which is exactly why we chose this design — but it *can* strip or replace response headers in some configurations (e.g., a Worker in front, or a Page Rule that sets COOP/COEP to a different value). After deployment, open browser DevTools → Network → click any document/asset and verify the COOP/COEP headers are present. If they are stripped, check Cloudflare Dashboard → Rules / Workers / Transform Rules.

3. **Auth is assumed to be handled upstream** by Cloudflare Access (or whatever you choose). The app itself does not implement signup; it adds `X-Robots-Tag: noindex` so it isn't indexed.

4. **WebSocket forwarding** is automatic with Cloudflare Tunnel — no extra config needed beyond a normal HTTP origin.

### Smoke-checking the deploy

After `cloudflared` is up and the public URL is reachable:

- Open `https://<your-domain>/` in two phones (or two browser tabs).
- Tab A: pick a ROM → "Watch-Together" → tap to start. Confirm role is "controller".
- Tab B: open the resulting `/s/<id>?rom=...` URL. Confirm role is "follower"; the gamepad is faded.
- Press buttons in Tab A; Tab B mirrors within ~1.5 s.
- Close Tab A; Tab B should flip to controller within a snapshot interval, and the game continues.

If something doesn't work, browser DevTools → Console + Network is the right place to look (the app logs to console liberally).

---

## ROMs

ROMs live in `/server/roms/`. They are **not** committed (`.gitignored`), except for a small public-domain test ROM:

- `test-arm.gba` — Julian Smolka's [GBA ARM test ROM](https://github.com/jsmolka/gba-tests) (MIT). Renders pass/fail of CPU tests; used to verify the emulator boots end-to-end.

Drop your own legally-obtained ROMs into `/server/roms/`. The server hashes them at startup and serves them via `GET /api/roms/:id`. The client verifies the SHA-256 against `/api/roms` metadata before booting and rejects mismatches (SPEC §15 integrity).

**No Nintendo BIOS** is included or needed — mGBA's built-in HLE BIOS is used.

---

## Regenerating the vendored mGBA core

The mGBA WASM core (`@thenick775/mgba-wasm` v2.4.1, MPL-2.0) is vendored at `/client/public/emulator/{mgba.js, mgba.wasm, mgba.d.ts}` with `LICENSE` + `NOTICE`. To bump:

```bash
# in a scratch directory
npm install @thenick775/mgba-wasm@<version>
# Copy node_modules/@thenick775/mgba-wasm/dist/{mgba.js,mgba.wasm,mgba.d.ts}
#   into /client/public/emulator/
# Refresh /client/public/emulator/NOTICE with the new version + date
# Re-read the .d.ts and update DECISIONS.md if any APIs changed
# Re-run the M0 spike at /spike to confirm determinism
```

The package's source is buildable from a Dockerfile in the upstream repo (`thenick775/mgba` on GitHub, branch `feature/wasm`).

---

## Project layout

```
/SPEC.md                  ← source-of-truth specification
/README.md                ← this file
/PROGRESS.md              ← milestone log
/DECISIONS.md             ← non-obvious choices logged here
/QUESTIONS.md             ← open human-judgement items
/client                   ← React + Vite + TS SPA
  /public/emulator/       ← vendored mGBA WASM core
  /src
    /emulator             ← loadMgba wrapper, snapshot helpers
    /net                  ← typed WS client w/ auto-reconnect
    /ui                   ← HomePage, PlayPage, SessionPage, Gamepad, styles
    /lib                  ← hash, b64, wake-lock, router, api
    /spike                ← M0 determinism spike (at /spike)
/server                   ← Fastify + ws hub + ROM endpoint
  /src
    index.ts              ← HTTP + WS + COOP/COEP middleware
    sessions.ts           ← in-memory session store + controller queue
    roms.ts               ← ROM hashing + serving
  /roms                   ← drop ROMs here (gitignored; test ROM committed)
/shared                   ← TS protocol types shared by client & server
```

---

## License

The mGBA core is MPL-2.0. See `/client/public/emulator/LICENSE` and `/client/public/emulator/NOTICE`. Application code in this repo is the author's; the layout and the test ROM (jsmolka, MIT) are credited where applicable.
