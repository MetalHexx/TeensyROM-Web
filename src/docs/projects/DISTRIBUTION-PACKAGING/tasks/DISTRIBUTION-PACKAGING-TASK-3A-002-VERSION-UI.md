# Task Handoff: Frontend Version UI Integration

## 🎯 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-3A-002-VERSION-UI`  
**Task Name**: Add Version Contract, Service, and Display in Header  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (5-6 files)

---

## 📋 Objective

**What**: Integrate the version endpoint into the Angular frontend following Clean Architecture, and display the version in the UI header.

**Why**: Users need to see which version of TeensyROM they're running directly in the application interface.

**Success Criteria**:
- [ ] Domain contract `IVersionService` with injection token created
- [ ] Domain model `AppVersion` interface created
- [ ] Infrastructure `VersionService` implementation calling API
- [ ] Version displays in header left of dark/light mode toggle
- [ ] Version format: `v1.0.0-alpha.1`
- [ ] Version fetched on component init

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- ✅ DISTRIBUTION-PACKAGING-TASK-3A-001: Backend endpoint exists at `GET /api/version`
- ✅ TypeScript API client regenerated with `VersionApiService`

**Dependencies**:
- `@teensyrom-nx/data-access/api-client` - Generated API client
- Existing Clean Architecture patterns in codebase

**Constraints**:
- Follow existing service patterns (see `SettingsService`, `DeviceService`)
- Must use domain contracts and injection tokens
- Header positioned left of theme toggle icon

---

## 📂 File Scope

**Files to Create**:
- `libs/domain/src/lib/contracts/version.contract.ts` - Interface + token
- `libs/domain/src/lib/models/version.model.ts` - AppVersion interface
- `libs/infrastructure/src/lib/version/version.service.ts` - Implementation
- `libs/infrastructure/src/lib/version/providers.ts` - DI provider

**Files to Modify**:
- `libs/domain/src/lib/contracts/index.ts` - Export version contract
- `libs/domain/src/lib/models/index.ts` - Export version model
- `libs/infrastructure/src/lib/index.ts` or providers barrel - Export version provider
- `libs/app/shell/src/lib/components/header/header.component.ts` - Inject service via token
- `libs/app/shell/src/lib/components/header/header.component.html` - Display version

---

## 🔧 Implementation Guidance

**Clean Architecture Layer Responsibilities**:

1. **Domain Layer** (`libs/domain`):
   - `IVersionService` interface with `getVersion(): Observable<AppVersion>` method
   - `VERSION_SERVICE` injection token
   - `AppVersion` model interface with `version: string` property

2. **Infrastructure Layer** (`libs/infrastructure`):
   - `VersionService` implementing `IVersionService`
   - Inject `VersionApiService` from API client
   - Map API response to domain model
   - Provider binding `VERSION_SERVICE` to `VersionService`

3. **Shell Layer** (`libs/app/shell`):
   - `HeaderComponent` injects `IVersionService` via `VERSION_SERVICE` token
   - Call service on component init, store result in local signal or property
   - Display version in template
   - Position left of dark/light mode toggle

**Reference Patterns**:
- `libs/domain/src/lib/contracts/settings.contract.ts` - Contract pattern
- `libs/infrastructure/src/lib/settings/settings.service.ts` - Service pattern

**Version Display**:
- Format: `v1.0.0-alpha.1` (with 'v' prefix)
- Style: Subtle, secondary text color
- Position: Left of theme toggle button in header toolbar

**Component Init**:
- Call `versionService.getVersion()` in `ngOnInit` or constructor
- Store result in a signal for reactive template binding
- Simple and direct - no store needed for static data

---

## 🧪 Testing Requirements

**Manual Testing**:

1. Start API (`dotnet run`)
2. Start frontend dev server (`pnpm start`)
3. Open app in browser
4. Verify version appears in header: `v1.0.0-alpha.1`
5. Verify positioned left of dark/light mode toggle
6. Check browser console for any errors
7. Verify API call to `/api/version` succeeds (Network tab)

**Unit Testing** (if time permits):
- Test `VersionService` with mocked API client

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 3a Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-3A-SEMANTIC-VERSIONING.md)
- [Master Plan](../DISTRIBUTION-PACKAGING-MASTER-PLAN.md)
- [OVERVIEW_CONTEXT.md](../../../OVERVIEW_CONTEXT.md) - Clean Architecture
- [SERVICE_STANDARDS.md](../../../SERVICE_STANDARDS.md)
- [STATE_STANDARDS.md](../../../STATE_STANDARDS.md)

**Example Files**:
- `libs/domain/src/lib/contracts/settings.contract.ts` - Contract pattern
- `libs/infrastructure/src/lib/settings/settings.service.ts` - Service pattern
- `libs/application/src/lib/settings/settings.store.ts` - Store pattern
- `libs/app/shell/src/lib/components/header/header.component.ts` - Target component

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-3A-001: VERSION-ENDPOINT (prerequisite - must be complete)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-3A-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path of the saved report when complete.

---

## ⚠️ Critical Reminders

1. **Follow Clean Architecture** - Domain contracts, infrastructure implementation, application store
2. **Use injection tokens** - `VERSION_SERVICE` token, not direct class injection
3. **Position in header** - Left of dark/light mode toggle, not right
4. **Fetch on startup** - Load version once when app initializes
5. **Export from barrels** - Update index.ts files for proper exports
