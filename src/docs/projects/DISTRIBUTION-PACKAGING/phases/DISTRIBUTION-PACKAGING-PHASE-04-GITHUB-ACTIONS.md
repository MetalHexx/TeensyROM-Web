# Phase 04: GitHub Actions Workflow

## 🎯 Objective

Create an automated release pipeline using GitHub Actions that builds, packages, and publishes releases for all supported platforms with semantic versioning.

**Value Delivered**: Tag-triggered releases with automatic artifact generation for Windows, macOS (Intel + ARM), and Linux.

**Prerequisite**: Phase 03 (Publishing Configuration) and Phase 3a (Semantic Versioning) must be complete.

---

## 🔑 Key Design Decisions (from Brainstorming)

### Versioning Strategy: Manual (Option A)
- **`.csproj` is source of truth** - version in file is what gets published
- **Git tag triggers release** - `git tag v1.0.0-alpha.1 && git push origin v1.0.0-alpha.1`
- **CI uses .csproj version** - no override, builds what's in the file
- **Developer workflow**: Update .csproj → commit → tag → push = release
- **Your responsibility**: Keep `.csproj` version in sync with tag before pushing

### Build Environment: Ubuntu with Bash
- **Ubuntu runners** - faster startup, common practice
- **Frontend built in CI** - bash commands replicate `copy-frontend.ps1`
- **.csproj has `SkipBuildFrontend` condition** - CI passes `-p:SkipBuildFrontend=true`
- **Local dev unchanged** - `dotnet publish -c Release` still runs PowerShell script

### wwwroot Not in Source Control
- Add `apps/api/src/TeensyRom.Api/wwwroot/` to `.gitignore`
- CI builds fresh frontend each time
- Keep `.gitkeep` file for directory structure

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 4, 6
- [ ] [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ ] [softprops/action-gh-release](https://github.com/softprops/action-gh-release) - Release action

---

## 📂 File Structure Overview

```
.github/
└── workflows/
    └── release.yml                          ✨ New - Complete release workflow

apps/api/src/TeensyRom.Api/
└── TeensyRom.Api.csproj                     📝 Modify - Add SkipBuildFrontend condition
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Release Workflow</h3></summary>

**Purpose**: Implement the complete GitHub Actions workflow for building and releasing.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-04-001-RELEASE-WORKFLOW`

**Implementation Subtasks**:

- [ ] Modify `.csproj` to add `SkipBuildFrontend` condition
- [ ] Create `.github/workflows/release.yml`
- [ ] Configure trigger: `push: tags: ['v*']`
- [ ] Add `validate` job for version extraction and pre-release detection
- [ ] Add `build` job with matrix for 4 platforms (win-x64, osx-x64, osx-arm64, linux-x64)
- [ ] Add `release` job to create GitHub Release with artifacts

**Workflow Structure**:

```
Jobs:
1. validate
   - Extract version from tag (strip 'v' prefix)
   - Detect pre-release (version contains '-')

2. build (matrix: 4 platforms)
   - Setup Node.js 20.x, pnpm 9, .NET 9.0.x
   - pnpm install --frozen-lockfile
   - pnpm nx build teensyrom-ui --configuration=production
   - Copy dist → wwwroot (bash)
   - dotnet publish -c Release -r {rid} -p:SkipBuildFrontend=true
   - Package (zip for Windows, tar.gz for Unix)
   - Upload artifacts

3. release
   - Download all artifacts
   - Create GitHub Release with softprops/action-gh-release
   - Attach all platform artifacts
   - Mark pre-releases appropriately
   - Auto-generate release notes
```

**Key Configuration**:

| Setting | Value |
|---------|-------|
| `DOTNET_VERSION` | `9.0.x` |
| `NODE_VERSION` | `20.x` |
| `PNPM_VERSION` | `9` |
| Artifact retention | 5 days |
| Pre-release detection | Version contains `-` suffix |

**Trigger**:
- Tag push: `v*` (e.g., `v1.0.0`, `v1.0.0-beta.1`)

**Testing Subtask**:
- [ ] Commit workflow to repository
- [ ] Verify workflow syntax is valid (GitHub validates on push)
- [ ] Check workflow appears in Actions tab

</details>

---

<details open>
<summary><h3>Task 2: Test Workflow</h3></summary>

**Purpose**: Verify workflow executes correctly with a test release.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-04-002-WORKFLOW-TEST`

**Implementation Subtasks**:

- [ ] Navigate to GitHub Actions → Release workflow
- [ ] Click "Run workflow"
- [ ] Enter test version: `0.0.1-alpha.1`
- [ ] Monitor workflow execution
- [ ] Verify all 4 platform builds complete
- [ ] Verify GitHub Release is created (marked as pre-release)
- [ ] Download and test at least one artifact (Windows recommended)
- [ ] Delete test release after verification

**Expected Workflow Run Time**: ~15-30 minutes (building for 4 platforms)

**Verification Checklist**:
- [ ] `validate` job passes with correct version
- [ ] All 4 `build` matrix jobs complete successfully
- [ ] `release` job creates GitHub Release
- [ ] Release has 4 attached files:
  - `TeensyROM-win-x64.zip`
  - `TeensyROM-osx-x64.tar.gz`
  - `TeensyROM-osx-arm64.tar.gz`
  - `TeensyROM-linux-x64.tar.gz`
- [ ] Release is marked as pre-release (alpha suffix)
- [ ] Windows artifact works when extracted and run

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- `.github/workflows/release.yml`

---

## 📝 Testing Summary

**Workflow Testing**:
1. Push workflow file to repository
2. Trigger manual run with test version
3. Monitor all jobs complete successfully
4. Verify release created with all artifacts
5. Download and test Windows artifact
6. Clean up test release

**Post-Verification**:
- Delete test release from GitHub Releases
- Consider keeping workflow runs for debugging reference

---

## ✅ Success Criteria

- [ ] `.github/workflows/release.yml` exists and is valid YAML
- [ ] Workflow can be triggered manually via `workflow_dispatch`
- [ ] Workflow triggers on version tag push (`v*`)
- [ ] Version validation rejects invalid formats
- [ ] All 4 platform builds complete successfully
- [ ] GitHub Release created with correct version
- [ ] All 4 artifacts attached to release
- [ ] Pre-release versions marked correctly
- [ ] Release notes auto-generated from commits

---

## 📝 Notes & Considerations

### Required Secrets

The workflow needs these secrets configured in repository settings:

| Secret | Purpose | Phase |
|--------|---------|-------|
| `HOMEBREW_TAP_TOKEN` | PAT for updating homebrew formula | Phase 05 |

Note: `GITHUB_TOKEN` is automatically provided by Actions.

### Matrix Build Strategy

Building 4 platforms in parallel:
- Reduces total build time vs sequential
- Each platform uses ~10GB disk space for build
- GitHub-hosted runners have sufficient resources

### Version Tag Format

- `v1.0.0` → Version `1.0.0` (release)
- `v1.0.0-alpha.1` → Version `1.0.0-alpha.1` (pre-release)
- `v1.0.0-beta.1` → Version `1.0.0-beta.1` (pre-release)
- `v1.0.0-rc.1` → Version `1.0.0-rc.1` (pre-release)

### Homebrew Integration

The `update-homebrew` job is included but will fail until Phase 05:
- Requires `HOMEBREW_TAP_TOKEN` secret
- Requires `MetalHexx/homebrew-TeensyROM` repository
- Conditional on `is_prerelease == 'false'`

This is intentional - it's a placeholder for Phase 05 integration.

### Artifact Naming

| Platform | File Name |
|----------|-----------|
| Windows | `TeensyROM-win-x64.zip` |
| macOS Intel | `TeensyROM-osx-x64.tar.gz` |
| macOS ARM | `TeensyROM-osx-arm64.tar.gz` |
| Linux | `TeensyROM-linux-x64.tar.gz` |

### Release Notes

Using `generate_release_notes: true` in `softprops/action-gh-release`:
- Auto-generates changelog from commits since last release
- Groups commits by type if using conventional commits
- Can be customized with `.github/release.yml` config file

### Cost Considerations

GitHub Actions usage:
- Public repos: Free unlimited minutes
- Private repos: 2000 minutes/month (free tier)
- Each release run: ~30-60 minutes across all jobs
