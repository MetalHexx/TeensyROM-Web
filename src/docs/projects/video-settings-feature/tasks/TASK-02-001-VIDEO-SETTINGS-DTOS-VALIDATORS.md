# Task Handoff: TASK-02-001-VIDEO-SETTINGS-DTOS-VALIDATORS

## 📋 Task Identity

**Task ID**: TASK-02-001-VIDEO-SETTINGS-DTOS-VALIDATORS  
**Task Name**: Create VideoSettingsDto and Validator  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High (Foundation for API layer)  
**Estimated Context Size**: Small (2 files)

---

## 🎯 Objective

**What**: Create the `VideoSettingsDto` record and `VideoSettingsValidator` class that define the API contract for video settings, following the established patterns from PlayerSettings, ConnectionSettings, and other settings groups.

**Why**: Establish the API-level data transfer objects and validation rules before integrating them into request/response models. This ensures consistent validation and serialization patterns across all settings endpoints.

**Success Criteria**:

- [ ] VideoSettingsDto record created in SettingsModels.cs with [Required] attributes
- [ ] XML documentation comments present on VideoSettingsDto and properties
- [ ] VideoSettingsValidator class created in SaveSettingsModels.cs
- [ ] Validator follows FluentValidation patterns from other settings validators
- [ ] Code follows existing DTO and validator patterns precisely
- [ ] All compiler checks pass (no errors or warnings)

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- ✅ Phase 1: VideoSettings domain model created and integrated into TeensySettings
- ✅ Phase 1: IVideoSettingsProvider interface created and implemented

**Dependencies**:

- `System.ComponentModel.DataAnnotations` - [Required] attributes
- `FluentValidation` - AbstractValidator base class
- Existing DTO patterns in SettingsModels.cs (PlayerSettingsDto, ConnectionSettingsDto)
- Existing validator patterns in SaveSettingsModels.cs

**Constraints**:

- Must follow exact DTO pattern: record type, [Required] attributes, XML comments
- VideoSettingsValidator can be minimal for MVP (EnableVideo is simple boolean)
- Must maintain alphabetical/logical ordering with other settings DTOs
- Must use same XML documentation style as existing DTOs

---

## 📂 File Scope

**Files to Modify**:

- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SettingsModels.cs` - Add VideoSettingsDto
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs` - Add VideoSettingsValidator

**Files to Review** (for context only):

- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SettingsModels.cs` - Review PlayerSettingsDto, ConnectionSettingsDto patterns
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs` - Review PlayerSettingsValidator pattern

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [Coding Standards](../../../CODING_STANDARDS.md) - C# conventions
- [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - DTO and validation patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approach
- [Phase 2 Detailed Plan](../phases/phase-02-backend-api.md) - Comprehensive task breakdown

**Key Requirements**:

### Part 1: Create VideoSettingsDto

1. **Open SettingsModels.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/`
2. **Add VideoSettingsDto record** after PlayerSettingsDto (maintains logical ordering)
3. **Add XML documentation comment**: "Video capture and display preferences"
4. **Define EnableVideo property**:
   - Type: `bool`
   - Attribute: `[Required]`
   - XML doc: "Enable video capture component visibility in player view."
5. **Follow exact pattern from PlayerSettingsDto**:
   - Record type (not class)
   - [Required] attribute on property
   - XML comments on both class and property
   - Simple property definition with setter

**Critical Type Definition**:

```csharp
/// <summary>
/// Video capture and display preferences.
/// </summary>
public record VideoSettingsDto
{
    /// <summary>
    /// Enable video capture component visibility in player view.
    /// </summary>
    [Required] public bool EnableVideo { get; set; }
}
```

### Part 2: Create VideoSettingsValidator

1. **Open SaveSettingsModels.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/`
2. **Add VideoSettingsValidator class** after PlayerSettingsValidator (maintains ordering)
3. **Inherit from AbstractValidator<VideoSettingsDto>**
4. **Keep constructor minimal for MVP**:
   - No additional validation rules needed (EnableVideo is simple boolean with [Required])
   - Add comment explaining future properties would add rules here

**Critical Type Definition**:

```csharp
public class VideoSettingsValidator : AbstractValidator<VideoSettingsDto>
{
    public VideoSettingsValidator()
    {
        // EnableVideo is bool with [Required] - no additional validation needed for MVP
        // Future properties (quality, resolution, device selection) would add rules here
    }
}
```

**Anti-Patterns to Avoid**:

- Don't use class instead of record for DTO (breaks pattern)
- Don't add validation logic to DTO itself (belongs in validator)
- Don't add complex validation rules yet (keep MVP simple)
- Don't skip XML documentation (required for API docs)

---

## 🧪 Testing Requirements

**Test Coverage Required**:

- [ ] VideoSettingsDto serializes to JSON correctly
- [ ] VideoSettingsDto deserializes from JSON correctly
- [ ] Missing EnableVideo property triggers [Required] validation error
- [ ] VideoSettingsValidator can be instantiated
- [ ] VideoSettingsValidator passes for valid VideoSettingsDto
- [ ] Validator structure ready for future rules

**Behavioral Expectations**:

- VideoSettingsDto serializes to `{ "enableVideo": true/false }` (camelCase)
- Deserialization from JSON creates VideoSettingsDto instance correctly
- [Required] attribute validation works at API boundary
- Validator integrates with FluentValidation pipeline

**Testing Reference**:

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing approach
- Existing DTO tests show serialization testing patterns
- Validator tests can be minimal since no complex rules exist yet

**Testing Strategy**:

- **DTO Serialization**: Test via JSON round-trip (serialize → deserialize)
- **Validation**: Test via FluentValidation TestHelper or integration tests
- **Integration**: Full validation tested in next task when integrated into SaveSettingsRequest

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 2 Detailed Plan](../phases/phase-02-backend-api.md) - Complete Phase 2 guidance
- [Phase 1 Completion Report](../reports/TASK-01-001-report.md) - Domain model implementation

**Related Tasks** (for context):

- TASK-01-001: Created VideoSettings domain model (completed)
- TASK-02-002: Will integrate VideoSettingsDto into request/response models (depends on this task)
- TASK-02-003: Will build and generate OpenAPI spec (depends on TASK-02-002)

**Example Pattern Reference**:

Consult these files for exact patterns to follow:

- `SettingsModels.cs` → PlayerSettingsDto shows DTO pattern
- `SaveSettingsModels.cs` → PlayerSettingsValidator shows validator pattern

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-02-001-report.md`

**Report Template**: Follow the structure defined in Phase 1's TASK-01-001-report.md

**Return Value**: Return the file path when complete: `docs/projects/video-settings-feature/reports/TASK-02-001-report.md`

**Report Should Include**:

- Files modified (2 files: SettingsModels.cs, SaveSettingsModels.cs)
- VideoSettingsDto definition added (code snippet)
- VideoSettingsValidator definition added (code snippet)
- Compiler/build results (should be success with no warnings)
- Testing results (serialization and validation tests)
- Time taken vs estimate

---

## 🎯 Expected Outcomes

After completing this task:

1. `SettingsModels.cs` contains VideoSettingsDto record with [Required] EnableVideo property
2. `SaveSettingsModels.cs` contains VideoSettingsValidator class with AbstractValidator inheritance
3. XML documentation complete on all public types and properties
4. Code follows exact patterns from existing settings DTOs and validators
5. All compiler checks pass with no errors or warnings
6. Tests verify serialization and validation behavior
7. Ready for TASK-02-002 (integrate into request/response models)

---

## 💡 Implementation Notes

- **File Locations**: Both files are in `apps/api/src/TeensyRom.Api/Endpoints/Settings/` directory tree
- **Formatting**: Run `dotnet format` before committing to ensure consistent style
- **Pattern Consistency**: VideoSettingsDto should be indistinguishable in style from PlayerSettingsDto
- **MVP Focus**: Keep validator simple for now - EnableVideo is just a boolean with no complex constraints
- **Future-Proofing**: Validator structure is ready to add rules when video quality, resolution, or device selection properties are added later

---

**Task Status**: Ready for Execution  
**Estimated Time**: 30-45 minutes  
**Complexity**: Low (straightforward DTO and validator creation following established patterns)
