#!/usr/bin/env bash
# Cardnews automated setup — installs everything that can be auto-installed.
# 자동으로: Bun, Codex CLI(brew), bun deps, codex-image skill 설치
# 수동 필요: Claude Code 앱 설치, `codex login` (ChatGPT OAuth)

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

bold() { printf "\n\033[1m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
miss() { printf "  \033[31m✗\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

bold "1) Bun"
if command -v bun >/dev/null 2>&1; then
  ok "이미 설치됨 ($(bun --version))"
else
  warn "Bun 미설치 — 자동 설치 시작"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ok "설치 완료 ($(bun --version))"
fi

bold "2) Codex CLI (OpenAI codex — 이미지 생성에 필수)"
if command -v codex >/dev/null 2>&1; then
  ok "이미 설치됨 ($(command -v codex))"
else
  if command -v brew >/dev/null 2>&1; then
    warn "Codex 미설치 — brew install --cask codex 실행"
    brew install --cask codex
    ok "설치 완료"
  elif command -v npm >/dev/null 2>&1; then
    warn "Homebrew 없음 → npm으로 설치 시도: npm install -g @openai/codex"
    npm install -g @openai/codex
    ok "설치 완료 (npm 글로벌)"
  else
    miss "Codex CLI 자동 설치 불가 — Homebrew도 npm도 없음"
    echo
    echo "  Codex CLI 설치 옵션 (둘 중 하나):"
    echo
    echo "  [추천] Homebrew로 설치 (macOS):"
    echo "    ① /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "    ② 설치 후 안내되는 'Next steps' 두세 줄도 그대로 실행 (PATH 등록)"
    echo "    ③ brew install --cask codex"
    echo
    echo "  [대안] npm으로 설치 (Node.js 18+ 필요):"
    echo "    npm install -g @openai/codex"
    echo
    echo "  설치 후 이 스크립트 다시 실행:  bash scripts/setup.sh"
    exit 1
  fi
fi

bold "3) Claude Code"
if command -v claude >/dev/null 2>&1; then
  ok "이미 설치됨"
else
  miss "Claude Code CLI(\`claude\`)가 PATH에 없음"
  echo
  echo "  ① 앱이 아직 없다면: https://claude.com/claude-code 에서 다운로드 후 설치."
  echo "  ② 앱은 깔았는데 \`claude\` 명령이 안 보이면, 앱을 한 번 실행해서"
  echo "     초기 셋업을 마치세요. CLI symlink가 그때 만들어집니다."
  echo "  ③ 그 다음 이 스크립트를 다시 실행:  bash scripts/setup.sh"
  exit 1
fi

bold "4) Bun 의존성"
bun install

bold "5) codex-image 스킬"
if [ -f "$ROOT/.claude/skills/codex-image/SKILL.md" ]; then
  ok "리포에 동봉됨 → .claude/skills/codex-image"
else
  miss ".claude/skills/codex-image/SKILL.md 없음 — 리포가 손상됐을 수 있음"
fi

bold "6) Codex OAuth 로그인 상태"
if codex login status 2>&1 | grep -qi "logged in"; then
  ok "ChatGPT 로그인됨"
else
  warn "Codex 로그인 필요 — 다음을 직접 실행:"
  echo "    codex login   # 브라우저에서 ChatGPT OAuth 진행"
fi
echo
echo "  ⚠️  ChatGPT Plus/Pro 유료 구독 필요."
echo "     무료 계정은 이미지 생성(gpt-image-2) 권한이 없어 /codex-image가 실패합니다."
echo "     구독: https://chat.openai.com/#pricing"

echo
bold "셋업 완료 — 이제 뭐 하면 되나"
echo
echo "  1) 이 폴더($ROOT)에서 Claude Code 실행"
echo "     → 세션이 열리면 CLAUDE.md가 자동 로드되며 작업 룰을 읽어옵니다."
echo
echo "  2) 채팅에 한국어로 던지면 끝:"
echo "     예) \"카드뉴스 만들자, 주제는 'Codex CLI 처음 시작'\""
echo "     → Claude Code가 Analyst→Copywriter→DesignReviewer→ImageDirector"
echo "       순으로 에이전트를 디스패치하고 이미지는 /codex-image로 자동 호출합니다."
echo
echo "  3) 산출물은 data/series/claude/cards/<날짜-슬러그>/ 아래에 생성됩니다."
echo
echo "  참고:"
echo "  - \`bun run m2:first-v2 \"<주제>\"\` 처럼 Claude Code 밖에서 헤드리스로 돌릴 때만"
echo "    ANTHROPIC_API_KEY가 필요합니다. 채팅에서 만들 때는 불필요."
echo "  - 동작 확인용:  bun run typecheck   |   bun run test"
