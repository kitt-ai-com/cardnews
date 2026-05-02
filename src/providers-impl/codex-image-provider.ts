import * as fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type {
  ImageAsset,
  ImagePrompt,
  ImageProvider,
} from "@core/providers/image";

export interface CodexImageProviderOptions {
  /** Project root passed to `codex exec -C`. */
  repoRoot?: string;
  /** Output directory for the final copied PNG. Caller decides. */
  outDir: string;
  /** Filename without extension. e.g. "page-02-skills". Default: codex-image-<timestamp>. */
  filename?: string;
  /** Path to the codex binary. Default: "codex" (PATH lookup). */
  codexBin?: string;
  /** Timeout per call. Default: 180000ms (3min). */
  timeoutMs?: number;
  /** Injection point for tests — replaces `spawn`. */
  spawnImpl?: typeof spawn;
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * CodexImageProvider drives the `codex exec` CLI to produce PNGs via the
 * built-in `image_gen` tool (gpt-image-2). Auth is handled by `codex login`,
 * not API keys.
 */
export class CodexImageProvider implements ImageProvider {
  readonly name = "codex-image";

  private readonly codexBin: string;
  private readonly timeoutMs: number;
  private readonly spawnImpl: typeof spawn;
  private versionChecked = false;

  constructor(private readonly opts: CodexImageProviderOptions) {
    this.codexBin = opts.codexBin ?? "codex";
    this.timeoutMs = opts.timeoutMs ?? 180_000;
    this.spawnImpl = opts.spawnImpl ?? spawn;
  }

  async generate(prompt: ImagePrompt): Promise<ImageAsset> {
    await this.ensureCodexAvailable();

    const filename =
      this.opts.filename ?? `codex-image-${Date.now()}`;
    const repoRoot = this.opts.repoRoot ?? process.cwd();
    const outDir = this.opts.outDir;
    const targetPath = `${outDir.replace(/\/+$/, "")}/${filename}.png`;

    const promptText = this.buildCodexPrompt(prompt, targetPath);

    const args = [
      "exec",
      promptText,
      "-C",
      repoRoot,
      "-s",
      "workspace-write",
      "-c",
      `model_reasoning_effort="medium"`,
      "--skip-git-repo-check",
    ];

    const result = await this.runCodex(args);

    if (result.timedOut) {
      throw new Error(
        `Codex image generation timed out after ${this.timeoutMs}ms — try lower quality.`
      );
    }

    if (result.exitCode !== 0) {
      const combined = `${result.stderr}\n${result.stdout}`;
      if (/oauth|login|auth/i.test(combined)) {
        throw new Error(
          "Codex OAuth expired. Run `codex login`."
        );
      }
      if (/model/i.test(combined)) {
        throw new Error(
          "Codex couldn't access gpt-image-2. Check OpenAI plan."
        );
      }
      throw new Error(
        `Codex exec failed (exit ${result.exitCode}). stderr: ${result.stderr.slice(-500)}`
      );
    }

    const savedPath = parseSavedFilePath(result.stdout);
    if (!savedPath) {
      throw new Error(
        `Codex did not produce a saved file path. stdout snippet: ${result.stdout.slice(-500)}`
      );
    }

    try {
      await fs.access(savedPath);
    } catch {
      throw new Error(
        `Codex reported saving but file not found: ${savedPath}`
      );
    }

    return {
      path: savedPath,
      prompt,
      providerMeta: {
        provider: "codex-image",
        model: "gpt-image-2",
        codexExitCode: result.exitCode,
        stdoutTail: result.stdout.slice(-500),
      },
      createdAt: new Date().toISOString(),
    };
  }

  private buildCodexPrompt(prompt: ImagePrompt, targetPath: string): string {
    const quality = prompt.quality ?? "auto";
    return [
      "Use the built-in image_gen tool to generate an image.",
      `Prompt: ${prompt.text}`,
      `Size: ${prompt.size}`,
      `Quality: ${quality}`,
      `Count: 1`,
      `After the image is generated, copy the file to ${targetPath} and print "Saved file: ${targetPath}" on its own line.`,
    ].join("\n");
  }

  private async ensureCodexAvailable(): Promise<void> {
    if (this.versionChecked) return;
    try {
      const result = await this.runRaw([this.codexBin, "--version"], {
        timeoutMs: 10_000,
      });
      if (result.exitCode !== 0) {
        throw new Error(
          "Codex CLI not on PATH (or not installed). Run `brew install codex` and `codex login`."
        );
      }
      this.versionChecked = true;
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        throw new Error(
          "Codex CLI not on PATH (or not installed). Run `brew install codex` and `codex login`."
        );
      }
      // Re-throw our own already-formatted error verbatim.
      if (err instanceof Error && /Codex CLI not on PATH/.test(err.message)) {
        throw err;
      }
      throw new Error(
        `Codex CLI not on PATH (or not installed). Run \`brew install codex\` and \`codex login\`. (${
          (err as Error)?.message ?? String(err)
        })`
      );
    }
  }

  private async runCodex(args: string[]): Promise<SpawnResult> {
    return this.runRaw([this.codexBin, ...args], {
      timeoutMs: this.timeoutMs,
    });
  }

  private runRaw(
    cmdAndArgs: string[],
    opts: { timeoutMs: number }
  ): Promise<SpawnResult> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = cmdAndArgs;
      let proc: ReturnType<typeof spawn>;
      try {
        proc = this.spawnImpl(cmd, args);
      } catch (err) {
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const settle = (result: SpawnResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      };

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill("SIGTERM");
        } catch {
          // ignore
        }
        // Give the child a moment to die; force-resolve as timeout regardless.
        setTimeout(() => {
          settle({ stdout, stderr, exitCode: null, timedOut: true });
        }, 50);
      }, opts.timeoutMs);

      proc.stdout?.on("data", (chunk: Buffer | string) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      });
      proc.stderr?.on("data", (chunk: Buffer | string) => {
        stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      });

      proc.on("error", (err: NodeJS.ErrnoException) => {
        fail(err);
      });

      proc.on("close", (code: number | null) => {
        if (timedOut) {
          settle({ stdout, stderr, exitCode: code, timedOut: true });
          return;
        }
        settle({ stdout, stderr, exitCode: code, timedOut: false });
      });
    });
  }
}

const SAVED_FILE_RE = /Saved file:\s*`?(\/[^`\s][^\n`]*?\.png)`?/;

function parseSavedFilePath(stdout: string): string | null {
  const m = stdout.match(SAVED_FILE_RE);
  return m ? m[1].trim() : null;
}
