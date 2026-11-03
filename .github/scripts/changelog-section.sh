#!/usr/bin/env bash
# Prints one version's release notes from CHANGELOG.md: the lines under its "## [<version>]" heading,
# up to the next "## [" heading, without the heading and without blank lines at either end.
# Fails when the changelog or the section is missing, or the section is empty.
#
# Usage: changelog-section.sh <version> [changelog]   (changelog defaults to CHANGELOG.md)
set -euo pipefail

version="${1:?usage: changelog-section.sh <version> [changelog]}"
changelog="${2:-CHANGELOG.md}"

if [ ! -f "$changelog" ]; then
  echo "::error::$changelog not found." >&2
  exit 1
fi

notes=$(awk -v heading="## [$version]" '
  index($0, "## [") == 1 {
    if (found) exit
    if (index($0, heading) == 1) { found = 1; next }
  }
  found { print }
' "$changelog" | sed '/[^[:space:]]/,$!d')

if [ -z "${notes//[[:space:]]/}" ]; then
  echo "::error::$changelog has no notes under \"## [$version]\". Add them, then tag again." >&2
  exit 1
fi

printf '%s\n' "$notes"
