import { describe, it, expect, beforeEach } from "vitest";
import {
  loadGlobal, saveGlobal,
  loadRom, saveRom, clearRom,
  resolveSettings,
  listRomOverrides,
  DEFAULT_SETTINGS,
} from "./settings";

describe("settings storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns DEFAULT_SETTINGS when global is empty", () => {
    expect(loadGlobal()).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates legacy settings.controlLayout into settings.global on first read", () => {
    localStorage.setItem("settings.controlLayout", "overlay");
    const g = loadGlobal();
    expect(g.controlLayout).toBe("overlay");
    // Legacy key removed.
    expect(localStorage.getItem("settings.controlLayout")).toBeNull();
    // New key written.
    expect(JSON.parse(localStorage.getItem("settings.global")!).controlLayout).toBe("overlay");
  });

  it("saveGlobal persists and loadGlobal reads back", () => {
    saveGlobal({ ...DEFAULT_SETTINGS, haptics: "strong" });
    expect(loadGlobal().haptics).toBe("strong");
  });

  it("loadRom returns empty object when no override exists", () => {
    expect(loadRom("emerald.gba")).toEqual({});
  });

  it("saveRom only persists explicitly set keys", () => {
    saveRom("emerald.gba", { speedDefault: 2 });
    expect(loadRom("emerald.gba")).toEqual({ speedDefault: 2 });
  });

  it("clearRom removes the per-rom entry", () => {
    saveRom("emerald.gba", { speedDefault: 2 });
    clearRom("emerald.gba");
    expect(loadRom("emerald.gba")).toEqual({});
    expect(localStorage.getItem("settings.rom.emerald.gba")).toBeNull();
  });

  it("resolveSettings cascades rom > global > defaults", () => {
    saveGlobal({ ...DEFAULT_SETTINGS, controlLayout: "stacked", haptics: "off" });
    saveRom("emerald.gba", { controlLayout: "overlay" });
    const r = resolveSettings("emerald.gba");
    expect(r.controlLayout).toBe("overlay");  // from per-rom
    expect(r.haptics).toBe("off");            // from global
  });

  it("resolveSettings uses defaults when given a null romId", () => {
    saveGlobal({ ...DEFAULT_SETTINGS, controlLayout: "flanking" });
    const r = resolveSettings(null);
    expect(r.controlLayout).toBe("flanking");
  });

  it("listRomOverrides returns rom ids with stored overrides", () => {
    saveRom("emerald.gba", { speedDefault: 2 });
    saveRom("zelda.gba", { startMuted: false });
    const ids = listRomOverrides();
    expect(ids.sort()).toEqual(["emerald.gba", "zelda.gba"]);
  });
});
