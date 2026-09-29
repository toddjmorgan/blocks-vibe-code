#!/usr/bin/env bash
# Launches Copilot CLI with the standard dev-loop commands (git, npm)
# pre-approved, so you aren't prompted individually for each one. Anything
# outside that set — destructive or unusual commands, off-limits file edits —
# still requires explicit approval. See "Standard dev loop" in
# .github/skills/vibe-code-guardrails/SKILL.md for what's covered.
set -e

exec copilot \
  --allow-tool 'shell(git:*)' \
  --allow-tool 'shell(npm:*)'
