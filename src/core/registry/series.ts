import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SeriesSchema, type Series } from "../schemas/series";

export interface SeriesRegistry {
  load(id: string): Promise<Series>;
  has(id: string): Promise<boolean>;
  clearCache(): void;
}

export class FileSeriesRegistry implements SeriesRegistry {
  private cache = new Map<string, Series>();

  constructor(private rootDir: string) {}

  async load(id: string): Promise<Series> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const file = path.join(this.rootDir, "series", id, "series.json");
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Series not found: '${id}' (looked at ${file})`);
      }
      throw err;
    }

    const parsed = SeriesSchema.parse(JSON.parse(raw));
    this.cache.set(id, parsed);
    return parsed;
  }

  async has(id: string): Promise<boolean> {
    try {
      await this.load(id);
      return true;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
