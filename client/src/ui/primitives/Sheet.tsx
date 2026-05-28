// Bottom sheet with three states: closed, peek (always visible), expanded.
// Drag the handle to switch between peek <-> expanded. Backdrop appears
// only in expanded state. The drag uses PointerEvents (same pattern as
// the existing Gamepad component) for reliable multi-touch behaviour.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHaptics } from "../hooks/useHaptics";

export type SheetState = "closed" | "peek" | "expanded";

interface Props {
  state: SheetState;
  onStateChange: (next: SheetState) => void;
  peekHeight?: number;     // px; if 0, no peek shown when state="peek"
  expandedHeight?: string; // CSS value; defaults to 75dvh
  children: ReactNode;     // sheet content (everything below the handle)
  handle?: ReactNode;      // optional custom handle area; default = the grabber
}

export function Sheet({
  state,
  onStateChange,
  peekHeight = 52,
  expandedHeight = "75dvh",
  children,
  handle,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const haptics = useHaptics();
  const dragStartY = useRef<number>(0);
  const dragStartTranslateY = useRef<number>(0);

  // Resolve the resting Y offset (from bottom) given the current state.
  // We render the sheet at expanded height always; CSS transform shifts
  // it down for peek/closed.
  const restingOffset = (s: SheetState): number => {
    if (!elRef.current) return 0;
    const h = elRef.current.getBoundingClientRect().height;
    if (s === "expanded") return 0;
    if (s === "peek") return h - peekHeight;
    return h; // closed: hidden offscreen
  };

  useEffect(() => {
    if (!elRef.current) return;
    elRef.current.style.transform = `translate3d(0, ${restingOffset(state)}px, 0)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, peekHeight]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (state === "closed") return;
    const el = elRef.current;
    if (!el) return;
    setDragging(true);
    dragStartY.current = e.clientY;
    const current = new DOMMatrix(getComputedStyle(el).transform).m42;
    dragStartTranslateY.current = current;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const el = elRef.current;
    if (!el) return;
    const dy = e.clientY - dragStartY.current;
    const h = el.getBoundingClientRect().height;
    const next = Math.max(0, Math.min(h, dragStartTranslateY.current + dy));
    el.style.transform = `translate3d(0, ${next}px, 0)`;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const el = elRef.current;
    if (!el) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    // Use the pointer's final position vs. its start position. Reading the
    // DOM's computed transform here is unreliable on mobile: pointermove
    // events can be sparse during a fast swipe, so the last transform we
    // wrote might lag the user's actual finger position. e.clientY captures
    // where the finger ACTUALLY ended up.
    const finalDy = e.clientY - dragStartY.current;

    // Threshold is just enough to ignore tap-tremor (a few px wobble during
    // what's clearly meant to be a tap). Any deliberate swipe — even a short
    // one — should commit. Always reset transform to the snap state's rest
    // offset so a drag that ends in the same state still snaps the sheet
    // back to its anchor.
    const TAP_TOLERANCE = 8;
    let next: SheetState;
    if (Math.abs(finalDy) < TAP_TOLERANCE) {
      next = state;
    } else if (finalDy < 0) {
      next = "expanded";
    } else {
      next = "peek";
    }
    el.style.transform = `translate3d(0, ${restingOffset(next)}px, 0)`;
    if (next !== state) {
      haptics("snap");
      onStateChange(next);
    }
  };

  return (
    <>
      <div
        className="app-sheet-backdrop"
        data-state={state}
        onClick={() => onStateChange(state === "expanded" ? "peek" : state)}
      />
      <div
        ref={elRef}
        className="app-sheet"
        data-state={state}
        data-dragging={dragging || undefined}
        style={{ height: expandedHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="dialog"
        aria-modal={state === "expanded"}
      >
        {handle ?? <div className="app-sheet-handle" aria-hidden />}
        <div className="app-sheet-content">{children}</div>
      </div>
    </>
  );
}
