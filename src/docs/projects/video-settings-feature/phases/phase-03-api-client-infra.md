# Phase 3: API Client Regeneration & Infrastructure Integration

## 🎯 Objective

Regenerate the TypeScript API client to include VideoSettingsDto from the updated OpenAPI specification, then integrate video settings into the frontend infrastructure layer through domain models, mappers, and services. This phase bridges the backend API with frontend application state.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Feature Planning Document](../master-plan.md) - High-level feature plan
- [ ] [Phase 2 Completion Report](../reports/TASK-02-CONSOLIDATED-report.md) - Backend API implementation
- [ ] [API Client Generation Guide](../../../API_CLIENT_GENERATION.md) - Client generation workflow

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Domain Standards](../../../DOMAIN_STANDARDS.md) - Domain model patterns
- [ ] [Overview Context](../../../OVERVIEW_CONTEXT.md) - Architecture layers and patterns

---

## 📂 File Structure Overview

```
libs/data-access/api-client/src/lib/
├── apis/                                    📝 Regenerated - SettingsApiService updated
├── models/                                  ✨ New - VideoSettingsDto model
│   ├── VideoSettingsDto.ts
│   ├── GetSettingsResponse.ts               📝 Modified - includes videoSettings
│   ├── SaveSettingsRequest.ts               📝 Modified - includes videoSettings
│   └── index.ts                             📝 Modified - export VideoSettingsDto

libs/domain/src/lib/models/
├── settings.model.ts                        📝 Modified - Add VideoSettings interface
└── index.ts                                 📝 Modified - Export VideoSettings

libs/infrastructure/src/lib/
├── domain.mapper.ts                         📝 Modified - Add VideoSettings mapping methods
└── settings/settings.service.ts             📝 Verified - No changes needed (uses mapper)
```

---

## 📋 Implementation Guidelines

---

<details open>
<summary><h3>Task 1: Regenerate TypeScript API Client</h3></summary>

**Purpose**: Regenerate the frontend TypeScript API client from the updated OpenAPI specification that now includes VideoSettingsDto schema.

**Related Documentation:**

- [API Client Generation](../../../API_CLIENT_GENERATION.md) - Complete generation workflow
- [OpenAPI Spec](../../../../../apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json) - Source specification

**Implementation Subtasks:**

- [ ] **Verify OpenAPI Spec**: Confirm VideoSettingsDto exists in api-spec/TeensyRom.Api.json
- [ ] **Navigate to workspace root**: `c:\dev\src\TeensyROM-Web\src`
- [ ] **Run generation command**: `pnpm run generate:api-client`
- [ ] **Verify generated files**: Check VideoSettingsDto.ts created in libs/data-access/api-client/src/lib/models/
- [ ] **Verify type updates**: Confirm GetSettingsResponse and SaveSettingsRequest include videoSettings property
- [ ] **Verify barrel exports**: Ensure VideoSettingsDto exported from models/index.ts

**Testing Subtask:**

- [ ] **Write Tests**: Verify generated types compile correctly (see Testing section below)

**Key Implementation Notes:**

- API client generation is automatic - just run the pnpm script
- Generated files use TypeScript `interface` types
- Property names are camelCase (enableVideo, not EnableVideo)
- Generation script also updates barrel exports automatically
- Do NOT manually edit generated files

**Expected Output**:

New file: `libs/data-access/api-client/src/lib/models/VideoSettingsDto.ts`
```typescript
export interface VideoSettingsDto {
  enableVideo: boolean;
}
```

Updated: `libs/data-access/api-client/src/lib/models/GetSettingsResponse.ts`
```typescript
export interface GetSettingsResponse {
  connectionSettings: ConnectionSettingsDto;
  playerSettings: PlayerSettingsDto;
  videoSettings: VideoSettingsDto; // ADDED
  // ... other properties
}
```

**Testing Focus for Task 1:**

> Focus on **compilation verification** - do generated types compile without errors?

**Behaviors to Test:**

- [ ] **TypeScript Compilation**: Generated code compiles with no errors
- [ ] **Type Exports**: VideoSettingsDto exported and accessible from package
- [ ] **Type Structure**: VideoSettingsDto has enableVideo property of type boolean

**Testing Reference:**

- Run `pnpm nx build data-access-api-client` to verify compilation
- Check for TypeScript errors in generated files

</details>

---

<details open>
<summary><h3>Task 2: Create Frontend VideoSettings Domain Model</h3></summary>

**Purpose**: Define the frontend domain interface for VideoSettings that matches the backend structure, following the established pattern from PlayerSettings, ConnectionSettings, etc.

**Related Documentation:**

- [Domain Standards](../../../DOMAIN_STANDARDS.md) - Domain model patterns
- [settings.model.ts](../../../../../../libs/domain/src/lib/models/settings.model.ts) - Existing settings interfaces

**Implementation Subtasks:**

- [ ] **Open settings.model.ts** in `libs/domain/src/lib/models/`
- [ ] **Add VideoSettings interface** after PlayerSettings (maintain logical ordering)
- [ ] **Define enableVideo property** with JSDoc comment
- [ ] **Update Settings root interface** to include videoSettings property
- [ ] **Update barrel export** in `libs/domain/src/lib/models/index.ts` to export VideoSettings

**Testing Subtask:**

- [ ] **Write Tests**: No tests needed for pure interface definition

**Key Implementation Notes:**

- Use `interface` (not `type` or `class`)
- Property naming matches backend: `enableVideo` (camelCase)
- JSDoc comments required on interface and properties
- Follow exact pattern from PlayerSettings, ConnectionSettings
- Place VideoSettings after PlayerSettings in Settings root interface

**Critical Type Definition**:

```typescript
/**
 * Video capture and display settings
 */
export interface VideoSettings {
  /** Enable video capture component visibility in player view */
  enableVideo: boolean;
}
```

**Update Settings root interface**:

```typescript
export interface Settings {
  connectionSettings: ConnectionSettings;
  playerSettings: PlayerSettings;
  videoSettings: VideoSettings; // ADDED
  fileTransferSettings: FileTransferSettings;
  searchSettings: SearchSettings;
  appSettings: AppSettings;
}
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **TypeScript Compilation**: Domain models compile without errors
- [ ] **Type Exports**: VideoSettings exported and accessible from @teensyrom-nx/domain

**Testing Reference:**

- Verify compilation with `pnpm nx build domain`

</details>

---

<details open>
<summary><h3>Task 3: Update DomainMapper with VideoSettings Transformations</h3></summary>

**Purpose**: Add mapping methods to DomainMapper to transform between API DTOs and domain models for VideoSettings, enabling bidirectional data flow through the infrastructure layer.

**Related Documentation:**

- [domain.mapper.ts](../../../../../../libs/infrastructure/src/lib/domain.mapper.ts) - Existing mapper patterns

**Implementation Subtasks:**

- [ ] **Open domain.mapper.ts** in `libs/infrastructure/src/lib/`
- [ ] **Import VideoSettingsDto** from @teensyrom-nx/data-access/api-client
- [ ] **Import VideoSettings** from @teensyrom-nx/domain
- [ ] **Add mapVideoSettings helper** in toSettings method (DTO → domain)
- [ ] **Add mapVideoSettingsDto helper** in toSettingsDto method (domain → DTO)
- [ ] **Update toSettings method** to include videoSettings mapping
- [ ] **Update toSettingsDto method** to include videoSettings mapping

**Testing Subtask:**

- [ ] **Write Tests**: Test bidirectional mapping (see Testing section below)

**Key Implementation Notes:**

- Follow exact pattern from `mapPlayerSettings` / `mapPlayerSettingsDto`
- Both methods are private static helpers
- toSettings maps API → Domain (for GET responses)
- toSettingsDto maps Domain → API (for POST requests)
- Simple property mapping (enableVideo → enableVideo)

**Critical Code Patterns**:

```typescript
// In toSettings method (API → Domain):
static toSettings(response: GetSettingsResponse): Settings {
  return {
    connectionSettings: this.mapConnectionSettings(response.connectionSettings),
    playerSettings: this.mapPlayerSettings(response.playerSettings),
    videoSettings: this.mapVideoSettings(response.videoSettings), // ADDED
    fileTransferSettings: this.mapFileTransferSettings(response.fileTransferSettings),
    searchSettings: this.mapSearchSettings(response.searchSettings),
    appSettings: this.mapAppSettings(response.appSettings),
  };
}

// Helper method (API → Domain):
private static mapVideoSettings(dto: VideoSettingsDto): VideoSettings {
  return {
    enableVideo: dto.enableVideo,
  };
}

// In toSettingsDto method (Domain → API):
static toSettingsDto(settings: Settings): SaveSettingsRequest {
  return {
    connectionSettings: this.mapConnectionSettingsDto(settings.connectionSettings),
    playerSettings: this.mapPlayerSettingsDto(settings.playerSettings),
    videoSettings: this.mapVideoSettingsDto(settings.videoSettings), // ADDED
    fileTransferSettings: this.mapFileTransferSettingsDto(settings.fileTransferSettings),
    searchSettings: this.mapSearchSettingsDto(settings.searchSettings),
    appSettings: this.mapAppSettingsDto(settings.appSettings),
  };
}

// Helper method (Domain → API):
private static mapVideoSettingsDto(settings: VideoSettings): VideoSettingsDto {
  return {
    enableVideo: settings.enableVideo,
  };
}
```

**Testing Focus for Task 3:**

> Focus on **behavioral testing** - do mappings preserve values correctly?

**Behaviors to Test:**

- [ ] **DTO → Domain Mapping**: VideoSettingsDto maps to VideoSettings correctly
- [ ] **Domain → DTO Mapping**: VideoSettings maps to VideoSettingsDto correctly
- [ ] **Round-Trip Integrity**: DTO → Domain → DTO preserves all values
- [ ] **enableVideo Value Preservation**: Boolean values transfer accurately (true/false)

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for mapper testing patterns
- Test both directions independently
- Test round-trip to ensure no data loss

</details>

---

<details open>
<summary><h3>Task 4: Verify SettingsService Integration</h3></summary>

**Purpose**: Verify that the existing SettingsService correctly handles VideoSettings through the updated mapper without requiring code changes.

**Related Documentation:**

- [settings.service.ts](../../../../../../libs/infrastructure/src/lib/settings/settings.service.ts) - Service to verify

**Implementation Subtasks:**

- [ ] **Open settings.service.ts** in `libs/infrastructure/src/lib/settings/`
- [ ] **Review getSettings method**: Confirm it uses DomainMapper.toSettings (no changes needed)
- [ ] **Review saveSettings method**: Confirm it uses DomainMapper.toSettingsDto (no changes needed)
- [ ] **Verify type compatibility**: Settings interface includes videoSettings (from domain)
- [ ] **No code changes required**: Service already handles VideoSettings through mapper

**Testing Subtask:**

- [ ] **Write Tests**: Integration tests verify end-to-end flow (see Testing section below)

**Key Implementation Notes:**

- SettingsService requires NO changes - it already uses DomainMapper
- Service is agnostic to specific settings groups
- Type checking ensures VideoSettings is included automatically
- Error handling remains unchanged

**Verification Points**:

1. `getSettings()` returns `Observable<Settings>` - Settings now includes videoSettings
2. `saveSettings(settings: Settings)` accepts settings - Settings now includes videoSettings
3. DomainMapper handles all transformation logic
4. Type system ensures VideoSettings is included

**Testing Focus for Task 4:**

> Focus on **integration testing** - does the full flow work end-to-end?

**Behaviors to Test:**

- [ ] **GET Settings**: getSettings returns videoSettings with default value (enableVideo: false)
- [ ] **SAVE Settings**: saveSettings accepts Settings with videoSettings
- [ ] **Round-Trip**: Save videoSettings, retrieve it back, values match
- [ ] **Error Handling**: Service error handling works correctly for video settings

**Testing Reference:**

- Integration tests via HTTP calls to API
- Manual testing via application UI (once Phase 5 complete)
- See [Testing Standards](../../../TESTING_STANDARDS.md) for service testing patterns

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**New Files** (generated by API client):

- `libs/data-access/api-client/src/lib/models/VideoSettingsDto.ts`

**Modified Files** (generated by API client):

- `libs/data-access/api-client/src/lib/models/GetSettingsResponse.ts`
- `libs/data-access/api-client/src/lib/models/SaveSettingsRequest.ts`
- `libs/data-access/api-client/src/lib/models/index.ts`

**Modified Files** (manual):

- `libs/domain/src/lib/models/settings.model.ts`
- `libs/domain/src/lib/models/index.ts`
- `libs/infrastructure/src/lib/domain.mapper.ts`

**Verified Files** (no changes needed):

- `libs/infrastructure/src/lib/settings/settings.service.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test observable transformations, not implementation
> - **Test as you go** - tests integrated into each task's subtasks
> - **Test through public APIs** - mappers and services tested through their public methods
> - **Mock at boundaries** - mock API client, not mappers

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md) - Core testing approach

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in task's subtask list
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```powershell
# Run domain library tests
pnpm nx test domain

# Run infrastructure library tests
pnpm nx test infrastructure

# Run API client build verification
pnpm nx build data-access-api-client

# Run all tests
pnpm nx run-many --target=test --all
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] Domain models follow [Domain Standards](../../../DOMAIN_STANDARDS.md)

**API Client Generation:**

- [ ] TypeScript API client regenerated successfully
- [ ] VideoSettingsDto.ts created in models folder
- [ ] GetSettingsResponse includes videoSettings property
- [ ] SaveSettingsRequest includes videoSettings property
- [ ] All generated code compiles without errors
- [ ] Barrel exports updated correctly

**Domain Layer:**

- [ ] VideoSettings interface created in settings.model.ts
- [ ] Settings root interface includes videoSettings property
- [ ] Domain models exported from barrel
- [ ] Domain library compiles without errors

**Infrastructure Layer:**

- [ ] DomainMapper includes mapVideoSettings method (DTO → domain)
- [ ] DomainMapper includes mapVideoSettingsDto method (domain → DTO)
- [ ] Both mapper methods tested for correctness
- [ ] Round-trip mapping preserves all values
- [ ] Infrastructure library compiles without errors

**Integration Verification:**

- [ ] SettingsService correctly handles VideoSettings
- [ ] getSettings returns videoSettings in response
- [ ] saveSettings accepts videoSettings in request
- [ ] End-to-end flow verified (GET/POST settings with video settings)

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Mapper tests pass with 100% accuracy
- [ ] Integration tests verify end-to-end flow

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors (`pnpm nx lint`)
- [ ] Code formatting is consistent
- [ ] No console errors in application

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Ready to proceed to Phase 4 (Frontend State Management)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Frontend Matches Backend**: VideoSettings interface structure matches backend exactly for simplicity. No frontend-specific divergence needed.

- **Mapper Simplicity**: VideoSettings mapping is straightforward (single boolean property) with no complex transformations or business logic.

- **Service Agnostic**: SettingsService requires no changes because it delegates all mapping to DomainMapper, making it agnostic to specific settings groups.

### Implementation Constraints

- **Generated Files**: Do not manually edit API client files - always regenerate via script
- **Type Safety**: TypeScript compiler enforces VideoSettings inclusion throughout the stack
- **Barrel Exports**: Must update barrel exports when adding new interfaces/types

### Future Enhancements

- **Additional Video Properties**: When backend adds new video settings (quality, resolution), frontend can add corresponding properties to VideoSettings interface

- **Complex Mapping**: If future video settings require complex transformations (e.g., enum mappings, nested objects), mapper methods can be expanded

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

**Phase Status**: Ready for Execution  
**Estimated Effort**: 1-1.5 hours  
**Dependencies**: Phase 2 complete ✅  
**Blocks**: Phase 4 (Frontend State Management)
