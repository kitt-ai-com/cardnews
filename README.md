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
- ✅ Codex CLI 설치 (`brew install --cask codex` — Homebrew 있을 때)
- ✅ Bun 의존성 (`bun install`)
- ✅ codex-image 스킬은 리포에 동봉 (`.claude/skills/codex-image/`)
- ✅ Codex 로그인 상태 검사

## 수동 필요 (PC당 1회)

| 항목 | 이유 | 방법 |
|---|---|---|
| **Homebrew** | Codex CLI 설치에 필요 | [brew.sh](https://brew.sh) 한 줄 install |
| **Claude Code 앱** | GUI 앱이라 CLI 자동 설치 불가 | https://claude.com/claude-code 다운로드 → **앱 한 번 실행해야 `claude` CLI가 PATH에 등록됨** |
| **`codex login`** | ChatGPT OAuth는 브라우저 필요 | 터미널에서 `codex login` 실행 → ChatGPT 로그인 |

> **API 키는 필요 없음.** Codex는 ChatGPT OAuth, Claude Code는 자체 로그인 사용.
> (예외: `bun run m2:first-v2` 같이 **Claude Code 밖**에서 헤드리스로 돌릴 때만 `ANTHROPIC_API_KEY` 필요.)

## 수동 셋업 (한 줄 install이 안 될 때)

```sh
git clone https://github.com/kitt-ai-com/cardnews.git
cd cardnews
bash scripts/setup.sh
```

## 처음 받는 사람을 위한 절차

> 셋업이 끝나면 받는 사람이 막히지 않게 끝까지 이어주는 흐름.

**1. 셋업 (한 번만)**

위 한 줄(또는 수동 셋업) 실행. 도중에 끊기면 메시지 그대로 따라가면 됨:

| 끊긴 곳 | 다음에 할 일 |
|---|---|
| `Homebrew 없음` | brew.sh 한 줄 install → `bash scripts/setup.sh` 다시 실행 |
| `Claude Code CLI(claude)가 PATH에 없음` | 앱 다운로드 + 한 번 실행 → 다시 setup.sh |
| `Codex 로그인 필요` | 터미널에 `codex login` (브라우저로 ChatGPT 로그인) |

**2. 카드뉴스 만들기**

이 폴더에서 Claude Code 실행 → 세션이 열리면 `CLAUDE.md`가 자동 로드됨. 그 다음 그냥 한국어로 부탁:

```
카드뉴스 만들자, 주제는 "Codex CLI 처음 시작"
```

Claude Code가 알아서:
1. `data/series/claude/design-guide.md`와 references를 read
2. **Analyst → Copywriter → DesignReviewer → EditorialReviewer** 에이전트를 디스패치 (병렬)
3. **ImageDirector**가 `/codex-image`로 배경 이미지 생성 (ChatGPT OAuth — API 키 불필요)
4. M3 렌더로 PNG export

산출물 위치:
```
data/series/claude/cards/<YYYY-MM-DD-slug>/
├─ analysis.md
├─ preview.html
├─ images/
└─ exports/      ← 인스타용 1080×1350 또는 2160×2700 PNG
```

**3. 피드백 흐름**

"이 부분 답답해", "톤이 약해", "사실 의심스러워" 같은 피드백을 던지면 Claude Code가 적절한 에이전트(DesignReviewer / Copywriter / EditorialReviewer)로 자동 디스패치합니다. 직접 CSS·카피 수정 요구는 지양 — 룰 자체가 `CLAUDE.md`의 **Team Orchestrator 패턴**으로 잡혀 있습니다.

## Develop

```sh
bun install
bun run test         # vitest
bun run test:watch
bun run typecheck
```

## Usage

세션 시작 시 Claude Code가 `CLAUDE.md`를 자동 로드합니다. 작업 흐름과 에이전트 디스패치 규칙은 거기 있습니다.
