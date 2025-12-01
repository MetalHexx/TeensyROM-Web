# Task: Create Release Workflow

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-04-001-RELEASE-WORKFLOW  
**Task Name**: Create Complete GitHub Actions Release Workflow  
**Assigned To**: Backend Wizard  
**Priority**: High  
**Estimated Complexity**: Medium (single file, ~150 lines)

---

## 🎯 Objective

**What**: Create a GitHub Actions workflow that automatically builds and releases TeensyROM for all 4 platforms when a version tag is pushed.

**Why**: Enable one-command releases that produce ready-to-download executables for Windows, macOS (Intel + ARM), and Linux without manual intervention.

**Success Criteria**:
- [ ] `.github/workflows/release.yml` exists and is valid YAML
- [ ] Workflow triggers on `v*` tag push
- [ ] Workflow extracts version from tag (strips `v` prefix)
- [ ] Pre-release detection works (versions with `-` suffix)
- [ ] Frontend builds successfully on Ubuntu
- [ ] All 4 platform builds complete (win-x64, osx-x64, osx-arm64, linux-x64)
- [ ] GitHub Release created with all artifacts attached
- [ ] Artifacts include full version in name (e.g., `TeensyROM-Web-1.0.0-alpha.1-win-x64.zip`)

---

## 📂 Context & Dependencies

**Prerequisites Completed**:
- Phase 01: Relative URL migration (frontend uses relative URLs in production)
- Phase 02: Static file serving (API serves wwwroot contents)
- Phase 03: Publishing configuration (.csproj has self-contained publish settings)
- Phase 3a: Version endpoint (version displays in UI and Scalar docs)

**Dependencies**:
- Node.js 20.x
- pnpm 9
- .NET SDK 9.0.x
- GitHub Actions runners (ubuntu-latest)

**Constraints**:
- Must use Ubuntu runners (common practice, faster startup)
- Frontend build done in CI (not via MSBuild target) - add `SkipBuildFrontend` condition to `.csproj`
- Version extracted from git tag (strips `v` prefix) and passed to `dotnet publish -p:Version=$VERSION`

---

## 📁 File Scope

**Files to Create**:
```
.github/workflows/release.yml          # Complete release workflow
```

**Files to Modify**:
```
apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj   # Add SkipBuildFrontend condition
.gitignore                                         # Add wwwroot exclusion
```

**Files to Review (for context)**:
```
apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj   # Current publish settings
scripts/copy-frontend.ps1                          # Logic to replicate in bash
```

---

## 📝 Implementation Details

### 1. Add wwwroot to .gitignore

Add this line to the root `.gitignore`:

```
# Frontend build output (built by CI or copy-frontend.ps1)
apps/api/src/TeensyRom.Api/wwwroot/*
```

This prevents tracking built frontend files. The directory will be created during CI build or by the PowerShell script.

**Also**: Remove any currently tracked wwwroot files from git:
```bash
git rm -r --cached apps/api/src/TeensyRom.Api/wwwroot/*
```

### 2. Modify .csproj BuildFrontend Target

Add a condition to skip the PowerShell script when running in CI:

```xml
<!-- Change this line -->
<Target Name="BuildFrontend" BeforeTargets="Publish" Condition="'$(Configuration)' == 'Release'">

<!-- To this -->
<Target Name="BuildFrontend" BeforeTargets="Publish" Condition="'$(Configuration)' == 'Release' AND '$(SkipBuildFrontend)' != 'true'">
```

This allows local `dotnet publish -c Release` to work unchanged, while CI passes `-p:SkipBuildFrontend=true`.

### 2. Create release.yml Workflow

**Workflow Structure**:

```
Jobs:
┌─────────────────────────────────────────────────────────────┐
│  validate                                                   │
│  ├── Extract version from tag                               │
│  ├── Validate semver format                                 │
│  └── Detect pre-release (contains '-')                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  build (matrix: 4 platforms)                                │
│  ├── Setup Node.js + pnpm + .NET                            │
│  ├── pnpm install                                           │
│  ├── pnpm nx build teensyrom-ui --configuration=production  │
│  ├── Copy dist → wwwroot                                    │
│  ├── dotnet publish -c Release -r {rid} -p:Version={ver}    │
│  ├── Package (zip for Windows, tar.gz for Unix)             │
│  └── Upload artifact                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  release                                                    │
│  ├── Download all artifacts                                 │
│  ├── Create GitHub Release                                  │
│  ├── Attach all 4 platform artifacts                        │
│  └── Mark pre-release if version contains '-'               │
└─────────────────────────────────────────────────────────────┘
```

**Key Configuration**:

| Setting | Value |
|---------|-------|
| Trigger | `push: tags: ['v*']` |
| Runner | `ubuntu-latest` |
| Node version | `20.x` |
| .NET version | `9.0.x` |
| pnpm version | `9` |
| Artifact retention | `5` days |

**Matrix Strategy**:

| Runtime ID | Artifact Name Pattern | Package Format |
|------------|----------------------|----------------|
| `win-x64` | `TeensyROM-Web-{version}-win-x64` | `.zip` |
| `osx-x64` | `TeensyROM-Web-{version}-osx-x64` | `.tar.gz` |
| `osx-arm64` | `TeensyROM-Web-{version}-osx-arm64` | `.tar.gz` |
| `linux-x64` | `TeensyROM-Web-{version}-linux-x64` | `.tar.gz` |

**Example**: For tag `v1.0.0-alpha.1`, artifacts are named `TeensyROM-Web-1.0.0-alpha.1-win-x64.zip`, etc.

**Version Handling**:
- Extract from `github.ref_name` (e.g., `v1.0.0-alpha.1`)
- Strip `v` prefix for version number (e.g., `1.0.0-alpha.1`)
- Pass to `dotnet publish -p:Version=$VERSION` (overrides .csproj)
- Detect pre-release: version contains `-` character
- Use in artifact names: `TeensyROM-Web-{version}-{rid}`

**Frontend Build in CI (bash equivalent of copy-frontend.ps1)**:
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build frontend
pnpm nx build teensyrom-ui --configuration=production

# Copy to wwwroot
mkdir -p apps/api/src/TeensyRom.Api/wwwroot
rm -rf apps/api/src/TeensyRom.Api/wwwroot/*
cp -r dist/apps/teensyrom-ui/browser/* apps/api/src/TeensyRom.Api/wwwroot/
```

**Publish Command**:
```bash
dotnet publish -c Release \
  -r ${{ matrix.rid }} \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:Version=$VERSION \
  -o ./publish
```

**Packaging**:
- Windows: `zip -r TeensyROM-Web-{version}-win-x64.zip .`
- Unix: `chmod +x TeensyRom.Api && tar -czvf TeensyROM-Web-{version}-{rid}.tar.gz .`

**GitHub Release**:
- Use `softprops/action-gh-release@v2`
- Set `prerelease` based on version detection (contains `-`)
- Release notes will be added manually (do not auto-generate)

---

## 🔗 Reference Materials

**Related Documentation**:
- [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 6 has sample workflow
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)

**Current .csproj** (lines 64-72):
```xml
<Target Name="BuildFrontend" BeforeTargets="Publish" Condition="'$(Configuration)' == 'Release'">
  <PropertyGroup>
    <WorkspaceRoot>$(MSBuildProjectDirectory)\..\..\..\..</WorkspaceRoot>
    <FrontendScript>$(WorkspaceRoot)\scripts\copy-frontend.ps1</FrontendScript>
  </PropertyGroup>
  <Message Text="Building Angular frontend..." Importance="high" />
  <Exec Command="pwsh -File &quot;$(FrontendScript)&quot;" WorkingDirectory="$(WorkspaceRoot)" />
</Target>
```

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-04-001-REPORT.md`

**Deliverables**:
1. Modified `.csproj` with `SkipBuildFrontend` condition
2. Complete `.github/workflows/release.yml` file
3. Completion report documenting implementation details

---

## ✅ Verification

After implementation:
1. Commit and push to main
2. Verify workflow appears in GitHub Actions tab
3. Verify YAML syntax is valid (GitHub validates on push)
4. Proceed to TASK-04-002 for live testing
