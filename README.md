# Watch-Together GBA Emulator

A private, mobile-first, browser-based Game Boy Advance emulator that lets a family play turn-based games together. Each client runs its own local mGBA WASM core; one "controller" plays and others "follow" in sync via WebSocket-relayed inputs + periodic save-state snapshots. No video is streamed — the design works behind a Cloudflare Tunnel (HTTP/WS only).

See `SPEC.md` for the full architecture and rationale.

---

## Quickstart (dev)

```bash
npm install
npm run dev
```

This launches:
- The Node.js server (WebSocket hub + ROM endpoint) on `http://localhost:8080`.
- The Vite dev server (client) on `http://localhost:5173`.

Open two browser tabs at `http://localhost:5173/s/<any-id>`. The first tab is the controller; the second mirrors it. Closing the controller hands control to the next tab.

> **Cross-origin isolation:** mGBA WASM uses threads, which requires COOP/COEP headers. Both the dev server (Vite) and the prod server set these. If the browser console complains about `SharedArrayBuffer`, verify the response headers include `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

## Production build & deploy

```bash
npm run build
npm start  # Serves the built client + WS hub on $PORT (default 8080)
```

Behind a Cloudflare Tunnel:

```bash
# Example cloudflared config — point the Tunnel at http://localhost:8080
cloudflared tunnel --url http://localhost:8080
```

The Tunnel forwards both HTTP/HTTPS *and* WebSocket traffic. **The Tunnel must pass `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers through unmodified.** If Cloudflare strips them, cross-origin isolation breaks and the threaded WASM core will fail to load. Verify by checking `crossOriginIsolated` in the browser console after deployment.

Auth is assumed to be handled upstream by Cloudflare Access — the app itself does not implement signup.

## ROMs

ROMs live in `/server/roms/`. They are **not** committed (gitignored), except for a small public-domain/homebrew test ROM. Drop your own legally-obtained ROMs there. The server hashes them at startup and serves them via `/api/roms/:id`.

No Nintendo BIOS is included or needed — mGBA's built-in HLE BIOS is used.

## Regenerating the vendored mGBA core

The mGBA WASM core (MPL-2.0) is vendored under `/vendor/mgba/` so the app builds without relying on the live npm package. To bump:

```bash
npm install @thenick775/mgba-wasm@<version>
# Copy node_modules/@thenick775/mgba-wasm/dist/*.{js,wasm,d.ts} into /vendor/mgba/
# Refresh /vendor/mgba/NOTICE with new version + date
```

See `/vendor/mgba/NOTICE` for source/version/date.

## Project layout

```
/SPEC.md                  ← source-of-truth specification
/README.md                ← this file
/PROGRESS.md              ← milestone log
/DECISIONS.md             ← non-obvious choices logged here
/QUESTIONS.md             ← open human-judgement items
/client                   ← React + Vite + TS SPA
/server                   ← Node + TS WebSocket hub + static + ROM endpoint
/shared                   ← TS protocol types shared by client and server
/vendor/mgba              ← Vendored mGBA WASM core (MPL-2.0)
```
