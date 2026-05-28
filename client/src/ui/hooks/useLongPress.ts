import { useRef } from "react";

export interface LongPressHandlers {
  onPointerDown: (e: { pointerId: number }) => void;
  onPointerUp: (e: { pointerId: number }) => void;
  onPointerCancel: (e: { pointerId: number }) => void;
  onPointerLeave: (e: { pointerId: number }) => void;
}

export function useLongPress(
  handler: () => void,
  ms = 500,
): LongPressHandlers {
  const timerRef = useRef<number | null>(null);
  const activePointerRef = useRef<number | null>(null);

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activePointerRef.current = null;
  };

  return {
    onPointerDown: (e) => {
      if (activePointerRef.current !== null) return;
      activePointerRef.current = e.pointerId;
      timerRef.current = window.setTimeout(() => {
        handler();
        cancel();
      }, ms);
    },
    onPointerUp: (e) => {
      if (e.pointerId !== activePointerRef.current) return;
      cancel();
    },
    onPointerCancel: (e) => {
      if (e.pointerId !== activePointerRef.current) return;
      cancel();
    },
    onPointerLeave: (e) => {
      if (e.pointerId !== activePointerRef.current) return;
      cancel();
    },
  };
}
