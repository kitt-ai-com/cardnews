import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PresetSchema, type Preset } from "../schemas/preset";

export interface PresetRegistry {
  load(id: string): Promise<Preset>;
  clearCache(): void;
}

/**
 * File-backed PresetRegistry.
 *
 * Resolution order (variants take priority over base):
 *   1. <rootDir>/presets/variants/<id>.json
 *   2. <rootDir>/presets/base/<id>.json
 */
export class FilePresetRegistry implements PresetRegistry {
  private cache = new Map<string, Preset>();

  constructor(private rootDir: string) {}

  async load(id: string): Promise<Preset> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const candidates = [
      path.join(this.rootDir, "presets", "variants", `${id}.json`),
      path.join(this.rootDir, "presets", "base", `${id}.json`),
    ];

    for (const file of candidates) {
      let raw: string;
      try {
        raw = await fs.readFile(file, "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw err;
      }
      const parsed = PresetSchema.parse(JSON.parse(raw));
      this.cache.set(id, parsed);
      return parsed;
    }

    throw new Error(
      `Preset not found: '${id}' (looked in variants/ and base/ under ${path.join(this.rootDir, "presets")})`
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}
