import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CodexImageProvider } from "@impl/codex-image-provider";
import type { ImagePrompt } from "@core/providers/image";

type SpawnArgs = { cmd: string; args: readonly string[] };

interface FakeProcOptions {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  exitDelayMs?: number;
  /** If true, never exits (used for timeout test). */
  hang?: boolean;
  /** If set, emit an 'error' event with this code instead of normal lifecycle. */
  errorCode?: string;
}

function makeFakeProc(opts: FakeProcOptions): any {
  const proc: any = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killed = false;
  proc.kill = (_signal?: string) => {
    proc.killed = true;
    // Simulate the OS reaping the process after a kill.
    setImmediate(() => {
      proc.emit("close", null, "SIGTERM");
    });
    return true;
  };

  // Schedule the lifecycle on the next tick so callers can attach listeners.
  setImmediate(() => {
    if (opts.errorCode) {
      const err: NodeJS.ErrnoException = new Error(
        `spawn error: ${opts.errorCode}`
      );
      err.code = opts.errorCode;
      proc.emit("error", err);
      return;
    }

    if (opts.stdout) {
      proc.stdout.emit("data", Buffer.from(opts.stdout));
    }
    if (opts.stderr) {
      proc.stderr.emit("data", Buffer.from(opts.stderr));
    }

    if (opts.hang) return;

    const finalize = () => {
      proc.emit("close", opts.exitCode ?? 0, null);
    };
    if (opts.exitDelayMs && opts.exitDelayMs > 0) {
      setTimeout(finalize, opts.exitDelayMs);
    } else {
      setImmediate(finalize);
    }
  });

  return proc;
}

/**
 * Build a spawnImpl mock that returns specific fake processes per invocation.
 * Index 0 is the `--version` probe, indexes 1+ are real generation calls.
 */
function makeSpawnImpl(
  procs: Array<FakeProcOptions | ((args: SpawnArgs) => FakeProcOptions)>,
  log?: SpawnArgs[]
) {
  let i = 0;
  return ((cmd: string, args: readonly string[]) => {
    log?.push({ cmd, args: [...args] });
    const next = procs[i] ?? procs[procs.length - 1];
    i += 1;
    const opts =
      typeof next === "function" ? next({ cmd, args: [...args] }) : next;
    return makeFakeProc(opts) as any;
  }) as any;
}

const basePrompt: ImagePrompt = {
  text: "minimal abstract cover with lime accents",
  size: "1024x1536",
  quality: "high",
};

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-image-test-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

describe("CodexImageProvider", () => {
  it("happy path: parses Saved file line, verifies file, returns ImageAsset", async () => {
    const outDir = path.join(tmpRoot, "out");
    await fs.mkdir(outDir, { recursive: true });
    const savedPath = path.join(outDir, "page-02.png");
    // Pre-create the file the fake codex claims to have saved.
    await fs.writeFile(savedPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const log: SpawnArgs[] = [];
    const spawnImpl = makeSpawnImpl(
      [
        // --version probe
        { stdout: "codex 0.128.0\n", exitCode: 0 },
        // generate call
        {
          stdout: `Working...\nSaved file: \`${savedPath}\`\nDone.\n`,
          exitCode: 0,
        },
      ],
      log
    );

    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir,
      filename: "page-02",
      spawnImpl,
    });

    const asset = await provider.generate(basePrompt);

    expect(asset.path).toBe(savedPath);
    expect(asset.prompt).toEqual(basePrompt);
    expect(asset.providerMeta.provider).toBe("codex-image");
    expect(asset.providerMeta.model).toBe("gpt-image-2");
    expect(asset.providerMeta.codexExitCode).toBe(0);
    expect(typeof asset.providerMeta.stdoutTail).toBe("string");
    expect(typeof asset.createdAt).toBe("string");
    expect(() => new Date(asset.createdAt).toISOString()).not.toThrow();

    // First call should be --version, second should be `exec` with the right flags.
    expect(log.length).toBe(2);
    expect(log[0].args).toContain("--version");
    expect(log[1].args[0]).toBe("exec");
    expect(log[1].args).toContain("-C");
    expect(log[1].args).toContain(tmpRoot);
    expect(log[1].args).toContain("-s");
    expect(log[1].args).toContain("workspace-write");
    expect(log[1].args).toContain("--skip-git-repo-check");
    // The prompt string is one of the args; ensure it embeds size/prompt.
    const promptArg = log[1].args.find((a) => a.includes("Use the built-in image_gen tool"));
    expect(promptArg).toBeDefined();
    expect(promptArg).toContain("1024x1536");
    expect(promptArg).toContain(basePrompt.text);
  });

  it("codex CLI not on PATH (ENOENT) throws clear install hint", async () => {
    const spawnImpl = makeSpawnImpl([{ errorCode: "ENOENT" }]);
    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir: tmpRoot,
      spawnImpl,
    });

    await expect(provider.generate(basePrompt)).rejects.toThrow(
      /Codex CLI not on PATH/i
    );
  });

  it("times out and kills the process when exit never comes", async () => {
    const spawnImpl = makeSpawnImpl([
      { stdout: "codex 0.128.0\n", exitCode: 0 },
      { hang: true },
    ]);

    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir: tmpRoot,
      timeoutMs: 80,
      spawnImpl,
    });

    await expect(provider.generate(basePrompt)).rejects.toThrow(
      /timed out after \d+ms/i
    );
  });

  it("throws when no Saved file line is in stdout, includes snippet", async () => {
    const spawnImpl = makeSpawnImpl([
      { stdout: "codex 0.128.0\n", exitCode: 0 },
      { stdout: "Working... Done. (but no save line)\n", exitCode: 0 },
    ]);

    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir: tmpRoot,
      spawnImpl,
    });

    await expect(provider.generate(basePrompt)).rejects.toThrow(
      /did not produce a saved file path/i
    );
  });

  it("maps exit 1 + stderr 'OAuth' to a login-expired error", async () => {
    const spawnImpl = makeSpawnImpl([
      { stdout: "codex 0.128.0\n", exitCode: 0 },
      {
        stdout: "",
        stderr: "error: OAuth token expired, please re-login\n",
        exitCode: 1,
      },
    ]);

    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir: tmpRoot,
      spawnImpl,
    });

    await expect(provider.generate(basePrompt)).rejects.toThrow(
      /OAuth expired.*codex login/i
    );
  });

  it("maps exit 1 + stderr 'model' to a plan/model error", async () => {
    const spawnImpl = makeSpawnImpl([
      { stdout: "codex 0.128.0\n", exitCode: 0 },
      {
        stdout: "",
        stderr: "error: model gpt-image-2 not available on this account\n",
        exitCode: 1,
      },
    ]);

    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir: tmpRoot,
      spawnImpl,
    });

    await expect(provider.generate(basePrompt)).rejects.toThrow(
      /gpt-image-2.*OpenAI plan/i
    );
  });

  it("throws when Saved line points at a path that doesn't exist", async () => {
    const ghostPath = path.join(tmpRoot, "does-not-exist.png");
    const spawnImpl = makeSpawnImpl([
      { stdout: "codex 0.128.0\n", exitCode: 0 },
      {
        stdout: `Saved file: \`${ghostPath}\`\n`,
        exitCode: 0,
      },
    ]);

    const provider = new CodexImageProvider({
      repoRoot: tmpRoot,
      outDir: tmpRoot,
      spawnImpl,
    });

    await expect(provider.generate(basePrompt)).rejects.toThrow(
      /reported saving but file not found/i
    );
  });
});
