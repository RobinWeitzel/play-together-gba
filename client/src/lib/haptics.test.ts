import { describe, it, expect, vi, beforeEach } from "vitest";
import { vibrate, type HapticsMode } from "./haptics";

describe("vibrate", () => {
  beforeEach(() => {
    (navigator as any).vibrate = vi.fn();
  });

  it("does not call vibrate when mode is 'off'", () => {
    vibrate("off", "tap");
    expect((navigator as any).vibrate).not.toHaveBeenCalled();
  });

  it("calls vibrate(8) for 'light' mode on a tap", () => {
    vibrate("light", "tap");
    expect((navigator as any).vibrate).toHaveBeenCalledWith(8);
  });

  it("calls vibrate(15) for 'strong' mode on a tap", () => {
    vibrate("strong", "tap");
    expect((navigator as any).vibrate).toHaveBeenCalledWith(15);
  });

  it("calls vibrate(20) for 'strong' mode on a 'success' event", () => {
    vibrate("strong", "success");
    expect((navigator as any).vibrate).toHaveBeenCalledWith(20);
  });

  it("no-ops gracefully when navigator.vibrate is undefined", () => {
    (navigator as any).vibrate = undefined;
    expect(() => vibrate("light", "tap")).not.toThrow();
  });
});
