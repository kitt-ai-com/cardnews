import { describe, expect, it, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FileSeriesRegistry } from "@core/registry/series";

const REAL_DATA = path.resolve("data");

async function mktmp(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-series-"));
}

async function writeSeries(root: string, id: string, body: unknown) {
  const dir = path.join(root, "series", id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "series.json"), JSON.stringify(body));
}

describe("FileSeriesRegistry", () => {
  it("loads the seeded 'claude' series and validates against SeriesSchema", async () => {
    const reg = new FileSeriesRegistry(REAL_DATA);
    const out = await reg.load("claude");
    expect(out.id).toBe("claude");
    expect(out.defaultPreset).toBe("c1-dark-lime");
    // zod defaults applied:
    expect(out.imageProvider).toBe("codex-image");
    expect(Array.isArray(out.trustedDomains)).toBe(true);
  });

  it("has() returns true for existing series, false for missing", async () => {
    const reg = new FileSeriesRegistry(REAL_DATA);
    expect(await reg.has("claude")).toBe(true);
    expect(await reg.has("does-not-exist")).toBe(false);
  });

  it("caches load() results — second call does not hit fs", async () => {
    const tmp = await mktmp();
    await writeSeries(tmp, "x", {
      id: "x",
      name: "X",
      theme: "T",
      defaultPreset: "p",
      audience: "a",
      tone: "t",
      branding: { seriesTag: "X" },
      footerHandle: "@x",
    });
    const reg = new FileSeriesRegistry(tmp);
    const first = await reg.load("x");
    // mutate file so a fresh read would change the result
    await fs.writeFile(
      path.join(tmp, "series", "x", "series.json"),
      JSON.stringify({ ...first, name: "MUTATED" })
    );
    const second = await reg.load("x");
    expect(second.name).toBe("X"); // served from cache
    reg.clearCache();
    const third = await reg.load("x");
    expect(third.name).toBe("MUTATED"); // re-read after clear
  });

  it("throws a helpful error including the path on missing id", async () => {
    const reg = new FileSeriesRegistry(REAL_DATA);
    await expect(reg.load("nope-nope")).rejects.toThrow(/Series not found.*nope-nope/);
    await expect(reg.load("nope-nope")).rejects.toThrow(/series\.json/);
  });

  it("throws when the JSON is schema-invalid", async () => {
    const tmp = await mktmp();
    await writeSeries(tmp, "bad", { id: "bad" }); // missing required fields
    const reg = new FileSeriesRegistry(tmp);
    await expect(reg.load("bad")).rejects.toThrow();
  });
});
