---
name: distribution
description: 'Distribution and release pipeline reference for TeensyROM Suite. Use for questions about the build/release architecture (single-executable design, build pipeline stages), the package layout (`api/` plus the single-file CLI in `cli/`) and the shared `~/.teensyrom` home, how `trom update` replaces an install, the automated GitHub Actions release and package-test workflows and their troubleshooting, Homebrew formula structure and distribution, artifact sizes/contents, code signing and other security considerations, or the distribution FAQ. NOT for actually running a release or local test build — use the `release` or `release-local` skills for that.'
---

# Distribution Skill

Reference for how TeensyROM Suite is built, packaged, and released as a self-contained desktop application (bundled .NET 9 Web API engine + Angular frontend, with the CLI alongside) for Windows, macOS, and Linux.

## When to Use This Skill

- Understanding the build pipeline architecture (frontend build → wwwroot copy → self-contained `dotnet publish` of the engine and of the CLI → package)
- Understanding the package layout (`api/` and `cli/`) and where the apps keep their data
- Understanding how `trom update` and the daily release check work, and what they require of the release assets
- Understanding the single-executable design (bundled runtime, SPA routing, SignalR hubs, API routes all on one process/port)
- Questions about the automated release workflow (`.github/workflows/release.yml`, the reusable `build-packages.yml` and the test-only `package-test.yml`): jobs, version/tag requirements, troubleshooting failures
- Questions about the Homebrew formula (`Formula/teensyrom-suite.rb`) structure, dual-architecture support, its commands (`trom`, `trom-suite` and the `teensyrom-web` alias) and the conflict with the older CLI formula, or manual formula updates
- Questions about artifact details: executable/archive sizes per platform, archive contents, download URLs
- Security considerations: code signing status, OS permission prompts (SmartScreen/Gatekeeper), serial port permissions, dependency vulnerability monitoring
- General distribution FAQ (pre-releases, deleting a failed release, overriding version, ports, verbose logging)

**Not for**: actually performing a release or a local test build — use the `release` skill (official releases) or the `release-local` skill (local test builds) for the step-by-step process.

## Overview

**Distribution goals**: zero end-user dependencies (bundled .NET runtime), one download per platform (`api/` with the single-file engine plus `cli/` with the single-file `trom`), automated GitHub Releases via CI/CD, updates from inside `trom`, Homebrew distribution on macOS, and cross-platform support (Windows x64, macOS Intel/ARM, Linux x64).

**Build pipeline**: Angular production build (needs the sibling SIDablist repo, which the `frontend` job checks out and builds first, once) → `wwwroot` artifact → per platform, `.github/scripts/package.sh publish` (self-contained single-file `dotnet publish` of the engine into `api/` and of the CLI into `cli/`) and `package.sh assemble` (unpack `Assets` zips, render `README.txt`, validate the layout, set executable bits, archive to `.zip`/`.tar.gz`). `build-packages.yml` is the reusable workflow that does this; `release.yml` and `package-test.yml` call it.

**Package layout**: `README.txt`, `api/` (`TeensyRom.Api[.exe]`, `wwwroot/`, `Assets/`, `appsettings.json`) and `cli/` (`trom[.exe]`, a single file). The packaged CLI finds the engine at `<cli folder>/../api/TeensyRom.Api[.exe]`, so the archive and the formula must keep that relationship. A PATH entry for `<root>/cli` stays valid across updates.

**Home**: both apps keep state under `~/.teensyrom` (`api/` for the engine, `cli/` for the CLI); `TEENSYROM_DATA_DIR` moves the whole home. The engine copies the package's seed assets into the home on version change and writes nothing beside the program.

**Updates**: `trom update` (`--check`, `--yes`) runs inside `trom` with no second updater executable. A release install downloads the package for its platform, verifies the GitHub `digest`, stages and probes it, stops the engine, swaps `api/`, `cli/` and `README.txt` under a journal (rolling back on any failure) and restarts the engine through the new `trom`; a Homebrew install runs `brew upgrade`; a source build is refused. `trom` also checks for a newer release at most once a day (`<home>/cli/release-check.json`, setting `update-check`), and `trom init --json` reports it as `update`. The asset names and `digest` values are a contract with that code.

**Homebrew**: the formula installs `trom` (runs `libexec/cli/trom`), `trom-suite` (starts Trom API in the foreground) and the `teensyrom-web` alias, and it conflicts with the older `metalhexx/teensyrom-cli/teensyrom-cli` formula. A package without `api/` (the `1.0.0-alpha.8` layout) keeps the previous single-wrapper install in an `else` branch, which is deleted after the first suite release ships.

**Release trigger**: pushing a git tag matching `v{major}.{minor}.{patch}[-{prerelease}]`; the tag version must equal `<Version>` in `src/apps/Version.props` (shared by the engine and the CLI), or the `validate` job fails; the `trom-agent` plugin's `plugin.json` and its `Agent version:` marker (under `## Version` in `src/plugins/trom-agent/claude/skills/trom/SKILL.md`) carry the same version; the three version locations in this repo are bumped in one commit, and the marketplace copies of `plugin.json` and the marker follow by pull request after the release (the `release` skill's Step 7). `CHANGELOG.md` must hold a section for the version: `validate` fails without it, and the release publishes it as its notes. Pre-release tags (e.g. `-alpha.1`) are marked as pre-releases on GitHub and **do** update the Homebrew formula (the `update-formula` job has no `if:`); every release produces all 4 platform artifacts.

**Package test**: `package-test.yml` (pull requests touching packaging paths, and manual dispatch) builds the packages and installs them without publishing anything: through a real Homebrew install on macOS arm64 and x64, and from the tarball on Linux. Each runs `package-smoke.sh` against a fake release feed.

## Full Reference

See [references/DISTRIBUTION.md](references/DISTRIBUTION.md) for the complete guide, including:

- Architecture: build pipeline diagram, single-executable design, runtime URL structure, package layout and home
- Updating: `trom update`, the release check, the asset contract
- Automated release process: workflow jobs, the package-test workflow, version/tag requirements, step-by-step release creation, troubleshooting workflow failures (build/update-formula/release job failures)
- Homebrew distribution: formula structure, install behavior, testing an install, manually updating the formula
- Artifact details: file sizes per platform, archive contents (`api/` plus `cli/`), download locations
- Security considerations: code signing status and impact, serial port permissions, dependency vulnerability monitoring
- FAQ: testing before release, pre-releases, workflow failure recovery, deleting a failed release, port/logging configuration
- Future enhancements: code signing, installer packages, additional package managers

For local build/test steps, see the `release-local` skill instead.
