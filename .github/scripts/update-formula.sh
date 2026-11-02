#!/usr/bin/env bash
# Rewrites the Homebrew formula for a release.
#
#   update-formula.sh <formula> <version> <sha_arm> <sha_x64> [url_arm url_x64]
#
# Sets the version and both sha256 values. With the two optional urls, replaces the url lines too
# (package-test points them at local files). Works with GNU and BSD sed.
#
# The formula must keep every `version "` line and every sha256 inside on_arm / on_intel in the shape
# these seds expect; see src/.claude/skills/distribution/references/DISTRIBUTION.md.
set -euo pipefail

die() { echo "update-formula.sh: $*" >&2; exit 1; }

[[ $# -eq 4 || $# -eq 6 ]] || die "usage: update-formula.sh <formula> <version> <sha_arm> <sha_x64> [url_arm url_x64]"

formula=$1
version=$2
sha_arm=$3
sha_x64=$4
url_arm=${5:-}
url_x64=${6:-}

[[ -f "$formula" ]] || die "'$formula' not found."
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || die "invalid version '$version'."
[[ "$sha_arm" =~ ^[0-9a-f]{64}$ ]] || die "sha_arm must be 64 lowercase hex characters."
[[ "$sha_x64" =~ ^[0-9a-f]{64}$ ]] || die "sha_x64 must be 64 lowercase hex characters."

sed_escape() { printf '%s' "$1" | sed 's/[&#\\]/\\&/g'; }

tmp="$formula.tmp"

args=(
  -e "s/version \".*\"/version \"$version\"/"
  -e "/on_arm do/,/end/ s/sha256 \".*\"/sha256 \"$sha_arm\"/"
  -e "/on_intel do/,/end/ s/sha256 \".*\"/sha256 \"$sha_x64\"/"
  -e 's#releases/download/v\#{version}/TeensyROM-Web-#releases/download/v\#{version}/TeensyROM-Suite-#'
  -e 's#MetalHexx/TeensyROM-Web/#MetalHexx/TeensyROM-Suite/#'
)

if [[ -n "$url_arm" ]]; then
  args+=(-e "/on_arm do/,/end/ s#url \".*\"#url \"$(sed_escape "$url_arm")\"#")
fi
if [[ -n "$url_x64" ]]; then
  args+=(-e "/on_intel do/,/end/ s#url \".*\"#url \"$(sed_escape "$url_x64")\"#")
fi

sed "${args[@]}" "$formula" > "$tmp"
mv "$tmp" "$formula"

grep -q "^  version \"$version\"[[:space:]]*$" "$formula" || die "version was not updated in '$formula'."
grep -q "sha256 \"$sha_arm\"" "$formula" || die "arm sha256 was not updated in '$formula'."
grep -q "sha256 \"$sha_x64\"" "$formula" || die "x64 sha256 was not updated in '$formula'."

echo "Updated $formula for v$version"
