---
name: distribution
description: 'Distribution and release pipeline reference for TeensyROM Web. Use for questions about the build/release architecture (single-executable design, build pipeline stages), the package layout (engine plus the CLI in `cli/`) and the shared `~/.teensyrom` home, the automated GitHub Actions release workflow and its troubleshooting, Homebrew formula structure and distribution (two commands), artifact sizes/contents, code signing and other security considerations, or the distribution FAQ. NOT for actually running a release or local test build — use the `release` or `release-local` skills for that.'
---

# Distribution Skill

Reference for how TeensyROM Web is built, packaged, and released as a self-contained desktop application (bundled .NET 9 Web API engine + Angular frontend, with the CLI alongside) for Windows, macOS, and Linux.

## When to Use This Skill

- Understanding the build pipeline architecture (frontend build → wwwroot copy → self-contained `dotnet publish` of the engine and of the CLI → package)
- Understanding the package layout (engine at the root, CLI in `cli/`) and where the apps keep their data
- Understanding the single-executable design (bundled runtime, SPA routing, SignalR hubs, API routes all on one process/port)
- Questions about the automated release workflow (`.github/workflows/release.yml`): jobs, version/tag requirements, troubleshooting failures
- Questions about the Homebrew formula (`Formula/teensyrom-web.rb`) structure, dual-architecture support, its two commands (`teensyrom-web`, `trom`) and the conflict with the older CLI formula, or manual formula updates
- Questions about artifact details: executable/archive sizes per platform, archive contents, download URLs
- Security considerations: code signing status, OS permission prompts (SmartScreen/Gatekeeper), serial port permissions, dependency vulnerability monitoring
- General distribution FAQ (pre-releases, deleting a failed release, overriding version, ports, verbose logging)

**Not for**: actually performing a release or a local test build — use the `release` skill (official releases) or the `release-local` skill (local test builds) for the step-by-step process.

## Overview

**Distribution goals**: zero end-user dependencies (bundled .NET runtime), one download per platform (the single-file engine plus the CLI in `cli/`), automated GitHub Releases via CI/CD, Homebrew distribution on macOS, and cross-platform support (Windows x64, macOS Intel/ARM, Linux x64).

**Build pipeline**: Angular production build (needs the sibling SIDablist repo, which the build job checks out and builds first) → copy to API `wwwroot/` → self-contained single-file `dotnet publish` of the engine per platform → self-contained (not single-file) `dotnet publish` of the CLI into `publish/<rid>/cli` → package into `.zip`/`.tar.gz` (+ Homebrew formula for macOS).

**Package layout**: the engine (`TeensyRom.Api[.exe]`, `wwwroot/`, `Assets/`, `appsettings.json`) at the archive root, the CLI in `cli/`. The packaged CLI finds the engine at `../TeensyRom.Api[.exe]`, so the archive and the formula must keep that relationship.

**Home**: both apps keep state under `~/.teensyrom` (`api/` for the engine, `cli/` for the CLI); `TEENSYROM_DATA_DIR` moves the whole home. The engine copies the package's seed assets into the home on version change and writes nothing beside the program.

**Homebrew**: the formula installs `teensyrom-web` and, when the package has `cli/`, `trom` (it conflicts with the older `metalhexx/teensyrom-cli/teensyrom-cli` formula). A package without `cli/` keeps the previous single-wrapper install.

**Release trigger**: pushing a git tag matching `v{major}.{minor}.{patch}[-{prerelease}]`; the tag version must match `<Version>` in `src/apps/Version.props` (shared by the engine and the CLI); the `trom-agent` plugin's `plugin.json` and its marketplace entry carry the same version, bumped in the same commit. Pre-release tags (e.g. `-alpha.1`) are marked as pre-releases on GitHub and **do** update the Homebrew formula (the `update-formula` job has no `if:`); every release produces all 4 platform artifacts.

## Full Reference

See [references/DISTRIBUTION.md](references/DISTRIBUTION.md) for the complete guide, including:

- Architecture: build pipeline diagram, single-executable design, runtime URL structure, package layout and home
- Automated release process: workflow jobs, version/tag requirements, step-by-step release creation, troubleshooting workflow failures (build/update-formula/release job failures)
- Homebrew distribution: formula structure, install behavior, testing an install, manually updating the formula
- Artifact details: file sizes per platform, archive contents (engine plus `cli/`), download locations
- Security considerations: code signing status and impact, serial port permissions, dependency vulnerability monitoring
- FAQ: testing before release, pre-releases, workflow failure recovery, deleting a failed release, port/logging configuration
- Future enhancements: code signing, auto-update, installer packages, additional package managers

For local build/test steps, see the `release-local` skill instead.
