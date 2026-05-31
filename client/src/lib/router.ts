// Tiny hash-based router. Routes live in `location.hash` (`#/play`, `#/s/<id>`,
// `#/join?...`) so the app works as a static bundle on GitHub Pages project
// pages — no SPA 404.html fallback or server route handling needed, and the
// hosting subpath (`/<repo>/`) never leaks into the route. See DECISIONS.md D1.
//
// The public shape (`{ path, search }`, `useRoute`, `navigate`) is unchanged
// from the previous pathname router, so callers and `App.tsx` are untouched —
// `path` is just the part after `#`.

import { useEffect, useState } from "react";

export interface Route {
  path: string;
  search: URLSearchParams;
}

function read(): Route {
  // hash looks like "#/s/abc?x=1". Strip the leading "#", split path/search.
  const raw = window.location.hash.replace(/^#/, "");
  const qIndex = raw.indexOf("?");
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const search = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");
  return { path: path || "/", search };
}

const listeners = new Set<(r: Route) => void>();

export function useRoute(): Route {
  const [r, setR] = useState<Route>(read);
  useEffect(() => {
    const handler = () => setR(read());
    listeners.add(handler);
    window.addEventListener("hashchange", handler);
    window.addEventListener("popstate", handler);
    return () => {
      listeners.delete(handler);
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
    };
  }, []);
  return r;
}

// Navigate to an in-app route. Accepts a path like "/settings" or
// "/s/abc?x=1" (no leading "#"); a leading "#" or "/" is tolerated.
export function navigate(path: string) {
  const clean = path.replace(/^#/, "");
  const next = clean.startsWith("/") ? clean : `/${clean}`;
  const target = `#${next}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
  // hashchange fires asynchronously; notify synchronously too so callers see
  // the update immediately (matches the old pushState behaviour).
  const r = read();
  for (const l of listeners) l(r);
}

// Build a full shareable URL for an in-app route (used for invite links).
export function routeUrl(path: string): string {
  const clean = path.replace(/^#/, "");
  const next = clean.startsWith("/") ? clean : `/${clean}`;
  return `${window.location.origin}${window.location.pathname}#${next}`;
}
