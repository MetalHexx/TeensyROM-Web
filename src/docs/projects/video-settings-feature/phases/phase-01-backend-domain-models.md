# Phase 1: Backend Foundation - Domain Models & Validation

## 🎯 Objective

Create the `VideoSettings` domain model in the backend Core layer and integrate it into the root `TeensySettings` container. This phase establishes the foundational data structure for video-related user preferences before any API contracts or endpoints are built.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [x] [Feature Planning Document](../master-plan.md) - High-level feature plan
- [x] [Backend Architecture](../../../BACKEND_ARCHITECTURE.md) - Backend patterns and CQRS flows

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Core/Settings/
├── TeensySettings.cs                    📝 Modified - Add VideoSettings property
├── PlayerSettings.cs                    📄 Reference - Existing pattern to follow
├── ConnectionSettings.cs                📄 Reference - Existing pattern to follow
└── VideoSettings.cs                     ✨ New - Video-related preferences model
```

---

## 📋 Implementation Guidelines

---

<details open>
<summary><h3>Task 1: Create VideoSettings Domain Model</h3></summary>

**Purpose**: Define the `VideoSettings` record class that will hold video-related user preferences. Starting with a single `EnableVideo` boolean property to control video capture visibility.

**Related Documentation:**

- [PlayerSettings.cs](../../../../../../apps/api/src/TeensyRom.Core/Settings/PlayerSettings.cs) - Reference pattern for settings records
- [Backend Architecture - Domain Models](../../../BACKEND_ARCHITECTURE.md#domain-entities) - Domain modeling principles

**Implementation Subtasks:**

- [ ] **Create VideoSettings.cs file** in `apps/api/src/TeensyRom.Core/Settings/` directory
- [ ] **Define VideoSettings record** with namespace `TeensyRom.Core.Settings`
- [ ] **Add XML documentation comment** explaining purpose: "Video capture and display preferences"
- [ ] **Add EnableVideo property** of type `bool` with default value `false`
- [ ] **Add XML doc comment** for EnableVideo property explaining it controls video capture component visibility

**Testing Subtask:**

- [ ] **Write Tests**: Test serialization/deserialization of VideoSettings (see Testing section below for details)

**Key Implementation Notes:**

- Use `record` type (not class) to match existing settings model patterns
- Follow immutable pattern with init-only properties
- Default EnableVideo to `false` to avoid surprising users without capture hardware
- Keep XML documentation concise and user-focused

**Critical Type Definition**:

```csharp
namespace TeensyRom.Core.Settings
{
  /// <summary>
  /// Video capture and display preferences
  /// </summary>
  public record VideoSettings
  {
    /// <summary>
    /// Enable video capture component visibility in player view
    /// </summary>
    public bool EnableVideo { get; set; } = false;
  }
}
```

**Testing Focus for Task 1:**

> Focus on **behavioral testing** - what observable outcomes occur?

**Behaviors to Test:**

- [ ] **Default Initialization**: VideoSettings initializes with EnableVideo = false
- [ ] **Property Assignment**: EnableVideo property can be set to true/false
- [ ] **Record Equality**: Two VideoSettings instances with same EnableVideo value are equal

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for behavioral testing patterns
- Settings domain models are typically tested via integration tests (serialization), not isolated unit tests

</details>

---

<details open>
<summary><h3>Task 2: Integrate VideoSettings into TeensySettings</h3></summary>

**Purpose**: Add VideoSettings as a property to the root `TeensySettings` container so it can be persisted alongside other settings groups.

**Related Documentation:**

- [TeensySettings.cs](../../../../../../apps/api/src/TeensyRom.Core/Settings/TeensySettings.cs) - Root settings container

**Implementation Subtasks:**

- [ ] **Open TeensySettings.cs** in `apps/api/src/TeensyRom.Core/Settings/`
- [ ] **Add VideoSettings property** to TeensySettings record: `public VideoSettings VideoSettings { get; set; } = new();`
- [ ] **Update XML documentation comment** to mention video settings group
- [ ] **Verify property placement** follows existing pattern (alphabetical or logical grouping)

**Testing Subtask:**

- [ ] **Write Tests**: Test TeensySettings includes VideoSettings property (see Testing section below)

**Key Implementation Notes:**

- Initialize with `new()` to ensure non-null default instance
- Place property logically (recommendation: after PlayerSettings, before FileTransferSettings)
- Maintain consistent formatting with other settings properties

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] **Default Initialization**: TeensySettings initializes with non-null VideoSettings instance
- [ ] **Property Access**: VideoSettings property can be read and written
- [ ] **Serialization Round-Trip**: TeensySettings with VideoSettings serializes and deserializes correctly

**Testing Reference:**

- See [Testing Standards](../../../TESTING_STANDARDS.md) for testing approach

</details>

---

<details open>
<summary><h3>Task 3: Verify Settings Serialization</h3></summary>

**Purpose**: Ensure SettingsService correctly reads and writes VideoSettings to/from disk along with other settings groups.

**Related Documentation:**

- [SettingsService.cs](../../../../../../apps/api/src/TeensyRom.Core/Settings/SettingsService.cs) - Settings persistence service

**Implementation Subtasks:**

- [ ] **Review SettingsService implementation** to understand serialization mechanism
- [ ] **Verify JSON serialization** includes VideoSettings property automatically (System.Text.Json should handle record properties by default)
- [ ] **Test manual load/save cycle** to confirm VideoSettings persists correctly
- [ ] **Check settings.json file** in bin folder after save to verify VideoSettings appears

**Testing Subtask:**

- [ ] **Write Tests**: Test SettingsService persists and loads VideoSettings (see Testing section below)

**Key Implementation Notes:**

- SettingsService uses `System.Text.Json` which automatically serializes public properties
- No code changes should be needed unless custom serialization logic exists
- Verify settings file on disk contains `"VideoSettings": { "EnableVideo": false }` after save

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] **Settings Save**: Saving settings with VideoSettings writes to disk correctly
- [ ] **Settings Load**: Loading settings from disk includes VideoSettings property
- [ ] **Default Handling**: Loading settings from old file (without VideoSettings) applies default values
- [ ] **Round-Trip Equality**: Settings saved and loaded are equal to original

**Testing Reference:**

- See [SettingsServiceTests.cs](../../../../../../apps/api/src/TeensyRom.Core.Tests/Settings/SettingsServiceTests.cs) for existing test patterns

</details>

---

## 🗂️ Files Modified or Created

> List all files that will be changed or created during this phase with full relative paths from project root.

**New Files:**

- `apps/api/src/TeensyRom.Core/Settings/VideoSettings.cs`
- `apps/api/src/TeensyRom.Core.Tests/Settings/VideoSettingsTests.cs` (if unit tests needed)

**Modified Files:**

- `apps/api/src/TeensyRom.Core/Settings/TeensySettings.cs`
- `apps/api/src/TeensyRom.Core.Tests/Settings/SettingsServiceTests.cs` (add VideoSettings serialization tests)

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

> **IMPORTANT:** Tests are written **within each task above**, not here. This section is only a summary for quick reference.

> **Core Testing Philosophy:**
>
> - **Favor behavioral testing** - test what users/consumers observe, not how it's implemented
> - **Test as you go** - tests are integrated into each task's subtasks, not deferred to the end
> - **Test through public APIs** - settings service and domain models tested through serialization/deserialization
> - **Mock at boundaries** - mock file system if needed, not internal settings logic

> **Reference Documentation:**
>
> - **All tasks**: [Testing Standards](../../../TESTING_STANDARDS.md) - Core behavioral testing approach

### Where Tests Are Written

**Tests are embedded in each task above** with:

- **Testing Subtask**: Checkbox in the task's subtask list (e.g., "Write Tests: Test behaviors for this task")
- **Testing Focus**: "Behaviors to Test" section listing observable outcomes
- **Testing Reference**: Links to relevant testing documentation

**Complete each task's testing subtask before moving to the next task.**

### Test Execution Commands

**Running Tests:**

```powershell
# Run all Core tests
dotnet test apps/api/src/TeensyRom.Core.Tests

# Run specific test class
dotnet test apps/api/src/TeensyRom.Core.Tests --filter "FullyQualifiedName~SettingsServiceTests"

# Run with verbose output
dotnet test apps/api/src/TeensyRom.Core.Tests --verbosity detailed
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
- [ ] VideoSettings.cs file created with EnableVideo property
- [ ] TeensySettings includes VideoSettings property with default initialization

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] All behavioral test checkboxes verified
- [ ] Tests written alongside implementation (not deferred)
- [ ] All tests passing with no failures
- [ ] Serialization round-trip tests pass

**Quality Checks:**

- [ ] No C# compiler errors or warnings
- [ ] Code formatting is consistent (dotnet format)
- [ ] XML documentation comments present on all public types/properties

**Documentation:**

- [ ] XML doc comments added for VideoSettings class and properties
- [ ] Code follows existing patterns (PlayerSettings, ConnectionSettings)

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] Settings.json file correctly includes VideoSettings after save
- [ ] No known bugs or issues
- [ ] Ready to proceed to Phase 2 (Backend API Layer)

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Record Type**: Using `record` instead of `class` follows existing settings model patterns and provides value-based equality semantics automatically
- **Default Value**: EnableVideo defaults to `false` to avoid surprising users who don't have video capture hardware
- **Property Initialization**: Using `= new()` in TeensySettings ensures VideoSettings is never null, avoiding null-reference errors

### Implementation Constraints

- **No Breaking Changes**: Adding a new property to TeensySettings is non-breaking; existing settings files without VideoSettings will use default values
- **JSON Serialization**: System.Text.Json automatically handles record types and default values, no custom serialization needed

### Future Enhancements

- **Additional Video Properties**: Resolution, frame rate, device selection can be added to VideoSettings without breaking existing code
- **Validation Logic**: Future settings may require validation (e.g., resolution ranges), which can be added via FluentValidation at API layer

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

</details>

---

**Phase Status**: Ready for Execution  
**Estimated Effort**: 30-45 minutes  
**Dependencies**: None (foundational phase)
