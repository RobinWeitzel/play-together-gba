import { describe, it, expect } from "vitest";
import { DEFAULT_PORTRAIT, DEFAULT_LANDSCAPE, DEFAULT_BUTTON_LAYOUT, clampToSafeArea } from "./buttonLayout";

describe("DEFAULT_BUTTON_LAYOUT", () => {
  it("contains all 7 GBA buttons in both orientations", () => {
    const ids = ["dpad", "a", "b", "l", "r", "start", "select"];
    for (const id of ids) {
      expect(DEFAULT_PORTRAIT.buttons[id as keyof typeof DEFAULT_PORTRAIT.buttons]).toBeDefined();
      expect(DEFAULT_LANDSCAPE.buttons[id as keyof typeof DEFAULT_LANDSCAPE.buttons]).toBeDefined();
    }
  });
  it("opacity is between 0.3 and 1.0", () => {
    expect(DEFAULT_PORTRAIT.opacity).toBeGreaterThanOrEqual(0.3);
    expect(DEFAULT_LANDSCAPE.opacity).toBeLessThanOrEqual(1.0);
  });
  it("schemaVersion is 1", () => {
    expect(DEFAULT_BUTTON_LAYOUT.schemaVersion).toBe(1);
  });
});

describe("clampToSafeArea", () => {
  it("clamps x and y inside [0,100]", () => {
    const clamped = clampToSafeArea({ x: 105, y: -5, size: 1 }, { top: 0, bottom: 0, left: 0, right: 0 });
    expect(clamped.x).toBeLessThanOrEqual(100);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
  });
});
