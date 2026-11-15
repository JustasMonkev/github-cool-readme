#!/usr/bin/env bash
# Wires github-cool-readme into your profile repo (<you>/<you>): token secret, workflow, settings,
# first run, README. Run it again to change settings; it asks before changing anything.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/pedrocatalao/github-cool-readme/v1/setup.sh)
#
# Options: --dry-run  show what would happen, change nothing
# Needs: gh (logged in) and git. Works with the bash that ships with macOS.
#
# This file only gets the steps and runs them, in the order setup/blocks lists them. Run from a
# clone (bash setup.sh), they're the ones next to it. Otherwise they're downloaded, all of them before
# the first runs, from the newest v1 release (COOL_README_SETUP_REF: a branch, tag or commit instead).

set -euo pipefail

DRY_RUN=false
NO_COMMIT=false # for trying setup out: everything up to the commit, then no commit, push or run
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-commit) NO_COMMIT=true ;;
    -h|--help) echo "Usage: setup.sh [--dry-run | --no-commit]  (sets up README cards in your profile repo)"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

SETUP_REPO="pedrocatalao/github-cool-readme"
SETUP_MAJOR="v1" # the releases this setup takes its steps from
SETUP_TMP=""     # where the steps were downloaded to, removed at the end

setup_fail() { # setup_fail what [what to do]: before the steps are loaded, so plain
  printf '  failed    %s\n' "$1" >&2
  [ -z "${2:-}" ] || printf '            %s\n' "$2" >&2
  exit 1
}

here="${BASH_SOURCE[0]:-}"
if [ -f "$here" ] && [ -f "$(dirname "$here")/setup/blocks" ]; then
  SETUP_DIR="$(cd "$(dirname "$here")" && pwd)/setup" # the steps are run from the profile repo, so a full path
else
  command -v gh >/dev/null || setup_fail "the GitHub CLI (gh) is not installed" "install it from https://cli.github.com"
  command -v git >/dev/null || setup_fail "git is not installed"
  gh auth status >/dev/null 2>&1 || setup_fail "gh is not logged in" "run: gh auth login"
  SETUP_REF="${COOL_README_SETUP_REF:-}"
  if [ -z "$SETUP_REF" ]; then
    SETUP_REF="$(gh api "repos/$SETUP_REPO/releases" --jq "[.[] | select(.draft or .prerelease | not) \
      | select(.tag_name | startswith(\"$SETUP_MAJOR.\"))][0].tag_name // empty" 2>/dev/null)" \
      || setup_fail "could not ask GitHub for the latest release of $SETUP_REPO" "check your connection and try again"
    [ -n "$SETUP_REF" ] || setup_fail "no $SETUP_MAJOR release of $SETUP_REPO found"
  fi
  SETUP_TMP="$(mktemp -d)"
  trap 'rm -rf "$SETUP_TMP"' EXIT # until the steps' own clean-up takes over
  SETUP_DIR="$SETUP_TMP"
  setup_get() { # setup_get file: one file of setup/, at SETUP_REF
    curl -fsSL --retry 2 "https://raw.githubusercontent.com/$SETUP_REPO/$SETUP_REF/setup/$1" -o "$SETUP_DIR/$1" \
      || setup_fail "could not download setup/$1 of $SETUP_REPO $SETUP_REF" "check your connection and try again"
  }
  setup_get blocks
  while read -r setup_block; do setup_get "$setup_block.sh"; done < "$SETUP_DIR/blocks"
fi

# Read before any step runs: the steps read from the terminal, and must not get this list instead.
SETUP_BLOCKS=()
while read -r setup_block; do SETUP_BLOCKS+=("$setup_block"); done < "$SETUP_DIR/blocks"

# Each step runs in this shell, so what one asks (the cards, the settings) the next one uses.
for setup_block in "${SETUP_BLOCKS[@]}"; do
  # shellcheck source=/dev/null
  . "$SETUP_DIR/$setup_block.sh"
done
