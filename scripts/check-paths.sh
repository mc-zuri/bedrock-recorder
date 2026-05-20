#!/usr/bin/env bash
# Guard against hardcoded personal data slipping into tracked files.
#
# Greps every git-tracked file in the repo for tokens that should never
# appear in committed code:
#   - Windows user-specific paths (C:\Users\<you>\..., C:/Users/...)
#   - Absolute D:/ paths that assume a contributor's workspace layout
#   - Known personal gamertags / profile paths
#
# Exits non-zero with a list of hits. CI runs this; contributors can run
# it locally before pushing:
#
#   bash scripts/check-paths.sh
#
# False positive? Edit the FORBIDDEN regex below or whitelist the file in
# ALLOWED_FILES. Keep the list tight — every exception is a future leak.

set -uo pipefail
cd "$(dirname "$0")/.."

# Tokens that should never appear in tracked content.
FORBIDDEN='C:[/\\]Users[/\\]|D:[/\\]projects|McZuri5840|C:[/\\]git[/\\]profiles'

# Files allowed to mention these tokens (escaping examples / docs about
# what NOT to do). Keep tiny.
ALLOWED_FILES=(
  "scripts/check-paths.sh"      # this file
  "CONTRIBUTING.md"             # explains the rule
)

hits=$(git ls-files | while read -r f; do
  # Skip allowed files.
  skip=0
  for allow in "${ALLOWED_FILES[@]}"; do
    [[ "$f" == "$allow" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue
  # Skip non-text files (binary fixtures, prebuilt addons, etc.).
  file --mime "$f" 2>/dev/null | grep -q 'charset=binary' && continue
  grep -EnH "$FORBIDDEN" "$f" 2>/dev/null
done)

if [[ -n "$hits" ]]; then
  echo "✗ Forbidden path tokens found in tracked files:"
  echo
  echo "$hits"
  echo
  echo "If a hit is legitimate (e.g. documenting what NOT to do), add"
  echo "the file to ALLOWED_FILES in scripts/check-paths.sh."
  exit 1
fi

echo "✓ No forbidden path tokens in tracked files."
