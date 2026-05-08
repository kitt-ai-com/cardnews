# cardnews

한국어 인스타그램 카드뉴스 자동화 — Claude × Codex 멀티 에이전트 파이프라인.

---

## 가장 빠른 길 — Claude Code에게 맡기기 (macOS · Windows 동일)

**사전 조건 (PC당 1회):**
- [Claude Code 앱](https://claude.com/claude-code) 설치 + 한 번 실행 (CLI symlink 생성)
- [ChatGPT Plus 또는 Pro 구독](https://chat.openai.com/#pricing) — `gpt-image-2` 이미지 생성에 필수

**설치:**

1. Claude Code 실행
2. 채팅에 다음을 던지면 끝:

```
https://github.com/kitt-ai-com/cardnews 설치해줘
```

Claude가 [INSTALL.md](INSTALL.md)의 플레이북을 따라 OS를 감지하고:
- 적절한 위치에 git clone
- Bun, Codex CLI 설치 (없으면)
- `bun install`
- codex-image 스킬 확인
- `codex login` 상태 확인
- 막히는 곳마다 무엇을 하면 되는지 안내

---

## 카드뉴스 만들기

설치가 끝났다면 그 cardnews 디렉토리에서 Claude Code 세션을 열고:

```
카드뉴스 만들자, 주제는 "Codex CLI 처음 시작"
```

CLAUDE.md가 자동 로드되며 Analyst → Copywriter → DesignReviewer → EditorialReviewer → ImageDirector 흐름으로 진행. 이미지는 `/codex-image`로 자동 호출(ChatGPT OAuth — API 키 불필요).

산출물 위치:
```
data/series/claude/cards/<YYYY-MM-DD-슬러그>/
├─ analysis.md
├─ preview.html
├─ images/
└─ exports/      ← 인스타용 1080×1350 또는 2160×2700 PNG
```

피드백을 던지면 적절한 에이전트로 자동 라우팅:
- "답답해", "이상해" → DesignReviewer
- "톤 약해" → Copywriter
- "사실 의심됨" → EditorialReviewer

직접 CSS·카피 수정 요구는 지양하고 자연어로 피드백 — 룰은 CLAUDE.md의 **Team Orchestrator 패턴**.

---

## 수동 셋업 (셸로 직접 깔고 싶을 때)

Claude Code 없이 터미널만으로 갈 때:

**macOS / Linux**
```sh
git clone https://github.com/kitt-ai-com/cardnews.git
cd cardnews
bash scripts/setup.sh
```

또는 한 줄 install:
```sh
bash <(curl -fsSL https://raw.githubusercontent.com/kitt-ai-com/cardnews/main/scripts/bootstrap.sh)
```

**Windows**: 셸 스크립트는 macOS/Linux 전제. Windows에서는 위 "Claude Code에게 맡기기" 흐름을 사용하세요. (혹은 WSL 안에서 Linux 셸 트랙으로.)

`scripts/setup.sh`가 자동 처리:
- ✅ Bun 설치 (없으면 공식 installer 자동 실행)
- ✅ Codex CLI 설치 (`brew install --cask codex` 또는 `npm install -g @openai/codex` fallback)
- ✅ `bun install`
- ✅ codex-image 스킬은 리포에 동봉
- ✅ Codex 로그인 상태 검사

> **API 키 불필요.** Codex는 ChatGPT OAuth, Claude Code는 자체 로그인 사용.
> 예외: `bun run m2:first-v2` 처럼 Claude Code 밖에서 헤드리스로 돌릴 때만 `ANTHROPIC_API_KEY` 필요.

---

## Develop

```sh
bun install
bun run test         # vitest
bun run test:watch
bun run typecheck
```

---

## Usage

세션 시작 시 Claude Code가 `CLAUDE.md`를 자동 로드합니다. 작업 흐름과 에이전트 디스패치 규칙은 거기 있습니다.
