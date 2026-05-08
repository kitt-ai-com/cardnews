# Install playbook

> **이 문서는 Claude Code가 따라가는 설치 절차입니다.**
> 사용자가 이 리포 URL을 주거나 "설치해줘 / 셋업해줘"라고 하면 Claude는 아래 순서대로 실행하세요.
> 사용자가 직접 셸로 깔고 싶다면 README의 "수동 셋업" 섹션을 참조하면 됩니다.

---

## 사전 조건 (사용자 1회)

설치 시작 전 확인:
- **Claude Code 앱** — 지금 너(Claude)가 실행되고 있다면 OK.
- **ChatGPT Plus 또는 Pro 구독** — `/codex-image`가 쓰는 `gpt-image-2`는 유료 플랜만 접근 가능. 무료 계정이면 6단계까지 통과해도 이미지 생성 시점에 실패함. 작업 시작 전 사용자에게 한 번 확인할 것.

---

## 0) OS 감지

```bash
uname -s 2>/dev/null || ver
```

| 결과 | 트랙 |
|---|---|
| `Darwin` | **macOS** |
| `Linux` | **Linux** |
| `MINGW*` / `MSYS*` / `CYGWIN*` / `ver`가 Windows 출력 | **Windows** |

윈도우면 Bash 명령은 `powershell.exe -c "<cmd>"` 또는 `pwsh -c "<cmd>"`로 감싸 실행.

---

## 1) git clone (현재 디렉토리가 cardnews 안이 아니면)

```bash
# 기본 위치
TARGET="$HOME/dev/cardnews"   # macOS/Linux
# Windows: %USERPROFILE%\dev\cardnews
```

다른 위치를 원하는지 **사용자에게 한 번 묻기**. 그 후:

```bash
mkdir -p "$(dirname "$TARGET")"
git clone https://github.com/kitt-ai-com/cardnews.git "$TARGET"
cd "$TARGET"
```

이미 있으면 `git -C "$TARGET" pull --ff-only`.

---

## 2) Bun 설치

| OS | 명령 |
|---|---|
| macOS / Linux | `curl -fsSL https://bun.sh/install \| bash` |
| Windows (PowerShell) | `powershell -c "irm bun.sh/install.ps1 \| iex"` |

설치 후 같은 세션에서 PATH 등록:
- macOS/Linux: `export PATH="$HOME/.bun/bin:$PATH"`
- Windows: 새 PowerShell 세션이 자동으로 PATH 잡음 (또는 `$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"`)

확인: `bun --version`.

---

## 3) Codex CLI 설치 (이미지 생성에 필수)

우선순위로 시도:

1. **macOS + Homebrew**: `brew install --cask codex`
2. **npm (모든 OS)**: `npm install -g @openai/codex`
3. **Windows + winget**: `winget install OpenAI.Codex` (cask 없음 시 시도)

셋 다 불가하면:
- macOS/Linux: Homebrew 설치 안내 → `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- Windows: Node.js LTS 설치 안내 → https://nodejs.org/ko 또는 `winget install OpenJS.NodeJS.LTS`

설치 후: `codex --version`으로 확인.

---

## 4) Claude Code CLI 확인

```bash
command -v claude || echo MISSING
```

`MISSING`이면:
- 앱이 없는 것일 수도 있고 (https://claude.com/claude-code 다운로드)
- 앱은 있는데 한 번도 실행 안 한 경우 (앱 한 번 열어야 `claude` symlink 생성)

지금 너(Claude)가 동작하고 있다면 보통 OK. 사용자가 새로운 Claude Code 세션 열 때 명령어 사용 가능.

---

## 5) Bun 의존성 설치

cardnews 디렉토리 안에서:

```bash
bun install
```

---

## 6) codex-image 스킬 확인

리포에 동봉돼 있어야 함:

```bash
test -f .claude/skills/codex-image/SKILL.md && echo OK || echo MISSING
```

`MISSING`이면 리포가 손상된 것 — `git pull` 후 재시도.

---

## 7) Codex OAuth 로그인 확인

```bash
codex login status 2>&1
```

"logged in" 안 보이면 사용자에게:
> 터미널에서 `codex login` 직접 실행해주세요. 브라우저가 열리며 ChatGPT OAuth 진행.

⚠️ 다시 강조: **ChatGPT Plus/Pro 구독 계정으로 로그인**해야 이미지 생성 가능.

---

## 8) 동작 확인 (선택)

```bash
bun run typecheck
bun run test
```

깨지면 사용자에게 보고.

---

## 9) 완료 안내

사용자에게 다음을 알려주기:

> **셋업 완료. 이제 Claude Code에서 한국어로 시작하면 됩니다:**
>
> ```
> 카드뉴스 만들자, 주제는 "Codex CLI 처음 시작"
> ```
>
> 그러면 다음이 자동 진행됩니다:
> 1. `data/series/claude/design-guide.md` + references 자동 read
> 2. Analyst → Copywriter → DesignReviewer → EditorialReviewer 에이전트 병렬 디스패치
> 3. ImageDirector가 `/codex-image`로 배경 이미지 생성 (ChatGPT OAuth — API 키 불필요)
> 4. M3 렌더 → PNG export
>
> **산출물**: `data/series/claude/cards/<YYYY-MM-DD-슬러그>/exports/`
>
> 피드백("답답해", "톤 약해", "사실 의심됨")을 던지면 적절한 에이전트로 자동 라우팅됩니다.

---

## 실패 모드 (Claude가 만났을 때 사용자 안내용)

| 증상 | 원인 | 안내 |
|---|---|---|
| `brew: command not found` (macOS) | Homebrew 미설치 | brew.sh 한 줄 install → 다시 진행 |
| `npm: command not found` | Node.js 미설치 | Node.js LTS 설치 후 다시 진행 |
| `claude: command not found` | 앱은 있는데 한 번도 실행 안 함 | 앱 실행 → 다시 확인 |
| `codex login status` → not logged in | OAuth 미완료 | `codex login` 직접 실행 |
| `/codex-image` 호출 시 "No access to gpt-image-2" | 무료 ChatGPT 계정 | Plus/Pro 구독 필요 |
| `bun install` 실패 | 네트워크 / 권한 | 에러 메시지 그대로 사용자에게 |
