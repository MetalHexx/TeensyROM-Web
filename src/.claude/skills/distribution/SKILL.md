---
name: distribution
description: 'Distribution and release pipeline reference for TeensyROM Web. Use for questions about the build/release architecture (single-executable design, build pipeline stages), the automated GitHub Actions release workflow and its troubleshooting, Homebrew formula structure and distribution, artifact sizes/contents, code signing and other security considerations, or the distribution FAQ. NOT for actually running a release or local test build — use the `release` or `release-local` skills for that.'
---

# Distribution Skill

Reference for how TeensyROM Web is built, packaged, and released as a self-contained desktop application (bundled .NET 9 Web API + Angular frontend) for Windows, macOS, and Linux.

## When to Use This Skill

- Understanding the build pipeline architecture (frontend build → wwwroot copy → self-contained `dotnet publish` → package)
- Understanding the single-executable design (bundled runtime, SPA routing, SignalR hubs, API routes all on one process/port)
- Questions about the automated release workflow (`.github/workflows/release.yml`): jobs, version/tag requirements, troubleshooting failures
- Questions about the Homebrew formula (`Formula/teensyrom-web.rb`) structure, dual-architecture support, or manual formula updates
- Questions about artifact details: executable/archive sizes per platform, archive contents, download URLs
- Security considerations: code signing status, OS permission prompts (SmartScreen/Gatekeeper), serial port permissions, dependency vulnerability monitoring
- General distribution FAQ (pre-releases, deleting a failed release, overriding version, ports, verbose logging)

**Not for**: actually performing a release or a local test build — use the `release` skill (official releases) or the `release-local` skill (local test builds) for the step-by-step process.

## Overview

**Distribution goals**: zero end-user dependencies (bundled .NET runtime), single executable per platform, automated GitHub Releases via CI/CD, Homebrew distribution on macOS, and cross-platform support (Windows x64, macOS Intel/ARM, Linux x64).

**Build pipeline**: Angular production build → copy to API `wwwroot/` → self-contained single-file `dotnet publish` per platform → package into `.zip`/`.tar.gz` (+ Homebrew formula for macOS).

**Release trigger**: pushing a git tag matching `v{major}.{minor}.{patch}[-{prerelease}]`; the tag version must match `TeensyRom.Api.csproj`'s `<Version>`. Pre-release tags (e.g. `-alpha.1`) skip the Homebrew formula update but still produce a GitHub Release with all 4 platform artifacts.

## Full Reference

See [references/DISTRIBUTION.md](references/DISTRIBUTION.md) for the complete guide, including:

- Architecture: build pipeline diagram, single-executable design, runtime URL structure
- Automated release process: workflow jobs, version/tag requirements, step-by-step release creation, troubleshooting workflow failures (build/update-formula/release job failures)
- Homebrew distribution: formula structure, install behavior, testing an install, manually updating the formula
- Artifact details: file sizes per platform, archive contents, download locations
- Security considerations: code signing status and impact, serial port permissions, dependency vulnerability monitoring
- FAQ: testing before release, pre-releases, workflow failure recovery, deleting a failed release, port/logging configuration
- Future enhancements: code signing, auto-update, installer packages, additional package managers

For local build/test steps, see the `release-local` skill instead.
