# cardnews

한국어 인스타그램 카드뉴스 자동화 — Claude × Codex 멀티 에이전트 파이프라인.

## Quick start

```sh
git clone https://github.com/kitt-ai-com/cardnews.git
cd cardnews
bash scripts/setup.sh
```

상세 셋업 (Bun / Codex CLI / Claude Code 설치 등): **[SETUP.md](./SETUP.md)**

## Develop

```sh
bun install
bun run test         # run tests (vitest)
bun run test:watch   # watch mode
bun run typecheck
```

## Usage

세션 시작 시 Claude Code가 `CLAUDE.md`를 자동 로드합니다. 작업 흐름과 에이전트 디스패치 규칙은 거기 있습니다.
