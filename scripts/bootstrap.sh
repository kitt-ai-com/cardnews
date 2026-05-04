#!/usr/bin/env bash
# Cardnews one-paste bootstrap.
# 새 PC에서 터미널에 한 줄 붙여넣으면 clone + 자동 셋업까지 한 번에.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/kitt-ai-com/cardnews/main/scripts/bootstrap.sh)
#
# Optional: 클론 위치 지정 (기본: ~/dev/cardnews)
#   CARDNEWS_DIR=~/projects/cardnews bash <(curl -fsSL ...)

set -euo pipefail

REPO="https://github.com/kitt-ai-com/cardnews.git"
TARGET="${CARDNEWS_DIR:-$HOME/dev/cardnews}"

bold() { printf "\n\033[1m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }

bold "Cardnews bootstrap"
echo "  repo:   $REPO"
echo "  target: $TARGET"

if ! command -v git >/dev/null 2>&1; then
  echo "git이 필요합니다 — Xcode CLT 설치: xcode-select --install"
  exit 1
fi

if [ -d "$TARGET/.git" ]; then
  ok "이미 클론돼 있음 — pull로 갱신"
  git -C "$TARGET" pull --ff-only
else
  mkdir -p "$(dirname "$TARGET")"
  git clone "$REPO" "$TARGET"
fi

cd "$TARGET"
bash scripts/setup.sh
