// Tiny path-only router. Hooks into history events so component subscribes
// trigger re-renders. Avoids pulling in react-router for the few routes we
// have: "/", "/play", "/spike", "/s/<sessionId>".

import { useEffect, useState } from "react";

export interface Route {
  path: string;
  search: URLSearchParams;
}

function read(): Route {
  return {
    path: window.location.pathname,
    search: new URLSearchParams(window.location.search),
  };
}

const listeners = new Set<(r: Route) => void>();

export function useRoute(): Route {
  const [r, setR] = useState<Route>(read);
  useEffect(() => {
    const handler = () => setR(read());
    listeners.add(handler);
    window.addEventListener("popstate", handler);
    return () => {
      listeners.delete(handler);
      window.removeEventListener("popstate", handler);
    };
  }, []);
  return r;
}

export function navigate(path: string) {
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState(null, "", path);
  const r = read();
  for (const l of listeners) l(r);
}
