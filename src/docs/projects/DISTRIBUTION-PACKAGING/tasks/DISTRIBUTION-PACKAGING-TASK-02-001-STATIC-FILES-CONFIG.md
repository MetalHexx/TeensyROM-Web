# Task Handoff: Static Files Configuration

## 🎯 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-02-001-STATIC-FILES-CONFIG`  
**Task Name**: Configure ASP.NET Core Static File Middleware  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (3-4 files)

---

## 📋 Objective

**What**: Configure ASP.NET Core to serve Angular production files from `wwwroot/` folder with proper SPA fallback routing.

**Why**: Enables the API to serve the complete Angular application as a single process, eliminating the need for a separate frontend server in production.

**Success Criteria**:
- [ ] `wwwroot/` folder exists in API project with `.gitkeep`
- [ ] `Program.cs` includes `UseDefaultFiles()` and `UseStaticFiles()` 
- [ ] `MapFallbackToFile("index.html")` added AFTER all API routes and SignalR hubs
- [ ] Middleware order is correct (static files before API, SPA fallback last)
- [ ] Manual test: Angular app loads from `http://localhost:5168` (after copying build)
- [ ] Manual test: SPA routes work (e.g., `/player/music` doesn't 404)
- [ ] Manual test: API endpoints still function (`/api/devices`, etc.)
- [ ] Manual test: SignalR hubs connect successfully

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- ✅ Phase 01: All API routes now have `/api/` prefix
- ✅ SignalR hubs mapped at `/api/logHub` and `/api/deviceEventHub`
- ✅ Frontend uses relative URLs in production mode

**Dependencies**:
- ASP.NET Core built-in static file middleware (no new packages needed)
- Angular production build (will be copied to wwwroot for testing)

**Constraints**:
- SPA fallback MUST be registered AFTER all API routes and SignalR hubs
- Must preserve existing `/Assets/*` static file serving for firmware images
- Must not break development workflow

---

## 📂 File Scope

**Files to Create**:
- `apps/api/src/TeensyRom.Api/wwwroot/.gitkeep` - Preserve empty folder in git

**Files to Modify**:
- `apps/api/src/TeensyRom.Api/Program.cs` - Add static file and SPA fallback middleware

**Files to Review** (context only):
- `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` - Verify wwwroot is included in publish

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md) - API structure and middleware patterns
- ASP.NET Core static files documentation

**Current Program.cs Middleware Order** (for reference):
```csharp
// Existing order to preserve:
app.UseStaticFiles(...);  // /Assets/* serving
app.UseUiCors();
app.UseRateLimiter();
app.MapApiDocs();
app.MapRadEndpoints();
app.MapHub<LogsHub>("/api/logHub");
app.MapHub<DeviceEventHub>("/api/deviceEventHub");
app.Run();
```

**Required Changes** (add before existing static files):
1. Add `app.UseDefaultFiles()` - Rewrites `/` to `/index.html`
2. Add `app.UseStaticFiles()` - Serves files from wwwroot

**Required Changes** (add after all routes, before `app.Run()`):
3. Add `app.MapFallbackToFile("index.html")` - SPA fallback for client-side routing

**Final Middleware Order Should Be**:
```
1. UseDefaultFiles()           ← NEW: Rewrite / to /index.html
2. UseStaticFiles()            ← NEW: Serve from wwwroot
3. UseStaticFiles(/Assets/*)   ← EXISTING: Firmware images
4. UseUiCors()                 ← EXISTING
5. UseRateLimiter()            ← EXISTING
6. MapApiDocs()                ← EXISTING
7. MapRadEndpoints()           ← EXISTING: All /api/* routes
8. MapHub (logHub)             ← EXISTING
9. MapHub (deviceEventHub)     ← EXISTING
10. MapFallbackToFile()        ← NEW: SPA fallback - MUST BE LAST
11. app.Run()
```

**Why This Order Matters**:
- `UseDefaultFiles()` must come before `UseStaticFiles()` to rewrite root requests
- SPA fallback catches all unmatched routes and returns `index.html`
- If SPA fallback were before API routes, it would intercept `/api/*` requests

**Anti-Patterns to Avoid**:
- ❌ Don't place `MapFallbackToFile()` before `MapRadEndpoints()` or SignalR hubs
- ❌ Don't add conditional logic for wwwroot - just serve if files exist
- ❌ Don't modify the existing `/Assets/*` static file configuration

---

## 🧪 Testing Requirements

**Manual Testing Steps**:

1. Create wwwroot folder and .gitkeep
2. Build Angular frontend:
   ```powershell
   pnpm nx build teensyrom-ui --configuration=production
   ```
3. Copy build output to wwwroot:
   ```powershell
   Copy-Item -Recurse -Force dist/apps/teensyrom-ui/browser/* apps/api/src/TeensyRom.Api/wwwroot/
   ```
4. Run API:
   ```powershell
   cd apps/api/src/TeensyRom.Api
   dotnet run
   ```
5. Test in browser:
   - `http://localhost:5168` - Angular app should load
   - `http://localhost:5168/player/music` - SPA route should work (no 404)
   - `http://localhost:5168/settings` - Another SPA route
   - Open DevTools Network tab - verify no 404s for assets

6. Test API functionality:
   - Angular app should be able to call `/api/devices`
   - SignalR connections should establish (check console for connection logs)

**Behavioral Expectations**:
- Root URL serves Angular app
- Deep links work (browser refresh on SPA route returns index.html)
- API routes under `/api/*` continue working
- SignalR hubs connect normally
- Existing `/Assets/*` serving unaffected

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 02 Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-02-STATIC-FILE-SERVING.md)
- [Master Plan](../DISTRIBUTION-PACKAGING-MASTER-PLAN.md)
- [Source Feature Plan](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 3.2-3.3

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-01-000: API Route Prefix (completed) - Added `/api/` prefix
- DISTRIBUTION-PACKAGING-TASK-02-002: Build Integration (next task) - Will automate copying

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-02-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path of the saved report when complete.

---

## ⚠️ Critical Reminders

1. **Middleware order is critical** - SPA fallback MUST be last before `app.Run()`
2. **Preserve existing functionality** - Don't break `/Assets/*` serving
3. **Test with actual Angular build** - Don't just test middleware registration
4. **Verify SignalR still works** - Check browser console for connection logs
