# TeensyROM Web Distribution Guide

**Last Updated**: 2025-12-06  
**Status**: Production Ready ✅

---

## 📋 Overview

This guide documents the complete distribution process for TeensyROM Web, a self-contained desktop application that bundles the .NET Web API and Angular frontend into a single executable for Windows, macOS, and Linux.

**Distribution Goals**:
- Zero dependencies for end users (bundled .NET runtime)
- Single executable per platform
- Automated GitHub Releases via CI/CD
- macOS distribution via Homebrew
- Cross-platform support (Windows, macOS Intel/ARM, Linux)

---

## 🏗️ Architecture

### Build Pipeline

```
┌─────────────────────────────────────────────────────┐
│  Source Code (Angular + .NET API)                  │
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
│  dotnet publish (self-contained, single-file)       │
│  → Single executable per platform                   │
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
4. **Enables SignalR hubs** - Real-time communication at `/logHub`, `/deviceEventHub`
5. **Handles SPA routing** - Unknown routes serve `index.html` for Angular routing

**Runtime URL Structure**:
- API routes: `http://localhost:213/api/devices`, `http://localhost:213/api/files`, etc.
- SignalR hubs: `http://localhost:213/logHub`, `http://localhost:213/deviceEventHub`
- SPA routes: `http://localhost:213/` (index.html), `http://localhost:213/player/music` (Angular routing)

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
- Serves both API and frontend from port 213
- No external dependencies
- Self-contained .NET runtime

---

## 🚀 Local Testing (Before Release)

See the `release-local` skill for the current step-by-step local build/test process.

---

## 🤖 Automated Release Process

### Overview

GitHub Actions automates the entire release process:

1. **Trigger**: Push git tag starting with `v` (e.g., `v1.0.0`)
2. **Validate**: Extract version, detect pre-release
3. **Build**: Build frontend, publish for 4 platforms in parallel
4. **Update Formula**: Calculate SHA256, update Homebrew formula (stable only)
5. **Release**: Create GitHub Release with all artifacts attached

### Workflow File

**Location**: `.github/workflows/release.yml`

**Jobs**:
1. `validate` - Extract version from tag, detect pre-release
2. `build` - Matrix build for 4 platforms (win-x64, osx-x64, osx-arm64, linux-x64)
3. `update-formula` - Update Homebrew formula (stable releases only)
4. `release` - Create GitHub Release with artifacts

### Version Requirements

**Git Tag Format**:
```
v{major}.{minor}.{patch}[-{prerelease}]
```

**Examples**:
- `v1.0.0` - Stable release (formula updated)
- `v1.0.0-alpha.1` - Pre-release (formula NOT updated)
- `v2.1.3-beta.2` - Pre-release (formula NOT updated)
- `v1.5.0-rc.1` - Pre-release (formula NOT updated)

**Critical**: The version in `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` MUST match the git tag:

```xml
<PropertyGroup>
  <Version>1.0.0</Version>  <!-- Must match git tag v1.0.0 -->
</PropertyGroup>
```

**Why no version override?**: The workflow does NOT use `-p:Version=` to override the .csproj version. This ensures:
- Version displayed in UI matches release tag
- `/api/version` endpoint returns correct version
- No version mismatch confusion

### Creating a Release

#### Step 1: Update Version in Code

**Backend version** (`apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`):
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
git add apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj
git commit -m "chore: bump version to 1.2.0"
git push origin main
```

#### Step 3: Create and Push Tag

**Stable release**:
```bash
git tag v1.2.0
git push origin v1.2.0
```

**Pre-release** (formula NOT updated):
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
- `update-formula`: 30 seconds (stable only)
- `release`: 1-2 minutes

#### Step 5: Verify Release

**GitHub Release**:
1. Go to **Releases** page
2. Find release tagged `v1.2.0`
3. Verify 4 artifacts attached:
   - `TeensyROM-Web-1.2.0-win-x64.zip`
   - `TeensyROM-Web-1.2.0-osx-x64.tar.gz`
   - `TeensyROM-Web-1.2.0-osx-arm64.tar.gz`
   - `TeensyROM-Web-1.2.0-linux-x64.tar.gz`
4. Check pre-release checkbox (should be unchecked for stable)

**Homebrew Formula** (stable releases only):
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
```

**Common issues**:
- Missing dependencies: Check `pnpm-lock.yaml` committed
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
- Placeholder values must match exactly: `PLACEHOLDER_SHA256_ARM64`, `PLACEHOLDER_SHA256_X64`

#### Release Job Fails

**Dependency failures**:
- Check `build` job succeeded
- Pre-releases: Formula update can be skipped (expected)

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
  
  def install
    libexec.install Dir["*"]
    (bin/"teensyrom-web").write <<~EOS
      #!/bin/zsh
      exec "#{libexec}/TeensyRom.Api" "$@"
    EOS
    chmod 0755, bin/"teensyrom-web"
  end
  
  test do
    system "#{bin}/teensyrom-web", "--version"
  end
end
```

**Install behavior**:
1. Downloads correct tar.gz for user's architecture (ARM64 or Intel)
2. Extracts all files to `libexec` (private location)
3. Creates wrapper script at `/usr/local/bin/teensyrom-web`
4. Sets executable permissions

**Result**: User can run `teensyrom-web` from anywhere

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
# Application should start, console shows: "Now listening on: http://localhost:5000"
```

**Open in browser**:
```bash
open http://localhost:5000
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

**Compression**:
- Single-file publish uses compression (`EnableCompressionInSingleFile`)
- Archive formats use standard compression (gzip for tar.gz, deflate for zip)

### Archive Contents

**Windows** (`TeensyROM-Web-1.2.0-win-x64.zip`):
```
TeensyRom.Api.exe       (Single executable)
TeensyRom.Api.pdb       (Debug symbols - optional)
web.config              (IIS config - not needed for standalone)
```

**macOS/Linux** (`TeensyROM-Web-1.2.0-osx-arm64.tar.gz`):
```
TeensyRom.Api           (Single executable, no .exe extension)
TeensyRom.Api.pdb       (Debug symbols - optional)
```

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
- Application listens on `http://localhost:5000` (local only, no external network access)
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

Yes, create a **pre-release** by adding a suffix to the version:
```bash
git tag v1.2.0-alpha.1
git push origin v1.2.0-alpha.1
```

Pre-releases skip formula updates but still create GitHub Releases with artifacts.

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

**Not recommended**. The workflow does NOT use `-p:Version=` to override `.csproj` version. This ensures:
- Version consistency between git tag and application
- `/api/version` endpoint returns correct version
- UI header displays correct version

Always update `TeensyRom.Api.csproj` to match git tag.

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

**Default**: `http://localhost:5000`

**Customizing**:
```bash
# Windows
$env:ASPNETCORE_URLS="http://localhost:8080"
.\TeensyRom.Api.exe

# macOS/Linux
export ASPNETCORE_URLS="http://localhost:8080"
./TeensyRom.Api
```

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
