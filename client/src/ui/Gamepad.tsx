// Touch gamepad per SPEC §13. Uses native PointerEvent listeners (NOT React
// synthetic events) on the button DOM nodes, with setPointerCapture for
// reliable multi-touch (D-pad + face buttons simultaneously).
//
// Buttons are split into two panels — left (L, D-pad, Select) and right
// (R, B/A, Start). CSS on the parent .play-shell positions the panels;
// see styles.css `[data-layout="..."]` blocks. The component does not
// care which layout is active.

import { useEffect, useRef } from "react";
import type { GbaButton } from "@gba/shared";

interface Props {
  onPress: (b: GbaButton) => void;
  onRelease: (b: GbaButton) => void;
  // If true, the controls are visible but inert (follower mode).
  disabled?: boolean;
}

function attachButton(
  el: HTMLElement,
  button: GbaButton,
  onPress: (b: GbaButton) => void,
  onRelease: (b: GbaButton) => void,
): () => void {
  let activePointerId: number | null = null;

  const press = (e: PointerEvent) => {
    e.preventDefault();
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add("pad-pressed");
    onPress(button);
    if ((navigator as any).vibrate) (navigator as any).vibrate(8);
  };
  const release = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.remove("pad-pressed");
    onRelease(button);
  };
  el.addEventListener("pointerdown", press, { passive: false });
  el.addEventListener("pointerup", release, { passive: false });
  el.addEventListener("pointercancel", release, { passive: false });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  return () => {
    el.removeEventListener("pointerdown", press as any);
    el.removeEventListener("pointerup", release as any);
    el.removeEventListener("pointercancel", release as any);
  };
}

function attachDpad(
  el: HTMLElement,
  onPress: (b: GbaButton) => void,
  onRelease: (b: GbaButton) => void,
): () => void {
  let activePointerId: number | null = null;
  const pressed = new Set<GbaButton>();

  const setDir = (clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const deadzone = Math.min(r.width, r.height) * 0.18;
    const want = new Set<GbaButton>();
    if (Math.hypot(dx, dy) > deadzone) {
      const a = Math.atan2(dy, dx);
      const right = a > -3 * Math.PI / 8 && a < 3 * Math.PI / 8;
      const left = a > 5 * Math.PI / 8 || a < -5 * Math.PI / 8;
      const down = a > Math.PI / 8 && a < 7 * Math.PI / 8;
      const up = a < -Math.PI / 8 && a > -7 * Math.PI / 8;
      if (right) want.add("Right");
      if (left) want.add("Left");
      if (down) want.add("Down");
      if (up) want.add("Up");
    }
    for (const b of pressed) {
      if (!want.has(b)) {
        pressed.delete(b);
        onRelease(b);
      }
    }
    for (const b of want) {
      if (!pressed.has(b)) {
        pressed.add(b);
        onPress(b);
      }
    }
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add("pad-pressed");
    setDir(e.clientX, e.clientY);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    setDir(e.clientX, e.clientY);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.remove("pad-pressed");
    for (const b of pressed) onRelease(b);
    pressed.clear();
  };
  el.addEventListener("pointerdown", onDown, { passive: false });
  el.addEventListener("pointermove", onMove, { passive: false });
  el.addEventListener("pointerup", onUp, { passive: false });
  el.addEventListener("pointercancel", onUp, { passive: false });
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  return () => {
    el.removeEventListener("pointerdown", onDown as any);
    el.removeEventListener("pointermove", onMove as any);
    el.removeEventListener("pointerup", onUp as any);
    el.removeEventListener("pointercancel", onUp as any);
  };
}

export function Gamepad({ onPress, onRelease, disabled }: Props) {
  const dpadRef = useRef<HTMLDivElement | null>(null);
  const aRef = useRef<HTMLButtonElement | null>(null);
  const bRef = useRef<HTMLButtonElement | null>(null);
  const lRef = useRef<HTMLButtonElement | null>(null);
  const rRef = useRef<HTMLButtonElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);
  const selectRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const offs: (() => void)[] = [];
    if (dpadRef.current) offs.push(attachDpad(dpadRef.current, onPress, onRelease));
    if (aRef.current) offs.push(attachButton(aRef.current, "A", onPress, onRelease));
    if (bRef.current) offs.push(attachButton(bRef.current, "B", onPress, onRelease));
    if (lRef.current) offs.push(attachButton(lRef.current, "L", onPress, onRelease));
    if (rRef.current) offs.push(attachButton(rRef.current, "R", onPress, onRelease));
    if (startRef.current) offs.push(attachButton(startRef.current, "Start", onPress, onRelease));
    if (selectRef.current) offs.push(attachButton(selectRef.current, "Select", onPress, onRelease));
    return () => { for (const o of offs) o(); };
  }, [onPress, onRelease, disabled]);

  const disabledCls = disabled ? " pad-disabled" : "";

  return (
    <>
      <div className={`pad-panel pad-panel-left${disabledCls}`} aria-hidden={disabled}>
        <button ref={lRef} className="pad-btn pad-shoulder">L</button>
        <div ref={dpadRef} className="pad-dpad" aria-label="D-pad">
          <div className="dpad-up">▲</div>
          <div className="dpad-left">◀</div>
          <div className="dpad-right">▶</div>
          <div className="dpad-down">▼</div>
          <div className="dpad-center" />
        </div>
        <button ref={selectRef} className="pad-btn pad-pill">SELECT</button>
      </div>

      <div className={`pad-panel pad-panel-right${disabledCls}`} aria-hidden={disabled}>
        <button ref={rRef} className="pad-btn pad-shoulder">R</button>
        <div className="pad-face">
          <button ref={bRef} className="pad-btn pad-face-b">B</button>
          <button ref={aRef} className="pad-btn pad-face-a">A</button>
        </div>
        <button ref={startRef} className="pad-btn pad-pill">START</button>
      </div>
    </>
  );
}
