# Phase 2: Frontend Infrastructure Layer

## ✅ PHASE COMPLETE

**Completed**: 2025-11-27

---

## 🎯 Objective

Regenerate the API client from the updated OpenAPI specification and update the frontend infrastructure layer: domain models, mappers, and ensure the infrastructure compiles correctly with the new per-device settings structure.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Master Plan](../master-plan.md) - High-level feature plan
- [ ] [Phase 1 Report](../reports/TASK-01-report.md) - Backend implementation details (when available)

**Standards & Guidelines:**

- [ ] [API Client Generation](../../../API_CLIENT_GENERATION.md) - Client regeneration steps
- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [ ] [Domain Standards](../../../DOMAIN_STANDARDS.md) - Domain model patterns

---

## 📂 File Structure Overview

```
libs/domain/src/lib/
├── models/
│   └── settings.model.ts                    📝 Modified - Add DeviceSettings, update Settings
├── contracts/
│   └── (no changes needed)

libs/data-access/api-client/
├── scripts/
│   └── generate-client.js                   ✅ No changes - Used as-is
├── src/lib/
│   ├── apis/
│   │   └── SettingsApiService.ts            🔄 Regenerated
│   └── models/
│       ├── DeviceSettingsDto.ts             🔄 Regenerated (NEW)
│       ├── GetSettingsResponse.ts           🔄 Regenerated
│       └── SaveSettingsRequest.ts           🔄 Regenerated

libs/infrastructure/src/lib/
├── domain.mapper.ts                         📝 Modified - Add device settings mapping
```

---

## 📋 Implementation Guidelines

> **IMPORTANT**: The API client is GENERATED code. Do NOT manually edit files in `libs/data-access/api-client/src/lib/`. Regenerate instead.

> **Dependency**: Phase 1 MUST be complete and backend must build successfully before starting this phase.

---

<details open>
<summary><h3>Task 1: Regenerate API Client</h3></summary>

**Purpose**: Generate new TypeScript client from updated OpenAPI specification that includes `DeviceSettingsDto` and updated request/response models.

**Prerequisites:**

- [ ] Phase 1 complete
- [ ] Backend builds successfully: `dotnet build apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj`

**Implementation Subtasks:**

- [ ] **Build Backend**: Run `dotnet build apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` from repo root
- [ ] **Verify Spec Generated**: Check `apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json` exists and has `DeviceSettingsDto`
- [ ] **Generate Client**: Run `pnpm run generate:api-client` from `src/` directory
- [ ] **Verify Generation**: Check `libs/data-access/api-client/src/lib/models/` contains new DTOs

**Commands:**

```bash
# From repo root
dotnet build src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj

# From src/ directory
cd src
pnpm run generate:api-client
```

**Key Verification Points:**

- [ ] `DeviceSettingsDto.ts` exists in generated models
- [ ] `GetSettingsResponse` includes `knownDevices: DeviceSettingsDto[]`
- [ ] `SaveSettingsRequest` includes `knownDevices: DeviceSettingsDto[]`
- [ ] Old `connectionSettings` and `videoSettings` removed from root response

**Testing Subtask:**

- [ ] **Compile Check**: Run `pnpm nx build data-access-api-client` to verify generated code compiles

</details>

---

<details open>
<summary><h3>Task 2: Update Domain Settings Model</h3></summary>

**Purpose**: Update the frontend `Settings` interface to match the new backend structure with `knownDevices` array.

**Related Documentation:**

- [Current settings.model.ts](../../../../libs/domain/src/lib/models/settings.model.ts)

**Implementation Subtasks:**

- [ ] **Add DeviceSettings Interface**: Create new interface matching backend structure
- [ ] **Update Settings Interface**: Add `knownDevices: DeviceSettings[]`, remove global settings
- [ ] **Keep Sub-Interfaces**: `VideoSettings` and `ConnectionSettings` still needed (used by `DeviceSettings`)

**Updated Model Structure:**

```typescript
// NEW - Add this interface
export interface DeviceSettings {
  deviceId: string;
  videoSettings: VideoSettings;
  connectionSettings: ConnectionSettings;
}

// MODIFIED - Update Settings interface
export interface Settings {
  playerSettings: PlayerSettings;
  fileTransferSettings: FileTransferSettings;
  searchSettings: SearchSettings;
  appSettings: AppSettings;
  knownDevices: DeviceSettings[];  // NEW
  // REMOVED: connectionSettings
  // REMOVED: videoSettings
}
```

**Key Implementation Notes:**

- `VideoSettings` and `ConnectionSettings` interfaces remain unchanged (still needed by `DeviceSettings`)
- Only the root `Settings` interface changes

**Testing Subtask:**

- [ ] **Compile Check**: `pnpm nx build domain` compiles without errors

</details>

---

<details open>
<summary><h3>Task 3: Update DomainMapper</h3></summary>

**Purpose**: Update `DomainMapper` to handle the new `DeviceSettings` structure and update the main settings mapping methods.

**Related Documentation:**

- [Current domain.mapper.ts](../../../../libs/infrastructure/src/lib/domain.mapper.ts)

**Implementation Subtasks:**

- [ ] **Add toDeviceSettings Method**: Map `DeviceSettingsDto` → `DeviceSettings`
- [ ] **Add toDeviceSettingsDto Method**: Map `DeviceSettings` → `DeviceSettingsDto`
- [ ] **Update toSettings Method**: Map `knownDevices` array, remove global settings mapping
- [ ] **Update toSettingsDto Method**: Map `knownDevices` array, remove global settings mapping
- [ ] **Remove Unused Mappings**: Clean up if `toConnectionSettings`/`toVideoSettings` are only used here

**New Mapping Methods:**

```typescript
// DTO → Domain
private static toDeviceSettings(dto: DeviceSettingsDto): DeviceSettings {
  return {
    deviceId: dto.deviceId,
    videoSettings: this.toVideoSettings(dto.videoSettings),
    connectionSettings: this.toConnectionSettings(dto.connectionSettings),
  };
}

// Domain → DTO
private static toDeviceSettingsDto(settings: DeviceSettings): DeviceSettingsDto {
  return {
    deviceId: settings.deviceId,
    videoSettings: this.toVideoSettingsDto(settings.videoSettings),
    connectionSettings: this.toConnectionSettingsDto(settings.connectionSettings),
  };
}
```

**Updated toSettings Method:**

```typescript
static toSettings(dto: GetSettingsResponse): Settings {
  return {
    playerSettings: this.toPlayerSettings(dto.playerSettings),
    fileTransferSettings: this.toFileTransferSettings(dto.fileTransferSettings),
    searchSettings: this.toSearchSettings(dto.searchSettings),
    appSettings: this.toAppSettings(dto.appSettings),
    knownDevices: dto.knownDevices?.map(d => this.toDeviceSettings(d)) ?? [],
    // REMOVED: connectionSettings
    // REMOVED: videoSettings
  };
}
```

**Key Implementation Notes:**

- Keep `toVideoSettings` and `toConnectionSettings` private methods - they're used by `toDeviceSettings`
- Handle null/undefined `knownDevices` array gracefully (default to empty array)

**Testing Subtask:**

- [ ] **Write Unit Tests**: Test `toDeviceSettings` mapping
- [ ] **Write Unit Tests**: Test `toDeviceSettingsDto` mapping
- [ ] **Write Unit Tests**: Test `toSettings` with empty `knownDevices`
- [ ] **Write Unit Tests**: Test `toSettings` with multiple devices

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] `toDeviceSettings` correctly maps all properties from DTO
- [ ] `toDeviceSettingsDto` correctly maps all properties to DTO
- [ ] `toSettings` handles null `knownDevices` (returns empty array)
- [ ] `toSettings` handles array of devices correctly
- [ ] Round-trip: `toSettings(toSettingsDto(settings))` equals original

</details>

---

<details open>
<summary><h3>Task 4: Verify Infrastructure Compiles</h3></summary>

**Purpose**: Ensure the entire infrastructure layer compiles without errors after the model changes.

**Implementation Subtasks:**

- [ ] **Build Infrastructure**: Run `pnpm nx build infrastructure`
- [ ] **Fix Any Errors**: Address any TypeScript errors from updated models
- [ ] **Build Dependent Libraries**: Ensure downstream libraries still compile

**Commands:**

```bash
pnpm nx build infrastructure
pnpm nx build application  # May have errors - that's Phase 3
```

**Key Implementation Notes:**

- Infrastructure should compile cleanly
- Application layer will likely have errors related to removed global selectors - that's expected and addressed in Phase 3

**Testing Subtask:**

- [ ] **Compile Verification**: `pnpm nx build infrastructure` succeeds
- [ ] **Lint Check**: `pnpm nx lint infrastructure` passes

</details>

---

## 🗂️ Files Modified or Created

**Regenerated Files (do not edit manually):**

- `libs/data-access/api-client/src/lib/models/DeviceSettingsDto.ts` - NEW
- `libs/data-access/api-client/src/lib/models/GetSettingsResponse.ts` - Updated
- `libs/data-access/api-client/src/lib/models/SaveSettingsRequest.ts` - Updated
- `libs/data-access/api-client/src/lib/models/index.ts` - Updated exports

**Modified Files:**

- `libs/domain/src/lib/models/settings.model.ts`
- `libs/infrastructure/src/lib/domain.mapper.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

**Core Testing Philosophy:**

- Verify generated code compiles
- Test mapper transformations with unit tests
- Ensure no breaking changes to infrastructure layer

**Test Categories:**

| Task | Test Type | Key Behaviors |
|------|-----------|---------------|
| Task 1 | Compile | Generated client compiles |
| Task 2 | Compile | Domain model compiles |
| Task 3 | Unit | Mapper transformations work correctly |
| Task 4 | Compile | Infrastructure layer compiles |

**Test Execution:**

```bash
pnpm nx test infrastructure
pnpm nx lint infrastructure
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] API client regenerated with `DeviceSettingsDto`
- [ ] `Settings` interface has `knownDevices: DeviceSettings[]`
- [ ] `Settings` interface does NOT have global `connectionSettings` or `videoSettings`
- [ ] `DomainMapper` correctly maps device settings

**Testing Requirements:**

- [ ] All mapper unit tests pass
- [ ] Infrastructure library compiles
- [ ] Lint passes with no errors

**Quality Checks:**

- [ ] No TypeScript errors in domain or infrastructure
- [ ] Generated client matches OpenAPI spec
- [ ] Mapper handles edge cases (null, empty arrays)

**Ready for Next Phase:**

- [ ] Infrastructure compiles cleanly
- [ ] Ready for application layer updates (Phase 3)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### API Client Generation Notes

- Generated client is in `libs/data-access/api-client/src/lib/`
- NEVER manually edit generated files
- If regeneration fails, check OpenAPI spec for issues
- Post-processing script renames `*Api` → `*ApiService`

### Dependencies for Next Phase

- Phase 3 will update application layer (store selectors)
- Application layer will have compile errors until Phase 3 is complete
- This is expected - Phase 3 addresses those errors

</details>
