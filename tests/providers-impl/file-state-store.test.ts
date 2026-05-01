import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FileStateStore } from "@impl/file-state-store";
import type { Card } from "@core/schemas/card";
import type { Page } from "@core/schemas/page";

function makePage(
  index: number,
  role: "cover" | "body" | "cta",
  layout: "cover" | "cta" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7"
): Page {
  return {
    index,
    role,
    layout,
    message: `m${index}`,
    mappingNote: `n${index}`,
    copy: { title: `T${index}` },
    manualEdit: false,
  };
}

function makeCard(id = "card-1"): Card {
  return {
    id,
    series: "claude",
    preset: "c1-dark-lime",
    topic: "test",
    sourcePolicy: { trustLevel: "unknown", factCheckMode: "strict" },
    coreMessage: "core",
    pages: [
      makePage(1, "cover", "cover"),
      makePage(2, "body", "P1"),
      makePage(3, "body", "P2"),
      makePage(4, "cta", "cta"),
    ],
    status: "draft.outline-ready",
    attempts: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  } as Card;
}

describe("FileStateStore", () => {
  let rootDir: string;
  let store: FileStateStore;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "cardnews-state-"));
    store = new FileStateStore(rootDir);
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("returns null when no state file exists", async () => {
    const result = await store.read("missing");
    expect(result).toBeNull();
  });

  it("round-trips a valid Card via write then read", async () => {
    const card = makeCard("rt-1");
    await store.write(card.id, card);
    const result = await store.read(card.id);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("rt-1");
    expect(result?.pages.length).toBe(4);
  });

  it("survives 50 interleaved write/read tasks", async () => {
    const card = makeCard("conc-1");
    await store.write(card.id, card);

    const tasks: Promise<unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        const c: Card = { ...card, coreMessage: `core-${i}` };
        tasks.push(store.write(card.id, c));
      } else {
        tasks.push(
          store.read(card.id).then((r) => {
            // Reader either gets null or a fully-valid card; never throws on partial JSON
            if (r !== null) {
              expect(r.id).toBe("conc-1");
            }
          })
        );
      }
    }
    await Promise.all(tasks);

    const final = await store.read(card.id);
    expect(final).not.toBeNull();
    expect(final?.id).toBe("conc-1");
  });

  it("serializes operations under withLock (5 parallel withLock tasks)", async () => {
    const card = makeCard("lock-1");
    await store.write(card.id, card);

    const order: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const tasks = Array.from({ length: 5 }, (_, i) =>
      store.withLock(card.id, async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const cur = await store.read(card.id);
        await new Promise((r) => setTimeout(r, 5));
        const next: Card = {
          ...(cur as Card),
          coreMessage: `core-${i}`,
        };
        await store.write(card.id, next);
        order.push(i);
        inFlight--;
      })
    );

    await Promise.all(tasks);

    expect(order.length).toBe(5);
    expect(maxInFlight).toBe(1);
  });

  it("leaves no temp files behind after write", async () => {
    const card = makeCard("temp-1");
    await store.write(card.id, card);
    const dir = path.join(rootDir, card.id);
    const entries = await fs.readdir(dir);
    const temp = entries.filter((e) => e.startsWith("state.json.tmp"));
    expect(temp).toEqual([]);
  });
});
