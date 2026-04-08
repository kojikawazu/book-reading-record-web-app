#!/usr/bin/env sh
set -eu

PREVIOUS_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
CURRENT_SHA="${VERCEL_GIT_COMMIT_SHA:-}"

if [ -z "$PREVIOUS_SHA" ] || [ -z "$CURRENT_SHA" ]; then
  echo "Vercel git SHA is missing. Continue build."
  exit 1
fi

CHANGED_FILES="$(git diff --name-only "$PREVIOUS_SHA" "$CURRENT_SHA" || true)"

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files detected. Skip build."
  exit 0
fi

for path in $CHANGED_FILES; do
  case "$path" in
    front/*)
      echo "front/ change detected: $path. Continue build."
      exit 1
      ;;
  esac
done

echo "No front/ changes detected. Skip build."
exit 0
