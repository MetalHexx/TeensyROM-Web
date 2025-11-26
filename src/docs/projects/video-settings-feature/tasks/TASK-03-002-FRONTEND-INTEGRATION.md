# Task Handoff: TASK-03-002-FRONTEND-INTEGRATION

## 📋 Task Identity

**Task ID**: TASK-03-002-FRONTEND-INTEGRATION  
**Task Name**: Integrate VideoSettings into Frontend Domain and Mapper  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Completes Phase 3 infrastructure)  
**Estimated Context Size**: Medium (3 files modified + tests)

---

## 🎯 Objective

**What**: Add VideoSettings to the frontend domain model, implement bidirectional mapping in DomainMapper, and verify SettingsService integration.

**Why**: The frontend needs a domain-layer representation of VideoSettings that matches the Clean Architecture pattern. DomainMapper transforms between API DTOs (from Task 3-1) and domain models, enabling the application layer to work with clean domain objects.

**Success Criteria**:

- [ ] VideoSettings interface created in domain models
- [ ] VideoSettings property added to Settings root interface
- [ ] DomainMapper includes mapVideoSettings helper (API → domain)
- [ ] DomainMapper includes mapVideoSettingsDto helper (domain → API)
- [ ] DomainMapper.toSettings correctly transforms videoSettings property
- [ ] DomainMapper.toSettingsDto correctly transforms videoSettings property
- [ ] SettingsService verified to work without changes
- [ ] All TypeScript compilation succeeds
- [ ] Unit tests pass for mapper transformations

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- ✅ TASK-03-001: TypeScript API client regenerated with VideoSettingsDto
- ✅ VideoSettingsDto.ts exists in data-access/api-client
- ✅ GetSettingsResponse includes videoSettings property
- ✅ SaveSettingsRequest includes videoSettings property

**Dependencies**:

- `libs/data-access/api-client` - Generated TypeScript client (VideoSettingsDto)
- `libs/domain` - Domain models layer
- `libs/infrastructure` - DomainMapper service

**Constraints**:

- Follow existing Settings pattern exactly (ConnectionSettings, PlayerSettings, etc.)
- Property placement: videoSettings after playerSettings (consistent with backend)
- DomainMapper must handle undefined/null videoSettings gracefully
- SettingsService should require NO changes (service agnostic to settings groups)

---

## 📂 File Scope

**Files to Modify**:

- `libs/domain/src/lib/models/settings.model.ts` - Add VideoSettings interface and property
- `libs/infrastructure/src/lib/domain.mapper.ts` - Add VideoSettings mapping methods
- `libs/infrastructure/src/lib/domain.mapper.spec.ts` - Add VideoSettings mapping tests

**Files to Review** (for context only):

- `libs/infrastructure/src/lib/settings/settings.service.ts` - Verify no changes needed
- `libs/data-access/api-client/src/lib/models/VideoSettingsDto.ts` - Generated DTO structure

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Domain Standards](../../../DOMAIN_STANDARDS.md) - Domain model patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach
- [Phase 3 Detailed Plan](../phases/phase-03-api-client-infra.md) - Tasks 2-4 details

---

## 📝 Task 2: Create VideoSettings Domain Interface

### File: `libs/domain/src/lib/models/settings.model.ts`

**Location in File**: After PlayerSettings interface (around line 70)

**What to Add**:

```typescript
/**
 * Video settings for video capture component in player view
 */
export interface VideoSettings {
  /** Enable video capture component visibility in player view */
  enableVideo: boolean;
}
```

**Update Settings Root Interface**:

Find the `Settings` interface (around line 95) and add videoSettings property:

```typescript
/**
 * Application settings containing all configuration groups
 */
export interface Settings {
  /** Connection settings for device communication */
  connectionSettings: ConnectionSettings;
  
  /** Player settings for playback behavior */
  playerSettings: PlayerSettings;
  
  /** Video settings for video capture component */
  videoSettings: VideoSettings; // ADD THIS LINE
  
  /** File transfer settings for file operations */
  fileTransferSettings: FileTransferSettings;
  
  /** Search settings for file search behavior */
  searchSettings: SearchSettings;
  
  /** Application-level settings */
  appSettings: AppSettings;
}
```

**Pattern Notes**:

- JSDoc comment on interface and property
- Property name is camelCase (videoSettings)
- Placement after playerSettings (consistent with backend TeensySettings.cs)
- Simple boolean property (enableVideo) for MVP

**Testing for Task 2**:

- [ ] VideoSettings interface exists
- [ ] VideoSettings has enableVideo property (boolean type)
- [ ] Settings root interface includes videoSettings property
- [ ] JSDoc comments present on interface and property
- [ ] TypeScript compilation succeeds

---

## 📝 Task 3: Update DomainMapper with VideoSettings Methods

### File: `libs/infrastructure/src/lib/domain.mapper.ts`

**Pattern Reference**: Follow existing PlayerSettings mapping (lines 150-160, 300-310)

#### Part 1: Add API → Domain Mapping

**Location**: After `mapPlayerSettings` helper (around line 160)

**Method to Add**:

```typescript
/**
 * Maps VideoSettingsDto from API to domain VideoSettings model
 * @param dto - VideoSettingsDto from API response
 * @returns VideoSettings domain model
 */
private static mapVideoSettings(dto: VideoSettingsDto): VideoSettings {
  return {
    enableVideo: dto.enableVideo,
  };
}
```

#### Part 2: Add Domain → API Mapping

**Location**: After `mapPlayerSettingsDto` helper (around line 310)

**Method to Add**:

```typescript
/**
 * Maps VideoSettings domain model to VideoSettingsDto for API request
 * @param settings - VideoSettings domain model
 * @returns VideoSettingsDto for API
 */
private static mapVideoSettingsDto(settings: VideoSettings): VideoSettingsDto {
  return {
    enableVideo: settings.enableVideo,
  };
}
```

#### Part 3: Update toSettings Method

**Location**: In `toSettings` method (around line 50)

**What to Change**: Add videoSettings transformation after playerSettings

Find this line:
```typescript
playerSettings: DomainMapper.mapPlayerSettings(response.playerSettings),
```

Add after it:
```typescript
videoSettings: DomainMapper.mapVideoSettings(response.videoSettings),
```

#### Part 4: Update toSettingsDto Method

**Location**: In `toSettingsDto` method (around line 95)

**What to Change**: Add videoSettings transformation after playerSettings

Find this line:
```typescript
playerSettings: DomainMapper.mapPlayerSettingsDto(settings.playerSettings),
```

Add after it:
```typescript
videoSettings: DomainMapper.mapVideoSettingsDto(settings.videoSettings),
```

**Pattern Notes**:

- Helper methods are `private static`
- JSDoc comments on all helpers
- Property order matches domain model (videoSettings after playerSettings)
- Bidirectional pattern: `map*` (API → domain), `map*Dto` (domain → API)

**Testing for Task 3**:

- [ ] mapVideoSettings helper exists (private static)
- [ ] mapVideoSettingsDto helper exists (private static)
- [ ] toSettings calls mapVideoSettings with response.videoSettings
- [ ] toSettingsDto calls mapVideoSettingsDto with settings.videoSettings
- [ ] All helpers have JSDoc comments
- [ ] TypeScript compilation succeeds

---

## 📝 Task 4: Verify SettingsService Integration

### File: `libs/infrastructure/src/lib/settings/settings.service.ts`

**Expected Outcome**: NO CHANGES NEEDED

**What to Verify**:

1. Open file and locate these methods:
   - `getSettings()` - returns `Observable<Settings>`
   - `saveSettings(settings: Settings)` - accepts `Settings` parameter

2. Confirm both methods use DomainMapper:
   ```typescript
   // In getSettings():
   map(response => DomainMapper.toSettings(response))
   
   // In saveSettings():
   const request = DomainMapper.toSettingsDto(settings);
   ```

3. Verify service is agnostic to settings groups (no conditional logic for specific groups)

**Why No Changes**:

- SettingsService delegates ALL transformations to DomainMapper
- Service works with Settings root interface
- VideoSettings automatically included via Settings.videoSettings property
- DomainMapper handles the transformation bidirectionally

**Testing for Task 4**:

- [ ] SettingsService.getSettings uses DomainMapper.toSettings
- [ ] SettingsService.saveSettings uses DomainMapper.toSettingsDto
- [ ] No conditional logic for specific settings groups
- [ ] Service requires no modifications

---

## 🧪 Testing Requirements

### File: `libs/infrastructure/src/lib/domain.mapper.spec.ts`

**Test Coverage Required**:

#### Test 1: toSettings includes videoSettings

```typescript
it('should map videoSettings from API response', () => {
  // Arrange
  const response: GetSettingsResponse = {
    connectionSettings: { /* ... */ },
    playerSettings: { /* ... */ },
    videoSettings: { enableVideo: true },
    fileTransferSettings: { /* ... */ },
    searchSettings: { /* ... */ },
    appSettings: { /* ... */ },
  };

  // Act
  const result = DomainMapper.toSettings(response);

  // Assert
  expect(result.videoSettings).toBeDefined();
  expect(result.videoSettings.enableVideo).toBe(true);
});
```

#### Test 2: toSettingsDto includes videoSettings

```typescript
it('should map videoSettings to API request', () => {
  // Arrange
  const settings: Settings = {
    connectionSettings: { /* ... */ },
    playerSettings: { /* ... */ },
    videoSettings: { enableVideo: false },
    fileTransferSettings: { /* ... */ },
    searchSettings: { /* ... */ },
    appSettings: { /* ... */ },
  };

  // Act
  const result = DomainMapper.toSettingsDto(settings);

  // Assert
  expect(result.videoSettings).toBeDefined();
  expect(result.videoSettings.enableVideo).toBe(false);
});
```

#### Test 3: Round-trip transformation

```typescript
it('should preserve videoSettings through round-trip transformation', () => {
  // Arrange
  const originalSettings: Settings = {
    connectionSettings: { /* ... */ },
    playerSettings: { /* ... */ },
    videoSettings: { enableVideo: true },
    fileTransferSettings: { /* ... */ },
    searchSettings: { /* ... */ },
    appSettings: { /* ... */ },
  };

  // Act
  const dto = DomainMapper.toSettingsDto(originalSettings);
  const response: GetSettingsResponse = {
    connectionSettings: dto.connectionSettings,
    playerSettings: dto.playerSettings,
    videoSettings: dto.videoSettings,
    fileTransferSettings: dto.fileTransferSettings,
    searchSettings: dto.searchSettings,
    appSettings: dto.appSettings,
  };
  const result = DomainMapper.toSettings(response);

  // Assert
  expect(result.videoSettings).toEqual(originalSettings.videoSettings);
});
```

**Testing Reference**:

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing approach
- Follow existing test patterns for playerSettings/connectionSettings
- Use Vitest framework (not Jest)

**Behavioral Expectations**:

- toSettings transforms videoSettings from API → domain correctly
- toSettingsDto transforms videoSettings from domain → API correctly
- Round-trip transformation preserves videoSettings data exactly
- Missing videoSettings handled gracefully (if API doesn't send it)

**Testing Strategy**:

- **Unit Tests**: Test DomainMapper transformations in isolation
- **Compilation**: TypeScript compiler validates type safety
- **Integration**: SettingsService verified to work without changes

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 3 Detailed Plan](../phases/phase-03-api-client-infra.md) - Complete Phase 3 guidance
- [Domain Standards](../../../DOMAIN_STANDARDS.md) - Domain model patterns
- [Service Standards](../../../SERVICE_STANDARDS.md) - Infrastructure service patterns
- [TASK-03-001 Report](../reports/TASK-03-001-report.md) - API client regeneration results

**Related Tasks** (for context):

- TASK-01-001: Created VideoSettings domain model (backend completed)
- TASK-02-CONSOLIDATED: Created VideoSettingsDto and API layer (backend completed)
- TASK-03-001: Regenerated TypeScript API client (completed, prerequisite)

**Code Patterns to Follow**:

Existing PlayerSettings pattern in files:

- `settings.model.ts` lines 60-80 - PlayerSettings interface
- `domain.mapper.ts` lines 150-160 - mapPlayerSettings helper
- `domain.mapper.ts` lines 300-310 - mapPlayerSettingsDto helper
- `domain.mapper.spec.ts` - Existing PlayerSettings tests

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-03-002-report.md`

**Report Template**: Follow the structure defined in TASK-01-001-report.md and TASK-03-001-report.md

**Return Value**: Return the file path when complete: `docs/projects/video-settings-feature/reports/TASK-03-002-report.md`

**Report Should Include**:

- **Files Modified** section with exact line numbers and changes
- **VideoSettings Interface** code snippet from settings.model.ts
- **DomainMapper Helpers** code snippets (mapVideoSettings, mapVideoSettingsDto)
- **Testing Results** with test count and pass/fail status
- **Compilation Results** showing TypeScript build succeeded
- **SettingsService Verification** confirming no changes needed
- **Success Criteria Checklist** with all items checked
- Screenshots or code snippets demonstrating working integration

---

## 🎯 Expected Outcomes

After completing this task:

1. **Domain Layer**:
   - VideoSettings interface exists in settings.model.ts
   - Settings root interface includes videoSettings property
   - JSDoc comments present

2. **Infrastructure Layer**:
   - DomainMapper.mapVideoSettings helper transforms API → domain
   - DomainMapper.mapVideoSettingsDto helper transforms domain → API
   - DomainMapper.toSettings includes videoSettings transformation
   - DomainMapper.toSettingsDto includes videoSettings transformation

3. **Testing**:
   - 3+ unit tests for VideoSettings mapping pass
   - All existing tests still pass
   - TypeScript compilation succeeds

4. **Integration**:
   - SettingsService verified to work without changes
   - Ready for Phase 4 (state management integration)

---

## 💡 Implementation Notes

### Property Placement Consistency

**Backend** (TeensySettings.cs):
```csharp
public ConnectionSettings ConnectionSettings { get; set; }
public PlayerSettings PlayerSettings { get; set; }
public VideoSettings VideoSettings { get; set; }  // After Player
public FileTransferSettings FileTransferSettings { get; set; }
```

**Frontend** (settings.model.ts) - Must Match:
```typescript
connectionSettings: ConnectionSettings;
playerSettings: PlayerSettings;
videoSettings: VideoSettings;  // After Player (same position)
fileTransferSettings: FileTransferSettings;
```

### Why SettingsService Requires No Changes

The service pattern is **settings-agnostic**:

```typescript
// getSettings flow:
API Response (VideoSettingsDto) 
  → DomainMapper.toSettings() 
  → Settings (VideoSettings) 
  → Observable<Settings>

// saveSettings flow:
Settings (VideoSettings)
  → DomainMapper.toSettingsDto()
  → SaveSettingsRequest (VideoSettingsDto)
  → API Call
```

The service operates on the **Settings root interface**, which now includes videoSettings. DomainMapper handles the transformation automatically.

### Testing Philosophy

Follow **behavioral testing** patterns:

- ✅ Test what users/consumers observe (transformed data)
- ✅ Test round-trip transformations preserve data
- ❌ Don't test private helper methods directly (test via public toSettings/toSettingsDto)

### Mapper Pattern Consistency

All settings groups follow this pattern:

```typescript
// Private helpers (API ↔ domain transformation)
private static mapGroupSettings(dto: GroupSettingsDto): GroupSettings
private static mapGroupSettingsDto(settings: GroupSettings): GroupSettingsDto

// Public methods call helpers
public static toSettings(response: GetSettingsResponse): Settings {
  return {
    groupSettings: DomainMapper.mapGroupSettings(response.groupSettings),
    // ... other groups
  };
}
```

VideoSettings must follow this exact pattern for consistency.

---

**Task Status**: Ready for Execution (depends on TASK-03-001)  
**Estimated Time**: 45-60 minutes  
**Complexity**: Medium (3 files, pattern replication, testing)
