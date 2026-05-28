import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLongPress } from "./useLongPress";

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires the handler after the hold duration", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useLongPress(handler, 500));
    act(() => { result.current.onPointerDown({ pointerId: 1 } as any); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire if released before the duration", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useLongPress(handler, 500));
    act(() => { result.current.onPointerDown({ pointerId: 1 } as any); });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { result.current.onPointerUp({ pointerId: 1 } as any); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(handler).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useLongPress(handler, 500));
    act(() => { result.current.onPointerDown({ pointerId: 1 } as any); });
    act(() => { result.current.onPointerCancel({ pointerId: 1 } as any); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(handler).not.toHaveBeenCalled();
  });
});
