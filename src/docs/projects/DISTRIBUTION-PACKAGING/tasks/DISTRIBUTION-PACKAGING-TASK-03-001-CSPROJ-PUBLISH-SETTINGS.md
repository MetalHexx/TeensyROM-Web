# Task Handoff: Configure .csproj Publish Settings

## 🎯 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-03-001-CSPROJ-PUBLISH-SETTINGS`  
**Task Name**: Add Self-Contained Single-File Publish Properties  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (1-2 files)

---

## 📋 Objective

**What**: Add MSBuild properties to `TeensyRom.Api.csproj` for self-contained single-file publishing across all target platforms.

**Why**: These properties enable `dotnet publish` to produce a single executable that includes the .NET runtime, eliminating user dependency requirements.

**Success Criteria**:
- [ ] `.csproj` contains `PublishSingleFile`, `SelfContained`, and compression properties
- [ ] `dotnet publish -c Release -r win-x64` produces single executable
- [ ] Published output is in expected location
- [ ] No build errors or warnings related to publish settings

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- ✅ Phase 01: API routes prefixed with `/api/`
- ✅ Phase 02: Static file serving configured with SPA fallback
- ✅ Frontend build script (`scripts/copy-frontend.ps1`) working

**Dependencies**:
- .NET 9 SDK
- No new NuGet packages required

**Constraints**:
- Must work for all 4 runtime identifiers: `win-x64`, `osx-x64`, `osx-arm64`, `linux-x64`
- Embedded assets (OneLoad64.zip, Composers.zip) must be included correctly
- wwwroot files must be included in published output

---

## 📂 File Scope

**Files to Modify**:
- `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` - Add publish properties

**Files to Review** (context only):
- `apps/api/src/TeensyRom.Api/Program.cs` - Understand asset extraction logic
- `apps/api/src/TeensyRom.Core/Common/AssetStartupHelper.cs` - Asset handling (if exists)

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md) - API structure
- [.NET Publishing Documentation](https://docs.microsoft.com/en-us/dotnet/core/deploying/)

**Current .csproj Structure** (for context):
```xml
<PropertyGroup>
  <TargetFramework>net9.0</TargetFramework>
  <Nullable>enable</Nullable>
  <ImplicitUsings>enable</ImplicitUsings>
  <!-- OpenAPI and other existing properties -->
</PropertyGroup>
```

**Properties to Add** (create new PropertyGroup or add to existing):

| Property | Value | Purpose |
|----------|-------|---------|
| `PublishSingleFile` | `true` | Bundles app into single executable |
| `SelfContained` | `true` | Includes .NET runtime in output |
| `EnableCompressionInSingleFile` | `true` | Compresses to reduce file size |
| `IncludeNativeLibrariesForSelfExtract` | `true` | Bundles native libraries (SerialPort) |
| `IncludeAllContentForSelfExtract` | `true` | Bundles all content files (wwwroot, assets) |

**Optional Properties** (consider adding):
| Property | Value | Purpose |
|----------|-------|---------|
| `PublishTrimmed` | `false` | Don't trim - can cause issues with reflection |
| `PublishReadyToRun` | `true` | Pre-JIT for faster startup (increases size) |

**Anti-Patterns to Avoid**:
- ❌ Don't enable `PublishTrimmed` - can break dynamic code/reflection
- ❌ Don't hardcode RuntimeIdentifier in .csproj - pass via command line
- ❌ Don't add platform-specific conditions unless necessary

---

## 🧪 Testing Requirements

**Build Verification**:

After adding properties, test with Windows publish:

```powershell
cd apps/api/src/TeensyRom.Api

# First, ensure frontend is built and copied
# (Run from repo root)
# .\scripts\copy-frontend.ps1

# Then publish
dotnet publish -c Release -r win-x64 -o ./publish/win-x64
```

**Verification Checks**:
- [ ] Command completes without errors
- [ ] Single `.exe` file created in `publish/win-x64/`
- [ ] File size is reasonable (expected: 100-200MB)
- [ ] No PDB files in output (Release mode)
- [ ] Check that wwwroot is embedded (will verify in Task 03-002)

**Expected Output Structure**:
```
publish/win-x64/
└── TeensyRom.Api.exe    (single file, ~100-200MB)
```

**Note**: Full functional testing is in Task 03-002. This task focuses on correct build configuration.

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 03 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-03-PUBLISHING.md)
- [Master Plan](../DISTRIBUTION-PACKAGING-MASTER-PLAN.md)
- [Source Feature Plan](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.4-3.5

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-02-002: Build Integration (completed) - Frontend build script
- DISTRIBUTION-PACKAGING-TASK-03-002: Local Publish Test (next task) - Functional verification

**External References**:
- [.NET Single-file deployment](https://docs.microsoft.com/en-us/dotnet/core/deploying/single-file/overview)
- [Self-contained deployment](https://docs.microsoft.com/en-us/dotnet/core/deploying/#publish-self-contained)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-03-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path of the saved report when complete.

---

## ⚠️ Critical Reminders

1. **Don't trim assemblies** - `PublishTrimmed=false` or omit entirely
2. **Test the publish command** - Verify it produces output before marking complete
3. **Check file size** - If unexpectedly small, assets may not be included
4. **Runtime ID via CLI** - Don't hardcode RID in .csproj, pass via `-r` flag
