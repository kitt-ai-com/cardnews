# Cardnews 셋업 가이드

새 PC에서 cardnews를 돌리기 위한 단계. 자동화 가능한 건 `scripts/setup.sh` 하나로 끝나고, 계정/시스템 레벨 설치만 수동으로 하면 됩니다.

## 1. 사전 설치 (수동, PC당 1회)

| 항목 | 명령어 | 비고 |
|---|---|---|
| **Bun** | `curl -fsSL https://bun.sh/install \| bash` | TS 런타임 + 패키지 매니저 |
| **Codex CLI** | `brew install codex` | gpt-image-2 호출 주체 (ChatGPT OAuth) |
| **Claude Code** | https://claude.com/claude-code | 에이전트 실행 환경 |
| **ChatGPT 로그인** | `codex` 실행 후 OAuth | ChatGPT Plus/Team/Pro 계정 사용량 한도 내 무료 |

> **API 키는 필요 없음.** Codex는 ChatGPT OAuth, Claude Code는 자체 로그인 사용.

## 2. 자동 셋업

```sh
git clone https://github.com/kitt-ai-com/cardnews.git
cd cardnews
bash scripts/setup.sh
```

`setup.sh`가 하는 일:
- `bun install` — 의존성 설치
- `.claude/skills/codex-image/` 에 codex-image 스킬 프로젝트-로컬 설치 (글로벌 ~/.claude 안 건드림)
- 필수 CLI(bun, codex, claude) 존재 확인 → 빠진 항목 안내

## 3. 동작 확인

```sh
bun run typecheck       # 타입 체크
bun run test            # 테스트
```

Claude Code 안에서:
```
/codex-image cherry blossom hanok
```
→ 이미지가 생성되고 프로젝트 root에 떨어지면 OK.

## 4. 작업 시작

`CLAUDE.md`를 따르세요. 시리즈 작업 전 반드시 읽어야 할 4개 문서가 명시돼 있습니다.
