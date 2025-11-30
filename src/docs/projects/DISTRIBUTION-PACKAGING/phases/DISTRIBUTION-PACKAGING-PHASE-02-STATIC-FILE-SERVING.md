# Phase 02: API Static File Serving

## 🎯 Objective

Configure the .NET API to serve the Angular production build as static files, with proper SPA fallback routing for Angular's client-side navigation.

**Value Delivered**: API can serve the complete Angular application, enabling single-process deployment.

**Prerequisite**: Phase 01 (Relative URL Migration) must be complete.

**Status**: ✅ COMPLETE (2025-11-30)

---

## 📚 Required Reading

- [x] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.2-3.3
- [x] [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md) - API structure and middleware
- [x] [ASP.NET Core Static Files Docs](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/static-files)

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/
├── wwwroot/                                 ✅ Created - Angular production build destination
│   └── .gitkeep                             ✅ Created - Keep folder in git
├── Program.cs                               ✅ Modified - Static files + SPA fallback
└── TeensyRom.Api.csproj                     ℹ️ No changes needed - wwwroot auto-included

scripts/
└── copy-frontend.ps1                        ✅ Created - Build + copy script

package.json                                 ✅ Modified - Added build:frontend script
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>✅ Task 1: Configure Static File Middleware (COMPLETE)</h3></summary>

**Purpose**: Add ASP.NET Core middleware to serve Angular production files from wwwroot folder with proper SPA fallback.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-02-001-STATIC-FILES-CONFIG`  
**Report**: [DISTRIBUTION-PACKAGING-TASK-02-001-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-02-001-REPORT.md)

**Implementation Subtasks**:

- [x] Create `wwwroot/` folder in API project
- [x] Add `.gitkeep` file to preserve empty folder in git
- [x] Update `Program.cs` to add `UseDefaultFiles()` before `UseStaticFiles()`
- [x] Add `UseStaticFiles()` for wwwroot folder
- [x] Add `MapFallbackToFile("index.html")` AFTER all API routes and SignalR hubs
- [x] Verify middleware order is correct (static files → API routes → SignalR → SPA fallback)

**Key Requirements**:

Middleware order in `Program.cs`:
1. `UseDefaultFiles()` - Serves index.html for root requests ✅
2. `UseStaticFiles()` - Serves files from wwwroot ✅
3. Existing asset serving (`/Assets/*`) ✅
4. `MapRadEndpoints()` - API routes ✅
5. `MapHub<LogsHub>("/api/logHub")` - SignalR ✅
6. `MapHub<DeviceEventHub>("/api/deviceEventHub")` - SignalR ✅
7. `MapFallbackToFile("index.html")` - SPA fallback (MUST BE LAST) ✅

**Testing Subtask**:
- [x] Build Angular: `pnpm nx build teensyrom-ui --configuration=production`
- [x] Manually copy `dist/apps/teensyrom-ui/browser/*` to API `wwwroot/`
- [x] Run API: `dotnet run` in API directory
- [x] Navigate to `http://localhost:5168` - Angular app loads
- [x] Navigate to SPA routes - Client-side routing works
- [x] Verify API endpoints still work
- [x] Verify SignalR hubs connect

**Outcome**: ✅ All tests passed. Angular app served successfully from API.

</details>

---

<details open>
<summary><h3>✅ Task 2: Build Integration Script (COMPLETE)</h3></summary>

**Purpose**: Create a script/target that builds the Angular frontend and copies output to API's wwwroot folder.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-02-002-BUILD-INTEGRATION`  
**Report**: [DISTRIBUTION-PACKAGING-TASK-02-002-REPORT.md](../reports/DISTRIBUTION-PACKAGING-TASK-02-002-REPORT.md)

**Implementation Subtasks**:

- [x] Create PowerShell script `scripts/copy-frontend.ps1`
- [x] Script builds frontend, cleans wwwroot, copies files
- [x] Add npm script in root `package.json` for convenience
- [x] Document the build process in script header

**Script Features Implemented**:
1. Runs `pnpm nx build teensyrom-ui --configuration=production` ✅
2. Clears `apps/api/src/TeensyRom.Api/wwwroot/*` (except .gitkeep) ✅
3. Copies `dist/apps/teensyrom-ui/browser/*` to wwwroot ✅
4. Professional console output with color-coded status ✅
5. Comprehensive error handling ✅
6. File count reporting ✅
7. Usage instructions in output ✅

**npm Script Added**:
```json
"build:frontend": "pwsh scripts/copy-frontend.ps1"
```

**Testing Results**:
- [x] Run script from repository root - Works perfectly
- [x] Verify wwwroot contains Angular build files - 14 files copied
- [x] Run API and verify application works - All tests passed

**Outcome**: ✅ Robust automation script with excellent UX and error handling.

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- ✅ `apps/api/src/TeensyRom.Api/wwwroot/.gitkeep`
- ✅ `scripts/copy-frontend.ps1`

**Modified Files**:
- ✅ `apps/api/src/TeensyRom.Api/Program.cs`
- ✅ `package.json` (added build:frontend script)
- ℹ️ `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` (no changes needed - wwwroot auto-included)

---

## 📝 Testing Summary

**Manual Integration Testing**:

1. Build and copy: Run `scripts/copy-frontend.ps1`
2. Start API only: `cd apps/api/src/TeensyRom.Api && dotnet run`
3. Navigate to `http://localhost:5168`:
   - [ ] Angular app loads
   - [ ] Styles and assets load correctly
   - [ ] No 404 errors in console

4. Test SPA routing:
   - [ ] Navigate to `/player/music` - page loads (not 404)
   - [ ] Navigate to `/settings` - page loads
   - [ ] Browser refresh on SPA route works

5. Test API functionality:
   - [ ] API calls from Angular work (`/devices`, `/files`, etc.)
   - [ ] SignalR connections establish
   - [ ] Device logs stream correctly

---

## ✅ Success Criteria

- [ ] `wwwroot/` folder exists in API project (tracked in git via .gitkeep)
- [ ] `Program.cs` configured with correct middleware order
- [ ] Angular production build serves from API at `http://localhost:5168`
- [ ] All SPA routes work (deep links, browser refresh)
- [ ] API endpoints continue functioning
- [ ] SignalR hubs connect successfully
- [ ] Existing `/Assets/*` serving still works
- [ ] Build script exists and works

---

## 📝 Notes & Considerations

### Middleware Order

The order of middleware registration in ASP.NET Core is critical:

```csharp
// CORRECT ORDER:
app.UseDefaultFiles();           // 1. Rewrite / to /index.html
app.UseStaticFiles();            // 2. Serve static files from wwwroot
app.UseStaticFiles(assetsOpts);  // 3. Serve /Assets/* (existing)
app.UseUiCors();                 // 4. CORS
app.UseRateLimiter();            // 5. Rate limiting
app.MapRadEndpoints();           // 6. API routes
app.MapHub<LogsHub>("/logHub");  // 7. SignalR
app.MapHub<DeviceEventHub>(...); // 8. SignalR
app.MapFallbackToFile("index.html"); // 9. SPA fallback - LAST!
```

### Why SPA Fallback Must Be Last

- SPA fallback catches ALL unmatched routes
- If placed before API routes, it would serve index.html for `/devices` instead of calling the API
- Angular router then handles the route client-side

### .gitkeep Convention

- Empty `wwwroot/` folder won't be tracked by git
- `.gitkeep` is a convention to preserve empty directories
- Build output (Angular files) should be in `.gitignore`
