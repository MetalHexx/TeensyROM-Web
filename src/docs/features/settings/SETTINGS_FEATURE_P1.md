# Phase 1: Settings Backend Foundation - DTOs, Validators, Mappers & Endpoints

## 🎯 Objective

Implement foundational GET and POST endpoints for TeensyROM user settings, enabling the frontend to retrieve and persist application preferences. These endpoints will use RadEndpoints mappers to demonstrate DTO-to-entity mapping patterns and include comprehensive validation for all settings sections (Connection, Player, FileTransfer, Search, App).

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [RadEndpoints Documentation](https://github.com/MetalHexx/RadEndpoints/blob/main/README.md) - Core RadEndpoints patterns
- [ ] [Backend Architecture](../../BACKEND_ARCHITECTURE.md) - Backend architecture overview
- [ ] [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md) - Original detailed planning document (Tasks 1-7)

**Standards & Guidelines:**

- [ ] [API Client Generation](../../API_CLIENT_GENERATION.md) - Understanding TypeScript client generation from .NET API

**Reference Implementations:**

- [ ] `LaunchRandomEndpoint.cs` - Example endpoint with validation patterns
- [ ] `LaunchRandomModels.cs` - Example DTO and validator patterns
- [ ] `LaunchRandomTests.cs` - Integration test patterns
- [ ] `TeensySettings.cs` - Domain settings model to mirror in DTOs
- [ ] `SettingsService.cs` - Existing settings service for persistence

---

## 📂 File Structure Overview

```
apps/api/src/TeensyRom.Api/
├── Endpoints/
│   └── Settings/                                                 ✨ New - Settings endpoint folder
│       ├── GetSettings/                                          ✨ New - Get settings endpoint
│       │   ├── GetSettingsEndpoint.cs                            ✨ New - GET endpoint implementation
│       │   ├── GetSettingsModels.cs                              ✨ New - Request/response DTOs
│       │   └── GetSettingsMapper.cs                              ✨ New - Entity-to-DTO mapper
│       └── SaveSettings/                                         ✨ New - Save settings endpoint
│           ├── SaveSettingsEndpoint.cs                           ✨ New - POST endpoint implementation
│           ├── SaveSettingsModels.cs                             ✨ New - Request/response DTOs with validators
│           └── SaveSettingsMapper.cs                             ✨ New - DTO-to-entity mapper
└── Program.cs                                                    📝 Modified - Add startup settings load

apps/api/src/TeensyRom.Api.Tests.Integration/
├── GetSettingsTests.cs                                           ✨ New - Integration tests for GET
└── SaveSettingsTests.cs                                          ✨ New - Integration tests for POST
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create DTO Models for Settings</h3></summary>

**Purpose**: Define Data Transfer Objects that mirror the domain settings structure but are optimized for API contracts with validation attributes.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-1-create-dto-models-for-settings) - Complete DTO specifications
- `TeensySettings.cs` - Domain model structure to mirror
- `LaunchRandomModels.cs` - Example DTO patterns

**Implementation Subtasks:**

- [ ] **Create `GetSettingsModels.cs`**: Define `GetSettingsResponse` DTO with nested DTOs for all settings sections
  - Include: `ConnectionSettingsDto`, `PlayerSettingsDto`, `FileTransferSettingsDto`, `SearchSettingsDto`, `AppSettingsDto`
  - Add XML documentation for all properties
  - Use `[Required]` attributes where appropriate
- [ ] **Create `SaveSettingsModels.cs`**: Define `SaveSettingsRequest` and `SaveSettingsResponse` DTOs
  - `SaveSettingsRequest` mirrors `GetSettingsResponse` structure for input
  - `SaveSettingsResponse` contains success message and saved settings
  - Add XML documentation for all properties
- [ ] **Create nested DTO classes**: Define DTOs for each settings section
  - `ConnectionSettingsDto` (ConnectionType, AutoConnectEnabled, Serial, Tcp)
  - `SerialConnectionSettingsDto` (Port, BaudRate)
  - `TcpConnectionSettingsDto` (HostAddress, Port, timeouts)
  - `PlayerSettingsDto` (RepeatModeOnStartup, PlayTimerEnabled, filters, startup launch settings)
  - `FileTransferSettingsDto` (WatchDirectoryLocation, AutoTransferPath, auto-copy/launch flags)
  - `SearchSettingsDto` (SearchWeights, SearchStopWords, BannedDirectories, BannedFiles)
  - `SearchWeightsDto` (Title, FileName, FilePath, Creator, Description)
  - `AppSettingsDto` (FirstTimeSetup)

**Testing Subtask:**

- [ ] **Write Tests**: Integration tests will cover DTO behavior through endpoint tests (no separate DTO unit tests needed)

**Key Implementation Notes:**

- DTOs should use primitive types and avoid domain-specific value objects (e.g., use `string` instead of `DirectoryPath`)
- All DTOs should be `record` types for value-based equality
- Keep DTOs in the same file as request/response models for simplicity
- Follow existing DTO naming convention: append `Dto` suffix

</details>

---

<details open>
<summary><h3>Task 2: Create Validators for SaveSettings Request</h3></summary>

**Purpose**: Implement FluentValidation validators for all settings sections to ensure data integrity before persistence.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-2-create-validators-for-savesettings-request) - Complete validation specifications
- `LaunchRandomModels.cs` - Example validator patterns
- Domain Settings Models - Validation constraints reference

**Implementation Subtasks:**

- [ ] **Create `SaveSettingsRequestValidator`**: Main validator class in `SaveSettingsModels.cs`
  - Validate all nested settings sections are not null
  - Use `RuleFor` with nested validators
- [ ] **Create `ConnectionSettingsValidator`**: Validate connection settings
  - `ConnectionType` must be valid enum value
  - `AutoConnectEnabled` (no validation needed, boolean)
  - `Serial` and `Tcp` must not be null
- [ ] **Create `SerialConnectionSettingsValidator`**: Validate serial settings
  - `Port` can be empty string (default) or valid COM port format
  - `BaudRate` must be positive integer, typically 9600, 19200, 38400, 57600, or 115200
- [ ] **Create `TcpConnectionSettingsValidator`**: Validate TCP settings
  - `HostAddress` can be empty or valid IP/hostname format
  - `Port` must be between 1 and 65535
  - `ConnectionTimeoutMs`, `ReadTimeoutMs`, `WriteTimeoutMs` must be positive integers
- [ ] **Create `PlayerSettingsValidator`**: Validate player settings
  - All boolean fields (no validation needed)
  - `StartupFilter` must be valid `TeensyFilterType` enum
- [ ] **Create `FileTransferSettingsValidator`**: Validate file transfer settings
  - `WatchDirectoryLocation` can be empty or valid absolute directory path
  - `AutoTransferPath` should be valid Unix-style relative path
  - Boolean fields (no validation needed)
- [ ] **Create `SearchSettingsValidator`**: Validate search settings
  - `SearchWeights` must not be null
  - `SearchStopWords` can be empty list
  - `BannedDirectories` can be empty list
  - `BannedFiles` can be empty list
- [ ] **Create `SearchWeightsValidator`**: Validate search weights
  - All weight values must be >= 0
  - At least one weight should be > 0 (meaningful search)
- [ ] **Create `AppSettingsValidator`**: Validate app settings
  - `FirstTimeSetup` (no validation needed, boolean)

**Testing Subtask:**

- [ ] **Write Tests**: Validation tests covered in integration tests

**Key Implementation Notes:**

- Use `RuleFor(x => x.Property)` pattern for each property
- Chain validators with `.SetValidator(new ChildValidator())` for nested objects
- Use descriptive error messages that will appear in validation problem details
- Consider using `When()` clauses for conditional validation
- RadEndpoints automatically discovers and applies validators

</details>

---

<details open>
<summary><h3>Task 3: Create RadEndpoints Mappers</h3></summary>

**Purpose**: Implement bidirectional mappers between domain entities and DTOs using RadEndpoints mapper pattern.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-3-create-radendpoints-mappers) - Complete mapper specifications
- [RadEndpoints Mapper Documentation](https://github.com/MetalHexx/RadEndpoints/blob/main/README.md#mappers) - Mapper patterns and conventions

**Implementation Subtasks:**

- [ ] **Create `GetSettingsMapper.cs`**: Implement entity-to-DTO mapper
  - Extend `RadMapper<TeensySettings, GetSettingsResponse>`
  - Implement `FromEntity(TeensySettings entity)` method
  - Map all nested settings sections to their respective DTOs
- [ ] **Create `SaveSettingsMapper.cs`**: Implement DTO-to-entity mapper
  - Extend `RadMapper<SaveSettingsRequest, TeensySettings>`
  - Implement `ToEntity(SaveSettingsRequest dto)` method
  - Map all nested DTOs to their respective domain entities
  - Ensure proper handling of value objects (e.g., `DirectoryPath`)
- [ ] **Implement nested mapping methods**: Create helper methods for mapping nested objects
  - ConnectionSettings ↔ ConnectionSettingsDto
  - PlayerSettings ↔ PlayerSettingsDto
  - FileTransferSettings ↔ FileTransferSettingsDto
  - SearchSettings ↔ SearchSettingsDto (including SearchWeights)
  - AppSettings ↔ AppSettingsDto

**Testing Subtask:**

- [ ] **Write Tests**: Mapper behavior tested through endpoint integration tests

**Key Implementation Notes:**

- Mappers are automatically discovered by RadEndpoints during startup
- Use `Map` property in endpoint to access the mapper instance
- For `DirectoryPath` value object: use `.ToString()` when mapping to DTO, `new DirectoryPath(string)` when mapping to entity
- Keep mapping logic simple and direct - avoid complex transformations
- Consider creating private helper methods for mapping nested objects to improve readability

</details>

---

<details open>
<summary><h3>Task 4: Implement GetSettings Endpoint</h3></summary>

**Purpose**: Create GET endpoint that retrieves current user settings using ISettingsService.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-4-implement-getsettings-endpoint) - Complete endpoint specifications
- `LaunchRandomEndpoint.cs` - Endpoint structure example
- `ISettingsService` - Settings service interface

**Implementation Subtasks:**

- [ ] **Create `GetSettingsEndpoint.cs`**: Implement endpoint class
  - Extend `RadEndpointWithoutRequest<GetSettingsResponse, GetSettingsMapper>`
  - Inject `ISettingsService` via constructor
  - Configure route as `GET /settings`
- [ ] **Implement `Configure()` method**: Set up routing and documentation
  - Use `Get("/settings")` route
  - Add `Produces<GetSettingsResponse>(200)`
  - Add `ProducesProblem(500)`
  - Set `WithName("GetSettings")`
  - Set `WithTags("Settings")`
  - Add comprehensive `WithDescription()` with markdown documentation
- [ ] **Implement `Handle()` method**: Retrieve and return settings
  - Call `settingsService.GetSettings()` to retrieve current settings
  - Use `Map.FromEntity(settings)` to convert to DTO
  - Set `Response` property with mapped DTO
  - Call `Send()` to return 200 OK

**Testing Subtask:**

- [ ] **Write Tests**: See Task 6 - Integration Tests

**Key Implementation Notes:**

- This endpoint requires no request model (uses `RadEndpointWithoutRequest`)
- Settings service maintains in-memory settings loaded from JSON
- No device-specific context needed - settings are application-wide
- Response should always be successful (settings always exist with defaults)

</details>

---

<details open>
<summary><h3>Task 5: Implement SaveSettings Endpoint</h3></summary>

**Purpose**: Create POST endpoint that persists user settings changes with comprehensive validation.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-5-implement-savesettings-endpoint) - Complete endpoint specifications
- `LaunchRandomEndpoint.cs` - Endpoint validation patterns
- `ISettingsService` - Settings service interface

**Implementation Subtasks:**

- [ ] **Create `SaveSettingsEndpoint.cs`**: Implement endpoint class
  - Extend `RadEndpoint<SaveSettingsRequest, SaveSettingsResponse, SaveSettingsMapper>`
  - Inject `ISettingsService` via constructor
  - Configure route as `POST /settings`
- [ ] **Implement `Configure()` method**: Set up routing and documentation
  - Use `Post("/settings")` route
  - Add `Produces<SaveSettingsResponse>(200)`
  - Add `ProducesValidationProblem(400)`
  - Add `ProducesProblem(500)`
  - Set `WithName("SaveSettings")`
  - Set `WithTags("Settings")`
  - Add comprehensive `WithDescription()` with markdown documentation
- [ ] **Implement `Handle()` method**: Validate, save, and return settings
  - Use `Map.ToEntity(request)` to convert DTO to domain entity
  - Call `settingsService.SaveSettings(settings)` to persist
  - If save fails, call `SendExternalError("Failed to save settings")`
  - Set `Response` with success message and saved settings
  - Call `Send()` to return 200 OK

**Testing Subtask:**

- [ ] **Write Tests**: See Task 6 - Integration Tests

**Key Implementation Notes:**

- RadEndpoints automatically runs validators before Handle() is called
- Validation failures return 400 Bad Request with problem details
- Settings service handles file I/O and error handling internally
- Response should echo back the saved settings for client confirmation

</details>

---

<details open>
<summary><h3>Task 6: Create Comprehensive Integration Tests</h3></summary>

**Purpose**: Implement end-to-end integration tests covering all endpoint scenarios including validation, happy paths, and edge cases.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-6-create-comprehensive-integration-tests) - Complete test specifications
- `LaunchRandomTests.cs` - Test patterns and structure
- `EndpointFixture.cs` - Test infrastructure

**Implementation Subtasks:**

**GetSettingsTests.cs:**
- [ ] **Create test class** with `[Collection("Endpoint")]` and `IDisposable`
- [ ] **Test: GetSettings_ReturnsDefaultSettings** - Verify default settings returned
- [ ] **Test: GetSettings_ReturnsCurrentSettings** - Verify GET returns previously saved settings
- [ ] **Test: GetSettings_Returns200OK** - Verify success status code
- [ ] **Test: GetSettings_ReturnsValidStructure** - Verify response DTO structure complete

**SaveSettingsTests.cs:**
- [ ] **Create test class** with `[Collection("Endpoint")]` and `IDisposable`
- [ ] **Test: SaveSettings_WithValidRequest_SavesSuccessfullyAndReturnsSettings** - Happy path
- [ ] **Test: SaveSettings_WithInvalidConnectionType_ReturnsBadRequest** - Validation
- [ ] **Test: SaveSettings_WithInvalidBaudRate_ReturnsBadRequest** - Serial validation
- [ ] **Test: SaveSettings_WithInvalidTcpPort_ReturnsBadRequest** - TCP validation
- [ ] **Test: SaveSettings_WithInvalidHostAddress_ReturnsBadRequest** - Host validation
- [ ] **Test: SaveSettings_WithInvalidTimeouts_ReturnsBadRequest** - Timeout validation
- [ ] **Test: SaveSettings_WithInvalidPath_ReturnsBadRequest** - Path validation
- [ ] **Test: SaveSettings_WithNegativeSearchWeights_ReturnsBadRequest** - Search weight validation
- [ ] **Test: SaveSettings_WithAllZeroSearchWeights_ReturnsBadRequest** - Search weight validation
- [ ] **Test: SaveSettings_SettingsPersist_BetweenRequests** - Persistence test
- [ ] **Test: SaveSettings_UpdatesOnlyChangedSection_OtherSectionsUnchanged** - Partial update

**Testing Subtask:**

- [ ] **Run All Tests**: Execute full test suite and verify all tests pass

**Key Implementation Notes:**

- Use `EndpointFixture.Client` for HTTP calls
- Use `r.Should().BeSuccessful<TResponse>()` for happy path assertions
- Use `r.Should().BeValidationProblem().WithKeyAndValue()` for validation assertions
- Tests should be isolated - use `f.Reset()` in `Dispose()`

**Behaviors to Test:**

- [ ] Settings retrieved with correct structure and default values
- [ ] Settings persist across requests
- [ ] Validation catches invalid connection configurations
- [ ] Validation catches invalid serial/TCP parameters
- [ ] Validation catches invalid file paths
- [ ] Validation catches invalid search weights
- [ ] Error responses include helpful validation messages
- [ ] Partial updates don't corrupt other settings sections

</details>

---

<details open>
<summary><h3>Task 7: Add Startup Settings Load</h3></summary>

**Purpose**: Ensure settings are loaded from JSON and available in DI container at application startup.

**Related Documentation:**
- [BASIC_SETTINGS_ENDPOINT_PLAN](./BASIC_SETTINGS_ENDPOINT_PLAN.md#task-7-add-startup-settings-load) - Startup configuration details
- `Program.cs` - Application startup configuration
- `SettingsService.cs` - Settings initialization patterns

**Implementation Subtasks:**

- [ ] **Locate service registration**: Find where `ISettingsService` is registered in `Program.cs`
- [ ] **Add startup settings load**: After building service provider, load settings
  - Get `ISettingsService` instance from DI container
  - Call `GetSettings()` to trigger initial load from JSON file
- [ ] **Add startup logging**: Log successful settings load
- [ ] **Handle startup failures**: Add error handling for settings load

**Testing Subtask:**

- [ ] **Manual Test**: Verify settings load on startup with various scenarios

**Key Implementation Notes:**

- Settings service is likely registered as singleton
- Initial `GetSettings()` call triggers JSON file read and caching
- Settings.json should be in application's working directory
- Don't fail startup if settings can't be loaded - use defaults

</details>

---

## ✅ Success Criteria

> **Mark checkboxes as criteria are met**. All items must be checked before phase is complete.

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] All subtasks within each task completed
- [ ] Code follows backend coding standards and patterns
- [ ] GET `/settings` endpoint returns current settings with 200 OK
- [ ] POST `/settings` endpoint saves settings and returns confirmation with 200 OK
- [ ] All validation rules implemented and tested

**Testing Requirements:**

- [ ] All testing subtasks completed within each task
- [ ] Integration tests achieve >90% code coverage for endpoints and validators
- [ ] All tests passing with no failures
- [ ] Settings load on application startup without errors

**Quality Checks:**

- [ ] No C# compiler errors or warnings
- [ ] All tests pass in CI/CD pipeline
- [ ] OpenAPI documentation generated correctly for both endpoints
- [ ] DTOs properly map to/from domain entities using RadEndpoints mappers

**Documentation:**

- [ ] Inline code comments added for complex logic (if needed)
- [ ] XML documentation complete for public API endpoints
- [ ] API docs (Scalar) display correctly at `/scalar/v1`

**Ready for Next Phase:**

- [ ] All success criteria met
- [ ] No known bugs or issues
- [ ] Backend endpoints ready for Angular HTTP service integration (Phase 2)
- [ ] TypeScript API client can be generated for frontend consumption

---

## 📝 Notes & Considerations

### Design Decisions

- **RadEndpoints Pattern**: Leverages automatic mapper discovery and validation for clean endpoint implementation
- **DTO Naming**: Explicit `Dto` suffix for clarity and avoidance of namespace conflicts with domain models
- **Nested Validators**: Validators follow nested structure for maintainability and reusability
- **Value Objects**: DirectoryPath value object handled in mapper layer, not exposed in DTOs

### Implementation Constraints

- **Settings Service**: Uses existing `SettingsService` for persistence - no changes to storage mechanism
- **JSON Persistence**: Settings stored in JSON file in application directory
- **No Authentication**: Settings endpoints are application-level configuration (authentication added in future phases if needed)

### Future Enhancements

- **Settings Versioning**: Add settings schema versioning for migration support
- **Settings History**: Track settings changes over time for audit purposes
- **Settings Export/Import**: Allow users to export/import settings configurations
- **Settings Validation API**: Expose validation endpoint for client-side pre-validation

### External References

- [RadEndpoints GitHub](https://github.com/MetalHexx/RadEndpoints) - Primary endpoint framework
- [FluentValidation Documentation](https://docs.fluentvalidation.net) - Validation framework patterns

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

---

## 💡 Agent Implementation Guide

> **Instructions for AI agents implementing this phase**

### Key Patterns to Follow

1. **RadEndpoints Conventions**: 
   - Folder per endpoint with Models, Mapper, Endpoint files
   - Extend base endpoint classes appropriately
   - Use `Configure()` for routing, `Handle()` for logic

2. **Validation Pattern**:
   - One validator per DTO
   - Chain nested validators with `.SetValidator()`
   - Provide descriptive error messages

3. **Integration Testing**:
   - Use `EndpointFixture` for test infrastructure
   - Test happy paths and all validation scenarios
   - Verify persistence and error handling

4. **Mapper Implementation**:
   - Keep mapping logic simple
   - Handle value objects (DirectoryPath) correctly
   - Create helper methods for complex nested mappings

### Before Starting

- Verify `TeensySettings.cs` domain model structure
- Review existing `SettingsService.cs` implementation
- Check `LaunchRandomEndpoint.cs` for endpoint pattern reference
- Understand RadEndpoints automatic discovery

### Common Pitfalls to Avoid

- Don't expose domain value objects in DTOs (use primitives)
- Don't skip XML documentation on DTOs and endpoints
- Don't forget to export mappers and validators
- Don't implement complex logic in endpoints (keep them thin)

---

_Last Updated: 2025-11-10_
_Phase Author: Coding Agent_
_Status: Ready for Implementation_
