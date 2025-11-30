# Phase 03: Publishing Configuration

## 🎯 Objective

Configure .NET publishing settings to create single-file, self-contained executables for Windows, macOS, and Linux platforms.

**Value Delivered**: Users can run TeensyROM without installing .NET runtime or any other dependencies.

**Prerequisite**: Phase 02 (Static File Serving) must be complete.

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.4-3.5
- [ ] [.NET Self-Contained Deployment](https://docs.microsoft.com/en-us/dotnet/core/deploying/self-contained)
- [ ] [Single-File Deployment](https://docs.microsoft.com/en-us/dotnet/core/deploying/single-file)

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/
├── TeensyRom.Api.csproj                     📝 Modified - Publish properties
└── publish/                                 (Generated - not in git)
    ├── win-x64/
    │   └── TeensyRom.Api.exe
    ├── osx-x64/
    │   └── TeensyRom.Api
    ├── osx-arm64/
    │   └── TeensyRom.Api
    └── linux-x64/
        └── TeensyRom.Api
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Configure .csproj Publish Settings</h3></summary>

**Purpose**: Add MSBuild properties for self-contained single-file publishing.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-03-001-CSPROJ-PUBLISH-SETTINGS`

**Implementation Subtasks**:

- [ ] Add `<PublishSingleFile>true</PublishSingleFile>` to PropertyGroup
- [ ] Add `<SelfContained>true</SelfContained>` to PropertyGroup
- [ ] Add `<EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>`
- [ ] Add `<IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>`
- [ ] Add `<IncludeAllContentForSelfExtract>true</IncludeAllContentForSelfExtract>`
- [ ] Verify embedded assets (OneLoad64.zip, etc.) are included correctly

**Key Properties**:

| Property | Value | Purpose |
|----------|-------|---------|
| `PublishSingleFile` | true | Bundles into single executable |
| `SelfContained` | true | Includes .NET runtime |
| `EnableCompressionInSingleFile` | true | Reduces file size |
| `IncludeNativeLibrariesForSelfExtract` | true | Bundles native libraries |
| `IncludeAllContentForSelfExtract` | true | Bundles all content files |

**Testing Subtask**:
- [ ] Run publish command for Windows: `dotnet publish -c Release -r win-x64`
- [ ] Verify single executable created in `publish/win-x64/`
- [ ] Check file size is reasonable (expected: 100-200MB due to .NET runtime + assets)

</details>

---

<details open>
<summary><h3>Task 2: Local Publish and Test</h3></summary>

**Purpose**: Verify published executable works on a machine without .NET installed.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-03-002-LOCAL-PUBLISH-TEST`

**Implementation Subtasks**:

- [ ] Build frontend and copy to wwwroot (using Phase 02 script)
- [ ] Publish for Windows: `dotnet publish -c Release -r win-x64 --self-contained`
- [ ] Copy published folder to clean location (or VM without .NET)
- [ ] Run executable and verify application starts
- [ ] Test all core functionality

**Publish Commands for All Platforms**:

```powershell
# Windows x64
dotnet publish -c Release -r win-x64 --self-contained -o ./publish/win-x64

# macOS x64 (Intel)
dotnet publish -c Release -r osx-x64 --self-contained -o ./publish/osx-x64

# macOS ARM64 (Apple Silicon)
dotnet publish -c Release -r osx-arm64 --self-contained -o ./publish/osx-arm64

# Linux x64
dotnet publish -c Release -r linux-x64 --self-contained -o ./publish/linux-x64
```

**Testing Subtask**:

Run on target platform (or clean environment):
- [ ] Application starts without .NET SDK/runtime installed
- [ ] Navigate to `http://localhost:5168` - Angular app loads
- [ ] API endpoints respond correctly
- [ ] SignalR connections work
- [ ] Embedded assets (game images, etc.) accessible
- [ ] Serial port communication works (if device available)

</details>

---

## 🗂️ Files Modified or Created

**Modified Files**:
- `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`

**Generated (Not in Git)**:
- `apps/api/src/TeensyRom.Api/publish/` directory and contents

---

## 📝 Testing Summary

**Windows Testing**:
1. Build and publish with script/commands
2. Copy `publish/win-x64/` to test location
3. Run `TeensyRom.Api.exe`
4. Open browser to `http://localhost:5168`
5. Verify all functionality

**Cross-Platform Notes**:
- macOS/Linux testing requires those platforms
- GitHub Actions will build for all platforms in Phase 04
- For initial testing, focus on Windows

---

## ✅ Success Criteria

- [ ] `.csproj` contains all publish configuration properties
- [ ] `dotnet publish -r win-x64 --self-contained` produces single executable
- [ ] Published executable runs on clean Windows (no .NET installed)
- [ ] Angular app loads correctly from published executable
- [ ] API endpoints and SignalR work
- [ ] Embedded assets (game images, music metadata) are available
- [ ] File size is acceptable (documented for reference)

---

## 📝 Notes & Considerations

### Expected File Sizes

Self-contained .NET 9 apps include the runtime (~60-80MB). With embedded assets:
- **Estimated**: 100-200MB per platform
- This is acceptable for a desktop application

### Native Dependencies

The application uses `System.IO.Ports` for serial communication:
- Windows: Uses native Windows serial APIs
- macOS: Uses native POSIX serial APIs  
- Linux: Uses native POSIX serial APIs

These should work in self-contained mode, but testing on actual platforms is recommended.

### Asset Extraction

Embedded assets (OneLoad64.zip, Composers.zip, etc.) are extracted on first run:
- Extraction path: User's local app data folder
- This behavior should work with self-contained deployment
- Verify assets extract correctly in testing

### Publish vs Build

- `dotnet build` - Compiles but doesn't bundle for deployment
- `dotnet publish` - Creates deployable output with all dependencies
- Always use `publish` for distribution

### Version Stamping

Consider adding version to output:
```xml
<PropertyGroup>
  <Version>1.0.0</Version>
  <AssemblyVersion>1.0.0.0</AssemblyVersion>
</PropertyGroup>
```

This will be set dynamically by GitHub Actions in Phase 04.
