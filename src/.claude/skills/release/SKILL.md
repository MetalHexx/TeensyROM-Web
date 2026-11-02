---
name: release
description: Automate the TeensyROM Suite release process with version bumping, tagging, and GitHub Release management
user-invocable: true
disable-model-invocation: true
---

# Release TeensyROM Suite

This skill automates the TeensyROM Suite release process by bumping the version, creating a git tag, and managing GitHub releases.

## Prerequisites

- All changes must be committed and pushed to main branch
- You must have the new version number ready (e.g., `1.0.0`, `1.0.0-alpha.1`, `2.1.0-beta.2`)
- Follow semantic versioning: `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-prerelease`

## Pre-flight

- The GitHub repo is named `TeensyROM-Suite`. The formula, the docs and `trom update` all read `MetalHexx/TeensyROM-Suite`, so rename before the first suite release.
- The release PR is merged to `main` (for `1.0.0-beta.1`, PR #93).
- The `Package Test` workflow (`.github/workflows/package-test.yml`) is green on the commit being tagged. It builds the packages and installs them: a real Homebrew install on macOS (arm64 and x64) and a tarball install on Linux, both smoke-tested with `.github/scripts/package-smoke.sh`. It runs only on `pull_request` and `workflow_dispatch`, so after the version bump lands on main, run `gh workflow run package-test.yml --ref main` and wait for it to pass before tagging.
- The tag equals `<Version>` in `src/apps/Version.props`. The `validate` job of `release.yml` fails otherwise.

## Process

### Step 1: Bump Version

Ask the user for the new version number, then update the `<Version>` element in the shared version file. It stamps both the engine (`TeensyRom.Api`) and the CLI (`TeensyRom.Cli`), so there is one place to bump:

**File**: `src/apps/Version.props`

```xml
<Version>NEW_VERSION_HERE</Version>
```

The `trom-agent` plugin is versioned with the tool suite, so the same version goes in two more places in this repo: `"version"` in `src/plugins/trom-agent/claude/.claude-plugin/plugin.json`, and the line `Agent version: NEW_VERSION_HERE` under `## Version` in `src/plugins/trom-agent/claude/skills/trom/SKILL.md` (the agent version marker). In the `tr-plugin-marketplace` repo set `plugins/trom-agent/claude/.claude-plugin/plugin.json` and the `trom-agent` entry of `.claude-plugin/marketplace.json`, and set the marker in `plugins/trom-agent/claude/skills/trom/SKILL.md` to match too: that copy normally arrives by republishing the plugin source. A CLI test covers the manifest and the marker and fails when either drifts from `Version.props`.

Example versions:
- Stable release: `1.0.0`, `1.2.3`, `2.0.0`
- Pre-release: `1.0.0-alpha.1`, `1.0.0-beta.1`, `2.0.0-rc.1`

Commit the version bump:
```bash
git add src/apps/Version.props src/plugins/trom-agent/claude/.claude-plugin/plugin.json src/plugins/trom-agent/claude/skills/trom/SKILL.md
git commit -m "chore: bump version to {version}"
git push origin main
```

### Step 2: Create Git Tag

Create and push a git tag with the `v` prefix to trigger the release workflow:

```bash
git tag v{version}
git push origin v{version}
```

### Step 3: Monitor Release Workflow

Inform the user that the release workflow has been triggered and provide them with:
- GitHub Actions workflow URL: `https://github.com/MetalHexx/TeensyROM-Suite/actions`
- Expected completion time: ~15-20 minutes for all 4 platform builds

Tell them: "The release workflow is now running. It will build TeensyROM Suite for all 4 platforms (win-x64, osx-x64, osx-arm64, linux-x64) and create a GitHub Release with the artifacts. This typically takes 15-20 minutes. I'll wait for you to confirm when the release has been created."

### Step 4: Update Release Notes

Once the user confirms the release has been created or provides a link to it:

1. Use `gh release view v{version}` (or the GitHub MCP tools if available) to fetch the release details
2. Ask the user for release notes content (what's new, bug fixes, breaking changes, etc.)
3. Use `gh release edit v{version} --notes "..."` (or the GitHub MCP tools) to update the release with the provided notes

The release will already have:
- ✅ Title: `TeensyROM Suite v{version}`
- ✅ Tag: `v{version}`
- ✅ Pre-release flag (if version contains `-`)
- ✅ All 4 platform artifacts attached (each holds `README.txt`, `api/` and `cli/`)

You just need to add the release body/notes. Start from this template:

````markdown
## What's new
- {highlights; lead with `trom ui` while it is new to readers}

## Update
- Already on a suite release: `trom update` (`trom update --check` only looks).
- Installed with Homebrew: `brew update && brew upgrade teensyrom-suite`.
- Fresh install: download the package for your platform below, unpack it and run `cli/trom ui` (`cli\trom ui` on Windows).

Alpha installs start fresh: there is no data migration from `1.0.0-alpha.*`.

## Downloads
- Windows x64: `TeensyROM-Suite-{version}-win-x64.zip`
- macOS Apple silicon: `TeensyROM-Suite-{version}-osx-arm64.tar.gz`
- macOS Intel: `TeensyROM-Suite-{version}-osx-x64.tar.gz`
- Linux x64: `TeensyROM-Suite-{version}-linux-x64.tar.gz`

Docs: https://github.com/MetalHexx/TeensyROM-Suite/blob/main/docs/getting-started.md
````

### Step 5: Post-Release Checks

1. `gh release view v{version} --json assets`: exactly the 4 assets, each with a `digest` (`sha256:<hex>`).
2. The `chore: update Homebrew formula for v{version}` commit is on `main`, with the version and both `sha256` values set.
3. Download one package from the release page and smoke-test it. Point `TEENSYROM_DATA_DIR` at a temp folder, unpack, run `cli/trom --version` (prints `trom {version}`) and `cli/trom ui --no-open --json`, then `cli/trom api stop`.
4. From an older install, `trom update --check` reports the new release.
5. On a Mac with Homebrew: `brew update && brew upgrade teensyrom-suite`, then `trom --version`.

### Step 6: Publish Trom Agent to tr-plugin-marketplace

Run this after the release, whenever the plugin changed or its version moved with the suite. The marketplace repo is `MetalHexx/tr-plugin-marketplace` (local clone `C:\dev\src\tr-plugin-marketplace`). `main` is protected, so publish by pull request.

1. In the clone: `git fetch`, then branch from `origin/main`.
2. Make `plugins/trom-agent/claude/` identical to this repo's `src/plugins/trom-agent/claude/`: copy it over and delete files the source no longer has. `.claude-plugin/plugin.json` and the `Agent version:` marker in `skills/trom/SKILL.md` already carry the release version.
3. Set `"version"` on the `trom-agent` entry of `.claude-plugin/marketplace.json` to the release version.
4. Update both READMEs: the root `README.md` (the *Needs* cell of the plugins table) and `plugins/trom-agent/README.md` (the *Install from source* bullet and *Where the source lives*). Link `https://github.com/MetalHexx/TeensyROM-Suite` instead of `TeensyROM-Web`, and drop the build-from-source text: the skill installs and updates `trom` from releases and Homebrew.
5. Commit, push the branch and open a PR. Merge after review.

## Example Workflow

```
User: /release
Agent: What version would you like to release? (e.g., 1.0.0 or 1.0.0-alpha.1)
User: 1.2.0
Agent: [Updates src/apps/Version.props, commits, creates tag v1.2.0, pushes]
Agent: ✅ Version bumped to 1.2.0 and tag v1.2.0 created. The release workflow is now running at https://github.com/MetalHexx/TeensyROM-Suite/actions. This will take ~15-20 minutes to complete. Please let me know when the release has been created.
User: The release is ready at https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.2.0
Agent: Great! What release notes would you like to add? Include what's new, bug fixes, breaking changes, etc.
User: [Provides release notes]
Agent: [Updates release with notes]
Agent: ✅ Release notes updated! Release is now complete: https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.2.0
```

## Important Notes

- The version in `src/apps/Version.props` MUST match the git tag version (without the `v` prefix)
- The plugin version (`plugin.json`, the agent version marker in `plugins/trom-agent/claude/skills/trom/SKILL.md`, and their marketplace copies in `tr-plugin-marketplace`) MUST match `Version.props`
- Pre-release versions (containing `-`) are automatically marked as pre-release in GitHub
- The workflow builds self-contained executables - no .NET SDK required to run them
- Every artifact holds `README.txt`, `api/` (the engine: `TeensyRom.Api[.exe]`, `appsettings.json`, `wwwroot/`, `Assets/`) and `cli/` (`trom[.exe]`, one file). The CLI finds the engine at `../api/TeensyRom.Api[.exe]`
- **Contract with `trom update`**: the asset names below and each asset's GitHub `digest` (`sha256:<hex>`) are read by `trom update`. It picks the newest release with an asset for its platform and refuses a download whose SHA-256 doesn't match, or that has no `digest`. Don't rename assets or attach them by hand. Drafts are ignored
- Artifacts are automatically attached to the release:
  - `TeensyROM-Suite-{version}-win-x64.zip`
  - `TeensyROM-Suite-{version}-osx-x64.tar.gz`
  - `TeensyROM-Suite-{version}-osx-arm64.tar.gz`
  - `TeensyROM-Suite-{version}-linux-x64.tar.gz`

## Error Handling

If the version bump fails, tag creation fails, or workflow fails:
1. Check git status and resolve conflicts
2. Verify version format is valid semver
3. Ensure tag doesn't already exist
4. Check GitHub Actions logs for build errors

If you need to retry:
1. Delete the tag: `git tag -d v{version}` and `git push origin :refs/tags/v{version}`
2. Fix the issue
3. Recreate the tag and push

## Technical Details

- Workflow file: `.github/workflows/release.yml` (jobs `validate`, `build`, `update-formula`, `release`). `build` calls the reusable `.github/workflows/build-packages.yml`, which builds Trom UI once and then one package per platform with `.github/scripts/package.sh`
- Version source: `src/apps/Version.props` (imported by the engine and the CLI projects)
- Build platforms: win-x64, osx-x64, osx-arm64, linux-x64
- Build time: ~15-20 minutes (parallel matrix builds)
- Artifact retention: 5 days in GitHub Actions, permanent in Releases
- Repository: MetalHexx/TeensyROM-Suite

## Related

- **Local test release** (no tagging/CI): the `release-local` skill (`.claude/skills/release-local/SKILL.md`)
