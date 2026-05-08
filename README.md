# cardnews

한국어 인스타그램 카드뉴스 자동화 — Claude × Codex 멀티 에이전트 파이프라인.

---

## 한 줄로 셋업 (One-paste install)

새 PC 터미널에 그대로 붙여넣으면 클론 + 자동 설치까지 끝납니다:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/kitt-ai-com/cardnews/main/scripts/bootstrap.sh)
```

기본 위치는 `~/dev/cardnews`. 다른 곳에 받고 싶으면:

```sh
CARDNEWS_DIR=~/projects/cardnews bash <(curl -fsSL https://raw.githubusercontent.com/kitt-ai-com/cardnews/main/scripts/bootstrap.sh)
```

## 자동 처리되는 항목

- ✅ Bun 설치 (없으면 공식 installer 자동 실행)
- ✅ Codex CLI 설치 (`brew install codex` — Homebrew 있을 때)
- ✅ Bun 의존성 (`bun install`)
- ✅ codex-image 스킬은 리포에 동봉 (`.claude/skills/codex-image/`)
- ✅ Codex 로그인 상태 검사

## 수동 필요 (PC당 1회)

| 항목 | 이유 | 방법 |
|---|---|---|
| **Homebrew** | Codex CLI 설치에 필요 | [brew.sh](https://brew.sh) 한 줄 install |
| **Claude Code** | GUI 앱이라 CLI 자동 설치 불가 | https://claude.com/claude-code |
| **`codex login`** | ChatGPT OAuth는 브라우저 필요 | `codex login` 실행 → ChatGPT 로그인 |

> **API 키는 필요 없음.** Codex는 ChatGPT OAuth, Claude Code는 자체 로그인 사용.

## 수동 셋업 (한 줄 install이 안 될 때)

```sh
git clone https://github.com/kitt-ai-com/cardnews.git
cd cardnews
bash scripts/setup.sh
```

## Develop

```sh
bun install
bun run test         # vitest
bun run test:watch
bun run typecheck
```

## Usage

세션 시작 시 Claude Code가 `CLAUDE.md`를 자동 로드합니다. 작업 흐름과 에이전트 디스패치 규칙은 거기 있습니다.
