import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FilePresetRegistry } from "@core/registry/preset";

const REAL_DATA = path.resolve("data");

async function mktmp(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-preset-"));
}

const sampleVariant = (id: string, accent = "#c4ff3d") => ({
  id,
  name: id,
  base: "C-dark-modern",
  canvas: { width: 1080, height: 1350 },
  colors: {
    background: "#0e0e10",
    text: "#ffffff",
    accent,
    muted: "rgba(255,255,255,0.55)",
  },
  typography: {
    fontFamily: ["Pretendard", "sans-serif"],
    title: { size: 64, weight: 900, lineHeight: 1.15, letterSpacing: -0.02 },
    body: { size: 34, weight: 400, lineHeight: 1.5, letterSpacing: -0.02 },
    label: { size: 24, weight: 700, lineHeight: 1.2, letterSpacing: 0.075 },
    hierarchyRatio: 1.5,
  },
  spacing: {
    safeZone: { top: 60, right: 48, bottom: 60, left: 48 },
    verticalBands: { header: 0.15, body: 0.7, footer: 0.15 },
    contentRatio: 0.75,
  },
  layouts: ["cover", "cta", "P1"],
  imageStyle: "test image style",
});

async function writePreset(root: string, kind: "base" | "variants", id: string, body: unknown) {
  const dir = path.join(root, "presets", kind);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(body));
}

describe("FilePresetRegistry", () => {
  it("loads a variant preset (c1-dark-lime) from the real seed data", async () => {
    const reg = new FilePresetRegistry(REAL_DATA);
    const out = await reg.load("c1-dark-lime");
    expect(out.id).toBe("c1-dark-lime");
    expect(out.colors.accent).toBe("#c4ff3d");
    expect(out.layouts).toContain("P6");
  });

  it("loads a base preset (C-dark-modern) from the real seed data", async () => {
    const reg = new FilePresetRegistry(REAL_DATA);
    const out = await reg.load("C-dark-modern");
    expect(out.id).toBe("C-dark-modern");
  });

  it("variants take priority over base when both define the same id", async () => {
    const tmp = await mktmp();
    await writePreset(tmp, "base", "shared", { ...sampleVariant("shared", "#000000") });
    await writePreset(tmp, "variants", "shared", { ...sampleVariant("shared", "#ffffff") });
    const reg = new FilePresetRegistry(tmp);
    const out = await reg.load("shared");
    expect(out.colors.accent).toBe("#ffffff");
  });

  it("falls back to base when no variant exists", async () => {
    const tmp = await mktmp();
    await writePreset(tmp, "base", "only-base", sampleVariant("only-base", "#abc123"));
    const reg = new FilePresetRegistry(tmp);
    const out = await reg.load("only-base");
    expect(out.colors.accent).toBe("#abc123");
  });

  it("throws helpful error on unknown id", async () => {
    const reg = new FilePresetRegistry(REAL_DATA);
    await expect(reg.load("does-not-exist")).rejects.toThrow(/Preset not found.*does-not-exist/);
  });

  it("caches load() results — second call does not hit fs", async () => {
    const tmp = await mktmp();
    const id = "cached";
    await writePreset(tmp, "variants", id, sampleVariant(id, "#111111"));
    const reg = new FilePresetRegistry(tmp);
    const first = await reg.load(id);
    expect(first.colors.accent).toBe("#111111");
    // mutate file
    await writePreset(tmp, "variants", id, sampleVariant(id, "#222222"));
    const second = await reg.load(id);
    expect(second.colors.accent).toBe("#111111"); // cached
    reg.clearCache();
    const third = await reg.load(id);
    expect(third.colors.accent).toBe("#222222");
  });

  it("throws when the JSON is schema-invalid", async () => {
    const tmp = await mktmp();
    await writePreset(tmp, "variants", "bad", { id: "bad" });
    const reg = new FilePresetRegistry(tmp);
    await expect(reg.load("bad")).rejects.toThrow();
  });
});
