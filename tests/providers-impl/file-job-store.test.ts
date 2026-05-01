import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FileJobStore } from "@impl/file-job-store";
import type { Job, JobState } from "@core/providers/job";

describe("FileJobStore", () => {
  let rootDir: string;
  let store: FileJobStore;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-job-"));
    store = new FileJobStore(rootDir);
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  function makeJob(jobId = "job-1"): Job {
    return {
      jobId,
      cardId: "card-1",
      createdAt: "2026-05-01T00:00:00.000Z",
    };
  }

  it("enqueue + update + get round-trip", async () => {
    const job = makeJob();
    await store.enqueue(job);
    await store.update(job.jobId, {
      status: "draft.writing",
      updatedAt: "2026-05-01T00:01:00.000Z",
    });
    const got = await store.get(job.jobId);
    expect(got).not.toBeNull();
    expect(got?.status).toBe("draft.writing");
    expect(got?.cardId).toBe("card-1");
  });

  it("update merges patches across multiple calls", async () => {
    const job = makeJob("merge-1");
    await store.enqueue(job);
    await store.update(job.jobId, { status: "draft.writing" });
    await store.update(job.jobId, { status: "draft.imaging" });
    const got = await store.get(job.jobId);
    expect(got?.status).toBe("draft.imaging");
    expect(got?.cardId).toBe("card-1"); // preserved
  });

  it("subscribe is fired on update; unsubscribe stops further notifications", async () => {
    const job = makeJob("sub-1");
    await store.enqueue(job);

    const seen: JobState[] = [];
    const unsubscribe = store.subscribe(job.jobId, (s) => {
      seen.push(s);
    });

    await store.update(job.jobId, { status: "draft.writing" });
    expect(seen.length).toBe(1);
    expect(seen[0].status).toBe("draft.writing");

    unsubscribe();
    await store.update(job.jobId, { status: "draft.imaging" });
    expect(seen.length).toBe(1); // no new notification
  });

  it("get returns null for unknown jobId", async () => {
    const got = await store.get("does-not-exist");
    expect(got).toBeNull();
  });

  it("a fresh instance can read jobs persisted by an earlier instance", async () => {
    const job = makeJob("persist-1");
    await store.enqueue(job);
    await store.update(job.jobId, { status: "draft.writing" });

    const fresh = new FileJobStore(rootDir);
    const got = await fresh.get(job.jobId);
    expect(got).not.toBeNull();
    expect(got?.status).toBe("draft.writing");
    expect(got?.cardId).toBe("card-1");
  });
});
