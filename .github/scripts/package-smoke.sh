#!/usr/bin/env bash
# Runs an installed package's trom through start, serve, init, update check and stop.
#
#   package-smoke.sh <trom> <version> [expected-install-kind]
#
# expected-install-kind is release or homebrew; without it either passes.
# TROM_RELEASES_URL must point at a feed (fake_release_feed.py) so `update --check` has one to read;
# SMOKE_NEXT_VERSION, when set, is the version that feed offers.
# TEENSYROM_DATA_DIR should point at a scratch folder.
set -euo pipefail

[[ $# -ge 2 && $# -le 3 ]] || { sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2; }

trom=$1
version=$2
kind=${3:-}
base=http://localhost:10213

[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "invalid version '$version'" >&2; exit 2; }
[[ -z "$kind" || "$kind" == release || "$kind" == homebrew ]] || { echo "expected-install-kind must be release or homebrew" >&2; exit 2; }
: "${TROM_RELEASES_URL:?TROM_RELEASES_URL must point at the fake feed}"

py=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 \
    && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    py=$candidate
    break
  fi
done
[[ -n "$py" ]] || { echo "Python 3 is required." >&2; exit 2; }

stopped=false
cleanup() {
  if [[ "$stopped" != true ]]; then
    "$trom" api stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

step() { echo; echo "== $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# json_assert <json> <python expression over d> <description>
json_assert() {
  printf '%s' "$1" | "$py" -I -c 'import sys, json; d = json.loads(sys.stdin.read()); sys.exit(0 if eval(sys.argv[1]) else 1)' "$2" \
    || fail "$3 (expected: $2)"
}

if [[ "$kind" == "" ]]; then
  kinds="('release', 'homebrew')"
else
  kinds="('$kind',)"
fi

step "trom --version"
output="$("$trom" --version)"
first="${output%%$'\n'*}"
first="${first%$'\r'}"
echo "$first"
[[ "$first" == "trom $version" ]] || fail "--version printed '$first', expected 'trom $version'"

step "trom api start --json"
out="$("$trom" api start --json)"
echo "$out"
json_assert "$out" "d['running'] is True and d['version'] == '$version' and d['matches'] is True" "Trom API did not start at $version"

step "GET $base/api/version"
out="$(curl -fsS --max-time 10 "$base/api/version")"
echo "$out"
json_assert "$out" "d['version'] == '$version'" "Trom API reports the wrong version"

step "GET $base/"
headers="$(curl -fsS --max-time 10 -D - -o /dev/null "$base/")"
echo "$headers"
printf '%s' "$headers" | grep -qi '^content-type:.*text/html' || fail "Trom UI was not served as text/html"

step "trom ui --no-open --json"
out="$("$trom" ui --no-open --json)"
echo "$out"
json_assert "$out" "d['available'] is True and d['opened'] is False" "Trom UI is not available"

step "trom init --json"
out="$("$trom" init --json)"
echo "$out"
json_assert "$out" "d['engine']['running'] is True and d['webUi']['available'] is True" "init does not show Trom API and Trom UI up"
json_assert "$out" "d['update']['installed'] == '$version' and d['update']['installKind'] in $kinds" "init reports the wrong install"

step "trom update --check --json"
out="$("$trom" update --check --json)"
echo "$out"
json_assert "$out" "d['installed'] == '$version' and d['available'] is True and d['installKind'] in $kinds" "update --check did not find the fake release"
if [[ -n "${SMOKE_NEXT_VERSION:-}" ]]; then
  json_assert "$out" "d['latest'] == '$SMOKE_NEXT_VERSION'" "update --check offered the wrong version"
fi

step "trom api status --json"
out="$("$trom" api status --json)"
echo "$out"
json_assert "$out" "d['running'] is True" "Trom API is not running"

step "trom api stop --json"
out="$("$trom" api stop --json)"
echo "$out"
stopped=true
json_assert "$out" "d['outcome'] == 'stopped'" "Trom API did not stop"

step "port 10213 is free"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ! curl -fsS --max-time 2 "$base/api/version" >/dev/null 2>&1; then
    echo "Trom API no longer answers."
    echo; echo "Smoke test passed for trom $version"
    exit 0
  fi
  sleep 1
done
fail "Trom API still answers after api stop"
