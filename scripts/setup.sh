#!/usr/bin/env bash
# Cardnews automated setup — installs deps + project-local codex-image skill.
# 수동 단계는 SETUP.md 참고.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
miss() { printf "  \033[31m✗\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

bold "1) CLI 사전 설치 확인"
MISSING=0
for cmd in bun codex claude; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd ($(command -v $cmd))"
  else
    miss "$cmd 없음"
    MISSING=$((MISSING+1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo
  warn "위 항목을 먼저 설치하세요. SETUP.md 참고."
  echo "  - bun:    curl -fsSL https://bun.sh/install | bash"
  echo "  - codex:  brew install codex"
  echo "  - claude: https://claude.com/claude-code"
  exit 1
fi

bold "2) Bun 의존성 설치"
bun install

bold "3) codex-image 스킬 (프로젝트-로컬) 설치"
SKILL_DIR="$ROOT/.claude/skills/codex-image"
if [ -d "$SKILL_DIR/.git" ]; then
  ok "이미 설치됨 — pull로 갱신"
  git -C "$SKILL_DIR" pull --ff-only
else
  rm -rf "$SKILL_DIR"
  mkdir -p "$ROOT/.claude/skills"
  git clone --depth 1 https://github.com/wjb127/codex-image.git "$SKILL_DIR"
  ok "설치 완료 → $SKILL_DIR"
fi

bold "4) Codex OAuth 로그인 상태"
if codex login status 2>&1 | grep -qi "logged in"; then
  ok "ChatGPT 로그인됨"
else
  warn "Codex 로그인 필요 — 다음 명령어를 실행하세요:"
  echo "    codex login   # 브라우저 ChatGPT OAuth 진행"
fi

echo
bold "셋업 완료"
echo "다음:"
echo "  bun run typecheck"
echo "  bun run test"
echo "  Claude Code 열고 /codex-image <prompt> 로 동작 확인"
