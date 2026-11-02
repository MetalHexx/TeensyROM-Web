# TeensyROM Suite Distribution Guide

**Last Updated**: 2026-11-01  
**Status**: Production Ready ✅

---

## 📋 Overview

This guide documents the complete distribution process for TeensyROM Suite, a self-contained desktop application that bundles the .NET Web API (the engine) and Angular frontend into a single executable for Windows, macOS, and Linux. Every download also carries the TeensyROM command-line tool (the CLI, `trom`) in `cli/`, next to the engine's `api/` folder.

**Distribution Goals**:
- Zero dependencies for end users (bundled .NET runtime)
- One download per platform: `api/` with the single-file engine and `cli/` with the single-file `trom`
- Automated GitHub Releases via CI/CD
- Updates from inside `trom` (`trom update`), no re-download
- macOS distribution via Homebrew (one formula installs all the commands)
- Cross-platform support (Windows, macOS Intel/ARM, Linux)

---

## 🏗️ Architecture

### Build Pipeline

```
┌─────────────────────────────────────────────────────┐
│  Source Code (Angular + .NET API + CLI)             │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Frontend Build (nx build --configuration=production)│
│  → dist/apps/teensyrom-ui/browser/                  │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Copy to API wwwroot/                               │
│  (Static file serving location)                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  package.sh publish: engine (self-contained, one    │
│  file) → <dir>/api/TeensyRom.Api[.exe]; CLI (self-  │
│  contained, one file) → <dir>/cli/trom[.exe]        │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  package.sh assemble: README.txt + api/ + cli/,     │
│  validate, chmod +x, archive                        │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Package & Distribute                               │
│  • Windows: .zip                                    │
│  • macOS: .tar.gz (Intel + ARM)                     │
│  • Linux: .tar.gz                                   │
│  • Homebrew formula (macOS only)                    │
└─────────────────────────────────────────────────────┘
```

### Single Executable Design

The published application:

1. **Bundles .NET 9 runtime** - No .NET SDK required on target machine
2. **Serves Angular SPA** - All frontend files embedded in wwwroot
3. **Provides API endpoints** - RadEndpoints at `/api/*` paths
4. **Enables SignalR hubs** - Real-time communication at `/api/logHub`, `/api/audioHub`, `/api/transferHub`
5. **Handles SPA routing** - Unknown routes serve `index.html` for Angular routing

**Runtime URL Structure**:
- API routes: `http://localhost:10213/api/devices`, `http://localhost:10213/api/files`, etc.
- SignalR hubs: `http://localhost:10213/api/logHub`, `http://localhost:10213/api/audioHub`, `http://localhost:10213/api/transferHub`
- SPA routes: `http://localhost:10213/` (index.html), `http://localhost:10213/player/music` (Angular routing)

### Package Layout and Home

Every platform's archive holds `README.txt`, the engine in `api/` and the CLI in `cli/`:

```
README.txt               ← Short start guide (src/apps/packaging/README.txt, version filled in)
api/
  TeensyRom.Api[.exe]    ← Engine (self-contained, single-file)
  appsettings.json       ← Runtime configuration
  wwwroot/               ← Angular frontend
  Assets/                ← Seed assets (unpacked)
cli/
  trom[.exe]             ← CLI (self-contained, single-file)
```

- **Single-file CLI**: `TeensyRom.Cli.csproj` has a publish-only property group, active when a `RuntimeIdentifier` is set and `SelfContained` is `true`: `PublishSingleFile`, `DebugType=embedded` (so there is no `.pdb`), no compression, and `IncludeNativeLibrariesForSelfExtract` and `PublishReadyToRun` on every RID except `osx-*`. `SelfContained` is never set without a RID, because the test projects reference the CLI (NETSDK1151). The logo font is an embedded resource (`TeensyRom.Cli.Fonts.Chunky.flf`), so nothing is read from beside the assembly. `package.sh assemble` fails when `cli/` holds anything but `trom[.exe]` (`.dylib` files are tolerated on `osx-*`).
- **The seam**: the packaged CLI finds the engine at `<cli folder>/../api/TeensyRom.Api[.exe]` (engine folder `<root>/api`) and starts it itself when it is not running; that folder is the engine's working directory and content root. The archive and the Homebrew formula must both keep `api/` and `cli/` side by side. Source runs find the engine by building it from the checkout instead.
- **The home**: both apps keep their state under one per-user home, `~/.teensyrom`. The engine uses `~/.teensyrom/api` (its `Assets/` working copy and logs, plus the `engine.lock` single-instance lock) and the CLI uses `~/.teensyrom/cli` (its own settings and logs). `TEENSYROM_DATA_DIR` moves the whole home. The engine copies the package's seed `Assets/` into `~/.teensyrom/api/Assets` when its version changes (it records the version in `Assets/.package-version`). Nothing is written beside the program, so a read-only install folder such as Homebrew's `libexec` works.

---

## 🔄 Updating

`trom update` runs inside `trom` (`CLI/Update/`); there is no second updater executable. `--check` only looks, `--yes` skips the confirmation (without a terminal, `--yes` is required).

**Release feed**: `https://api.github.com/repos/MetalHexx/TeensyROM-Suite/releases?per_page=30`, sent with `User-Agent: trom/<version>`. Drafts and non-SemVer tags are dropped. The hidden env var `TROM_RELEASES_URL` replaces the URL, and plain `http` is accepted only through it (the fake feed in package-test and `release-local`). A rate limit (403 with none left, or 429) is reported as such.

**Which release**: stable releases always qualify; pre-releases only when the installed version is itself a pre-release. The newest is the highest SemVer with an asset named `TeensyROM-Suite-{version}-{rid}.zip|.tar.gz` for this platform (`win-x64`, `osx-x64`, `osx-arm64`, `linux-x64`).

**Contract with the release**: the asset names and the GitHub `digest` (`sha256:<hex>`) on each asset. A download is streamed through SHA-256 and compared with `digest`; a missing digest is refused before any download, and a mismatch deletes the file and refuses.

**By install kind** (`InstallInspector`, from where `trom` runs):

| Kind | `trom update` |
|------|---------------|
| Release (packaged, outside a Homebrew `Cellar`) | Replaces the install in place, as below |
| Homebrew (packaged, path has a `/Cellar/` segment) | Stops the engine, runs `<prefix>/bin/brew update` and `brew upgrade teensyrom-suite`, verifies `<prefix>/bin/trom --version`, restarts the engine. Says so when Homebrew doesn't offer the new version yet |
| Source | Refused, pointing to `docs/contributing.md` |

**Release install, in order**: take `.trom-update/update.lock`; check disk space; download and verify into `<root>/.trom-update/`; extract to `staging/` (zip-slip refused; tar links and devices refused) and check `README.txt`, `api/<exe>`, `api/appsettings.json`, `api/wwwroot/index.html`, `cli/<trom>`; probe `staging/cli/trom --version` (must print `trom <release version>`); stop the engine (an engine started by another app that can't be stopped from the CLI refuses the update); swap (it targets the install's CLI folder; before anything new is written, `ApplyAsync` runs `Recover` on any earlier half-finished update), then restart the engine through the new `<root>/cli/trom` if it was running. The working folder is on the same volume as the install so moves are renames.

**The swap** is journaled (`.trom-update/journal.json`, flushed after every step): `api/` and `README.txt` move to `backup/`, the running `trom` is renamed to `trom[.exe].old` (Windows will not overwrite a running exe), staged entries move in, then commit. Moves retry with backoff for about 15 s (Defender, the search indexer). Any failure rolls back in reverse, restarts the old engine if it was running and throws. After a crash, the next `trom` run finishes the rollback from an uncommitted journal, and removes leftovers (`backup/`, `staging/`, `download/`, `cli/*.old`) quietly.

**Newer-engine guard**: a packaged `trom` never replaces a running engine that is newer than itself; it says to start `trom` again. This protects menus left open across an update.

**Homebrew**: `ApplyAsync` stops the engine, runs `brew update` and `brew upgrade teensyrom-suite` (output streamed to stderr), reads `<prefix>/bin/trom --version`, and starts the engine again through `<prefix>/bin/trom` even when brew failed (brew leaves whatever it linked). It fails with "Homebrew doesn't offer … yet" when the installed version is not newer than before.

**Platform**: `PlatformRid.Current` maps the OS and `RuntimeInformation.ProcessArchitecture` to `win-x64`, `osx-x64`, `osx-arm64` or `linux-x64`; any other combination has no package, and `trom update` says so.

**The release check**: `trom` fetches the feed at most every 24 h (a failure retries after 1 h) and records `<home>/cli/release-check.json`. Interactive commands (not `--json`, help, `--version`, `init` or `update`; a terminal is required) print one notice on stderr (code `updateAvailable`, at most once per 24 h; the lookup has 5 s and the command's end waits at most 1 s), and the guided menu shows the line under the logo and an "Update to {version}" entry before Leave, which closes the menu after a successful update. `trom init --json` reports `update: {installed, latest, available, installKind, checkedAt}` (no network for a source install). `trom settings set update-check false` turns the check off; source and unknown installs never check.

---

## 🔧 Local Development vs Production

### Development Mode

**Requirements**:
- .NET 9 SDK
- Node.js 20.x + pnpm
- Two separate processes

**Commands**:
```bash
# Terminal 1: Backend API (port 5168)
cd apps/api/src/TeensyRom.Api
dotnet run

# Terminal 2: Frontend dev server (port 4200)
pnpm start
```

**URL Configuration**:
- Frontend uses `isDevMode()` to detect development builds
- Development: API calls go to `http://localhost:5168`
- Production: API calls use relative paths (same origin)

### Production Build

**Requirements**:
- .NET 9 SDK (build machine only)
- Node.js 20.x + pnpm (build machine only)
- **End users need nothing** (self-contained executable)

**Single executable**:
- Serves both API and frontend from port 10213
- No external dependencies
- Self-contained .NET runtime

---

## 🚀 Local Testing (Before Release)

See the `release-local` skill for the current step-by-step local build/test process. It builds the package with `.github/scripts/package.sh`, smoke-tests it with `trom api start`, `trom ui --no-open` and `trom update --check`, and can run a full `trom update` against a fake release feed.

---

## 🤖 Automated Release Process

### Overview

GitHub Actions automates the entire release process:

1. **Trigger**: Push git tag starting with `v` (e.g., `v1.0.0`)
2. **Validate**: Extract version, detect pre-release, fail when the tag differs from `Version.props`
3. **Build**: the reusable `build-packages.yml`: check out and build the sibling SIDablist repo (the frontend depends on it), build the frontend once, then one package job per platform (4 in parallel) running `package.sh publish` and `assemble`
4. **Update Formula**: Calculate SHA256, update Homebrew formula with `.github/scripts/update-formula.sh` (every tag, pre-releases included)
5. **Release**: Create GitHub Release with all artifacts attached

### Workflow Files

**`.github/workflows/release.yml`** (on tag push). Jobs:
1. `validate` - Extract version from tag, detect pre-release, check the tag equals `<Version>` in `src/apps/Version.props`
2. `build` - `uses: ./.github/workflows/build-packages.yml` with the version
3. `update-formula` - Update Homebrew formula (no condition: runs for every tag, pre-releases included)
4. `release` - Create GitHub Release with artifacts

**`.github/workflows/build-packages.yml`** (`workflow_call`; inputs `version`, `rids`, `retention-days`). Job `frontend` builds Trom UI and uploads `wwwroot`; job `package` (RID matrix) downloads it and runs `.github/scripts/package.sh publish` then `assemble`, uploading `TeensyROM-Suite-<version>-<rid>`. It defines its own .NET and Node versions, because a called workflow doesn't inherit the caller's `env`.

**`.github/workflows/package-test.yml`** (pull requests touching `.github/workflows/{build-packages,package-test,release}.yml`, `.github/scripts/**`, `Formula/**`, `src/apps/cli/**`, `src/apps/api/src/TeensyRom.Api/**`, `src/apps/Version.props` or `src/apps/packaging/**`, plus manual dispatch). It builds osx-arm64, osx-x64 and linux-x64 and installs them without publishing, secrets or pushes:
- `macos` (arm64 on `macos-15`, x64 on `macos-15-intel`): a fake release feed, a local Homebrew tap with the real formula rewritten by `update-formula.sh` to `file://` URLs, `brew install`, `package-smoke.sh` on `$(brew --prefix)/bin/trom`, then `brew test`.
- `linux`: untar the package, `package-smoke.sh` on `cli/trom`, then `trom path add`, `status` and `remove` with a diff of `~/.bashrc`.

**Scripts** (`.github/scripts/`):
- `package.sh publish|assemble`: builds the package layout (see `release-local`).
- `update-formula.sh <formula> <version> <sha_arm> <sha_x64> [url_arm url_x64]`: the formula seds, portable between GNU and BSD sed; used by the release and by package-test.
- `fake_release_feed.py <dir> <next-version> <assets…>`: writes a GitHub-shaped `releases.json` (real `sha256:` digests, `http://127.0.0.1` URLs, an older release and a draft); `--digest wrong|none` writes bad digests.
- `package-smoke.sh <trom> <version> [release|homebrew]`: `--version`, `api start`, `/api/version`, `/` as `text/html`, `ui --no-open`, `init`, `update --check` against the fake feed, `api status`, `api stop`.

### Version Requirements

**Git Tag Format**:
```
v{major}.{minor}.{patch}[-{prerelease}]
```

**Examples**:
- `v1.0.0` - Stable release
- `v1.0.0-alpha.1` - Pre-release (marked as a pre-release on GitHub)
- `v2.1.3-beta.2` - Pre-release
- `v1.5.0-rc.1` - Pre-release

The formula is updated for **every** tag: the `update-formula` job has no `if:`, so pre-releases rewrite `version` and the checksums on `main` just like stable releases.

**Critical**: The version in `src/apps/Version.props` MUST match the git tag. It is imported by both `TeensyRom.Api.csproj` and `TeensyRom.Cli.csproj`, so one bump stamps the engine and the CLI:

```xml
<PropertyGroup>
  <Version>1.0.0</Version>  <!-- Must match git tag v1.0.0 -->
</PropertyGroup>
```

The `trom-agent` plugin is versioned with the tool suite: `src/plugins/trom-agent/claude/.claude-plugin/plugin.json` carries the same version as `Version.props`, and so does the agent version marker, the line `Agent version: 1.2.0` under `## Version` in `src/plugins/trom-agent/claude/skills/trom/SKILL.md` (a CLI test covers the manifest and the marker and fails on drift). `tr-plugin-marketplace` mirrors them in its copy of `plugin.json`, in the `trom-agent` entry of `.claude-plugin/marketplace.json`, and in its copy of the `SKILL.md` marker, which must match too.

**Tag check**: `validate` fails when the tag differs from `Version.props`. After it passes, `package.sh publish` still passes the version as `-p:Version=`, which equals `Version.props`, so:
- Version displayed in UI matches release tag
- `/api/version` and `trom --version` return the tag's version
- `assemble` checks `cli/trom --version` against it on a matching host

### Creating a Release

#### Step 1: Update Version in Code

**Version** (`src/apps/Version.props`, stamps the engine and the CLI):
```xml
<PropertyGroup>
  <Version>1.2.0</Version>
</PropertyGroup>
```

**Plugin version** (same value): `"version": "1.2.0"` in `src/plugins/trom-agent/claude/.claude-plugin/plugin.json`, and the marker line `Agent version: 1.2.0` under `## Version` in `src/plugins/trom-agent/claude/skills/trom/SKILL.md`; then in `tr-plugin-marketplace` update `plugins/trom-agent/claude/.claude-plugin/plugin.json`, the `trom-agent` entry in `.claude-plugin/marketplace.json`, and the `Agent version:` marker in `plugins/trom-agent/claude/skills/trom/SKILL.md`. That copy normally arrives by republishing the plugin source, so the marker must match there too.

**Verify frontend displays version**:
- Version shown in header (from `/api/version` endpoint)
- Open Scalar docs to verify version (`/scalar/v1`)

#### Step 2: Commit and Push

```bash
git add src/apps/Version.props src/plugins/trom-agent/claude/.claude-plugin/plugin.json src/plugins/trom-agent/claude/skills/trom/SKILL.md
git commit -m "chore: bump version to 1.2.0"
git push origin main
```

#### Step 3: Create and Push Tag

**Stable release**:
```bash
git tag v1.2.0
git push origin v1.2.0
```

**Pre-release**:
```bash
git tag v1.2.0-alpha.1
git push origin v1.2.0-alpha.1
```

#### Step 4: Monitor Workflow

1. Go to **Actions** tab on GitHub
2. Watch **Release** workflow execute
3. Check each job's logs if failures occur

**Workflow execution time**: ~10-15 minutes

**Job timeline**:
- `validate`: 10 seconds
- `build` (the frontend once, then 4 parallel package jobs): 8-12 minutes
- `update-formula`: 30 seconds
- `release`: 1-2 minutes

#### Step 5: Verify Release

**GitHub Release**:
1. Go to **Releases** page
2. Find release tagged `v1.2.0`
3. Verify 4 artifacts attached (each holds `README.txt`, `api/` and `cli/`), each with a GitHub `digest` (`gh release view v1.2.0 --json assets`); `trom update` needs both the names and the digests:
   - `TeensyROM-Suite-1.2.0-win-x64.zip`
   - `TeensyROM-Suite-1.2.0-osx-x64.tar.gz`
   - `TeensyROM-Suite-1.2.0-osx-arm64.tar.gz`
   - `TeensyROM-Suite-1.2.0-linux-x64.tar.gz`
4. Check pre-release checkbox (should be unchecked for stable)

**Homebrew Formula** (every release, pre-releases included):
1. Check `Formula/teensyrom-suite.rb` in repository
2. Verify version updated: `version "1.2.0"`
3. Verify SHA256 checksums updated (not PLACEHOLDER)
4. Check commit message: `chore: update Homebrew formula for v1.2.0`

**Formula updates**:
- `on_arm do` block: `sha256` updated with ARM64 tar.gz checksum
- `on_intel do` block: `sha256` updated with x64 tar.gz checksum
- URLs point to new version: `.../TeensyROM-Suite-1.2.0-osx-arm64.tar.gz`

### Troubleshooting Workflow Failures

#### Build Job Fails

**Frontend build errors**:
```bash
# Locally test frontend build
pnpm nx build teensyrom-ui --configuration=production
```

**Backend and CLI publish / package errors** (the same script CI runs):
```bash
bash .github/scripts/package.sh publish win-x64 1.2.0 ./src/publish/win-x64
bash .github/scripts/package.sh assemble win-x64 1.2.0 ./src/publish/win-x64 ./src/publish/out
```
`assemble` errors name the missing piece (`api/wwwroot/index.html`, `cli/` holding more than `trom[.exe]`, a `--version` mismatch).

**Common issues**:
- Missing dependencies: Check `pnpm-lock.yaml` committed
- `pnpm install --frozen-lockfile` cannot resolve `file:../../SIDablist/...`: the SIDablist checkout/build steps ahead of it in the build job failed or were removed (a tag has no matching SIDablist branch, so the job uses its `main`)
- Build configuration errors: Verify `nx.json` and `project.json` valid
- TypeScript errors: Run `pnpm nx lint` locally

#### Update Formula Job Fails

**Artifact download errors**:
- Build job must succeed first
- Verify macOS artifacts are created (check build logs)

**SHA256 calculation errors**:
- Check artifact names match pattern: `TeensyROM-Suite-{version}-osx-{arch}.tar.gz`
- Verify version output from validate job

**Commit errors**:
- Check GITHUB_TOKEN has `contents: write` permission
- Verify no merge conflicts in formula file

**sed errors**:
- Formula must have correct structure (`on_arm do ... end`, `on_intel do ... end`)
- `update-formula.sh` rewrites any line containing `version "` and edits `sha256` from `on_arm do`/`on_intel do` to the next `end`: keep new formula lines free of `version "` and outside those two blocks. It fails if the version or either checksum is not found afterwards. `package-test` runs it on the real formula, so a broken rule shows up in the pull request

#### Release Job Fails

**Dependency failures**:
- Check `build` job succeeded
- The job runs even when `update-formula` fails (`if: always() && needs.build.result == 'success'`), so a formula failure does not block the GitHub Release

**GitHub Release creation errors**:
- Tag must exist (pushed before workflow)
- Artifacts must be uploaded by build job
- Check permissions: GITHUB_TOKEN needs release permissions

---

## 🍺 Homebrew Distribution

### Overview

macOS users can install via Homebrew using a self-hosted tap:

```bash
brew tap MetalHexx/TeensyROM-Suite https://github.com/MetalHexx/TeensyROM-Suite
brew install teensyrom-suite
```

**Formula location**: `Formula/teensyrom-suite.rb` (repository root)

### Formula Structure

**Dual architecture support** (the URLs below take effect at the first suite release; see the upgrade path):
```ruby
class TeensyromSuite < Formula
  desc "TeensyROM Suite: Trom UI, Trom Terminal and Trom API for your TeensyROM"
  homepage "https://github.com/MetalHexx/TeensyROM-Suite"
  version "1.2.0"

  on_arm do
    url "https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v#{version}/TeensyROM-Suite-#{version}-osx-arm64.tar.gz"
    sha256 "abc123..."  # Calculated by workflow
  end

  on_intel do
    url "https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v#{version}/TeensyROM-Suite-#{version}-osx-x64.tar.gz"
    sha256 "def456..."  # Calculated by workflow
  end

  depends_on :macos

  conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli", because: "both install the TeensyROM CLI"

  def install
    libexec.install Dir["*"]

    if (libexec/"api/TeensyRom.Api").exist?
      # api/ + cli/ package: the engine and the CLI share the default home, ~/.teensyrom
      wrapper = <<~EOS
        #!/bin/zsh
        cd "#{libexec}/api"
        exec "./TeensyRom.Api" "$@"
      EOS
      (bin/"trom").write <<~EOS
        #!/bin/zsh
        exec "#{libexec}/cli/trom" "$@"
      EOS
      chmod 0755, bin/"trom"
    else
      # Older package (no cli/, engine predates ~/.teensyrom): the previous wrapper
      wrapper = <<~EOS
        #!/bin/zsh
        export TEENSYROM_DATA_DIR="${HOME}/Library/Application Support/TeensyROM-Web"
        mkdir -p "${TEENSYROM_DATA_DIR}"
        cd "#{libexec}"
        exec "./TeensyRom.Api" "$@"
      EOS
    end

    # teensyrom-web is kept as an alias so existing habits and scripts keep working
    %w[trom-suite teensyrom-web].each do |name|
      (bin/name).write wrapper
      chmod 0755, bin/name
    end
  end

  test do
    if (libexec/"cli/trom").exist?
      assert_match version.to_s, shell_output("#{bin}/trom --version", 0)
    else
      assert_predicate libexec/"TeensyRom.Api", :executable?
    end
  end
end
```

The formula also has a `caveats` block (omitted here) that teaches `trom ui`, `trom`, `trom-suite`, `trom update` / `brew upgrade` and `~/.teensyrom`. The real file, `Formula/teensyrom-suite.rb`, is the source of truth. `test` never starts the API: it has no `--version` (it would start the server and hang `brew test`).

**Install behavior**:
1. Downloads correct tar.gz for user's architecture (ARM64 or Intel)
2. Extracts all files to `libexec` (private location): `libexec/api` and `libexec/cli`
3. If `libexec/api/TeensyRom.Api` exists (the `api/` + `cli/` package), creates `trom` in `bin` (runs `libexec/cli/trom`) and makes the engine wrapper `cd` into `libexec/api`. Neither wrapper sets `TEENSYROM_DATA_DIR`, so both apps use `~/.teensyrom`
4. Otherwise (an older package, such as `1.0.0-alpha.8`, with the engine at the root and no `cli/`, whose engine still writes beside itself), the engine wrapper sets `TEENSYROM_DATA_DIR` to `~/Library/Application Support/TeensyROM-Web`. That `else` branch is deleted after the first suite release ships
5. Writes the engine wrapper into `bin` twice: `trom-suite` (starts Trom API in the foreground) and `teensyrom-web` (an alias kept for existing habits and scripts), then sets executable permissions
6. `conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli"`: the older CLI formula in the tap `MetalHexx/TeensyROM-CLI` installs a `TeensyRom.Cli` command; the line is kept so the two CLIs are not installed together
7. `depends_on :macos`: the formula only has macOS packages

**Result**: User can run `trom` (and `trom ui`) from anywhere; `trom-suite` (and its `teensyrom-web` alias) runs the engine in the foreground. `trom update` runs `brew upgrade teensyrom-suite` for a Homebrew install.

**Upgrade path**: old release downloads keep their `TeensyROM-Web-{version}-…` names. The formula's `url` lines point at those until the first suite release; the `update-formula` job then rewrites the URL prefix to `TeensyROM-Suite-` and the repo to `MetalHexx/TeensyROM-Suite`.

### Testing Homebrew Install

**Prerequisites**:
- macOS machine (Intel or Apple Silicon)
- Homebrew installed (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)

**Add tap** (first time only):
```bash
brew tap MetalHexx/TeensyROM-Suite https://github.com/MetalHexx/TeensyROM-Suite
```

**Install**:
```bash
brew install teensyrom-suite
```

**Verify**:
```bash
trom --version
# Should output: trom 1.2.0 (the version, then the OS and architecture)

trom ui
# Starts Trom API if needed, opens Trom UI in the browser, prints the local and network addresses

trom api stop
```

`trom-suite` instead runs the engine in the foreground (console shows: "Now listening on: http://localhost:10213"). The engine has no `--version`.

CI does this on every pull request that touches packaging: `package-test.yml` installs the formula from a local tap on macOS arm64 and x64 and runs `package-smoke.sh` against the installed `trom`.

**macOS Security Note**: First launch may require:
1. System Preferences → Security & Privacy → General
2. Click "Open Anyway" next to blocked message
3. Subsequent launches work without prompt

### Updating Formula Manually

If workflow automation fails, manually update formula:

```bash
# Calculate SHA256 for macOS artifacts
shasum -a 256 TeensyROM-Suite-1.2.0-osx-arm64.tar.gz
shasum -a 256 TeensyROM-Suite-1.2.0-osx-x64.tar.gz

# Update version, ARM64 sha256, x64 sha256 (the same script the workflow runs)
bash .github/scripts/update-formula.sh Formula/teensyrom-suite.rb 1.2.0 <sha_arm64> <sha_x64>

# Commit and push
git add Formula/teensyrom-suite.rb
git commit -m "chore: update Homebrew formula for v1.2.0"
git push origin main
```

**Test formula locally**:
```bash
brew install --build-from-source Formula/teensyrom-suite.rb
```

---

## 📦 Artifact Details

### File Sizes

Approximate sizes of the single-file `trom` (self-contained, uncompressed):

| Platform | `trom` size |
|----------|-------------|
| Windows x64 | 97 MB |
| Linux x64 | 97 MB |
| macOS ARM64 | 83 MB |

The engine and the archives have not been re-measured since the layout change, so no figures are given for them; measure a package from `package.sh assemble` or a release when you need them. Most of the engine is the bundled .NET 9 runtime, plus the Angular build, application assemblies and embedded assets (SID database, images).

**Compression**:
- Single-file publish of the engine uses compression (`EnableCompressionInSingleFile`); the CLI's single file is not compressed
- Archive formats use standard compression (gzip for tar.gz, deflate for zip)

### Archive Contents

**Windows** (`TeensyROM-Suite-1.2.0-win-x64.zip`):
```
README.txt
api/
  TeensyRom.Api.exe     (Engine, single-file executable)
  appsettings.json      (Runtime configuration)
  wwwroot/              (Angular frontend)
  Assets/               (Seed assets, unpacked)
  api-spec/             (OpenAPI schema)
  web.config            (IIS config - not needed for standalone)
  *.pdb, *.xml          (Debug symbols and XML docs - optional)
cli/
  trom.exe              (CLI, single-file, symbols embedded)
```

**macOS/Linux** (`TeensyROM-Suite-1.2.0-osx-arm64.tar.gz`): the same layout, with `api/TeensyRom.Api` and `cli/trom` (no `.exe`; both marked executable by `package.sh assemble`).

**Note**: `.pdb` files can be removed to reduce size, but they're helpful for debugging crash dumps.

### Download Locations

**GitHub Releases**:
```
https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.2.0/TeensyROM-Suite-1.2.0-win-x64.zip
https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.2.0/TeensyROM-Suite-1.2.0-osx-x64.tar.gz
https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.2.0/TeensyROM-Suite-1.2.0-osx-arm64.tar.gz
https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.2.0/TeensyROM-Suite-1.2.0-linux-x64.tar.gz
```

**Homebrew** (macOS only):
- Formula automatically fetches correct architecture
- URLs constructed from version in formula: `"https://github.com/.../v#{version}/TeensyROM-Suite-#{version}-osx-arm64.tar.gz"`

---

## 🔒 Security Considerations

### Code Signing

**Current state**: Executables are NOT code-signed

**Impact**:
- **Windows**: SmartScreen warning on first launch ("Windows protected your PC")
- **macOS**: Gatekeeper blocks unsigned apps (user must approve in System Preferences)
- **Linux**: No impact (code signing not required)

**Future enhancement**:
- Windows: Use Azure Code Signing with Azure Key Vault
- macOS: Use Apple Developer ID certificate with `codesign` and `notarytool`

### Permissions

**Serial port access**:
- Windows: Requires administrator rights for certain USB drivers
- macOS: User must grant permission in System Preferences (Security & Privacy → Privacy → USB)
- Linux: User must be in `dialout` group (`sudo usermod -a -G dialout $USER`)

**Firewall**:
- Trom API listens on `http://0.0.0.0:10213` so phones and tablets on the network can open Trom UI; `trom ui` prints the addresses
- Windows Firewall asks the first time it starts: allow Private networks
- Linux USB needs the user in the `dialout` group

### Dependency Vulnerabilities

**Frontend dependencies**: Monitored by GitHub Dependabot
**Backend dependencies**: Monitored by GitHub Dependabot

**Update process**:
1. Dependabot creates PR for vulnerable dependency
2. Review and test changes
3. Merge and create new release
4. Users update with `trom update` (or `brew upgrade teensyrom-suite`)

**Update integrity**: `trom update` downloads over HTTPS from the GitHub release and installs only a package whose SHA-256 matches the asset's GitHub `digest`. The packages are not code-signed.

---

## 📚 Related Documentation

- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../backend-architecture/references/BACKEND_ARCHITECTURE.md) - API design and serial communication (`backend-architecture` skill)
- **Frontend Architecture**: [OVERVIEW_CONTEXT.md](../../architecture-overview/references/OVERVIEW_CONTEXT.md) - Angular architecture and Clean Architecture layers (`architecture-overview` skill)
- **Testing Standards**: [TESTING_STANDARDS.md](../../testing-standards/references/TESTING_STANDARDS.md) - Unit, integration, and E2E testing approaches (`testing-standards` skill)
- **Component Library**: `pnpm component-docs list` - Reusable UI components (`component-library` skill)

---

## ❓ FAQ

### How do I test changes locally before creating a release?

Follow the **Local Testing** section above. Build frontend, run API, test publish command for your platform.

### Can I create a release without updating the Homebrew formula?

Not with the current workflow. The `update-formula` job has no `if:`, so every tag, pre-releases included, rewrites `version` and the checksums on `main`, and Homebrew users pick the release up as soon as that commit lands. To test a build without touching the formula, use the `release-local` skill.

### What if the workflow fails?

1. Check job logs in GitHub Actions
2. Test locally using publish commands from **Local Testing** section
3. Common issues: frontend build errors, missing dependencies, version mismatches
4. Fix issues, delete failed tag, push corrected tag

### How do I delete a failed release?

```bash
# Delete local tag
git tag -d v1.2.0

# Delete remote tag
git push origin :refs/tags/v1.2.0

# Delete GitHub Release (via web UI or gh CLI)
gh release delete v1.2.0 --yes
```

Then fix issues and recreate tag.

### Can I override the version during publish?

Locally, yes: `package.sh publish <rid> <version> <dir>` passes the version as `-p:Version=`, which is how `release-local` builds a fake newer package to try `trom update`. For a release, don't: the `validate` job fails unless the tag equals `src/apps/Version.props`, which keeps the git tag, `/api/version`, `trom --version` and the UI header on one version. Always update `Version.props` to match the git tag.

### Why does the executable need security approval on macOS?

The executable is not code-signed with an Apple Developer ID certificate. Users must:
1. Right-click executable → Open (or run from terminal)
2. System Preferences → Security & Privacy → Click "Open Anyway"
3. Future launches work without prompt

### How do I verify the Homebrew formula SHA256 checksums?

```bash
# Download artifacts from GitHub Release
curl -LO https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.2.0/TeensyROM-Suite-1.2.0-osx-arm64.tar.gz
curl -LO https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.2.0/TeensyROM-Suite-1.2.0-osx-x64.tar.gz

# Calculate SHA256
shasum -a 256 TeensyROM-Suite-1.2.0-osx-arm64.tar.gz
shasum -a 256 TeensyROM-Suite-1.2.0-osx-x64.tar.gz

# Compare with Formula/teensyrom-suite.rb
```

Checksums must match exactly.

### What ports does the application use?

**Default**: `http://localhost:10213`

**Customizing**:
```bash
# Windows (from the api\ folder)
$env:ASPNETCORE_URLS="http://localhost:8080"
.\TeensyRom.Api.exe

# macOS/Linux (from the api/ folder)
export ASPNETCORE_URLS="http://localhost:8080"
./TeensyRom.Api
```

`trom` expects the engine on 10213, so a different port is for running the engine on its own.

### Where does the app keep its data?

In one per-user home, `~/.teensyrom`: `api/` for the engine and `cli/` for the CLI. Set `TEENSYROM_DATA_DIR` to move the whole home (a relative value is made absolute). The engine copies the package's seed `Assets/` into `~/.teensyrom/api/Assets` when its version changes, and nothing is written beside the program. An older Homebrew package (no `cli/`) still keeps its data in `~/Library/Application Support/TeensyROM-Web` through the wrapper's `TEENSYROM_DATA_DIR`.

### How do I enable verbose logging?

```bash
# Windows (from the api\ folder)
$env:ASPNETCORE_ENVIRONMENT="Development"
.\TeensyRom.Api.exe

# macOS/Linux (from the api/ folder)
export ASPNETCORE_ENVIRONMENT="Development"
./TeensyRom.Api
```

Development mode enables:
- Detailed logging to console
- Developer exception pages
- CORS for localhost:4200 (frontend dev server)

---

## 🚧 Future Enhancements

### Planned Improvements

1. **Code Signing**
   - Windows: Azure Code Signing via GitHub Actions
   - macOS: Apple Developer ID certificate + notarization

2. **Update banner in Trom UI**
   - `trom update` and the release check exist in `trom`; Trom UI does not show an update notice yet

3. **Installer Packages**
   - Windows: MSI installer via WiX Toolset
   - macOS: DMG with drag-to-Applications
   - Linux: .deb and .rpm packages

4. **Chocolatey/Scoop** (Windows package managers)
   - `choco install teensyrom-suite`
   - `scoop install teensyrom-suite`

5. **Linux Package Repositories**
   - Ubuntu PPA
   - Arch AUR package
   - Flatpak/Snap support

6. **Microsoft Store / Mac App Store**
   - Requires code signing + store accounts
   - Automated distribution to stores

---

## 📞 Support

**Issues**: [GitHub Issues](https://github.com/MetalHexx/TeensyROM-Suite/issues)  
**Discussions**: [GitHub Discussions](https://github.com/MetalHexx/TeensyROM-Suite/discussions)  
**Wiki**: [Project Wiki](https://github.com/MetalHexx/TeensyROM-Suite/wiki)

For distribution-specific issues:
- Tag with `distribution` label
- Include platform (Windows/macOS/Linux)
- Attach relevant logs from console output
