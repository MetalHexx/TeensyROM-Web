# Phase 2: Backend API Layer - DTOs, Validation, Endpoints

## 🎯 Objective

Create the API surface for video settings by adding DTOs with validation rules and updating existing settings endpoints to handle the new video settings group. This phase completes the backend implementation and enables OpenAPI spec generation with VideoSettings included.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [Feature Planning Document](../master-plan.md) - High-level feature plan
- [x] [Phase 1 Completion Report](../reports/TASK-01-001-report.md) - Domain model implementation details
- [x] [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - API patterns and endpoint structure

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/Endpoints/Settings/
├── SettingsModels.cs                        📝 Modified - Add VideoSettingsDto
├── GetSettings/
│   ├── GetSettingsModels.cs                 📝 Modified - Add VideoSettings to response
│   └── GetSettingsMapper.cs                 📝 Modified - Add VideoSettings mapping
└── SaveSettings/
    ├── SaveSettingsModels.cs                📝 Modified - Add VideoSettings to request + validator
    └── SaveSettingsMapper.cs                📝 Modified - Add VideoSettings mapping
```

---

## 📋 Implementation Guidelines

---

<details open>
<summary><h3>Task 1: Create VideoSettingsDto</h3></summary>

**Purpose**: Define the `VideoSettingsDto` record that will be exposed through the API, following the established DTO pattern from PlayerSettingsDto, ConnectionSettingsDto, etc.

**Related Documentation:**

- [PlayerSettingsDto](../../../../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/SettingsModels.cs) - Reference pattern for DTO structure
- [Backend Architecture - DTOs](../../../BACKEND_ARCHITECTURE.md) - DTO design principles

**Implementation Subtasks:**

- [ ] **Open SettingsModels.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/`
- [ ] **Add VideoSettingsDto record** after PlayerSettingsDto (maintain alphabetical/logical ordering)
- [ ] **Add XML documentation comment**: "Video capture and display preferences"
- [ ] **Define EnableVideo property** with `[Required]` attribute and XML doc comment
- [ ] **Follow existing DTO patterns** (record type, Required attributes, XML comments)

**Testing Subtask:**

- [ ] **Write Tests**: Test DTO serialization/deserialization (see Testing section below)

**Key Implementation Notes:**

- Use `record` type to match all existing DTOs
- Apply `[Required]` attribute to EnableVideo property
- XML comments should match style and detail level of other DTOs
- Place VideoSettingsDto logically (recommendation: after PlayerSettingsDto, before FileTransferSettingsDto)

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

**Testing Focus for Task 1:**

> Focus on **DTO contract validation** - does it serialize correctly?

**Behaviors to Test:**

- [ ] **JSON Serialization**: VideoSettingsDto serializes to correct JSON structure
- [ ] **JSON Deserialization**: JSON deserializes to VideoSettingsDto correctly
- [ ] **Required Validation**: Missing EnableVideo property triggers validation error

**Testing Reference:**

- See existing DTO tests for serialization patterns
- Use integration tests that validate full request/response cycle

</details>

---

<details open>
<summary><h3>Task 2: Create VideoSettingsValidator</h3></summary>

**Purpose**: Create FluentValidation validator for VideoSettingsDto to enforce business rules and constraints at the API boundary.

**Related Documentation:**

- [PlayerSettingsValidator](../../../../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Reference pattern for validators

**Implementation Subtasks:**

- [ ] **Open SaveSettingsModels.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/`
- [ ] **Add VideoSettingsValidator class** after PlayerSettingsValidator (maintain ordering)
- [ ] **Inherit from AbstractValidator<VideoSettingsDto>**
- [ ] **Keep validation simple** for MVP - just basic type validation (no complex rules yet)

**Testing Subtask:**

- [ ] **Write Tests**: Test validator rules (see Testing section below)

**Key Implementation Notes:**

- For MVP, no additional validation rules needed beyond [Required] attribute on DTO
- EnableVideo is a boolean with no range constraints
- Future video properties (quality, device selection) can add validation rules later
- Keep validator structure consistent with other settings validators

**Critical Type Definition**:

```csharp
public class VideoSettingsValidator : AbstractValidator<VideoSettingsDto>
{
    public VideoSettingsValidator()
    {
        // EnableVideo is bool with [Required] - no additional validation needed for MVP
        // Future properties (quality, resolution, etc.) would add rules here
    }
}
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Validator Exists**: VideoSettingsValidator can be instantiated
- [ ] **Valid VideoSettings**: Validator passes for valid VideoSettingsDto
- [ ] **Future-Proofing**: Validator structure ready for additional rules

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for validator testing patterns
- Keep tests simple for MVP since no complex rules exist yet

</details>

---

<details open>
<summary><h3>Task 3: Update GetSettings Response Model</h3></summary>

**Purpose**: Add VideoSettings property to GetSettingsResponse so the API returns video settings when clients request all settings.

**Related Documentation:**

- [GetSettingsModels.cs](../../../../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsModels.cs) - Response model to update

**Implementation Subtasks:**

- [ ] **Open GetSettingsModels.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/`
- [ ] **Add VideoSettings property** to GetSettingsResponse record
- [ ] **Apply [Required] attribute** and XML documentation comment
- [ ] **Place property logically** (recommendation: after PlayerSettings, before FileTransferSettings)
- [ ] **Ensure consistency** with other settings properties

**Testing Subtask:**

- [ ] **Write Tests**: Test GetSettings endpoint returns VideoSettings (see Testing section below)

**Key Implementation Notes:**

- Property type: `VideoSettingsDto`
- Initialize with `null!` (null-forgiving operator) following existing pattern
- XML comment should describe what video settings represent
- Maintain consistent ordering with SaveSettingsRequest

**Critical Type Definition**:

```csharp
/// <summary>
/// Video capture and display preferences.
/// </summary>
[Required] public VideoSettingsDto VideoSettings { get; set; } = null!;
```

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Response Includes VideoSettings**: GetSettings response contains VideoSettings property
- [ ] **Default Values Returned**: Response includes default EnableVideo = false
- [ ] **Serialization Works**: Response serializes to JSON correctly with videoSettings

**Testing Reference:**

- Test via endpoint integration tests (call GET /api/settings and verify response)

</details>

---

<details open>
<summary><h3>Task 4: Update SaveSettings Request Model</h3></summary>

**Purpose**: Add VideoSettings property to SaveSettingsRequest so the API accepts video settings when clients save all settings.

**Related Documentation:**

- [SaveSettingsModels.cs](../../../../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs) - Request model to update

**Implementation Subtasks:**

- [ ] **Open SaveSettingsModels.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/`
- [ ] **Add VideoSettings property** to SaveSettingsRequest record
- [ ] **Apply [Required] attribute** and XML documentation comment
- [ ] **Place property logically** (same position as in GetSettingsResponse)
- [ ] **Update SaveSettingsRequestValidator** to include VideoSettings validation rule

**Testing Subtask:**

- [ ] **Write Tests**: Test SaveSettings endpoint accepts VideoSettings (see Testing section below)

**Key Implementation Notes:**

- Property type: `VideoSettingsDto`
- Initialize with `null!` following existing pattern
- Add validation rule in SaveSettingsRequestValidator constructor
- Maintain consistent ordering between GetSettings and SaveSettings models

**Critical Type Definitions**:

```csharp
// In SaveSettingsRequest:
/// <summary>
/// Video capture and display preferences.
/// </summary>
[Required] public VideoSettingsDto VideoSettings { get; set; } = null!;

// In SaveSettingsRequestValidator constructor:
RuleFor(x => x.VideoSettings)
    .NotNull().WithMessage("Video settings are required.")
    .SetValidator(new VideoSettingsValidator());
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] **Request Accepts VideoSettings**: SaveSettings request deserializes VideoSettings correctly
- [ ] **Validation Enforced**: Missing VideoSettings triggers validation error
- [ ] **Validator Called**: VideoSettingsValidator is invoked during request validation

**Testing Reference:**

- Test via endpoint integration tests (POST /api/settings with VideoSettings)

</details>

---

<details open>
<summary><h3>Task 5: Update GetSettings Mapper</h3></summary>

**Purpose**: Add mapping logic to convert VideoSettings domain model to VideoSettingsDto in the GetSettings response mapper.

**Related Documentation:**

- [GetSettingsMapper.cs](../../../../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsMapper.cs) - Mapper to update

**Implementation Subtasks:**

- [ ] **Open GetSettingsMapper.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/`
- [ ] **Update MapResponse method** to include VideoSettings property mapping
- [ ] **Create MapVideoSettings helper method** following established pattern (MapPlayerSettings, MapConnectionSettings)
- [ ] **Implement domain → DTO transformation** (VideoSettings → VideoSettingsDto)

**Testing Subtask:**

- [ ] **Write Tests**: Test mapper transforms VideoSettings correctly (see Testing section below)

**Key Implementation Notes:**

- Follow existing mapper pattern: private static helper method for each settings group
- Map EnableVideo property from domain model to DTO
- Maintain consistent structure with other mapper methods
- Ensure null safety (though VideoSettings should never be null after Phase 1)

**Critical Code Pattern**:

```csharp
// In MapResponse method:
var response = new GetSettingsResponse
{
    ConnectionSettings = MapConnectionSettings(entity.ConnectionSettings),
    PlayerSettings = MapPlayerSettings(entity.PlayerSettings),
    VideoSettings = MapVideoSettings(entity.VideoSettings),
    FileTransferSettings = MapFileTransferSettings(entity.FileTransferSettings),
    SearchSettings = MapSearchSettings(entity.SearchSettings),
    AppSettings = MapAppSettings(entity.AppSettings)
};

// New helper method:
private static VideoSettingsDto MapVideoSettings(VideoSettings entity)
{
    return new VideoSettingsDto
    {
        EnableVideo = entity.EnableVideo
    };
}
```

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] **Mapping Correctness**: VideoSettings domain model maps to VideoSettingsDto correctly
- [ ] **EnableVideo Value Preserved**: EnableVideo value transfers accurately (true → true, false → false)
- [ ] **Null Safety**: Mapper handles VideoSettings gracefully (though should never be null)

**Testing Reference:**

- Unit test the mapper directly with known inputs/outputs
- Integration test via GetSettings endpoint

</details>

---

<details open>
<summary><h3>Task 6: Update SaveSettings Mapper</h3></summary>

**Purpose**: Add bidirectional mapping logic to convert between VideoSettingsDto and VideoSettings domain model in the SaveSettings mapper.

**Related Documentation:**

- [SaveSettingsMapper.cs](../../../../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsMapper.cs) - Mapper to update

**Implementation Subtasks:**

- [ ] **Open SaveSettingsMapper.cs** in `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/`
- [ ] **Update MapRequestToEntity method** to include VideoSettings mapping (DTO → domain)
- [ ] **Update MapEntityToDto method** to include VideoSettings mapping (domain → DTO)
- [ ] **Create two helper methods**: MapVideoSettings (DTO → domain) and MapVideoSettingsDto (domain → DTO)

**Testing Subtask:**

- [ ] **Write Tests**: Test bidirectional mapper transformations (see Testing section below)

**Key Implementation Notes:**

- Follow existing pattern: two mapper methods per settings group
- MapVideoSettings: VideoSettingsDto → VideoSettings (used in SaveSettings)
- MapVideoSettingsDto: VideoSettings → VideoSettingsDto (used for response)
- Maintain consistency with PlayerSettings, ConnectionSettings mapper methods

**Critical Code Patterns**:

```csharp
// In MapRequestToEntity method:
var entity = new TeensySettings
{
    ConnectionSettings = MapConnectionSettings(request.ConnectionSettings),
    PlayerSettings = MapPlayerSettings(request.PlayerSettings),
    VideoSettings = MapVideoSettings(request.VideoSettings),
    FileTransferSettings = MapFileTransferSettings(request.FileTransferSettings),
    SearchSettings = MapSearchSettings(request.SearchSettings),
    AppSettings = MapAppSettings(request.AppSettings)
};

// In MapEntityToDto method:
var dto = new SaveSettingsRequest
{
    ConnectionSettings = MapConnectionSettingsDto(entity.ConnectionSettings),
    PlayerSettings = MapPlayerSettingsDto(entity.PlayerSettings),
    VideoSettings = MapVideoSettingsDto(entity.VideoSettings),
    FileTransferSettings = MapFileTransferSettingsDto(entity.FileTransferSettings),
    SearchSettings = MapSearchSettingsDto(entity.SearchSettings),
    AppSettings = MapAppSettingsDto(entity.AppSettings)
};

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

**Testing Focus for Task 6:**

**Behaviors to Test:**

- [ ] **DTO → Domain Mapping**: VideoSettingsDto maps to VideoSettings domain model correctly
- [ ] **Domain → DTO Mapping**: VideoSettings domain model maps to VideoSettingsDto correctly
- [ ] **Round-Trip Integrity**: Mapping DTO → domain → DTO preserves all values
- [ ] **EnableVideo Preservation**: Value transfers accurately in both directions

**Testing Reference:**

- Unit test both mapper directions with known inputs
- Integration test via SaveSettings endpoint (full round-trip)

</details>

---

<details open>
<summary><h3>Task 7: Build Backend and Generate OpenAPI Spec</h3></summary>

**Purpose**: Build the backend API project to generate the updated OpenAPI specification that includes VideoSettingsDto, preparing for frontend API client regeneration in Phase 3.

**Related Documentation:**

- [API Client Generation](../../../API_CLIENT_GENERATION.md) - Complete OpenAPI generation workflow

**Implementation Subtasks:**

- [ ] **Navigate to API project directory**: `apps/api/src/`
- [ ] **Run dotnet build**: `dotnet build TeensyRom.Api.csproj`
- [ ] **Verify build succeeds** with no errors or warnings
- [ ] **Locate generated OpenAPI spec**: `openapi-spec.json` in workspace root
- [ ] **Verify VideoSettingsDto** appears in OpenAPI spec with correct schema
- [ ] **Commit openapi-spec.json** to source control

**Testing Subtask:**

- [ ] **Manual Verification**: Review openapi-spec.json includes VideoSettingsDto schema

**Key Implementation Notes:**

- OpenAPI generation happens automatically during build via Scalar/Swashbuckle integration
- Generated spec is placed in workspace root: `c:\dev\src\TeensyROM-Web\src\openapi-spec.json`
- Spec should include VideoSettingsDto schema with EnableVideo property
- GetSettingsResponse and SaveSettingsRequest should reference VideoSettingsDto
- Spec is used by frontend to regenerate TypeScript API client in Phase 3

**Expected OpenAPI Schema**:

```json
{
  "VideoSettingsDto": {
    "type": "object",
    "properties": {
      "enableVideo": {
        "type": "boolean"
      }
    },
    "required": ["enableVideo"]
  }
}
```

**Testing Focus for Task 7:**

**Behaviors to Test:**

- [ ] **Build Succeeds**: Backend builds without errors
- [ ] **Spec Generated**: openapi-spec.json file created/updated
- [ ] **VideoSettingsDto Included**: Schema contains VideoSettingsDto definition
- [ ] **Properties Correct**: enableVideo property defined as boolean with required constraint
- [ ] **Request/Response Updated**: GetSettingsResponse and SaveSettingsRequest include videoSettings

**Testing Reference:**

- Manual inspection of openapi-spec.json
- Validate JSON structure matches expected schema
- Compare with PlayerSettings schema for consistency

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**Modified Files:**

- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SettingsModels.cs` - Add VideoSettingsDto
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsModels.cs` - Add VideoSettings to response
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsMapper.cs` - Add VideoSettings mapping
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsModels.cs` - Add VideoSettings to request + validator
- `apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsMapper.cs` - Add VideoSettings bidirectional mapping
- `openapi-spec.json` - Regenerated with VideoSettingsDto schema

**No New Files Created** (all changes are additive to existing files)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test API contracts and transformations, not internal logic
> - **Test as you go** - tests are integrated into each task's subtasks, not deferred to the end
> - **Test through endpoints** - integration tests via HTTP calls validate full flow
> - **Mock at boundaries** - mock SettingsService if needed, not mappers or DTOs

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md) - Core behavioral testing approach

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```powershell
# Run all API tests
dotnet test apps/api/src/TeensyRom.Api.Tests

# Run specific test class (if API tests exist)
dotnet test apps/api/src/TeensyRom.Api.Tests --filter "FullyQualifiedName~SettingsEndpointTests"

# Run with verbose output
dotnet test apps/api/src/TeensyRom.Api.Tests --verbosity detailed
```

**Note**: If API endpoint tests don't exist yet, testing will focus on:
- Manual testing via Scalar API docs at `/scalar/v1`
- Integration testing in Phase 3 after frontend regeneration
- Mapper unit tests if needed

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)
- [ ] VideoSettingsDto created with [Required] attribute and XML comments
- [ ] VideoSettingsValidator created (even if empty for MVP)
- [ ] GetSettingsResponse includes VideoSettings property
- [ ] SaveSettingsRequest includes VideoSettings property with validation rule
- [ ] GetSettings mapper transforms VideoSettings domain → DTO
- [ ] SaveSettings mapper transforms VideoSettings bidirectionally (DTO ↔ domain)

**Build & Generation Requirements:**

- [ ] Backend builds successfully with no errors or warnings
- [ ] openapi-spec.json regenerated with VideoSettingsDto schema
- [ ] OpenAPI spec includes VideoSettingsDto in components/schemas
- [ ] GetSettingsResponse schema references VideoSettingsDto
- [ ] SaveSettingsRequest schema references VideoSettingsDto

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Mapper transformations tested (round-trip integrity)
- [ ] OpenAPI spec manually verified for correctness

**Quality Checks:**

- [ ] No C# compiler errors or warnings
- [ ] Code formatting is consistent (dotnet format)
- [ ] XML documentation comments present on all public types/properties
- [ ] FluentValidation validators follow established patterns

**Documentation:**

- [ ] XML doc comments added for VideoSettingsDto and properties
- [ ] Code follows existing patterns (PlayerSettingsDto, ConnectionSettingsDto)
- [ ] Mapper methods follow established naming conventions

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] openapi-spec.json committed to source control
- [ ] No known bugs or issues
- [ ] Ready to proceed to Phase 3 (API Client Regeneration)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Minimal Validation for MVP**: VideoSettingsValidator has no additional rules beyond [Required] attribute since EnableVideo is a simple boolean. Future properties (quality, resolution) can add validation rules without changing the structure.

- **DTO Pattern Consistency**: VideoSettingsDto follows the exact pattern of PlayerSettingsDto, ConnectionSettingsDto, etc., using record types, [Required] attributes, and detailed XML comments.

- **Mapper Separation**: GetSettings and SaveSettings have separate mappers, so VideoSettings mapping appears in both files. This maintains separation of concerns between read and write operations.

- **OpenAPI Generation**: The build process automatically generates openapi-spec.json via Scalar/Swashbuckle integration. No manual OpenAPI editing required - the spec reflects the C# DTOs automatically.

### Implementation Constraints

- **No Breaking Changes**: Adding VideoSettings to GetSettingsResponse and SaveSettingsRequest is non-breaking for existing clients since they can ignore unknown properties. However, clients must update to send VideoSettings when saving to avoid validation errors.

- **Bidirectional Mapping**: SaveSettings mapper requires both directions (DTO → domain for save, domain → DTO for response verification). This ensures clients can read back what they saved.

### Future Enhancements

- **Additional Video Properties**: Resolution, frame rate, device selection, recording options can be added to VideoSettingsDto without changing the overall structure.

- **Complex Validation**: When adding new properties, VideoSettingsValidator can include FluentValidation rules for ranges, enums, string formats, etc.

- **Endpoint Tests**: If API endpoint tests are added in the future, they should validate full request/response cycles including VideoSettings.

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

**Phase Status**: Ready for Execution  
**Estimated Effort**: 1.5-2 hours  
**Dependencies**: Phase 1 complete ✅