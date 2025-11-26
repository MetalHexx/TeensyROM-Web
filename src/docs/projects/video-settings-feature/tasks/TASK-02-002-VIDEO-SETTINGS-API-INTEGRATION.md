# Task Handoff: TASK-02-002-VIDEO-SETTINGS-API-INTEGRATION

## 📋 Task Identity

**Task ID**: TASK-02-002-VIDEO-SETTINGS-API-INTEGRATION  
**Task Name**: Integrate VideoSettings into API Request/Response Models and Mappers  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High (Completes API layer)  
**Estimated Context Size**: Medium (4 files)

---

## 🎯 Objective

**What**: Integrate VideoSettingsDto into GetSettings and SaveSettings request/response models, and add bidirectional mapping logic to transform between VideoSettings domain models and VideoSettingsDto.

**Why**: Complete the API layer by exposing video settings through existing settings endpoints. This enables clients to read and write video settings through GET /api/settings and POST /api/settings endpoints.

**Success Criteria**:

- [ ] GetSettingsResponse includes VideoSettings property with [Required] attribute
- [ ] SaveSettingsRequest includes VideoSettings property with [Required] attribute
- [ ] SaveSettingsRequestValidator includes VideoSettings validation rule
- [ ] GetSettings mapper transforms VideoSettings domain → DTO
- [ ] SaveSettings mapper transforms VideoSettings bidirectionally (DTO ↔ domain)
- [ ] All mappers follow established patterns from other settings groups
- [ ] All compiler checks pass (no errors or warnings)
- [ ] Round-trip integrity verified (DTO → domain → DTO preserves values)

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- ✅ Phase 1: VideoSettings domain model created and integrated
- ✅ TASK-02-001: VideoSettingsDto and VideoSettingsValidator created

**Dependencies**:

- `System.ComponentModel.DataAnnotations` - [Required] attributes
- `FluentValidation` - Validator integration in SaveSettingsRequestValidator
- VideoSettingsDto from SettingsModels.cs (created in TASK-02-001)
- VideoSettingsValidator from SaveSettingsModels.cs (created in TASK-02-001)
- VideoSettings domain model from TeensyRom.Core

**Constraints**:

- Must maintain consistent property ordering across GetSettings and SaveSettings models
- Must follow established mapper patterns (private static helper methods)
- Must ensure backward compatibility (old clients can ignore VideoSettings)
- Must handle null safety (though VideoSettings should never be null after Phase 1)

---

## 📂 File Scope

**Files to Modify**:

- `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsModels.cs` - Add VideoSettings to response
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsMapper.cs` - Add VideoSettings mapping (domain → DTO)
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs` - Add VideoSettings to request + validator rule
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsMapper.cs` - Add VideoSettings bidirectional mapping

**Files to Review** (for context only):

- Review GetSettings files for PlayerSettings integration pattern
- Review SaveSettings files for PlayerSettings mapping patterns

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [Coding Standards](../../../CODING_STANDARDS.md) - C# conventions
- [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - Mapper patterns and API design
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach
- [Phase 2 Detailed Plan](../phases/phase-02-backend-api.md) - Comprehensive task breakdown (Tasks 3-6)

**Key Requirements**:

### Part 1: Update GetSettings Response Model

**File**: `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsModels.cs`

1. **Add VideoSettings property** to GetSettingsResponse record
2. **Apply [Required] attribute** and XML documentation
3. **Place property after PlayerSettings** (before FileTransferSettings) for consistency
4. **Initialize with `null!`** following existing pattern

**Property Definition**:

```csharp
/// <summary>
/// Video capture and display preferences.
/// </summary>
[Required] public VideoSettingsDto VideoSettings { get; set; } = null!;
```

### Part 2: Update GetSettings Mapper

**File**: `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsMapper.cs`

1. **Update MapResponse method** to include VideoSettings property mapping
2. **Create MapVideoSettings helper method** (private static)
3. **Implement domain → DTO transformation**: `VideoSettings` → `VideoSettingsDto`
4. **Follow pattern from MapPlayerSettings, MapConnectionSettings**

**Mapper Pattern**:

```csharp
// In MapResponse method, add VideoSettings property:
VideoSettings = MapVideoSettings(entity.VideoSettings),

// New helper method:
private static VideoSettingsDto MapVideoSettings(VideoSettings entity)
{
    return new VideoSettingsDto
    {
        EnableVideo = entity.EnableVideo
    };
}
```

### Part 3: Update SaveSettings Request Model

**File**: `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs`

1. **Add VideoSettings property** to SaveSettingsRequest record
2. **Apply [Required] attribute** and XML documentation
3. **Place property consistently** (same position as in GetSettingsResponse)
4. **Update SaveSettingsRequestValidator constructor** to add VideoSettings validation rule

**Property Definition**:

```csharp
/// <summary>
/// Video capture and display preferences.
/// </summary>
[Required] public VideoSettingsDto VideoSettings { get; set; } = null!;
```

**Validator Rule**:

```csharp
// In SaveSettingsRequestValidator constructor:
RuleFor(x => x.VideoSettings)
    .NotNull().WithMessage("Video settings are required.")
    .SetValidator(new VideoSettingsValidator());
```

### Part 4: Update SaveSettings Mapper

**File**: `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsMapper.cs`

1. **Update MapRequestToEntity method** to include VideoSettings (DTO → domain)
2. **Update MapEntityToDto method** to include VideoSettings (domain → DTO)
3. **Create two helper methods**:
   - `MapVideoSettings(VideoSettingsDto dto)` → `VideoSettings` (for saving)
   - `MapVideoSettingsDto(VideoSettings entity)` → `VideoSettingsDto` (for response)
4. **Follow bidirectional pattern from PlayerSettings mappers**

**Mapper Patterns**:

```csharp
// In MapRequestToEntity, add:
VideoSettings = MapVideoSettings(request.VideoSettings),

// In MapEntityToDto, add:
VideoSettings = MapVideoSettingsDto(entity.VideoSettings),

// New helper methods:
private static VideoSettingsDto MapVideoSettingsDto(VideoSettings entity)
{
    return new VideoSettingsDto
    {
        EnableVideo = entity.EnableVideo
    };
}

private static VideoSettings MapVideoSettings(VideoSettingsDto dto)
{
    return new VideoSettings
    {
        EnableVideo = dto.EnableVideo
    };
}
```

**Anti-Patterns to Avoid**:

- Don't skip validation rule in SaveSettingsRequestValidator (required for request validation)
- Don't forget bidirectional mapping in SaveSettings (need both directions for round-trip)
- Don't place VideoSettings in different positions across files (maintain consistency)
- Don't skip XML documentation (required for API documentation)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

- [ ] GetSettingsResponse includes VideoSettings property in JSON
- [ ] GetSettings endpoint returns default VideoSettings (EnableVideo = false)
- [ ] GetSettings mapper transforms VideoSettings domain → DTO correctly
- [ ] SaveSettingsRequest accepts VideoSettings in request body
- [ ] Missing VideoSettings in SaveSettingsRequest triggers validation error
- [ ] SaveSettings mapper transforms VideoSettings DTO → domain correctly
- [ ] SaveSettings mapper transforms VideoSettings domain → DTO correctly
- [ ] Round-trip integrity: DTO → domain → DTO preserves all values
- [ ] EnableVideo value transfers accurately in both directions (true/false)

**Behavioral Expectations**:

- GET /api/settings response contains `"videoSettings": { "enableVideo": false }` (default)
- POST /api/settings accepts VideoSettings in request body
- POST /api/settings without VideoSettings returns 400 Bad Request with validation error
- POST /api/settings with VideoSettings returns success and persists value
- Saved VideoSettings can be read back via GET /api/settings (round-trip)

**Testing Reference**:

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing approach
- Integration tests via HTTP endpoints validate full flow
- Manual testing via Scalar API docs at `/scalar/v1`

**Testing Strategy**:

- **Mapper Unit Tests**: Test mapper methods directly with known inputs/outputs
- **Integration Tests**: Test via GET/POST endpoints to verify full request/response cycle
- **Manual Testing**: Use Scalar API docs to verify VideoSettings appears in OpenAPI spec and endpoints work

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 2 Detailed Plan](../phases/phase-02-backend-api.md) - Complete Phase 2 guidance (Tasks 3-6)
- [TASK-02-001 Report](../reports/TASK-02-001-report.md) - DTO/Validator creation (will be available after TASK-02-001)

**Related Tasks** (for context):

- TASK-01-001: Created VideoSettings domain model (completed)
- TASK-02-001: Created VideoSettingsDto and VideoSettingsValidator (prerequisite)
- TASK-02-003: Will build and generate OpenAPI spec (depends on this task)

**Example Pattern Reference**:

Consult these files for exact patterns to follow:

- GetSettings files → PlayerSettings shows response model and mapper patterns
- SaveSettings files → PlayerSettings shows request model, validator, and bidirectional mapper patterns

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-02-002-report.md`

**Report Template**: Follow the structure defined in Phase 1's TASK-01-001-report.md

**Return Value**: Return the file path when complete: `docs/projects/video-settings-feature/reports/TASK-02-002-report.md`

**Report Should Include**:

- Files modified (4 files: GetSettingsModels, GetSettingsMapper, SaveSettingsModels, SaveSettingsMapper)
- Code snippets showing VideoSettings integration in each file
- Compiler/build results (should be success with no warnings)
- Testing results (mapper tests, integration tests, round-trip verification)
- Manual testing results (Scalar API verification)
- Time taken vs estimate

---

## 🎯 Expected Outcomes

After completing this task:

1. `GetSettingsModels.cs` contains VideoSettings property in GetSettingsResponse
2. `GetSettingsMapper.cs` maps VideoSettings domain → DTO
3. `SaveSettingsModels.cs` contains VideoSettings property in SaveSettingsRequest + validation rule
4. `SaveSettingsMapper.cs` maps VideoSettings bidirectionally (DTO ↔ domain)
5. All mappers follow established patterns precisely
6. Round-trip integrity verified (save VideoSettings, read it back, values match)
7. All compiler checks pass with no errors or warnings
8. Ready for TASK-02-003 (build and generate OpenAPI spec)

---

## 💡 Implementation Notes

- **Property Ordering**: Maintain consistent ordering across GetSettings and SaveSettings (VideoSettings after PlayerSettings, before FileTransferSettings)
- **Formatting**: Run `dotnet format` before committing to ensure consistent style
- **Mapper Consistency**: SaveSettings needs TWO mapper methods (DTO → domain for save, domain → DTO for response)
- **Validation Integration**: SaveSettingsRequestValidator must include `.SetValidator(new VideoSettingsValidator())` to integrate FluentValidation
- **Testing Approach**: Focus on integration tests via endpoints rather than isolated mapper tests - endpoints validate the full flow
- **Backward Compatibility**: Adding VideoSettings is non-breaking for GET (clients ignore unknown properties), but POST requires VideoSettings (breaking for old clients)

---

**Task Status**: Ready for Execution (after TASK-02-001 completes)  
**Estimated Time**: 45-60 minutes  
**Complexity**: Medium (multiple files with bidirectional mapping logic)
