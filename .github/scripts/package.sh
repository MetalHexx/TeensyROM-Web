#!/usr/bin/env bash
# Builds the TeensyROM Suite release package.
#
#   package.sh publish  <rid> <version> <dir>        dotnet publish the API into <dir>/api and the CLI into <dir>/cli
#   package.sh assemble <rid> <version> <dir> <out>  turn <dir> into <out>/TeensyROM-Suite-<version>-<rid>.zip|.tar.gz
#
# <rid> is win-x64, osx-x64, osx-arm64, linux-x64 or linux-arm64. assemble prints the archive path as its last line.
# Runs on Linux, macOS, Git Bash and WSL; assemble works in a temp folder on the local file system because
# chmod does nothing on /mnt/c.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

die() { echo "package.sh: $*" >&2; exit 1; }

usage() {
  sed -n "2,7p" "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

python_cmd() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 \
      && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
      echo "$candidate"
      return
    fi
  done
  die "Python 3 is required (python3 or python)."
}

check_rid() {
  case "$1" in
    win-x64|osx-x64|osx-arm64|linux-x64|linux-arm64) ;;
    *) die "Unsupported rid '$1'. Use win-x64, osx-x64, osx-arm64, linux-x64 or linux-arm64." ;;
  esac
}

check_version() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || die "Invalid version '$1'."
}

absolute() {
  mkdir -p "$1"
  (cd "$1" && pwd)
}

publish() {
  local rid=$1 version=$2 dir
  check_rid "$rid"
  check_version "$version"
  dir="$(absolute "$3")"

  cd "$repo"

  dotnet publish src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
    -c Release \
    -r "$rid" \
    --self-contained true \
    -p:PublishSingleFile=true \
    -p:SkipBuildFrontend=true \
    -p:OpenApiGenerateDocuments=false \
    -p:OpenApiGenerateDocumentsOnBuild=false \
    -p:Version="$version" \
    -o "$dir/api"

  dotnet publish src/apps/cli/src/TeensyRom.Cli/TeensyRom.Cli.csproj \
    -c Release \
    -r "$rid" \
    --self-contained true \
    -p:Version="$version" \
    -o "$dir/cli"
}

assemble() {
  local rid=$1 version=$2 src out py api_exe cli_exe archive entry
  check_rid "$rid"
  check_version "$version"
  [[ -d "$3/api" && -d "$3/cli" ]] || die "'$3' must hold api/ and cli/ (run publish first)."
  src="$(absolute "$3")"
  out="$(absolute "$4")"
  py="$(python_cmd)"

  if [[ "$rid" == win-* ]]; then
    api_exe="TeensyRom.Api.exe"
    cli_exe="trom.exe"
  else
    api_exe="TeensyRom.Api"
    cli_exe="trom"
  fi

  tmp="$(mktemp -d)" # global: the EXIT trap runs after this function returns
  trap 'rm -rf "$tmp"' EXIT

  cp -R "$src/api" "$tmp/"
  cp -R "$src/cli" "$tmp/"

  # Unpack the Assets zips now so the API does not extract them at runtime into a read-only folder.
  if [[ -d "$tmp/api/Assets" ]]; then
    local zip
    while IFS= read -r -d '' zip; do
      echo "Extracting ${zip#"$tmp"/}"
      "$py" -m zipfile -e "$zip" "$(dirname "$zip")"
      rm -f "$zip"
    done < <(find "$tmp/api/Assets" -type f -name '*.zip' -print0)
  fi

  sed "s/{{VERSION}}/$version/g" "$repo/src/apps/packaging/README.txt" > "$tmp/README.txt"

  [[ -f "$tmp/api/$api_exe" ]] || die "api/$api_exe is missing."
  [[ -f "$tmp/api/appsettings.json" ]] || die "api/appsettings.json is missing."
  [[ -f "$tmp/api/wwwroot/index.html" ]] || die "api/wwwroot/index.html is missing; build the frontend first."
  [[ -d "$tmp/api/Assets" ]] || die "api/Assets is missing."
  [[ -f "$tmp/cli/$cli_exe" ]] || die "cli/$cli_exe is missing."

  for entry in "$tmp"/cli/* "$tmp"/cli/.[!.]*; do
    [[ -e "$entry" ]] || continue
    entry="$(basename "$entry")"
    [[ "$entry" == "$cli_exe" ]] && continue
    [[ "$rid" == osx-* && "$entry" == *.dylib ]] && continue
    die "cli/ must hold only $cli_exe, but it also holds '$entry'."
  done

  chmod +x "$tmp/api/$api_exe" "$tmp/cli/$cli_exe"

  if [[ "$rid" == win-* ]]; then
    archive="$out/TeensyROM-Suite-$version-$rid.zip"
    rm -f "$archive"
    (cd "$tmp" && "$py" -m zipfile -c "$archive" README.txt api cli)
  else
    archive="$out/TeensyROM-Suite-$version-$rid.tar.gz"
    rm -f "$archive"
    COPYFILE_DISABLE=1 tar -czf "$archive" -C "$tmp" README.txt api cli
  fi

  smoke_version "$rid" "$version" "$tmp/cli/$cli_exe"

  echo "$archive"
}

host_rid() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os/$arch" in
    Linux/x86_64) echo linux-x64 ;;
    Linux/aarch64|Linux/arm64) echo linux-arm64 ;;
    Darwin/arm64) echo osx-arm64 ;;
    Darwin/x86_64) echo osx-x64 ;;
    MINGW*/x86_64|MSYS*/x86_64|CYGWIN*/x86_64) echo win-x64 ;;
    *) echo "" ;;
  esac
}

smoke_version() {
  local rid=$1 version=$2 exe=$3 output first
  if [[ "$(host_rid)" != "$rid" ]]; then
    echo "Skipping --version check: this host cannot run $rid."
    return
  fi
  output="$("$exe" --version)" || die "$exe --version failed."
  first="${output%%$'\n'*}"
  first="${first%$'\r'}"
  [[ "$first" == "trom $version" ]] || die "Expected 'trom $version' from --version, got '$first'."
  echo "Checked: $first"
}

[[ $# -ge 1 ]] || usage
command_name=$1
shift

case "$command_name" in
  publish)  [[ $# -eq 3 ]] || usage; publish "$@" ;;
  assemble) [[ $# -eq 4 ]] || usage; assemble "$@" ;;
  *) usage ;;
esac
