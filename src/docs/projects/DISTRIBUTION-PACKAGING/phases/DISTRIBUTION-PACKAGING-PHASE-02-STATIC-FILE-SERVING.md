# Phase 02: API Static File Serving

## 🎯 Objective

Configure the .NET API to serve the Angular production build as static files, with proper SPA fallback routing for Angular's client-side navigation.

**Value Delivered**: API can serve the complete Angular application, enabling single-process deployment.

**Prerequisite**: Phase 01 (Relative URL Migration) must be complete.

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.2-3.3
- [ ] [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md) - API structure and middleware
- [ ] [ASP.NET Core Static Files Docs](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/static-files)

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/
├── wwwroot/                                 ✨ New - Angular production build destination
│   └── .gitkeep                             ✨ New - Keep folder in git
├── Program.cs                               📝 Modified - Static files + SPA fallback
└── TeensyRom.Api.csproj                     📝 Modified - wwwroot included in build

scripts/
└── copy-frontend.ps1                        ✨ New - Build + copy script (optional)
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Configure Static File Middleware</h3></summary>

**Purpose**: Add ASP.NET Core middleware to serve Angular production files from wwwroot folder with proper SPA fallback.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-02-001-STATIC-FILES-CONFIG`

**Implementation Subtasks**:

- [ ] Create `wwwroot/` folder in API project
- [ ] Add `.gitkeep` file to preserve empty folder in git
- [ ] Update `Program.cs` to add `UseDefaultFiles()` before `UseStaticFiles()`
- [ ] Add `UseStaticFiles()` for wwwroot folder
- [ ] Add `MapFallbackToFile("index.html")` AFTER all API routes and SignalR hubs
- [ ] Verify middleware order is correct (static files → API routes → SignalR → SPA fallback)

**Key Requirements**:

Middleware order in `Program.cs`:
1. `UseDefaultFiles()` - Serves index.html for root requests
2. `UseStaticFiles()` - Serves files from wwwroot
3. Existing asset serving (`/Assets/*`)
4. `MapRadEndpoints()` - API routes
5. `MapHub<LogsHub>("/logHub")` - SignalR
6. `MapHub<DeviceEventHub>("/deviceEventHub")` - SignalR
7. `MapFallbackToFile("index.html")` - SPA fallback (MUST BE LAST)

**Critical Order Note**: The SPA fallback MUST come after all API routes. If placed before, it would intercept API requests.

**Testing Subtask**:
- [ ] Build Angular: `pnpm nx build teensyrom-ui --configuration=production`
- [ ] Manually copy `dist/apps/teensyrom-ui/browser/*` to API `wwwroot/`
- [ ] Run API: `dotnet run` in API directory
- [ ] Navigate to `http://localhost:5168` - Angular app loads
- [ ] Navigate to `http://localhost:5168/player/music` - SPA route works (no 404)
- [ ] Verify `/devices` API endpoint still works
- [ ] Verify SignalR hubs connect

</details>

---

<details open>
<summary><h3>Task 2: Build Integration Script</h3></summary>

**Purpose**: Create a script/target that builds the Angular frontend and copies output to API's wwwroot folder.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-02-002-BUILD-INTEGRATION`

**Implementation Subtasks**:

- [ ] Create PowerShell script `scripts/copy-frontend.ps1`
- [ ] Script should: build frontend, clean wwwroot, copy files
- [ ] Add npm script in root `package.json` for convenience
- [ ] Document the build process in README or script header

**Script Requirements**:
1. Run `pnpm nx build teensyrom-ui --configuration=production`
2. Clear existing `apps/api/src/TeensyRom.Api/wwwroot/*` (except .gitkeep)
3. Copy `dist/apps/teensyrom-ui/browser/*` to wwwroot
4. Output success message

**Optional**: Add as Nx target in `project.json` for integration with Nx workflow.

**Testing Subtask**:
- [ ] Run script from repository root
- [ ] Verify wwwroot contains Angular build files
- [ ] Run API and verify application works

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- `apps/api/src/TeensyRom.Api/wwwroot/.gitkeep`
- `scripts/copy-frontend.ps1` (optional)

**Modified Files**:
- `apps/api/src/TeensyRom.Api/Program.cs`
- `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` (if needed for wwwroot inclusion)
- `package.json` (optional - add script)

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
