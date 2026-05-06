# Codex LLM Fallback — Dual Backend Design

**Date:** 2026-05-07
**Owner:** kitt.ai.ceo@gmail.com
**Status:** Draft (awaiting implementation plan)

## Motivation

m2 파이프라인은 현재 `@anthropic-ai/sdk`를 통해 Claude Opus 4.7 만 호출한다. 사용 중 `ANTHROPIC_API_KEY`의 크레딧 잔액 소진(`credit_balance_too_low`) 으로 파이프라인이 즉시 멈추는 상황이 발생했다. 사용자는 Codex CLI(ChatGPT OAuth) 가 이미 설치·로그인된 환경을 갖고 있으므로, **Anthropic 크레딧이 없을 때 Codex 로 자동 폴백**하는 듀얼 백엔드 구조를 도입한다.

## Goals

1. Anthropic 크레딧이 있을 때는 기존 동작과 100% 동일 (Claude Opus 4.7 사용, voice 유지).
2. `credit_balance_too_low` 발생 시 같은 파이프라인 안에서 즉시 Codex 로 전환, 사용자 개입 없이 카드뉴스 생성 완료.
3. `ANTHROPIC_API_KEY` 미설정 또는 잔액 0 상태에서도 Codex 만으로 풀 파이프라인 동작.
4. 기존 4개 에이전트(analyst·copywriter·fact-checker·image-director) 의 `AgentPort<I,O>` 계약과 zod 검증·token 로깅·재시도 흐름을 그대로 유지.

## Non-Goals

- Anthropic API 의존성 자체 제거(코드는 남기고 사용 가능 상태 유지).
- 자동 폴백 발동 시 결과물의 voice 일관성 보정 — 별도 작업으로 분리.
- 호출자(스크립트) 측 명시적 백엔드 선택 플래그(`--llm codex|claude`) — 자동 폴백만 다룬다.
- 토큰 사용량을 Anthropic 응답 형식과 동일하게 정확히 매핑 — Codex 측 best-effort 로깅만.

## Architecture Overview

```
m2-first-v2.ts
        │ (analyst / copywriter / fact-checker / image-director — 4개)
        ▼
makeDualAgentRunner()                    (신규)
        │
        ├─ Claude runner   (기본, 기존 코드 그대로)
        │      └─ ANTHROPIC_API_KEY → @anthropic-ai/sdk
        │
        ├─ Codex runner    (신규)
        │      └─ codex exec subprocess
        │
        └─ 공유 latch  { tripped: boolean; reason?: string }
              · tripped=false  → Claude 호출
              · tripped=true   → Codex 직접 호출
              · 첫 credit_balance_too_low 가 latch flip
              · 4개 dual runner 가 같은 latch 객체 공유
```

**핵심 invariant:** 한 파이프라인 = 하나의 latch 인스턴스. 4개 에이전트가 latch 객체를 공유하므로 첫 폴백 트리거 이후 남은 호출은 Anthropic 을 다시 두드리지 않고 Codex 로 직행. 낭비된 Anthropic 호출은 파이프라인당 최대 1회.

## Files

| 파일 | 변경 종류 | 책임 |
|---|---|---|
| `src/integrations/llm/codex-agent-runner.ts` | 신규 | codex CLI subprocess 호출 + zod 검증 + AgentPort 반환 |
| `src/integrations/llm/dual-agent-runner.ts` | 신규 | claude/codex runner 합성 + 공유 latch |
| `src/integrations/llm/index.ts` | 수정 | `makeCodexAgentRunner`, `makeDualAgentRunner`, `FallbackLatch` export |
| `scripts/m2-first-v2.ts` | 수정 | 4개 runner 를 dual runner 로 wrap, 공유 latch 주입 |
| `tests/integrations/llm/codex-agent-runner.test.ts` | 신규 | unit tests |
| `tests/integrations/llm/dual-agent-runner.test.ts` | 신규 | unit tests |
| `src/integrations/llm/claude-agent-runner.ts` | 소폭 수정 | (1) `ANTHROPIC_API_KEY` 부재 검증을 lazy 로 (생성 → 첫 `.run()` 호출 시점). (2) token log 행에 `backend: "claude"` 필드 추가. credit error 를 그대로 throw 하는 책임은 유지 |
| `src/integrations/llm/util.ts` | 신규 | `stripMarkdownFences()` 를 분리 — claude/codex runner 가 공유 |

## Component 1 — Codex Agent Runner

### Public API

```ts
export interface CodexAgentRunnerConfig<I, O> {
  contract: AgentContract<I, O>;
  name: string;                        // "analyst" | "copywriter" | ...
  model?: string;                      // 환경변수 CARDNEWS_CODEX_MODEL 우선, 둘 다 없으면 codex 기본값
  codexBin?: string;                   // 기본 "codex" (PATH 검색)
  maxRetries?: number;                 // 기본 1 (codex 호출은 비싸지 않으니 단순)
  tokenLogPath?: string;               // 기존 Claude runner 와 동일
  spawnFn?: typeof import("node:child_process").spawn;  // 테스트용 주입
  loadSystemPrompt?: (path: string) => Promise<string>; // 테스트용 주입
}

export function makeCodexAgentRunner<I, O>(
  config: CodexAgentRunnerConfig<I, O>
): AgentPort<I, O>;
```

### Spawn 명령

```
codex exec \
  --json \
  --skip-git-repo-check \
  --ephemeral \
  -s read-only \
  --output-last-message <tmpfile> \
  -            # prompt via stdin
```

플래그별 이유:

| 플래그 | 이유 |
|---|---|
| `--json` | 이벤트 stream — token usage 추출 시도 |
| `--ephemeral` | session 파일 안 남김, 격리 보장 |
| `--skip-git-repo-check` | cardnews 워크스페이스가 git 레포 아닐 수 있음 |
| `-s read-only` | codex 가 파일 쓰기·shell 명령 실행 못 하게 봉쇄 (LLM 응답만 필요) |
| `--output-last-message` | 최종 텍스트를 파일로 회수 — stdout JSON 이벤트 파싱 의존도 ↓ |
| `-` (stdin) | prompt 본문은 stdin 으로 (긴 system prompt 안전) |

`--cd` 는 지정하지 않는다(cwd 그대로).

### Prompt 합성

Claude runner 의 system blocks 2개를 단순 concat:

```
<systemPrompt 본문>

Here is the input to process:
```json
<JSON.stringify(validatedInput)>
```

Return ONLY a JSON object matching the output schema.
```

System prompt 는 `loadSystemPrompt(contract.systemPromptPath, { repoRoot })` 로 기존과 동일 경로/캐시 사용.

### 응답 처리

1. spawn 종료 (exit 0) 후 `<tmpfile>` 읽기
2. `stripMarkdownFences()` (`claude-agent-runner.ts` 의 함수 재사용 — `src/integrations/llm/util.ts` 로 추출)
3. `JSON.parse`
4. `contract.outputSchema.parse(parsed)`
5. 성공 시 `<tmpfile>` 삭제, 실패 시도 마찬가지로 cleanup

### Token 로깅

`--json` 이벤트 중 `token_count` / `usage` 비슷한 필드가 있으면 추출. 없으면 다음 형태로만 기록:

```json
{
  "agent": "<name>",
  "ts": "...",
  "model": "codex:<resolved-model-or-default>",
  "attempt": <n>,
  "input_tokens": null,
  "output_tokens": null,
  "cache_read": 0,
  "cache_create": 0,
  "backend": "codex"
}
```

Anthropic 호출 시에도 `backend: "claude"` 필드를 추가해 구분 가능하게 한다(claude runner 의 logTokenUsage 한 줄 수정).

### 에러 처리

| 상황 | 동작 |
|---|---|
| codex spawn 실패 (ENOENT) | `Error("codex CLI not found. Install via brew install codex")` 즉시 throw |
| codex 비정상 종료 (exit ≠ 0) | stderr 마지막 ~500자 캡처 → `Error("Codex CLI failed: ...")` |
| `<tmpfile>` 빈 파일 / 없음 | `Error("Codex returned empty response")` |
| JSON parse 실패 | `Error("Failed to parse JSON: ... Snippet: ...")` (Claude runner 와 동일 메시지 포맷) |
| zod 검증 실패 | zod 에러 그대로 throw |
| `maxRetries > 1` 인 경우 | JSON parse / zod 실패만 재시도, spawn 실패 / 비정상 종료는 즉시 throw |

## Component 2 — Dual Agent Runner

### Public API

```ts
export interface FallbackLatch {
  tripped: boolean;
  reason?: string;
  trippedAt?: string;          // ISO timestamp
}

export interface DualAgentRunnerConfig<I, O> {
  claude: AgentPort<I, O>;
  codex: AgentPort<I, O>;
  latch: FallbackLatch;
  onSwitch?: (info: { agent: string; reason: string }) => void;  // 기본: console.error
}

export function makeDualAgentRunner<I, O>(
  config: DualAgentRunnerConfig<I, O>
): AgentPort<I, O>;
```

### 동작

```
run(input):
  if (latch.tripped):
    return codex.run(input)

  try:
    return await claude.run(input)
  catch (err):
    if (isCreditExhausted(err)):
      latch.tripped = true
      latch.reason  = err.message
      latch.trippedAt = new Date().toISOString()
      onSwitch({ agent: claude.name, reason: latch.reason })
      return codex.run(input)
    throw err

isCreditExhausted(err):
  msg = (err.message ?? "") .toLowerCase()
  return msg.includes("credit_balance_too_low") || msg.includes("credit balance is too low")
```

`name` 필드는 wrapped runner 의 이름과 동일(`claude.name`).
`contract` 도 동일(`claude.contract` — 두 runner 의 contract 가 같다는 invariant 가정, 생성 시점에 검증하지 않음 — caller 의 책임).

### 라치 공유

`m2-first-v2.ts` 에서 `const latch: FallbackLatch = { tripped: false }` 1회 생성 후 4개 dual runner 에 모두 주입. JS 객체 참조 동등성 덕에 한 곳에서 flip 하면 나머지가 즉시 본다(동일 process 내 sync 보장).

## Component 3 — m2-first-v2.ts 변경

```ts
import { makeCodexAgentRunner } from "../src/integrations/llm/codex-agent-runner";
import { makeDualAgentRunner, FallbackLatch } from "../src/integrations/llm/dual-agent-runner";

const latch: FallbackLatch = { tripped: false };

const wrap = <I, O>(
  name: string,
  contract: AgentContract<I, O>
): AgentPort<I, O> =>
  makeDualAgentRunner({
    claude: makeClaudeAgentRunner({ contract, name, tokenLogPath: cardDir }),
    codex:  makeCodexAgentRunner({ contract, name, tokenLogPath: cardDir }),
    latch,
  });

const analyst       = wrap("analyst",        analystContract);
const copywriter    = wrap("copywriter",     copywriterContract);
const factChecker   = wrap("fact-checker",   factCheckerContract);
const imageDirector = wrap("image-director", imageDirectorContract);
```

**ANTHROPIC_API_KEY 부재 처리:** Claude runner 는 생성자에서 키 없으면 throw 한다(현재 동작). 듀얼 구조에서 키가 없을 가능성을 고려해 `claude-agent-runner.ts` 의 키 부재 처리는 lazy 로 변경 — 생성 시점이 아닌 첫 `.run()` 호출 시점에 던지도록 한다. 그러면 키가 없을 때 첫 `claude.run()` 이 즉시 throw → dual runner 가 잡고 latch flip → Codex 진행. (자세한 patch 는 implementation plan 에서)

## Data Flow

```
[m2 main]
    │  pipeline.start()
    ▼
[orchestrator] ──── analyst.run(...) ─────────────┐
    │                                              │
    ▼                                              ▼
                                          [DualAgentRunner.run]
                                                   │
                                            latch.tripped?
                                                   │
                                          ┌──── No ┴── Yes ─────┐
                                          ▼                       ▼
                                   [Claude.run]              [Codex.run]
                                          │                       │
                                  credit_balance_too_low?         │
                                       │                          │
                                ┌─ Yes ┴── No ───┐                │
                                ▼                ▼                │
                          flip latch          throw              return
                          + Codex.run          err
                               │
                               └────────────┬───────────────┐
                                            ▼                ▼
                                       return result    [token-log .jsonl]
```

## Token 로깅 변경

`.tokens.jsonl` 의 각 행에 `backend` 필드 추가(현재 없음). 기존 reader (없을 가능성 높음) 호환을 위해 필드 추가는 무해. 향후 token 비교 분석 시 백엔드별 분리 가능.

## Testing

### `tests/integrations/llm/codex-agent-runner.test.ts`

| 케이스 | mock 설정 | 기대 |
|---|---|---|
| happy path | spawn mock — exit 0, tmpfile 에 valid JSON | input 검증 → spawn 호출 → 결과 zod parse 통과 |
| spawn ENOENT | spawn mock 이 ENOENT 던짐 | "codex CLI not found" 메시지 throw |
| exit ≠ 0 | spawn mock — exit 1, stderr "auth required" | "Codex CLI failed: auth required" throw |
| empty tmpfile | exit 0 but tmpfile 비어있음 | "empty response" throw |
| JSON parse 실패 | tmpfile 에 "not json" | "Failed to parse JSON" throw |
| zod 검증 실패 | tmpfile 에 schema 안 맞는 JSON | zod 에러 throw |
| markdown fences 제거 | tmpfile 에 ```json ... ``` 감싸진 valid JSON | strip 후 parse 성공 |
| stdin 으로 prompt 전달 | spawn mock 이 stdin 캡처 | prompt 에 systemPrompt + input JSON 둘 다 포함 |

### `tests/integrations/llm/dual-agent-runner.test.ts`

| 케이스 | 기대 |
|---|---|
| latch=false, claude 성공 | claude.run 1회, codex.run 0회, latch 그대로 false |
| latch=false, claude → credit error | claude.run 1회, codex.run 1회, latch flip true, reason set |
| latch=false, claude → 401 | claude.run 1회, codex.run 0회, throw 그대로 |
| latch=false, claude → 429 | claude.run 1회, codex.run 0회, throw 그대로 (Claude runner 내부 retry 후의 최종 실패라고 가정) |
| latch=true 진입 | claude.run 0회, codex.run 1회 |
| 공유 라치 — runner A 가 flip → runner B 호출 | runner B 의 claude.run 0회, codex.run 1회 |

### 회귀 테스트

기존 `claude-agent-runner.test.ts` 는 변경 없음(claude runner 의 책임 unchanged). lazy 키 검증 변경은 별도 케이스 추가:
- 키 없이 makeClaudeAgentRunner 호출 → throw 하지 않음
- `.run()` 호출 시점에 throw

## Error Handling Summary

| 레이어 | 에러 종류 | 처리 |
|---|---|---|
| Claude runner | 401 / 404 / 429 / 5xx / network | 기존 그대로 (retry/raise) |
| Claude runner | 400 + credit_balance_too_low | throw (변경 없음, dual runner 가 잡음) |
| Codex runner | ENOENT (codex 없음) | throw — 사용자에게 brew install codex 안내 |
| Codex runner | exit ≠ 0 | throw — stderr 발췌 포함 |
| Codex runner | 빈 응답 / parse 실패 / zod 실패 | throw |
| Dual runner | claude credit error | latch flip + codex.run, codex 실패 시 그 에러 throw |
| Dual runner | claude 다른 에러 | passthrough |
| Dual runner | latch tripped 상태 codex 실패 | codex 에러 그대로 throw (final failure) |

## Rollout

1. 신규 모듈 + 테스트 추가 (Claude 의 lazy 키 검증 패치 포함)
2. `m2-first-v2.ts` wire-up
3. typecheck + 전체 vitest 통과 확인
4. 수동 검증:
   - case 1: ANTHROPIC_API_KEY 정상 (잔액 있음) → Claude voice 그대로 (token log 에 `backend: "claude"`)
   - case 2: ANTHROPIC_API_KEY 잔액 없음 → 첫 호출에서 latch flip, 나머지는 Codex (`backend: "codex"`)
   - case 3: ANTHROPIC_API_KEY 미설정 → 첫 호출에서 latch flip, 전체 Codex

## Open Questions

- `--json` 이벤트 스트림에 token usage 가 실제로 포함되는지 — implementation 단계에서 codex 출력 1회 캡처해 확인. 없으면 null 로 로깅.
- Codex 기본 model 의 한국어 카드뉴스 voice — 별도 작업.
