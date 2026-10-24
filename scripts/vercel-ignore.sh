#!/usr/bin/env bash

# Vercel Ignored Build Step Script
# Exit 0: Skip build (no docs/registry/ui changes detected)
# Exit 1: Proceed with build

BASE_SHA=""

# 1. Check if VERCEL_GIT_PREVIOUS_SHA is valid and exists in local git history
if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && [ "$VERCEL_GIT_PREVIOUS_SHA" != "0000000000000000000000000000000000000000" ]; then
  if git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" >/dev/null 2>&1; then
    BASE_SHA="$VERCEL_GIT_PREVIOUS_SHA"
  else
    echo "⚠️ VERCEL_GIT_PREVIOUS_SHA ($VERCEL_GIT_PREVIOUS_SHA) not found in local git history."
  fi
fi

# 2. If no valid previous SHA, check if we are on a branch with a merge base against main
if [ -z "$BASE_SHA" ]; then
  for b in origin/main main origin/master master; do
    if git rev-parse --verify "$b" >/dev/null 2>&1; then
      MERGE_BASE="$(git merge-base "$b" HEAD 2>/dev/null)"
      CURRENT_HEAD="$(git rev-parse HEAD 2>/dev/null)"
      if [ -n "$MERGE_BASE" ] && [ "$MERGE_BASE" != "$CURRENT_HEAD" ]; then
        BASE_SHA="$MERGE_BASE"
        echo "Found merge base against $b: $BASE_SHA"
        break
      fi
    fi
  done
fi

# 3. Fallback to HEAD~1 (single commit check on main or detached HEAD)
if [ -z "$BASE_SHA" ]; then
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    BASE_SHA="HEAD~1"
  else
    echo "⚠️ Initial commit or shallow clone with no ancestor. Proceeding with build."
    exit 1
  fi
fi

echo "Inspecting changes between $BASE_SHA and HEAD..."

# Check if there are changes in docs-relevant paths
if git diff --quiet "$BASE_SHA" HEAD -- \
  docs/ \
  registry/ \
  registry.json \
  packages/ui/ \
  scripts/build-registry.mjs \
  scripts/vercel-ignore.sh \
  vercel.json \
  .vercelignore \
  package.json \
  package-lock.json; then
  echo "🛑 No changes in docs, registry, packages/ui, or build config. Skipping Vercel deployment."
  exit 0
else
  echo "✅ Changes detected in docs-related paths. Proceeding with Vercel build."
  exit 1
fi
