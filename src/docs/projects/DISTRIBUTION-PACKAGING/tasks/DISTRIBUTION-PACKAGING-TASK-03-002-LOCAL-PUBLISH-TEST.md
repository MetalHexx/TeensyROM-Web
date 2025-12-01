# Task Handoff: Local Publish Test

## 🎯 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-03-002-LOCAL-PUBLISH-TEST`  
**Task Name**: Verify Published Executable Works Without .NET SDK  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (testing/verification only)

---

## 📋 Objective

**What**: Build, publish, and verify that the self-contained executable runs correctly and serves the full application without requiring .NET SDK/runtime on the target machine.

**Why**: This validates that the distribution package will work for end users who don't have development tools installed.

**Success Criteria**:
- [ ] Published executable starts without .NET SDK installed
- [ ] Angular app loads at `http://localhost:5168`
- [ ] SPA routing works (deep links, browser refresh)
- [ ] API endpoints respond (`/api/devices`, etc.)
- [ ] SignalR connections establish
- [ ] Embedded assets are accessible (game images, etc.)
- [ ] File size documented for reference

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- ✅ DISTRIBUTION-PACKAGING-TASK-03-001: .csproj publish settings configured
- ✅ Frontend build script working (`scripts/copy-frontend.ps1`)
- ✅ Static file serving configured (Phase 02)

**Dependencies**:
- Windows machine for testing (or VM)
- Ideally: Clean Windows environment without .NET SDK for true verification
- Alternative: Use `where dotnet` to verify no SDK, or test in VM

**Constraints**:
- Must test on Windows (other platforms tested in CI later)
- Serial port testing requires physical device (optional for this task)

---

## 📂 File Scope

**No Files to Create or Modify** - This is a testing/verification task.

**Files to Use**:
- `scripts/copy-frontend.ps1` - Build frontend
- `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` - Publish source

**Output Location** (not committed):
- `apps/api/src/TeensyRom.Api/publish/win-x64/` - Published executable

---

## 🔧 Implementation Guidance

**Complete Testing Workflow**:

### Step 1: Build Frontend and Copy to wwwroot

```powershell
# From repository root
.\scripts\copy-frontend.ps1
```

Verify: `apps/api/src/TeensyRom.Api/wwwroot/` contains Angular build files.

### Step 2: Publish for Windows

```powershell
cd apps/api/src/TeensyRom.Api
dotnet publish -c Release -r win-x64 --self-contained -o ./publish/win-x64
```

Verify:
- Command completes successfully
- `publish/win-x64/TeensyRom.Api.exe` exists
- Note file size for report

### Step 3: Test Published Executable

**Option A: Clean Environment (Preferred)**
1. Copy `publish/win-x64/` to a machine or VM without .NET SDK
2. Run `TeensyRom.Api.exe`
3. Open browser to `http://localhost:5168`

**Option B: Local Test (Acceptable)**
1. Navigate to `publish/win-x64/`
2. Run `.\TeensyRom.Api.exe`
3. Open browser to `http://localhost:5168`

### Step 4: Functional Verification

Test each area:

**Angular App Loading**:
- [ ] Root URL (`http://localhost:5168`) loads Angular app
- [ ] Styles render correctly
- [ ] No 404 errors in browser console

**SPA Routing**:
- [ ] Navigate to `/player/music` via UI
- [ ] Direct URL to `/settings` works
- [ ] Browser refresh on SPA route works (returns to same page)

**API Functionality**:
- [ ] Open DevTools Network tab
- [ ] API calls succeed (check for `/api/*` requests)
- [ ] No CORS errors

**SignalR**:
- [ ] Console shows SignalR connection logs
- [ ] Device event hub connects (check browser console)

**Assets**:
- [ ] Game/music metadata loads (if cached)
- [ ] `/Assets/*` endpoint works for firmware images

### Step 5: Document Results

Record for report:
- Executable file size
- Startup time (approximate)
- Any warnings in console
- Memory usage (approximate, via Task Manager)

---

## 🧪 Testing Requirements

**Functional Test Matrix**:

| Test Area | Expected Result | Status |
|-----------|-----------------|--------|
| App startup | Starts without errors | ⬜ |
| Angular loads | UI renders at root URL | ⬜ |
| SPA routes | Deep links work | ⬜ |
| API calls | `/api/*` endpoints respond | ⬜ |
| SignalR | Hubs connect | ⬜ |
| Assets | Static files served | ⬜ |

**Optional Tests** (if device available):
- [ ] Device discovery works
- [ ] File browsing works
- [ ] File launch works

**Edge Cases**:
- [ ] Multiple browser tabs work
- [ ] Closing and reopening app works
- [ ] Port 5168 conflict handling (check for clear error message)

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 03 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-03-PUBLISHING.md)
- [Master Plan](../DISTRIBUTION-PACKAGING-MASTER-PLAN.md)

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-03-001: CSPROJ Publish Settings (must be complete)
- DISTRIBUTION-PACKAGING-TASK-04-001: GitHub Actions (next phase) - Will automate this

**Publish Commands for Reference** (all platforms):
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

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-03-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Report Should Include**:
- Published executable file size
- All test results from matrix
- Any issues encountered
- Screenshots if helpful
- Recommendations for Phase 04

**Return Value**: Return the file path of the saved report when complete.

---

## ⚠️ Critical Reminders

1. **Build frontend first** - Run `copy-frontend.ps1` before publishing
2. **Use Release configuration** - Debug builds are much larger
3. **Test in browser** - Don't just verify app starts, test functionality
4. **Document file size** - Important for release notes and user expectations
5. **Check console output** - Note any warnings or errors on startup
