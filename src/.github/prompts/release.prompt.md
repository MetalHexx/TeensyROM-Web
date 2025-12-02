---
description: Automate the TeensyROM Web release process with version bumping, tagging, and GitHub Release management
---

# Release TeensyROM Web

This slash command automates the TeensyROM Web release process by bumping the version, creating a git tag, and managing GitHub releases.

## Prerequisites

- All changes must be committed and pushed to main branch
- You must have the new version number ready (e.g., `1.0.0`, `1.0.0-alpha.1`, `2.1.0-beta.2`)
- Follow semantic versioning: `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-prerelease`

## Process

### Step 1: Bump Version

Ask the user for the new version number, then update the `<Version>` element in the TeensyRom.Api.csproj file:

**File**: `src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`

```xml
<Version>NEW_VERSION_HERE</Version>
```

Example versions:
- Stable release: `1.0.0`, `1.2.3`, `2.0.0`
- Pre-release: `1.0.0-alpha.1`, `1.0.0-beta.1`, `2.0.0-rc.1`

Commit the version bump:
```bash
git add src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj
git commit -m "chore: bump version to {version}"
git push origin main
```

### Step 2: Create Git Tag

Create and push a git tag with the `v` prefix to trigger the release workflow:

```bash
git tag v{version}
git push origin v{version}
```

Use git commands via `run_in_terminal` or GitHub MCP tools to create the tag.

### Step 3: Monitor Release Workflow

Inform the user that the release workflow has been triggered and provide them with:
- GitHub Actions workflow URL: `https://github.com/MetalHexx/TeensyROM-Web/actions`
- Expected completion time: ~15-20 minutes for all 4 platform builds

Tell them: "The release workflow is now running. It will build TeensyROM Web for all 4 platforms (win-x64, osx-x64, osx-arm64, linux-x64) and create a GitHub Release with the artifacts. This typically takes 15-20 minutes. I'll wait for you to confirm when the release has been created."

### Step 4: Update Release Notes

Once the user confirms the release has been created or provides a link to it:

1. Use `mcp_io_github_git_get_release` to fetch the release details
2. Ask the user for release notes content (what's new, bug fixes, breaking changes, etc.)
3. Use `mcp_io_github_git_update_release` to update the release with the provided notes

The release will already have:
- ✅ Title: `TeensyROM Web v{version}`
- ✅ Tag: `v{version}`
- ✅ Pre-release flag (if version contains `-`)
- ✅ All 4 platform artifacts attached

You just need to add the release body/notes.

## Example Workflow

```
User: /release
Agent: What version would you like to release? (e.g., 1.0.0 or 1.0.0-alpha.1)
User: 1.2.0
Agent: [Updates TeensyRom.Api.csproj, commits, creates tag v1.2.0, pushes]
Agent: ✅ Version bumped to 1.2.0 and tag v1.2.0 created. The release workflow is now running at https://github.com/MetalHexx/TeensyROM-Web/actions. This will take ~15-20 minutes to complete. Please let me know when the release has been created.
User: The release is ready at https://github.com/MetalHexx/TeensyROM-Web/releases/tag/v1.2.0
Agent: Great! What release notes would you like to add? Include what's new, bug fixes, breaking changes, etc.
User: [Provides release notes]
Agent: [Updates release with notes]
Agent: ✅ Release notes updated! Release is now complete: https://github.com/MetalHexx/TeensyROM-Web/releases/tag/v1.2.0
```

## Important Notes

- The version in TeensyRom.Api.csproj MUST match the git tag version (without the `v` prefix)
- Pre-release versions (containing `-`) are automatically marked as pre-release in GitHub
- The workflow builds self-contained executables - no .NET SDK required to run them
- Artifacts are automatically attached to the release:
  - `TeensyROM-Web-{version}-win-x64.zip`
  - `TeensyROM-Web-{version}-osx-x64.tar.gz`
  - `TeensyROM-Web-{version}-osx-arm64.tar.gz`
  - `TeensyROM-Web-{version}-linux-x64.tar.gz`

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

- Workflow file: `.github/workflows/release.yml`
- Version source: `src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`
- Build platforms: win-x64, osx-x64, osx-arm64, linux-x64
- Build time: ~15-20 minutes (parallel matrix builds)
- Artifact retention: 5 days in GitHub Actions, permanent in Releases
- Repository: MetalHexx/TeensyROM-Web
