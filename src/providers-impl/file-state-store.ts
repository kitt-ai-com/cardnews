import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { StateStore } from "@core/providers/state";
import { CardSchema, type Card } from "@core/schemas/card";

const LOCK_TIMEOUT_MS = 30_000;
const LOCK_STALE_MS = 30_000;
const LOCK_POLL_MS = 25;

export class FileStateStore implements StateStore {
  constructor(private readonly rootDir: string) {}

  private cardDir(cardId: string): string {
    return path.join(this.rootDir, cardId);
  }

  private statePath(cardId: string): string {
    return path.join(this.cardDir(cardId), "state.json");
  }

  private lockPath(cardId: string): string {
    return path.join(this.cardDir(cardId), "state.lock");
  }

  async read(cardId: string): Promise<Card | null> {
    const file = this.statePath(cardId);
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    const parsed = JSON.parse(raw);
    return CardSchema.parse(parsed);
  }

  async write(cardId: string, card: Card): Promise<void> {
    // Validate first — reject malformed mutations early.
    CardSchema.parse(card);

    const dir = this.cardDir(cardId);
    await fs.mkdir(dir, { recursive: true });

    const target = this.statePath(cardId);
    const tmp = path.join(
      dir,
      `state.json.tmp.${process.pid}.${Date.now()}.${Math.random()
        .toString(36)
        .slice(2, 10)}`
    );

    const payload = JSON.stringify(card, null, 2);

    const fh = await fs.open(tmp, "wx");
    try {
      await fh.writeFile(payload, "utf8");
      await fh.sync();
    } finally {
      await fh.close();
    }

    try {
      await fs.rename(tmp, target);
    } catch (err) {
      // Best-effort cleanup of the tmp file if rename fails.
      try {
        await fs.unlink(tmp);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  async withLock<T>(cardId: string, fn: () => Promise<T>): Promise<T> {
    const dir = this.cardDir(cardId);
    await fs.mkdir(dir, { recursive: true });

    const lockFile = this.lockPath(cardId);
    const start = Date.now();

    while (true) {
      try {
        const fh = await fs.open(lockFile, "wx");
        try {
          await fh.writeFile(
            JSON.stringify({ pid: process.pid, t: Date.now() }),
            "utf8"
          );
          await fh.sync();
        } finally {
          await fh.close();
        }
        break;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") throw err;

        // Stale lock recovery
        try {
          const stat = await fs.stat(lockFile);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            try {
              await fs.unlink(lockFile);
            } catch {
              // ignore — someone else may have cleaned it
            }
            continue;
          }
        } catch {
          // file vanished between EEXIST and stat — retry immediately
          continue;
        }

        if (Date.now() - start > LOCK_TIMEOUT_MS) {
          throw new Error(
            `FileStateStore: timed out acquiring lock for cardId=${cardId} after ${LOCK_TIMEOUT_MS}ms`
          );
        }

        await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
      }
    }

    try {
      return await fn();
    } finally {
      try {
        await fs.unlink(lockFile);
      } catch {
        // ignore
      }
    }
  }
}
