#!/usr/bin/env bash
# Flags writes under .scratch/ while that directory is still committable.
#
# Why: this repo is public (GitHub Pages) and .scratch/ holds specs and issue
# files. Until someone decides whether .scratch/ belongs in .gitignore, anything
# written there could be pushed publicly by accident.
#
# Self-retiring: once .scratch/ is gitignored, git check-ignore succeeds and this
# hook goes silent for good. No need to remove it by hand.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0

case "$file" in
  */.scratch/* | .scratch/*) ;;
  *) exit 0 ;;
esac

# Decision already made in favour of keeping it private? Then stay quiet.
if git -C "$(dirname "$file")" check-ignore -q "$file" 2>/dev/null; then
  exit 0
fi

jq -n --arg f "$file" '{
  systemMessage: "\($f) written — .scratch/ is not gitignored and this repo is public.",
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "A file was written under .scratch/ (\($f)). This repo is public and .scratch/ is not in .gitignore, so the file is committable. Unless the user has already settled this, tell them in your reply that the .gitignore decision for .scratch/ is still open and ask whether to ignore or commit it. Never stage a .scratch/ path silently."
  }
}'
