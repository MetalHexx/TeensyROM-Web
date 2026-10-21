# TeensyROM Web Distribution Guide

**Last Updated**: 2026-10-19  
**Status**: Production Ready ✅

---

## 📋 Overview

This guide documents the complete distribution process for TeensyROM Web, a self-contained desktop application that bundles the .NET Web API (the engine) and Angular frontend into a single executable for Windows, macOS, and Linux. Every download also carries the TeensyROM command-line tool (the CLI) in a `cli/` subfolder beside the engine.

**Distribution Goals**:
- Zero dependencies for end users (bundled .NET runtime)
- One download per platform: the single-file engine plus the CLI in `cli/`
- Automated GitHub Releases via CI/CD
- macOS distribution via Homebrew (one formula installs both commands)
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
│  dotnet publish engine (self-contained, one file)   │
│  → publish/<rid>/TeensyRom.Api[.exe]                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  dotnet publish CLI (self-contained, folder)        │
│  → publish/<rid>/cli/trom[.exe]                     │
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

Every platform's archive has the engine at its root and the CLI in `cli/`:

```
TeensyRom.Api[.exe]      ← Engine (self-contained, single-file)
appsettings.json         ← Runtime configuration
wwwroot/                 ← Angular frontend
Assets/                  ← Seed assets (unpacked)
cli/
  trom[.exe]             ← CLI, with its own runtime, Fonts/ and dependencies
```

- **Self-contained, not single-file**: the CLI resolves its fonts from its assembly location, which is empty in a single-file bundle. Keeping it in its own subfolder also stops the two self-contained apps' runtimes from overwriting each other.
- **The seam**: the packaged CLI finds the engine at `../TeensyRom.Api[.exe]` relative to its own folder, and starts it itself when it is not running. The archive and the Homebrew formula must both keep `cli/` directly inside the engine's folder.
- **The home**: both apps keep their state under one per-user home, `~/.teensyrom`. The engine uses `~/.teensyrom/api` (its `Assets/` working copy and logs, plus the `engine.lock` single-instance lock) and the CLI uses `~/.teensyrom/cli` (its own settings and logs). `TEENSYROM_DATA_DIR` moves the whole home. The engine copies the package's seed `Assets/` into `~/.teensyrom/api/Assets` when its version changes (it records the version in `Assets/.package-version`). Nothing is written beside the program, so a read-only install folder such as Homebrew's `libexec` works.

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

See the `release-local` skill for the current step-by-step local build/test process. It also publishes the CLI into `cli/` and smoke-tests it from the package.

---

## 🤖 Automated Release Process

### Overview

GitHub Actions automates the entire release process:

1. **Trigger**: Push git tag starting with `v` (e.g., `v1.0.0`)
2. **Validate**: Extract version, detect pre-release
3. **Build**: Check out and build the sibling SIDablist repo (the frontend depends on it), build the frontend, publish the engine and the CLI for 4 platforms in parallel
4. **Update Formula**: Calculate SHA256, update Homebrew formula (every tag, pre-releases included)
5. **Release**: Create GitHub Release with all artifacts attached

### Workflow File

**Location**: `.github/workflows/release.yml`

**Jobs**:
1. `validate` - Extract version from tag, detect pre-release
2. `build` - Matrix build for 4 platforms (win-x64, osx-x64, osx-arm64, linux-x64); publishes the engine, then the CLI into `cli/`
3. `update-formula` - Update Homebrew formula (no condition: runs for every tag, pre-releases included)
4. `release` - Create GitHub Release with artifacts

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

**Why no version override?**: The workflow does NOT use `-p:Version=` to override the version in `Version.props`. This ensures:
- Version displayed in UI matches release tag
- `/api/version` endpoint returns correct version
- No version mismatch confusion

### Creating a Release

#### Step 1: Update Version in Code

**Version** (`src/apps/Version.props`, stamps the engine and the CLI):
```xml
<PropertyGroup>
  <Version>1.2.0</Version>
</PropertyGroup>
```

**Verify frontend displays version**:
- Version shown in header (from `/api/version` endpoint)
- Open Scalar docs to verify version (`/scalar/v1`)

#### Step 2: Commit and Push

```bash
git add src/apps/Version.props
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
- `build` (4 parallel jobs): 8-12 minutes
- `update-formula`: 30 seconds
- `release`: 1-2 minutes

#### Step 5: Verify Release

**GitHub Release**:
1. Go to **Releases** page
2. Find release tagged `v1.2.0`
3. Verify 4 artifacts attached (each holds the engine at its root and the CLI in `cli/`):
   - `TeensyROM-Web-1.2.0-win-x64.zip`
   - `TeensyROM-Web-1.2.0-osx-x64.tar.gz`
   - `TeensyROM-Web-1.2.0-osx-arm64.tar.gz`
   - `TeensyROM-Web-1.2.0-linux-x64.tar.gz`
4. Check pre-release checkbox (should be unchecked for stable)

**Homebrew Formula** (every release, pre-releases included):
1. Check `Formula/teensyrom-web.rb` in repository
2. Verify version updated: `version "1.2.0"`
3. Verify SHA256 checksums updated (not PLACEHOLDER)
4. Check commit message: `chore: update Homebrew formula for v1.2.0`

**Formula updates**:
- `on_arm do` block: `sha256` updated with ARM64 tar.gz checksum
- `on_intel do` block: `sha256` updated with x64 tar.gz checksum
- URLs point to new version: `.../TeensyROM-Web-1.2.0-osx-arm64.tar.gz`

### Troubleshooting Workflow Failures

#### Build Job Fails

**Frontend build errors**:
```bash
# Locally test frontend build
pnpm nx build teensyrom-ui --configuration=production
```

**Backend publish errors**:
```bash
# Locally test publish
dotnet publish apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:OpenApiGenerateDocuments=false \
  -p:OpenApiGenerateDocumentsOnBuild=false \
  -o ./publish/win-x64

# Locally test the CLI publish (self-contained, not single-file)
dotnet publish apps/cli/src/TeensyRom.Cli/TeensyRom.Cli.csproj \
  -c Release -r win-x64 --self-contained true \
  -o ./publish/win-x64/cli
```

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
- Check artifact names match pattern: `TeensyROM-Web-{version}-osx-{arch}.tar.gz`
- Verify version output from validate job

**Commit errors**:
- Check GITHUB_TOKEN has `contents: write` permission
- Verify no merge conflicts in formula file

**sed errors**:
- Formula must have correct structure (`on_arm do ... end`, `on_intel do ... end`)
- The job rewrites any line containing `version "` and edits `sha256` from `on_arm do`/`on_intel do` to the next `end`: keep new formula lines free of `version "` and outside those two blocks

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
brew install MetalHexx/TeensyROM/teensyrom-web
```

**Formula location**: `Formula/teensyrom-web.rb` (repository root)

### Formula Structure

**Dual architecture support**:
```ruby
class TeensyromWeb < Formula
  desc "Desktop application for managing TeensyROM devices"
  homepage "https://github.com/MetalHexx/TeensyROM-Web"
  version "1.2.0"
  
  on_arm do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-osx-arm64.tar.gz"
    sha256 "abc123..."  # Calculated by workflow
  end
  
  on_intel do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-osx-x64.tar.gz"
    sha256 "def456..."  # Calculated by workflow
  end
  
  conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli", because: "both install the TeensyROM CLI"

  def install
    libexec.install Dir["*"]
    if (libexec/"cli/trom").exist?
      # Combined package: engine and CLI share the default home, ~/.teensyrom
      (bin/"teensyrom-web").write <<~EOS
        #!/bin/zsh
        cd "#{libexec}"
        exec "./TeensyRom.Api" "$@"
      EOS
      (bin/"trom").write <<~EOS
        #!/bin/zsh
        exec "#{libexec}/cli/trom" "$@"
      EOS
      chmod 0755, bin/"trom"
    else
      # Older package (no cli/, engine predates ~/.teensyrom): the previous wrapper
      # (sets TEENSYROM_DATA_DIR to ~/Library/Application Support/TeensyROM-Web)
    end
    chmod 0755, bin/"teensyrom-web"
  end
  
  test do
    system "#{bin}/teensyrom-web", "--version"
  end
end
```

**Install behavior**:
1. Downloads correct tar.gz for user's architecture (ARM64 or Intel)
2. Extracts all files to `libexec` (private location): the engine at its root, the CLI in `libexec/cli`
3. If `libexec/cli/trom` exists (the combined package), creates two wrapper scripts in `bin`: `teensyrom-web` (changes to `libexec`, runs the engine) and `trom` (runs `libexec/cli/trom`). Neither sets `TEENSYROM_DATA_DIR`, so both apps use `~/.teensyrom`
4. Otherwise (an older package with no `cli/`, such as `1.0.0-alpha.8`, whose engine still writes beside itself), keeps the previous `teensyrom-web` wrapper unchanged, which sets `TEENSYROM_DATA_DIR` to `~/Library/Application Support/TeensyROM-Web`. That `else` branch can be deleted after the first release that contains `cli/`
5. Sets executable permissions
6. `conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli"`: the older CLI formula in the tap `MetalHexx/TeensyROM-CLI` installs a `TeensyRom.Cli` command; the line is kept so the two CLIs are not installed together

**Result**: User can run `teensyrom-web` (and, with the combined package, `trom`) from anywhere

### Testing Homebrew Install

**Prerequisites**:
- macOS machine (Intel or Apple Silicon)
- Homebrew installed (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)

**Add tap** (first time only):
```bash
brew tap MetalHexx/TeensyROM
```

**Install**:
```bash
brew install teensyrom-web
```

**Verify**:
```bash
teensyrom-web --version
# Should output: 1.2.0 (or current version)

teensyrom-web
# Application should start, console shows: "Now listening on: http://localhost:10213"
```

With the combined package, `trom` starts the engine itself when it is not running, and `trom engine stop` stops it.

**Open in browser**:
```bash
open http://localhost:10213
```

**macOS Security Note**: First launch may require:
1. System Preferences → Security & Privacy → General
2. Click "Open Anyway" next to blocked message
3. Subsequent launches work without prompt

### Updating Formula Manually

If workflow automation fails, manually update formula:

```bash
# Calculate SHA256 for macOS artifacts
shasum -a 256 TeensyROM-Web-1.2.0-osx-arm64.tar.gz
shasum -a 256 TeensyROM-Web-1.2.0-osx-x64.tar.gz

# Edit Formula/teensyrom-web.rb
# Update version, ARM64 sha256, x64 sha256

# Commit and push
git add Formula/teensyrom-web.rb
git commit -m "chore: update Homebrew formula for v1.2.0"
git push origin main
```

**Test formula locally**:
```bash
brew install --build-from-source Formula/teensyrom-web.rb
```

---

## 📦 Artifact Details

### File Sizes

Approximate sizes for self-contained builds:

| Platform | Executable Size | Archive Size |
|----------|----------------|--------------|
| Windows x64 | 122 MB | 47 MB (.zip) |
| macOS x64 | 108 MB | 42 MB (.tar.gz) |
| macOS ARM64 | 98 MB | 38 MB (.tar.gz) |
| Linux x64 | 115 MB | 44 MB (.tar.gz) |

**Why so large?**
- Bundled .NET 9 runtime (~90 MB)
- Angular production build (~5 MB)
- Application assemblies (~10 MB)
- Embedded assets (SID database, images, etc.) (~15 MB)

**The CLI adds to every archive**: it is self-contained but not single-file, so `cli/` carries its own runtime and dependencies (about 80 MB uncompressed in a local win-x64 publish). The sizes above predate it.

**Compression**:
- Single-file publish of the engine uses compression (`EnableCompressionInSingleFile`); the CLI folder is not single-file
- Archive formats use standard compression (gzip for tar.gz, deflate for zip)

### Archive Contents

**Windows** (`TeensyROM-Web-1.2.0-win-x64.zip`):
```
TeensyRom.Api.exe       (Engine, single-file executable)
appsettings.json        (Runtime configuration)
wwwroot/                (Angular frontend)
Assets/                 (Seed assets, unpacked)
api-spec/               (OpenAPI schema)
web.config              (IIS config - not needed for standalone)
*.pdb, *.xml            (Debug symbols and XML docs - optional)
cli/
  trom.exe              (CLI, with its own runtime, Fonts/ and dependencies)
```

**macOS/Linux** (`TeensyROM-Web-1.2.0-osx-arm64.tar.gz`): the same layout, with `TeensyRom.Api` and `cli/trom` (no `.exe`; both marked executable by the workflow).

**Note**: `.pdb` files can be removed to reduce size, but they're helpful for debugging crash dumps.

### Download Locations

**GitHub Releases**:
```
https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-win-x64.zip
https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-osx-x64.tar.gz
https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-osx-arm64.tar.gz
https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-linux-x64.tar.gz
```

**Homebrew** (macOS only):
- Formula automatically fetches correct architecture
- URLs constructed from version in formula: `"https://github.com/.../v#{version}/TeensyROM-Web-#{version}-osx-arm64.tar.gz"`

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
- Application listens on `http://localhost:10213` (local only, no external network access)
- No firewall prompt should appear (loopback only)

### Dependency Vulnerabilities

**Frontend dependencies**: Monitored by GitHub Dependabot
**Backend dependencies**: Monitored by GitHub Dependabot

**Update process**:
1. Dependabot creates PR for vulnerable dependency
2. Review and test changes
3. Merge and create new release
4. Users download updated version

**No auto-update mechanism**: Users must manually download new releases

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

**Not recommended**. The workflow does NOT use `-p:Version=` to override the version in `src/apps/Version.props`. This ensures:
- Version consistency between git tag and application
- `/api/version` endpoint returns correct version
- UI header displays correct version

Always update `src/apps/Version.props` to match git tag.

### Why does the executable need security approval on macOS?

The executable is not code-signed with an Apple Developer ID certificate. Users must:
1. Right-click executable → Open (or run from terminal)
2. System Preferences → Security & Privacy → Click "Open Anyway"
3. Future launches work without prompt

### How do I verify the Homebrew formula SHA256 checksums?

```bash
# Download artifacts from GitHub Release
curl -LO https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-osx-arm64.tar.gz
curl -LO https://github.com/MetalHexx/TeensyROM-Web/releases/download/v1.2.0/TeensyROM-Web-1.2.0-osx-x64.tar.gz

# Calculate SHA256
shasum -a 256 TeensyROM-Web-1.2.0-osx-arm64.tar.gz
shasum -a 256 TeensyROM-Web-1.2.0-osx-x64.tar.gz

# Compare with Formula/teensyrom-web.rb
```

Checksums must match exactly.

### What ports does the application use?

**Default**: `http://localhost:10213`

**Customizing**:
```bash
# Windows
$env:ASPNETCORE_URLS="http://localhost:8080"
.\TeensyRom.Api.exe

# macOS/Linux
export ASPNETCORE_URLS="http://localhost:8080"
./TeensyRom.Api
```

### Where does the app keep its data?

In one per-user home, `~/.teensyrom`: `api/` for the engine and `cli/` for the CLI. Set `TEENSYROM_DATA_DIR` to move the whole home (a relative value is made absolute). The engine copies the package's seed `Assets/` into `~/.teensyrom/api/Assets` when its version changes, and nothing is written beside the program. An older Homebrew package (no `cli/`) still keeps its data in `~/Library/Application Support/TeensyROM-Web` through the wrapper's `TEENSYROM_DATA_DIR`.

### How do I enable verbose logging?

```bash
# Windows
$env:ASPNETCORE_ENVIRONMENT="Development"
.\TeensyRom.Api.exe

# macOS/Linux
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

2. **Auto-Update**
   - Check for updates on launch
   - Prompt user to download new version
   - Verify signatures before updating

3. **Installer Packages**
   - Windows: MSI installer via WiX Toolset
   - macOS: DMG with drag-to-Applications
   - Linux: .deb and .rpm packages

4. **Chocolatey/Scoop** (Windows package managers)
   - `choco install teensyrom-web`
   - `scoop install teensyrom-web`

5. **Linux Package Repositories**
   - Ubuntu PPA
   - Arch AUR package
   - Flatpak/Snap support

6. **Microsoft Store / Mac App Store**
   - Requires code signing + store accounts
   - Automated distribution to stores

---

## 📞 Support

**Issues**: [GitHub Issues](https://github.com/MetalHexx/TeensyROM-Web/issues)  
**Discussions**: [GitHub Discussions](https://github.com/MetalHexx/TeensyROM-Web/discussions)  
**Wiki**: [Project Wiki](https://github.com/MetalHexx/TeensyROM-Web/wiki)

For distribution-specific issues:
- Tag with `distribution` label
- Include platform (Windows/macOS/Linux)
- Attach relevant logs from console output
