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

bold "2) Codex CLI"
if command -v codex >/dev/null 2>&1; then
  ok "이미 설치됨 ($(command -v codex))"
else
  if command -v brew >/dev/null 2>&1; then
    warn "Codex 미설치 — brew install codex 실행"
    brew install codex
    ok "설치 완료"
  else
    miss "Homebrew 없음 — Codex CLI 자동 설치 불가"
    echo
    echo "  먼저 Homebrew를 설치하세요:"
    echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  그 다음 이 스크립트를 다시 실행."
    exit 1
  fi
fi

bold "3) Claude Code"
if command -v claude >/dev/null 2>&1; then
  ok "이미 설치됨"
else
  miss "Claude Code 미설치 — GUI 앱이라 자동 설치 불가"
  echo
  echo "  https://claude.com/claude-code 에서 다운로드 후 다시 실행."
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
bold "셋업 완료"
echo "  bun run typecheck"
echo "  bun run test"
echo "  Claude Code 열고 /codex-image <prompt> 동작 확인"
