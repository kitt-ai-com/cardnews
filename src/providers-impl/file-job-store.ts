import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  Job,
  JobId,
  JobState,
  JobStore,
  Unsubscribe,
} from "@core/providers/job";

type Listener = (state: JobState) => void;

export class FileJobStore implements JobStore {
  private readonly memory = new Map<JobId, JobState>();
  private readonly listeners = new Map<JobId, Set<Listener>>();

  constructor(private readonly rootDir: string) {}

  private filePath(jobId: JobId): string {
    return path.join(this.rootDir, `${jobId}.json`);
  }

  private async writeAtomic(jobId: JobId, state: JobState): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
    const target = this.filePath(jobId);
    const tmp = path.join(
      this.rootDir,
      `${jobId}.json.tmp.${process.pid}.${Date.now()}.${Math.random()
        .toString(36)
        .slice(2, 10)}`
    );

    const payload = JSON.stringify(state, null, 2);
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
      try {
        await fs.unlink(tmp);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  private async loadFromDisk(jobId: JobId): Promise<JobState | null> {
    try {
      const raw = await fs.readFile(this.filePath(jobId), "utf8");
      return JSON.parse(raw) as JobState;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async enqueue(job: Job): Promise<JobId> {
    const initial: JobState = {
      jobId: job.jobId,
      cardId: job.cardId,
      status: "draft.analyzing",
      updatedAt: job.createdAt,
    };
    this.memory.set(job.jobId, initial);
    await this.writeAtomic(job.jobId, initial);
    return job.jobId;
  }

  async update(jobId: JobId, patch: Partial<JobState>): Promise<void> {
    let cur = this.memory.get(jobId);
    if (!cur) {
      const fromDisk = await this.loadFromDisk(jobId);
      if (!fromDisk) {
        throw new Error(`FileJobStore: unknown jobId=${jobId}`);
      }
      cur = fromDisk;
      this.memory.set(jobId, cur);
    }

    const next: JobState = { ...cur, ...patch };
    this.memory.set(jobId, next);
    await this.writeAtomic(jobId, next);

    const subs = this.listeners.get(jobId);
    if (subs) {
      for (const fn of subs) {
        try {
          fn(next);
        } catch {
          // listener errors should not break the store
        }
      }
    }
  }

  async get(jobId: JobId): Promise<JobState | null> {
    const inMem = this.memory.get(jobId);
    if (inMem) return inMem;
    const fromDisk = await this.loadFromDisk(jobId);
    if (fromDisk) {
      this.memory.set(jobId, fromDisk);
      return fromDisk;
    }
    return null;
  }

  subscribe(jobId: JobId, fn: Listener): Unsubscribe {
    let set = this.listeners.get(jobId);
    if (!set) {
      set = new Set();
      this.listeners.set(jobId, set);
    }
    set.add(fn);
    return () => {
      const cur = this.listeners.get(jobId);
      if (!cur) return;
      cur.delete(fn);
      if (cur.size === 0) this.listeners.delete(jobId);
    };
  }
}
