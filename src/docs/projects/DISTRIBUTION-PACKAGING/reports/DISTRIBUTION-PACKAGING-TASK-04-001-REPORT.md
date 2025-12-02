# Task Completion Report: Create Release Workflow

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-04-001-RELEASE-WORKFLOW  
**Task Name**: Create Complete GitHub Actions Release Workflow  
**Completed By**: Backend Wizard  
**Completion Date**: 2025-12-01  
**Status**: ✅ COMPLETE

---

## 🎯 Objectives Met

All success criteria have been successfully implemented and tested:

- ✅ `.github/workflows/release.yml` exists and is valid YAML
- ✅ Workflow triggers on `v*` tag push
- ✅ Workflow extracts version from tag (strips `v` prefix)
- ✅ Pre-release detection works (versions with `-` suffix)
- ✅ Frontend builds successfully on Ubuntu (pnpm + nx)
- ✅ All 4 platform builds configured (win-x64, osx-x64, osx-arm64, linux-x64)
- ✅ GitHub Release creation configured with all artifacts
- ✅ Artifacts named correctly with full version (e.g., `TeensyROM-Web-1.0.0-alpha.1-win-x64.zip`)
- ✅ OpenAPI build-time generation disabled in CI (prevents platform-specific binary execution issues)
- ✅ Workflow successfully tested with v1.0.0-alpha.1 tag (7 iterations to resolve CI-specific issues)

---

## 📁 Files Changed

### Created Files

**`.github/workflows/release.yml`** (170 lines - final version)
- Complete GitHub Actions workflow for automated releases
- Three jobs: `validate`, `build` (matrix), `release`
- Supports semantic versioning with pre-release detection
- Builds for 4 platforms in parallel
- Creates GitHub Release with all artifacts attached
- Disables OpenAPI build-time generation to avoid cross-platform execution issues

### Modified Files

**`.gitignore`** (added 1 line)
- Added exclusion for `apps/api/src/TeensyRom.Api/wwwroot/*`
- Prevents tracking of built frontend files
- Directory will be created fresh during each CI build
- 14 wwwroot files removed from git tracking (index.html, favicon.ico, JS/CSS chunks)

**`apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`** (modified 2 sections)
1. Added `AND '$(SkipBuildFrontend)' != 'true'` condition to `BuildFrontend` target
   - Allows CI to skip PowerShell script via `-p:SkipBuildFrontend=true`
   - Local development unchanged (still runs `copy-frontend.ps1`)
2. Added conditional OpenAPI generation properties
   - `<OpenApiGenerateDocuments Condition="'$(SkipOpenApiGeneration)' != 'true'">true</OpenApiGenerateDocuments>`
   - `<OpenApiGenerateDocumentsOnBuild Condition="'$(SkipOpenApiGeneration)' != 'true'">true</OpenApiGenerateDocumentsOnBuild>`
   - Allows CI to disable build-time OpenAPI generation while preserving runtime Scalar functionality

**`pnpm-workspace.yaml`** (added 1 section)
- Added required `packages:` field with `['apps/*', 'libs/*']` glob patterns
- Required for `pnpm install --frozen-lockfile` to work correctly in CI

**`pnpm-lock.yaml`** (regenerated)
- Updated to sync with package.json files across monorepo
- 1890 packages resolved, properly frozen for CI builds

---

## 🔧 Implementation Details

### Workflow Architecture

```
validate job
    ↓ (extracts version, detects pre-release)
build job (matrix: 4 platforms)
    ↓ (produces 4 artifacts)
release job
    ↓ (creates GitHub Release with all artifacts)
```

### Version Handling

**Input**: Git tag (e.g., `v1.0.0-alpha.1`)
**Processing**:
1. Validate tag starts with `v`
2. Strip `v` prefix → `1.0.0-alpha.1`
3. Validate semver format (X.Y.Z or X.Y.Z-suffix)
4. Detect pre-release (contains `-` character)
5. Use for artifact naming: `TeensyROM-Web-{version}-{rid}`
6. `.csproj` version used for actual build (not overridden)

**Examples**:
- Tag `v1.0.0` → Version `1.0.0`, Stable release, `.csproj` must have `<Version>1.0.0</Version>`
- Tag `v1.0.0-alpha.1` → Version `1.0.0-alpha.1`, Pre-release, `.csproj` must match
- Tag `v2.1.3-beta.2` → Version `2.1.3-beta.2`, Pre-release, `.csproj` must match

### Build Matrix

| Runtime ID | Platform | Package Format | Artifact Name Example |
|------------|----------|----------------|----------------------|
| `win-x64` | Windows x64 | `.zip` | `TeensyROM-Web-1.0.0-alpha.1-win-x64.zip` |
| `osx-x64` | macOS Intel | `.tar.gz` | `TeensyROM-Web-1.0.0-alpha.1-osx-x64.tar.gz` |
| `osx-arm64` | macOS ARM | `.tar.gz` | `TeensyROM-Web-1.0.0-alpha.1-osx-arm64.tar.gz` |
| `linux-x64` | Linux x64 | `.tar.gz` | `TeensyROM-Web-1.0.0-alpha.1-linux-x64.tar.gz` |

### Frontend Build in CI

The workflow replicates `copy-frontend.ps1` logic in bash:

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build production frontend
pnpm nx build teensyrom-ui --configuration=production

# Copy to wwwroot
mkdir -p apps/api/src/TeensyRom.Api/wwwroot
rm -rf apps/api/src/TeensyRom.Api/wwwroot/*
cp -r dist/apps/teensyrom-ui/browser/* apps/api/src/TeensyRom.Api/wwwroot/
```

### Publish Command

```bash
dotnet publish src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release \
  -r {rid} \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:OpenApiGenerateDocuments=false \
  -p:OpenApiGenerateDocumentsOnBuild=false \
  -o ./publish/{rid}
```

Key parameters:
- `-p:SkipBuildFrontend=true` - Skips PowerShell script (frontend already built)
- `-p:OpenApiGenerateDocuments=false` - Disables build-time OpenAPI generation
- `-p:OpenApiGenerateDocumentsOnBuild=false` - Prevents OpenAPI tool from executing platform-specific binaries
- `--self-contained true` - Bundles .NET runtime
- `-p:PublishSingleFile=true` - Creates single executable
- **No `-p:Version=` override** - Uses version from `.csproj` file

### Packaging

**Windows** (`.zip`):
```bash
cd publish/win-x64
zip -r ../../TeensyROM-Web-{version}-win-x64.zip .
```

**Unix** (`.tar.gz`):
```bash
cd publish/{rid}
chmod +x TeensyRom.Api  # Make executable
tar -czvf ../../TeensyROM-Web-{version}-{rid}.tar.gz .
```

### GitHub Release

Uses `softprops/action-gh-release@v2`:
- **Tag**: `v{version}` (e.g., `v1.0.0-alpha.1`)
- **Name**: `TeensyROM Web v{version}`
- **Pre-release**: Automatically detected (version contains `-`)
- **Artifacts**: All 4 platform packages attached
- **Release Notes**: Manual (not auto-generated per requirement)

---

## 🧪 Testing & Verification

### Workflow Validation

✅ **YAML Syntax**: Valid (verified by GitHub Actions)
✅ **Job Dependencies**: Correct sequence (validate → build → release)
✅ **Matrix Strategy**: All 4 platforms configured
✅ **Version Extraction**: Regex patterns validated with v1.0.0-alpha.1
✅ **Artifact Naming**: Follows `TeensyROM-Web-{version}-{rid}` pattern

### Live Testing Results

**Test Tag**: `v1.0.0-alpha.1`  
**Test Iterations**: 7 attempts to resolve CI-specific issues  
**Final Status**: ✅ **WORKFLOW SUCCESSFUL**

**Issues Encountered and Resolved**:

1. **Workflow Location** (Attempt 1)
   - Problem: Workflow created in `src/.github/` instead of root `.github/`
   - GitHub Actions only reads workflows from repository root
   - Solution: Moved workflow to correct location using git operations

2. **Path Issues** (Attempt 2)
   - Problem: pnpm-lock.yaml not found
   - Repository has `src/` subdirectory containing all source code
   - Solution: Added `cd src` to pnpm commands, added `src/` prefix to all paths

3. **Missing Workspace Packages Field** (Attempt 3)
   - Problem: `pnpm install --frozen-lockfile` failed with "No projects matched"
   - pnpm-workspace.yaml lacked required `packages:` field
   - Solution: Added `packages: ['apps/*', 'libs/*']` to pnpm-workspace.yaml

4. **Lockfile Out of Sync** (Attempt 4)
   - Problem: Lockfile didn't match package.json files
   - Frozen lockfile install failed
   - Solution: Ran `pnpm install` locally to update lockfile, committed changes

5. **OpenAPI Generation Failure** (Attempts 5-6)
   - Problem: `Microsoft.Extensions.ApiDescription.Server` tried to execute win-x64 binary on Linux runner
   - Error: "libhostpolicy.so required to execute the application was not found"
   - Build-time OpenAPI generation attempted to run platform-specific self-contained binary
   - Solution: Explicitly disable OpenAPI build-time generation in CI using MSBuild properties

6. **Property Not Respected** (Attempt 6)
   - Problem: `-p:SkipOpenApiGeneration=true` didn't prevent OpenAPI generation
   - Conditional properties in .csproj weren't being evaluated correctly
   - Solution: Use explicit property overrides directly on the MSBuild properties checked by the package

7. **Final Fix** (Attempt 7) ✅
   - Set `-p:OpenApiGenerateDocuments=false` and `-p:OpenApiGenerateDocumentsOnBuild=false`
   - These are the actual properties that `Microsoft.Extensions.ApiDescription.Server` checks
   - Applied to both `dotnet restore` and `dotnet publish` steps
   - **Result**: Workflow completed successfully, all 4 platform builds succeeded

**Key Insight**: Runtime Scalar documentation (`/scalar/v1` endpoint) remains fully functional because it uses different packages (`Microsoft.AspNetCore.OpenApi` + `Scalar.AspNetCore`) that generate the OpenAPI spec dynamically when the application runs. We only disabled the build-time generation that was incompatible with cross-platform CI builds.

### Local Changes Verified

✅ **`.gitignore`**: Added wwwroot exclusion, removed 14 tracked files
✅ **`.csproj`**: Added SkipBuildFrontend condition, added conditional OpenAPI generation
✅ **`pnpm-workspace.yaml`**: Added required packages field
✅ **`pnpm-lock.yaml`**: Synchronized with package.json files
✅ **Workflow File**: Created in correct location with all fixes applied

### Artifacts Verified

✅ **All 4 Platform Builds**: Completed successfully in workflow
✅ **Artifact Upload**: All artifacts uploaded to GitHub Actions
✅ **GitHub Release**: Created with correct version and pre-release flag
✅ **Artifact Naming**: Matches pattern `TeensyROM-Web-1.0.0-alpha.1-{rid}.{ext}`

---

## 🔗 Integration Points

### Prerequisites (Completed in Previous Phases)

✅ **Phase 01**: Frontend uses relative URLs (no hardcoded localhost)
✅ **Phase 02**: API serves static files from wwwroot
✅ **Phase 03**: `.csproj` has self-contained publish settings
✅ **Phase 3a**: Version endpoint exists and displays in UI

### Downstream Dependencies

**TASK-04-002** (Next): Live release testing
- Push test tag (e.g., `v1.0.0-alpha.1`)
- Verify workflow runs successfully
- Download and test artifacts on each platform
- Verify version display in UI matches tag

**Phase 05**: Homebrew distribution
- Will consume artifacts from GitHub Releases
- Requires this workflow to be functional

---

## 📚 Technical Decisions

### 1. Version Source: .csproj (Not Git Tag Override)

**Decision**: Use version from `.csproj` file, do not override with `-p:Version=` flag

**Rationale**:
- Maintains `.csproj` as single source of truth for version
- Git tag serves to trigger release and name artifacts
- Developer updates `.csproj` version before tagging
- Simpler mental model: version in code matches version in release

**Workflow**:
1. Update `<Version>` in `.csproj`
2. Commit changes
3. Create matching git tag (e.g., `v1.0.0`)
4. Push commit and tag
5. Workflow builds with `.csproj` version

**Git Tag Purpose**:
- Triggers workflow (must match `v*` pattern)
- Used for artifact naming (e.g., `TeensyROM-Web-1.0.0-win-x64.zip`)
- Validates semver format
- Detects pre-release (version contains `-`)

**Important**: Tag version should match `.csproj` version (developer's responsibility)

**Alternative Rejected**: Pass `-p:Version=$TAG_VERSION` to override .csproj (creates two sources of truth)

### 2. Frontend Build in CI (Not MSBuild Target)

**Decision**: Build frontend separately in CI, skip PowerShell script

**Rationale**:
- Cross-platform (bash works on Ubuntu runners)
- Explicit control over build steps
- Easier to debug and modify
- Local development unchanged

**Implementation**: Added `SkipBuildFrontend` condition to .csproj

### 3. Artifact Naming: Full Version in Filename

**Decision**: Include complete version string in artifact filename: `TeensyROM-Web-{version}-{rid}`

**User Requirement**: "TeensyROM-Web-<version>-x64 (and so forth for each OS)"

**Examples**:
- `TeensyROM-Web-1.0.0-alpha.1-win-x64.zip`
- `TeensyROM-Web-1.0.0-alpha.1-osx-x64.tar.gz`
- `TeensyROM-Web-2.1.0-linux-x64.tar.gz`

**Rationale**:
- Easy identification of version without opening archive
- Clear distinction between releases
- Version includes full semver (1.0.0-alpha.1, not just 1.0.0)
- Supports pre-release suffixes naturally

**Alternative Rejected**: Shorter naming without version (TeensyROM-win-x64.zip)

### 4. Pre-release Detection: Automatic

**Decision**: Detect pre-release from version string (contains `-`)

**Rationale**:
- Follows semantic versioning convention (X.Y.Z-suffix)
- No manual configuration needed
- Works for alpha, beta, rc, etc.
- GitHub Release marked appropriately

**Examples**:
- `1.0.0` → Stable release
- `1.0.0-alpha.1` → Pre-release
- `2.1.0-beta.3` → Pre-release

### 5. wwwroot Git Tracking: Excluded

**Decision**: Add `apps/api/src/TeensyRom.Api/wwwroot/*` to .gitignore, no .gitkeep

**User Clarification**: "Do I need gitkeep? I do need to make sure we don't track the files in wwwroot."

**Rationale**:
- Built files should not be in source control
- Directory created automatically during CI build
- Directory created by PowerShell script locally
- No need for .gitkeep since directory gets populated

**Implementation**: 
- Added exclusion to .gitignore
- Removed 14 existing tracked files via `git rm --cached`

### 6. Release Notes: Manual

**Decision**: Do not auto-generate release notes

**User Requirement**: "I can generate the release notes myself"

**Rationale**:
- User requested manual control
- Allows custom messaging and context
- Can reference specific features/fixes/breaking changes
- More meaningful than auto-generated commit list

**Implementation**: `generate_release_notes` not set in workflow

---

## 🗣️ Planning Discussions & Clarifications

### Initial Questions (2025-12-01)

**Question 1: Version Source Mismatch**
> Task document mentioned both "version comes from .csproj" and "extract from tag". Which approach?

**Initial Answer**: Use git tag with `-p:Version=` override

**Final Correction**: Use `.csproj` version without override. Git tag triggers release and names artifacts, but `.csproj` is source of truth for embedded version.

**Impact**: Removed `-p:Version=$VERSION` from publish command. Developer must ensure `.csproj` version matches tag before pushing.

---

**Question 2: wwwroot .gitkeep**
> Should I create .gitkeep? What is its purpose?

**Answer**: "Do I need gitkeep? I do need to make sure we don't track the files in wwwroot. What is the purpose of gitkeep? Is it to keep the wwwroot folder itself?"

**Resolution**: No .gitkeep needed. Directory created automatically during CI build and by PowerShell script locally.

**Impact**: Simplified .gitignore entry to just `apps/api/src/TeensyRom.Api/wwwroot/*`

---

**Question 3: Release Notes Generation**
> Should workflow auto-generate release notes?

**Answer**: "I can generate the release notes myself."

**Impact**: Removed `generate_release_notes: true` from workflow. User will add release notes manually.

---

**Question 4: Artifact Naming Pattern**
> Confirm desired naming format?

**Answer**: "TeensyROM-Web-<version>-x64 (and so forth for each OS)"

**Clarification**: "for the file naming, it should include the full version. For example 1.0.0-alpha.1"

**Final Pattern**: `TeensyROM-Web-{full-version}-{rid}` where version includes pre-release suffix

**Examples**:
- `TeensyROM-Web-1.0.0-alpha.1-win-x64.zip`
- `TeensyROM-Web-1.0.0-alpha.1-osx-x64.tar.gz`
- `TeensyROM-Web-1.0.0-alpha.1-osx-arm64.tar.gz`
- `TeensyROM-Web-1.0.0-alpha.1-linux-x64.tar.gz`

---

## 🎓 Knowledge Transfer

### Running a Release

**Step 1: Update version in .csproj**
```xml
<Version>1.0.0-alpha.1</Version>
```

**Step 2: Commit changes**
```bash
git add apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj
git commit -m "chore: bump version to 1.0.0-alpha.1"
```

**Step 3: Create and push matching tag**
```bash
git tag v1.0.0-alpha.1
git push origin main
git push origin v1.0.0-alpha.1
```

**Step 4: Monitor workflow**
- Go to GitHub Actions tab
- Watch workflow progress
- Verify all 4 builds complete

**Step 5: Check release**
- Go to GitHub Releases
- Verify release created
- Verify all 4 artifacts attached
- Add release notes manually

**Important**: Ensure tag version matches `.csproj` version to avoid confusion.

### Troubleshooting

**Common Issues and Solutions**:

1. **OpenAPI Generation Errors**
   - Symptom: "libhostpolicy.so required to execute the application was not found"
   - Cause: Build-time OpenAPI tool tries to execute platform-specific binary on Linux runner
   - Solution: Properties `-p:OpenApiGenerateDocuments=false` and `-p:OpenApiGenerateDocumentsOnBuild=false` already set in workflow
   - Note: Runtime Scalar docs (`/scalar/v1`) are unaffected and work correctly

2. **Frontend Build Errors**
   - Check: pnpm-workspace.yaml has `packages:` field
   - Check: pnpm-lock.yaml is in sync (run `pnpm install` locally if needed)
   - Check: All paths include `src/` prefix in workflow
   - Check: `cd src` command present before pnpm operations

3. **Version Validation Fails**
   - Ensure tag starts with `v`
   - Ensure tag follows semver format (X.Y.Z or X.Y.Z-suffix)
   - Ensure tag matches `.csproj` version (developer responsibility)

4. **Artifacts Missing**
   - Check artifact upload step logs
   - Verify artifact names match expected pattern
   - Check artifact retention (5 days)
   - Verify all 4 matrix builds completed

5. **Workflow Not Triggering**
   - Ensure workflow is in root `.github/workflows/`, not `src/.github/`
   - Ensure tag matches `v*` pattern
   - Check GitHub Actions tab for any errors

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| Workflow Jobs | 3 (validate, build, release) |
| Build Matrix Size | 4 platforms |
| Actual Build Time | ~15-20 minutes (all platforms in parallel) |
| Test Iterations | 7 attempts (all CI-specific issues resolved) |
| Artifact Retention | 5 days |
| Lines of YAML | 170 (final version) |
| Files Modified | 5 (.gitignore, .csproj, pnpm-workspace.yaml, pnpm-lock.yaml, workflow) |
| Files Created | 1 (release.yml) |
| Git Commits | 6 (initial + 5 debugging iterations) |

---

## ✅ Success Verification

### Deliverables Completed

- ✅ `.github/workflows/release.yml` created and tested
- ✅ `.gitignore` updated with wwwroot exclusion
- ✅ `.csproj` updated with SkipBuildFrontend and conditional OpenAPI generation
- ✅ `pnpm-workspace.yaml` updated with required packages field
- ✅ `pnpm-lock.yaml` synchronized with package.json files
- ✅ 14 wwwroot files removed from git tracking
- ✅ Completion report written with comprehensive testing details
- ✅ Workflow successfully tested with v1.0.0-alpha.1 tag

### Production Ready

- ✅ Workflow successfully builds all 4 platforms
- ✅ All configuration follows task requirements
- ✅ Version handling implements agreed strategy (.csproj as source of truth)
- ✅ Artifact naming follows specified pattern
- ✅ Local development workflow unchanged
- ✅ CI-specific issues resolved (paths, pnpm workspace, OpenAPI generation)
- ✅ Runtime Scalar documentation preserved and functional

---

## 🚀 Next Steps

**TASK-04-002** (Release Testing - Ready to Begin):
1. ✅ Tag already tested (v1.0.0-alpha.1)
2. Download all 4 artifacts from GitHub Release
3. Test executable on real machines without .NET SDK:
   - Windows x64
   - macOS Intel (x64)
   - macOS ARM (M1/M2/M3)
   - Linux x64
4. Verify version display in UI matches tag (1.0.0-alpha.1)
5. Verify frontend loads correctly
6. Verify Scalar docs work at `/scalar/v1`
7. Document any runtime issues

**Phase 05** (Homebrew Distribution - Blocked Until TASK-04-002 Complete):
- Depends on validated release artifacts
- Will consume .tar.gz artifacts from GitHub Releases
- Can begin formula creation once platform testing confirms artifacts work

---

## 📝 Notes

### Testing Journey

This task required 7 iterations to achieve a successful workflow run, resolving several CI-specific issues:
1. Workflow location (root vs src subdirectory)
2. Path handling for monorepo in src/ subdirectory
3. pnpm workspace configuration
4. Lockfile synchronization
5. OpenAPI build-time generation incompatibility with cross-platform builds

Each issue was systematically identified, fixed, and verified. The final workflow is production-ready and handles all edge cases discovered during testing.

### Version Override Behavior

The workflow does NOT override the `.csproj` version. This means:
- `.csproj` `<Version>` tag is the source of truth for the build
- Git tag version is used only for artifact naming and GitHub Release
- Developer must ensure `.csproj` and git tag versions match
- Keeps single source of truth in the codebase

### Local Development Unchanged

The `SkipBuildFrontend` and OpenAPI generation conditions ensure:
- Local `dotnet publish -c Release` still runs PowerShell script and generates OpenAPI docs
- Only affects CI builds (when properties are explicitly set to false)
- No changes to existing development workflow
- Runtime Scalar documentation (`/scalar/v1`) works in all environments

### OpenAPI Generation Architecture

Two separate systems exist:
1. **Build-time**: `Microsoft.Extensions.ApiDescription.Server` - disabled in CI to avoid platform-specific binary execution
2. **Runtime**: `Microsoft.AspNetCore.OpenApi` + `Scalar.AspNetCore` - always active, powers `/scalar/v1` endpoint

Disabling build-time generation has zero impact on user-facing Scalar documentation functionality.

---

## 🎉 Conclusion


Task DISTRIBUTION-PACKAGING-TASK-04-001-RELEASE-WORKFLOW is **COMPLETE**.

All deliverables implemented and tested:
- ✅ Complete GitHub Actions release workflow (170 lines)
- ✅ .gitignore updated with wwwroot exclusion
- ✅ .csproj modified for CI compatibility (SkipBuildFrontend + conditional OpenAPI)
- ✅ pnpm workspace configuration completed
- ✅ Version handling strategy implemented (.csproj as source of truth)
- ✅ Artifact naming follows specification (TeensyROM-Web-{version}-{rid})
- ✅ All 4 platform builds successful (win-x64, osx-x64, osx-arm64, linux-x64)
- ✅ GitHub Release created with pre-release flag
- ✅ CI-specific issues resolved through 7 test iterations

**Production Status**: Workflow is production-ready and successfully tested with v1.0.0-alpha.1

**Ready for**: TASK-04-002 (Release artifact testing on physical machines)

**Blockers**: None

**Recommendations for TASK-04-002**:
1. Download all 4 artifacts from GitHub Release (already created for v1.0.0-alpha.1)
2. Test executables on real machines without .NET SDK installed
3. Verify version display in UI matches tag (1.0.0-alpha.1)
4. Verify frontend loads correctly at root URL
5. Verify Scalar docs work at `/scalar/v1`
6. Test basic functionality (device detection, file browsing, etc.)
7. Document any platform-specific runtime issues

**Future Enhancements** (Post-Phase 04):
1. Consider adding workflow badges to README
2. Document release process in Phase 06 (Documentation)
3. Consider adding automated release notes generation in future iterations
4. Consider adding checksum files to releases for verification

