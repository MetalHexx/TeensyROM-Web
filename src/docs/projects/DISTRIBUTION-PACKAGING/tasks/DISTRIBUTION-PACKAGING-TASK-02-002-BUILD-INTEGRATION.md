# Task Handoff: Build Integration Script

## 🎯 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-02-002-BUILD-INTEGRATION`  
**Task Name**: Create Build Script for Frontend → wwwroot Copy  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small (2-3 files)

---

## 📋 Objective

**What**: Create a PowerShell script and npm script that builds the Angular frontend and copies the output to the API's wwwroot folder.

**Why**: Automates the build-copy workflow, ensuring consistent build process for distribution and local testing.

**Success Criteria**:
- [ ] PowerShell script `scripts/copy-frontend.ps1` exists and works
- [ ] Script builds Angular frontend with production configuration
- [ ] Script cleans wwwroot (preserving .gitkeep) and copies new build
- [ ] npm script added to root `package.json` for convenience
- [ ] Running script from repo root successfully populates wwwroot
- [ ] API serves the copied Angular build correctly

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- ✅ DISTRIBUTION-PACKAGING-TASK-02-001: Static file middleware configured
- ✅ wwwroot folder exists with .gitkeep

**Dependencies**:
- pnpm installed
- PowerShell (Windows) or pwsh (cross-platform)
- Nx workspace configured

**Constraints**:
- Script should work from repository root
- Must preserve `.gitkeep` when cleaning wwwroot
- Should output clear success/failure messages

---

## 📂 File Scope

**Files to Create**:
- `scripts/copy-frontend.ps1` - PowerShell build + copy script

**Files to Modify**:
- `package.json` (root) - Add npm script for convenience

**Files to Review** (context only):
- `apps/teensyrom-ui/project.json` - Verify build target configuration
- `dist/apps/teensyrom-ui/browser/` - Build output location (after build)

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- PowerShell best practices (proper error handling, informative output)
- Follow existing npm script naming conventions in package.json

**Script Requirements**:

The script should perform these steps in order:
1. Run `pnpm nx build teensyrom-ui --configuration=production`
2. Verify build succeeded (check exit code)
3. Clean `apps/api/src/TeensyRom.Api/wwwroot/*` except `.gitkeep`
4. Copy `dist/apps/teensyrom-ui/browser/*` to wwwroot
5. Output success message with file count

**Example Script Structure** (implement with proper error handling):
```powershell
#!/usr/bin/env pwsh
# copy-frontend.ps1 - Build Angular and copy to API wwwroot

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot | Split-Path -Parent
$distPath = Join-Path $repoRoot "dist/apps/teensyrom-ui/browser"
$wwwrootPath = Join-Path $repoRoot "apps/api/src/TeensyRom.Api/wwwroot"

# 1. Build frontend
Write-Host "Building Angular frontend..." -ForegroundColor Cyan
# ... build command ...

# 2. Clean wwwroot (preserve .gitkeep)
# ... clean logic ...

# 3. Copy files
# ... copy logic ...

# 4. Output summary
# ... success message ...
```

**npm Script to Add**:
```json
{
  "scripts": {
    "build:frontend": "pwsh scripts/copy-frontend.ps1"
  }
}
```

**Alternative**: Also consider adding as Nx target if preferred for workflow integration.

**Anti-Patterns to Avoid**:
- ❌ Don't delete `.gitkeep` when cleaning wwwroot
- ❌ Don't hardcode absolute paths
- ❌ Don't suppress error output - let failures be visible
- ❌ Don't forget to check if dist folder exists before copying

---

## 🧪 Testing Requirements

**Manual Testing Steps**:

1. Ensure clean state:
   ```powershell
   # Remove any existing build
   Remove-Item -Recurse -Force dist/apps/teensyrom-ui -ErrorAction SilentlyContinue
   ```

2. Run the script:
   ```powershell
   .\scripts\copy-frontend.ps1
   # OR
   pnpm run build:frontend
   ```

3. Verify output:
   - Script completes without errors
   - `apps/api/src/TeensyRom.Api/wwwroot/` contains Angular build files
   - `index.html` exists in wwwroot
   - `.gitkeep` still exists in wwwroot

4. Test the full flow:
   ```powershell
   cd apps/api/src/TeensyRom.Api
   dotnet run
   ```
   - Navigate to `http://localhost:5168`
   - Angular app should load correctly

**Edge Cases to Test**:
- Running script when dist folder doesn't exist (should fail with clear message)
- Running script when wwwroot has existing files (should clean and replace)
- Running script from different directories (should work from repo root)

**Behavioral Expectations**:
- Clear console output showing progress
- Exit code 0 on success, non-zero on failure
- File count reported on success
- Error message if build fails

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 02 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-02-STATIC-FILE-SERVING.md)
- [Master Plan](../DISTRIBUTION-PACKAGING-MASTER-PLAN.md)

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-02-001: Static Files Config (completed) - wwwroot ready
- DISTRIBUTION-PACKAGING-TASK-03-001: CSPROJ Publish Settings (next phase) - Will use this script

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-02-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path of the saved report when complete.

---

## ⚠️ Critical Reminders

1. **Preserve .gitkeep** - Don't delete it when cleaning wwwroot
2. **Use relative paths** - Script should work regardless of where repo is cloned
3. **Clear error messages** - If build fails, user should know why
4. **Test end-to-end** - Don't just test the script, verify the API serves correctly
