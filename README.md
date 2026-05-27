# Play-Together GBA

A small, self-hosted Game Boy Advance emulator that lets a family share a save game across phones, tablets, and laptops. Whoever has the controls plays; everyone else watches in sync over WebSocket. Close your tab and the save stays — anyone in the family can pick it up later.

---

## ⚠️ Read this before you deploy

> **This project was vibe-coded.** Almost every line of code in this repository was generated through conversation with a large language model. I (the human credited on the commits) gave it the design brief and the spec, but I did not hand-write it.
>
> What that means for you:
> - **It works for me, on my hardware, with my family.** It might not work for you. There may be sharp edges I never tripped over.
> - **There is no support.** If you open an issue, I might not answer. If you open a PR, I might not merge it. Please fork freely.
> - **Don't host anything sensitive on the same machine.** It's never had a real security review.
> - **Don't expect upstream updates.** This is a personal scratch I built once; it might never be touched again.
> - **You're running other people's code.** Audit the Dockerfile, the workflow, and the small server before you point a tunnel at it. The full source is ~3 kLOC; you can read it in an afternoon.
>
> If you're OK with all that — read on, and have fun. 🎮

---

## What it does

- **Persistent shared saves.** Create a "save", give it a name, pick a ROM. Your family picks up the same save from any device. The game waits when nobody is playing.
- **One controller at a time.** Whoever joined first holds the buttons; everyone else watches their tab in sync. Close the controller's tab and the next person in queue takes over from the latest snapshot.
- **Contributor tracking.** The save credits the person currently holding the controls for the wall-clock time they spend playing. No accounts, no auth — just names entered once on each device.
- **Mobile-first.** A touch gamepad with three layout options (side controls / overlay / stacked) is the default. Works as a "real" installed app via PWA (Add to Home Screen) on Android and iOS.
- **No video streaming.** Everyone runs their own [mGBA](https://mgba.io/) WebAssembly core locally; the server only relays inputs and small (~2 KB) save-state snapshots. That means it works behind a Cloudflare Tunnel where UDP/WebRTC don't.

---

## What you need to deploy this

- A box that can run Docker (NAS, home server, a Linux laptop, a Raspberry Pi 4+, etc.).
- A few GBA ROMs that you own. **None are included** — you provide your own.
- *(Optional)* A Cloudflare account if you want family to play from outside your home network.

Targeted at **Android Chrome** and **desktop Chrome/Edge**. iOS Safari mostly works (fullscreen / orientation lock are limited), but it's not the gating target.

---

## Quickstart with Docker

```bash
docker run -d \
  --name play-together-gba \
  -p 8080:8080 \
  -v /path/to/your/roms:/app/server/roms \
  -v /path/to/your/data:/app/server/data \
  --restart unless-stopped \
  ghcr.io/robinweitzel/play-together-gba:latest
```

Open `http://<your-server>:8080`. Done.

Drop `.gba` files into the host folder you mounted at `/app/server/roms` and restart the container — the server hashes ROMs on boot only.

**The two mounts matter:**
- `/app/server/roms` — your ROM library.
- `/app/server/data` — persistent saves (game state + names + minutes-per-player). **Skip this mount and every save vanishes the moment the container is recreated.**

If you'd rather use Compose, there's a ready-to-go `docker-compose.yml` in the repo. Edit the volume paths and `docker compose up -d`.

---

## Quickstart on Unraid

1. **Community Apps → Docker → Add Container.**
2. Fill in:
   - **Repository:** `ghcr.io/robinweitzel/play-together-gba:latest`
   - **Network Type:** Bridge (default)
   - **Port:** Container `8080` → Host `8080` (or any free host port; map it via your reverse proxy later)
   - **Path 1 (ROMs):** Container `/app/server/roms` → Host `/mnt/user/appdata/play-together-gba/roms` (Read/Write)
   - **Path 2 (Saves):** Container `/app/server/data` → Host `/mnt/user/appdata/play-together-gba/data` (Read/Write)
   - **Restart Policy:** unless-stopped
3. Apply. First pull is ~200 MB.
4. Drop your ROMs into `…/roms/` and restart the container.

**Heads-up about the GHCR image:** GitHub publishes new container images as **private** by default for the user that owns the repo. If your Unraid host can't pull, either:
- Make the package public: GitHub → your profile → Packages → `play-together-gba` → Package settings → Change visibility → Public. Recommended for self-hosted use; the image contains no secrets.
- Or `docker login ghcr.io -u <username> -p <PAT-with-read:packages>` once on the Unraid host.

---

## Letting family outside your home network play

The server only needs to expose HTTP and WebSockets. A few options:

### Cloudflare Tunnel (what I use)

`cloudflared` ties a public URL to your local server without opening any router ports.

```bash
cloudflared tunnel --url http://localhost:8080
```

For something more permanent: name the tunnel, attach a DNS record on your domain, and run `cloudflared` as a service. Cloudflare's own docs walk you through it. Pair it with Cloudflare Access if you want a one-click family-only login.

**One footgun**: the tunnel **must pass `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` through unmodified.** The threaded mGBA WASM build needs those headers, and some Cloudflare features (Workers in front, certain Transform Rules) will strip them. After deployment, open the public URL → DevTools → Console and check `crossOriginIsolated` — if it's `false`, that's where to look.

### Tailscale / WireGuard

Cleaner if everyone in the family is on the same overlay network. Install Tailscale on the server and each family device; access via the server's MagicDNS name. No public exposure at all.

---

## How saves & contributors work

- A **save** is a named, persistent file on the server: ROM + save state + contributor ledger.
- The **first person to open a save** becomes the controller. Anyone else who joins watches.
- When the controller's tab closes, the next person in queue gets promoted automatically.
- Everyone enters their name once on first visit; it's stored in `localStorage`. The currently-playing person accumulates minutes against their name on each save they touch.
- Saves can be **archived** (soft-hidden) and restored from the home page. Deletion is intentionally not exposed — saves live forever on disk.

You can have as many parallel saves as you want — one per game, one per kid, one per playthrough, whatever.

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| Page loads but the canvas stays black / a console error mentions `SharedArrayBuffer` | Cross-origin isolation. The server sets COOP/COEP/CORP; verify they reach the browser. Behind Cloudflare Tunnel, check for a Worker or Transform Rule stripping them. |
| Saves vanish when I recreate the container | The `/app/server/data` mount is missing or pointing at an ephemeral path. |
| ROMs don't appear on the home page | Filename must end in `.gba`. ROMs are hashed only at startup — restart the container after dropping new ones in. |
| "ROM hash mismatch" when joining a save | The ROM file on the server changed after the save was created. Either restore the original ROM or create a fresh save with the new file. |
| Controls feel laggy on a follower's screen | Followers always lag behind by network RTT + the snapshot interval (default 1.5 s). That's by design — turn-based games (Pokémon, etc.) feel fine; twitch action games will not. |
| Multitouch doesn't work on D-pad + A simultaneously | Should work on Android Chrome — uses `setPointerCapture`. iOS Safari can be flaky depending on iOS version; the layout picker (⚙) has an Overlay mode that may help. |
| Audio is silent on a follower | Followers are muted by default. Use the 🔊 toggle in the header. (Audio echoing across multiple tabs is a worse default.) |

---

## Adding it to your phone's home screen

There's a tiny PWA manifest plus a deliberately empty pass-through service worker. The service worker exists only because Android Chrome refuses to install a site as a real app without one — it caches nothing, so users always get the latest server build.

- **Android Chrome:** the menu shows "Install app" or "Add to Home Screen".
- **iOS Safari:** Share → Add to Home Screen.

Once installed, it launches in standalone mode (no browser chrome) with a gradient gamepad icon. It still talks to the server every time it opens — no offline mode.

---

## Building from source

You need Node 22+.

```bash
git clone https://github.com/RobinWeitzel/play-together-gba
cd play-together-gba
npm install
npm run dev
```

Opens the client at `http://localhost:5173/` and the server at `http://localhost:8080/` (Vite proxies `/api` and `/ws` to it).

For a production build:

```bash
npm run build
npm start                 # serves /client/dist + WS hub on $PORT (default 8080)
```

To build your own container:

```bash
docker build -t play-together-gba:local .
docker run -p 8080:8080 \
  -v ./roms:/app/server/roms \
  -v ./data:/app/server/data \
  play-together-gba:local
```

There's a determinism-spike page at `/spike` that the build used to validate the emulator's save-state behaviour; useful for debugging if a deploy ever stops working.

---

## ROMs

**You provide your own ROMs.** Drop `.gba` files into the `/app/server/roms` mount. The repo ships exactly one ROM for the test suite: `test-arm.gba` (Julian Smolka's MIT-licensed [ARM CPU test ROM](https://github.com/jsmolka/gba-tests)) — not a game, just a CPU test that draws "Passed/Failed test N" to the screen. It exists so a fresh install has *something* to boot.

The server hashes every ROM at startup to enforce that all clients are running the same bytes. ROMs are gitignored; nothing about them ever leaves your machine.

No Nintendo BIOS is needed or shipped — mGBA's built-in HLE BIOS is used.

---

## Credits & license

- **[mGBA](https://mgba.io/)** by endrift and contributors — the actual emulator. MPL-2.0. The compiled WebAssembly build is vendored under `/client/public/emulator/` ([@thenick775/mgba-wasm](https://github.com/thenick775/mgba)) and includes its own `LICENSE` + `NOTICE`.
- **Test ROM:** `test-arm.gba` by [jsmolka](https://github.com/jsmolka/gba-tests), MIT.
- **The rest of this repo** was written almost entirely by a large language model under my supervision. See the disclaimer at the top.

---

## Project layout (if you're poking around)

```
/SPEC.md                  ← original design brief
/PROGRESS.md              ← milestone log (M0–M4)
/DECISIONS.md             ← non-obvious technical choices and why
/QUESTIONS.md             ← open items the LLM couldn't decide on its own

/client                   ← React + Vite + TypeScript SPA
  /public/emulator/       ← vendored mGBA WASM core (MPL-2.0)
  /public/icons/          ← PWA icon
  /src                    ← see /src/ui for screens, /src/emulator for the wrapper

/server                   ← Fastify + ws hub, runs via tsx in dev and prod
  /src/index.ts           ← HTTP + WS routes + COOP/COEP
  /src/saves.ts           ← file-backed save store + contributor ledger
  /src/sessions.ts        ← in-memory session + controller queue
  /roms                   ← drop your ROMs here (gitignored; test ROM committed)

/shared/src               ← TS types shared by client & server

Dockerfile                ← multi-stage; alpine; ships /client/dist + tsx-run server
docker-compose.yml        ← ready to copy + edit volume paths
.github/workflows/        ← multi-arch (amd64 + arm64) image build → GHCR
```

That's it. If you fix something obvious in your fork, please post a link in the issues — I'll probably never merge it but other family-deployers might find it useful.
