#!/bin/bash
# Hook: Auto-sync memories to repo on stop
# Triggered by: Stop event
# Cost: 0 tokens (local bash)

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
REPO_ROOT="$(pwd)"

build_project_slug() {
  local input="$1"
  local normalized="$input"

  normalized="${normalized//\\//}"

  if [[ "$normalized" =~ ^/([a-zA-Z])/(.*)$ ]]; then
    local drive="${BASH_REMATCH[1]^}"
    local rest="${BASH_REMATCH[2]}"
    echo "${drive}--${rest//\//-}"
    return 0
  fi

  if [[ "$normalized" =~ ^([a-zA-Z]):/?(.*)$ ]]; then
    local drive="${BASH_REMATCH[1]^}"
    local rest="${BASH_REMATCH[2]}"
    rest="${rest#/}"
    echo "${drive}--${rest//\//-}"
    return 0
  fi

  normalized="${normalized#/}"
  echo "${normalized//\//-}"
}

# Source: Claude Code auto-memory
PROJECT_SLUG="$(build_project_slug "$REPO_ROOT")"
SRC="$HOME/.claude/projects/$PROJECT_SLUG/memory"
# Destination: project repo (tracked by git)
DST=".claude/memory"

[ ! -d "$SRC" ] && exit 0
mkdir -p "$DST"

SYNCED=0
for f in "$SRC"/*.md; do
  [ ! -f "$f" ] && continue
  BASENAME=$(basename "$f")
  if [ ! -f "$DST/$BASENAME" ] || ! cmp -s "$f" "$DST/$BASENAME"; then
    cp "$f" "$DST/$BASENAME"
    SYNCED=$((SYNCED + 1))
  fi
done

if [ "$SYNCED" -gt 0 ]; then
  echo "{\"systemMessage\": \"Memorias: ${SYNCED} archivo(s) sincronizados a .claude/memory/\"}"
else
  echo '{"suppressOutput": true}'
fi
