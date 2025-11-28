# Task Handoff: Phase 2 - Frontend Infrastructure Layer

## 📋 Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | `PHASE-02` |
| **Feature** | Per-Device Settings |
| **Phase** | 2 of 4 - Frontend Infrastructure Layer |
| **Estimated Scope** | 4 tasks (API client, domain models, mappers) |
| **Dependencies** | Phase 1 complete ✅ |
| **Assigned To** | UI Wizard |

---

## 🎯 Objective

Regenerate the TypeScript API client from the updated OpenAPI spec and update the frontend infrastructure layer to support the new per-device settings model.

After this phase:
1. Generated API client reflects new `knownDevices` array structure
2. Frontend `Settings` model has `knownDevices: DeviceSettings[]`
3. `DeviceSettings` interface with `deviceId`, `videoSettings`, `connectionSettings`
4. `DomainMapper` can transform device settings between API and domain models
5. Infrastructure layer compiles without errors

---

## 📚 Required Reading Before Starting

Read these documents in order:

1. **[Phase 1 Report](./reports/PHASE-01-report.md)** - Understand what changed in backend
2. **[Phase 2 Details](./phases/phase-02-frontend-infrastructure.md)** - Full task breakdown
3. **[API Client Generation](../../API_CLIENT_GENERATION.md)** - How to regenerate client

---

## ⚠️ Prerequisites - Backend Cleanup Required

Before starting Phase 2, ensure the deprecated backend files are deleted:

```powershell
cd c:\dev\src\TeensyROM-Web\src

# Delete deprecated interface files
Remove-Item "apps/api/src/TeensyRom.Core/Abstractions/IConnectionSettingsProvider.cs"
Remove-Item "apps/api/src/TeensyRom.Core/Abstractions/IVideoSettingsProvider.cs"

# Verify backend builds
cd apps/api
dotnet build
```

If the build fails, there may be lingering references to the deleted interfaces that need cleanup.

---

## 🔨 Task Sequence

Execute in this order:

### Task 1: Regenerate API Client

```powershell
# From workspace root: c:\dev\src\TeensyROM-Web\src

# 1. Build backend to regenerate OpenAPI spec
dotnet build apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj

# 2. Regenerate TypeScript client
pnpm run generate:api-client

# 3. Verify generation succeeded
ls libs/data-access/api-client/src/lib/models/
```

**Expected New Models:**
- `DeviceSettingsDto.ts` - Device settings with `deviceId`, `videoSettings`, `connectionSettings`
- Updated `GetSettingsResponse.ts` - Now has `knownDevices` array
- Updated `SaveSettingsRequest.ts` - Now has `knownDevices` array

---

### Task 2: Update Domain Models

**File**: `libs/domain/src/lib/models/settings.model.ts`

Add `DeviceSettings` interface and update `Settings`:

```typescript
// Add new interface
export interface DeviceSettings {
  deviceId: string;
  videoSettings: VideoSettings;
  connectionSettings: ConnectionSettings;
}

// Update Settings to use knownDevices
export interface Settings {
  playerSettings: PlayerSettings;
  fileTransferSettings: FileTransferSettings;
  searchSettings: SearchSettings;
  appSettings: AppSettings;
  knownDevices: DeviceSettings[];  // NEW - replaces global connectionSettings/videoSettings
}
```

**Remove from `Settings` interface** (if present):
- `connectionSettings` (global)
- `videoSettings` (global)

---

### Task 3: Update DomainMapper

**File**: `libs/infrastructure/src/lib/mappers/domain.mapper.ts`

Add device settings mapping methods:

```typescript
// Map single device settings
static toDeviceSettings(dto: DeviceSettingsDto): DeviceSettings {
  return {
    deviceId: dto.deviceId,
    videoSettings: this.toVideoSettings(dto.videoSettings),
    connectionSettings: this.toConnectionSettings(dto.connectionSettings),
  };
}

// Map device settings array
static toKnownDevices(dtos: DeviceSettingsDto[]): DeviceSettings[] {
  return dtos?.map(d => this.toDeviceSettings(d)) ?? [];
}

// Map back to DTO
static toDeviceSettingsDto(model: DeviceSettings): DeviceSettingsDto {
  return {
    deviceId: model.deviceId,
    videoSettings: this.toVideoSettingsDto(model.videoSettings),
    connectionSettings: this.toConnectionSettingsDto(model.connectionSettings),
  };
}

// Update toSettings to use knownDevices
static toSettings(dto: GetSettingsResponse): Settings {
  return {
    playerSettings: this.toPlayerSettings(dto.playerSettings),
    fileTransferSettings: this.toFileTransferSettings(dto.fileTransferSettings),
    searchSettings: this.toSearchSettings(dto.searchSettings),
    appSettings: this.toAppSettings(dto.appSettings),
    knownDevices: this.toKnownDevices(dto.knownDevices),  // NEW
    // REMOVE: connectionSettings, videoSettings (global)
  };
}

// Update toSaveSettingsRequest to use knownDevices
static toSaveSettingsRequest(settings: Settings): SaveSettingsRequest {
  return {
    // ... other fields ...
    knownDevices: settings.knownDevices.map(d => this.toDeviceSettingsDto(d)),
    // REMOVE: connectionSettings, videoSettings (global)
  };
}
```

---

### Task 4: Compile Verification

```powershell
# Verify infrastructure compiles
pnpm nx build infrastructure

# Verify no lint errors
pnpm nx lint infrastructure

# Check for downstream compile errors (expected in application layer)
pnpm nx build application
```

**Expected**: Infrastructure compiles. Application layer may have errors due to removed global selectors - that's Phase 3 work.

---

## 📂 Files to Modify

### Generated (No Manual Edit)
- `libs/data-access/api-client/src/lib/models/DeviceSettingsDto.ts` - Auto-generated
- `libs/data-access/api-client/src/lib/models/GetSettingsResponse.ts` - Updated structure
- `libs/data-access/api-client/src/lib/models/SaveSettingsRequest.ts` - Updated structure

### Manual Edits Required
- `libs/domain/src/lib/models/settings.model.ts` - Add `DeviceSettings`, update `Settings`
- `libs/infrastructure/src/lib/mappers/domain.mapper.ts` - Add device mapping methods

---

## ✅ Success Criteria

Complete this phase when:

- [ ] API client regenerated successfully
- [ ] `DeviceSettingsDto` exists in generated models
- [ ] `DeviceSettings` interface added to domain models
- [ ] `Settings` interface has `knownDevices` array (no global video/connection)
- [ ] `DomainMapper` has device settings mapping methods
- [ ] Infrastructure library compiles: `pnpm nx build infrastructure`
- [ ] Lint passes: `pnpm nx lint infrastructure`

---

## 🔗 API Contract Reference

**GET /api/settings** now returns:

```json
{
  "knownDevices": [
    {
      "deviceId": "ABC123...",
      "videoSettings": { "enableVideo": false },
      "connectionSettings": { 
        "connectionType": "Serial",
        "autoConnectEnabled": true 
      }
    }
  ],
  "playerSettings": { ... },
  "fileTransferSettings": { ... },
  "searchSettings": { ... },
  "appSettings": { ... }
}
```

**Note**: No more global `connectionSettings` or `videoSettings` at the root level.

---

## 📤 Handoff to Phase 3

After completing Phase 2, ensure:

1. Infrastructure compiles without errors
2. Create `reports/PHASE-02-report.md` with:
   - Tasks completed
   - Any deviations from plan
   - Compile status
   - Generated model verification

Phase 3 will update the application layer store with per-device selectors.

---

## 🔗 Related Documentation

- [Phase 2 Details](./phases/phase-02-frontend-infrastructure.md) - Full task breakdown
- [Master Plan](./master-plan.md) - Feature overview
- [API Client Generation](../../API_CLIENT_GENERATION.md) - Generation process
- [Phase 1 Report](./reports/PHASE-01-report.md) - What changed in backend
