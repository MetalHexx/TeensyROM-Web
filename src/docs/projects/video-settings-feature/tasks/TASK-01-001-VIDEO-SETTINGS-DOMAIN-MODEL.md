# Task Handoff: TASK-01-001-VIDEO-SETTINGS-DOMAIN-MODEL

## 📋 Task Identity

**Task ID**: TASK-01-001-VIDEO-SETTINGS-DOMAIN-MODEL  
**Task Name**: Create VideoSettings Domain Model  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High (Foundation)  
**Estimated Context Size**: Small (1-3 files)

---

## 🎯 Objective

**What**: Create the `VideoSettings` domain model record in the TeensyRom.Core/Settings directory and integrate it into the root `TeensySettings` container.

**Why**: Establish the foundational backend data structure for video-related user preferences before any API contracts or endpoints are built. This follows the backend-first approach where domain models are defined before DTOs and API layers.

**Success Criteria**:

- [ ] VideoSettings.cs file created with record type definition
- [ ] EnableVideo boolean property defined with default value false
- [ ] VideoSettings property added to TeensySettings root container
- [ ] XML documentation comments present on all public types/properties
- [ ] Settings serialization verified (VideoSettings persists to/from disk)
- [ ] All tests pass

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- None (this is the foundational task for the video settings feature)

**Dependencies**:

- `System.Text.Json` - Used by SettingsService for serialization
- Existing settings models (PlayerSettings, ConnectionSettings) serve as reference patterns

**Constraints**:

- Must follow existing settings model patterns (record type, default initialization)
- Must maintain backward compatibility (old settings files without VideoSettings should still load)
- Must use immutable property pattern (init-only setters or mutable as per existing pattern)
- EnableVideo must default to false to avoid surprising users without capture hardware

---

## 📂 File Scope

**Files to Create**:

- `apps/api/src/TeensyRom.Core/Settings/VideoSettings.cs` - New video settings domain model

**Files to Modify**:

- `apps/api/src/TeensyRom.Core/Settings/TeensySettings.cs` - Add VideoSettings property
- `apps/api/src/TeensyRom.Core.Tests/Settings/SettingsServiceTests.cs` - Add serialization tests (optional but recommended)

**Files to Review** (for context only):

- `apps/api/src/TeensyRom.Core/Settings/PlayerSettings.cs` - Reference pattern for settings records
- `apps/api/src/TeensyRom.Core/Settings/ConnectionSettings.cs` - Another reference pattern
- `apps/api/src/TeensyRom.Core/Settings/SettingsService.cs` - Settings persistence service

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - C# conventions
- [Backend Architecture](../../../../docs/BACKEND_ARCHITECTURE.md) - Domain modeling principles
- [Testing Standards](../../../../docs/TESTING_STANDARDS.md) - Testing approach

**Key Requirements**:

1. **Create VideoSettings Record**:
   - Use `record` type (not class) to match existing patterns
   - Namespace: `TeensyRom.Core.Settings`
   - Add XML doc comment: "Video capture and display preferences"
   - Define `EnableVideo` property of type `bool` with default `= false`
   - Add XML doc for property: "Enable video capture component visibility in player view"

2. **Integrate into TeensySettings**:
   - Add property: `public VideoSettings VideoSettings { get; set; } = new();`
   - Use `new()` initialization to ensure non-null default
   - Place logically (recommendation: after PlayerSettings, before FileTransferSettings)
   - Update class XML doc to mention video settings group

3. **Verify Serialization**:
   - SettingsService uses System.Text.Json (should auto-handle record properties)
   - Manually test save/load cycle to confirm VideoSettings appears in settings.json
   - Add integration test to SettingsServiceTests verifying round-trip serialization

**Anti-Patterns to Avoid**:

- Don't use class instead of record (breaks pattern consistency)
- Don't initialize VideoSettings as null in TeensySettings (causes null-reference errors)
- Don't add validation logic here (belongs in API DTO layer)
- Don't add business logic (domain models are pure data structures)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

- [ ] Integration test: VideoSettings serializes to JSON correctly
- [ ] Integration test: VideoSettings deserializes from JSON correctly
- [ ] Integration test: TeensySettings round-trip includes VideoSettings
- [ ] Integration test: Loading old settings file (without VideoSettings) applies defaults

**Behavioral Expectations**:

- New VideoSettings() creates instance with EnableVideo = false
- TeensySettings.VideoSettings is never null after initialization
- Settings.json file contains `"videoSettings": { "enableVideo": false }` after save (camelCase due to JSON serialization settings)
- Loading settings from disk correctly populates VideoSettings property

**Testing Reference**:

- Existing pattern: `SettingsServiceTests.cs` shows how to test settings serialization
- Use integration tests (not isolated unit tests) for settings models since behavior is tested via serialization

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 1 Plan](../phases/phase-01-backend-domain-models.md) - Detailed phase implementation plan
- [Backend Architecture - Domain Models](../../../../docs/BACKEND_ARCHITECTURE.md#domain-entities)

**Related Tasks** (for context):

- TASK-01-002: Will update backend API DTOs and endpoints (depends on this task)
- TASK-01-003: Will regenerate API client (depends on TASK-01-002)

**Example Pattern Reference**:

```csharp
// From PlayerSettings.cs - follow this pattern
namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Playback behavior and player-related preferences
  /// </summary>
  public record PlayerSettings
  {
    public bool RepeatModeOnStartup { get; set; } = false;
    public bool PlayTimerEnabled { get; set; } = false;
    // ... more properties
  }
}

// From TeensySettings.cs - follow this integration pattern
public record TeensySettings
{
  public ConnectionSettings ConnectionSettings { get; set; } = new();
  public PlayerSettings PlayerSettings { get; set; } = new();
  // Add VideoSettings here following same pattern
}
```

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-01-001-report.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/video-settings-feature/reports/TASK-01-001-report.md`

---

## 🎯 Expected Outcomes

After completing this task:

1. `VideoSettings.cs` exists in Settings folder with EnableVideo property
2. `TeensySettings.cs` includes VideoSettings property with default initialization
3. Settings service correctly serializes/deserializes VideoSettings
4. Integration tests verify round-trip behavior
5. All tests pass with no compiler warnings/errors
6. Ready for Phase 2 (Backend API Layer)

---

## 💡 Implementation Notes

- **File Location**: Ensure VideoSettings.cs is in the same folder as other settings models
- **Formatting**: Run `dotnet format` before committing to ensure consistent style
- **Testing Strategy**: Focus on integration tests via SettingsService rather than isolated unit tests (settings models are simple DTOs)
- **Backward Compatibility**: Old settings.json files without VideoSettings will automatically get default values on load

---

**Task Status**: Ready for Execution  
**Estimated Time**: 20-30 minutes  
**Complexity**: Low (straightforward domain model creation)
