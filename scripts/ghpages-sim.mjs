// Minimal static file server that MIMICS GitHub Pages for local M0 testing:
//   - serves a directory tree (mount the built `dist` under /<repo>/)
//   - sets correct Content-Type incl. application/wasm
//   - sets NO COOP/COEP headers (so the coi-serviceworker shim is what must
//     establish cross-origin isolation — exactly the GitHub Pages condition)
//   - SPA-friendly: unknown paths under the mount fall back to index.html
//
// Usage: node scripts/ghpages-sim.mjs <rootDir> <port>
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const root = process.argv[2] ?? ".";
const port = Number(process.argv[3] ?? 8788);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".gba": "application/octet-stream",
  ".map": "application/json",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith("/")) p += "index.html";
    let filePath = normalize(join(root, p));
    if (!filePath.startsWith(normalize(root))) { res.writeHead(403).end("forbidden"); return; }
    let body;
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) filePath = join(filePath, "index.html");
      body = await readFile(filePath);
    } catch {
      // SPA fallback: serve the nearest index.html for the repo mount.
      const m = p.match(/^(\/[^/]+\/)/);
      const idx = m ? join(root, m[1], "index.html") : join(root, "index.html");
      try { body = await readFile(idx); filePath = idx; }
      catch { res.writeHead(404).end("not found"); return; }
    }
    res.setHeader("Content-Type", TYPES[extname(filePath)] ?? "application/octet-stream");
    // Deliberately NO Cross-Origin-* headers — mimic GitHub Pages.
    res.writeHead(200).end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(port, () => console.log(`ghpages-sim serving ${root} at http://localhost:${port}`));
