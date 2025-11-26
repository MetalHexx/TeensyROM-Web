# Video Settings Feature - Master Plan

**Project Overview**: Add a new video settings group to the TeensyROM settings system that allows users to enable/disable video capture functionality across the application.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Domain Standards**: [DOMAIN_STANDARDS.md](../../DOMAIN_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **API Client Generation**: [API_CLIENT_GENERATION.md](../../API_CLIENT_GENERATION.md)
- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)

---

## 🎯 Project Objective

Add a new video settings capability to the TeensyROM application that provides users with control over video capture features. This feature introduces a new `VideoSettings` model in the backend (similar to the existing `PlayerSettings`), propagates it through the full stack via DTOs and API contracts, and exposes it in the frontend through the settings UI. The primary user-facing value is a toggle control (`EnableVideo`) that determines whether video capture components are visible and active during device playback sessions.

**User Value**: Users gain the ability to enable or disable video capture functionality based on their hardware setup and preferences. This is particularly valuable for users who don't have video capture devices, allowing them to simplify the UI by hiding unused components. It also provides a foundation for future video-related settings (quality, recording options, etc.).

**System Benefits**: This implementation follows the established pattern for settings groups (Connection, Player, FileTransfer, Search, App), ensuring consistency across the codebase. It exercises the complete settings flow from backend domain models through API endpoints, OpenAPI generation, frontend API client, state management, and UI components.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Backend Foundation - Domain Models & Validation ✅ COMPLETE</h3></summary>

### Objective

Establish the backend foundation by creating the `VideoSettings` domain model in the Core layer and integrating it into the root `TeensySettings` container. This phase ensures the backend domain is complete before any API contracts or endpoints are built.

### Key Deliverables

- [x] `VideoSettings.cs` class created in `TeensyRom.Core/Settings/` with `EnableVideo` property
- [x] `VideoSettings` property added to `TeensySettings` record
- [x] Default value initialization configured (EnableVideo = false)
- [x] Settings serialization/deserialization verified
- [x] **Bonus**: IVideoSettingsProvider interface created
- [x] **Bonus**: SettingsService updated with VideoSettings observable and provider methods
- [x] **Bonus**: Comprehensive tests added (8 tests following behavioral patterns)

### Completed Tasks

1. ✅ **TASK-01-001-VIDEO-SETTINGS-DOMAIN-MODEL** (Backend Wizard) - Complete
   - VideoSettings domain model created
   - Integration into TeensySettings complete
   - Provider interface and service integration added
   - Tests added and passing
   - [Completion Report](reports/TASK-01-001-report.md)

### Resolution of Open Questions

- **Default EnableVideo Value**: Implemented as `false` (disabled) to avoid surprising users without video capture hardware ✅

**Phase Status**: ✅ Complete - November 25, 2025

</details>

---

<details open>
<summary><h3>Phase 2: Backend API Layer - DTOs, Validation, Endpoints</h3></summary>

### Objective

Create the API surface for video settings by adding DTOs with validation rules and updating existing settings endpoints to handle the new video settings group. This phase completes the backend implementation and enables OpenAPI spec generation.

### Key Deliverables

- [ ] `VideoSettingsDto` record created with validation attributes
- [ ] `VideoSettingsValidator` class created with FluentValidation rules
- [ ] `GetSettingsResponse` updated to include `VideoSettings` property
- [ ] `SaveSettingsRequest` updated to include `VideoSettings` property
- [ ] GetSettings endpoint returns video settings in response
- [ ] SaveSettings endpoint accepts and persists video settings
- [ ] Settings mappers updated for VideoSettings ↔ VideoSettingsDto transformations

### High-Level Tasks

1. **Create VideoSettings DTO**: Define DTO with validation attributes in SettingsModels.cs
2. **Add Validation Rules**: Create FluentValidation validator for VideoSettingsDto
3. **Update Request/Response Models**: Add VideoSettings to GetSettingsResponse and SaveSettingsRequest
4. **Update Settings Mappers**: Implement bidirectional mapping in SaveSettingsMapper and GetSettingsMapper
5. **Verify Endpoints**: Test GetSettings and SaveSettings endpoints return/accept video settings

### Open Questions for Phase 2

- **Additional Validation Rules**: Should we add constraints beyond required fields (e.g., business rules)?
  - *Recommendation*: Keep simple for now (just [Required]), add validation as future video settings emerge

</details>

---

<details open>
<summary><h3>Phase 3: API Client Regeneration & Infrastructure Integration</h3></summary>

### Objective

Regenerate the TypeScript API client to include the new video settings DTOs, then integrate them into the frontend infrastructure layer via the settings service and domain mapper. This phase bridges backend and frontend.

### Key Deliverables

- [ ] OpenAPI spec regenerated with VideoSettingsDto
- [ ] TypeScript API client regenerated with updated models
- [ ] Domain `VideoSettings` interface created in libs/domain
- [ ] DomainMapper updated with VideoSettings transformation methods
- [ ] SettingsService correctly maps VideoSettings in both directions

### High-Level Tasks

1. **Regenerate OpenAPI Spec**: Run backend build to generate updated OpenAPI spec
2. **Regenerate API Client**: Run pnpm generate:api-client to create TypeScript models
3. **Create Domain VideoSettings Interface**: Define frontend domain contract for video settings
4. **Update Domain Mapper**: Add toVideoSettings and toVideoSettingsDto methods
5. **Verify Settings Service**: Ensure getSettings/saveSettings correctly handle video settings

### Open Questions for Phase 3

- **Domain Model Structure**: Should frontend VideoSettings interface match backend exactly or diverge?
  - *Recommendation*: Match exactly for simplicity; diverge only if frontend needs differ

</details>

---

<details open>
<summary><h3>Phase 4: Frontend State Management - Store & Actions</h3></summary>

### Objective

Extend the settings store to manage video settings state and provide actions/selectors for components to interact with video settings data. This phase ensures reactive state management for the new settings group.

### Key Deliverables

- [ ] SettingsState interface includes VideoSettings property
- [ ] Settings store initial state includes default VideoSettings
- [ ] Video settings selectors created (selectVideoSettings, selectEnableVideo)
- [ ] Settings history correctly tracks video settings changes
- [ ] Settings form service integrates video settings

### High-Level Tasks

1. **Update SettingsState Interface**: Add videoSettings property to state definition
2. **Create Video Settings Selectors**: Define selectors for accessing video settings state
3. **Verify State Hydration**: Ensure video settings load from API on store initialization
4. **Test State Persistence**: Verify video settings save correctly through store actions

### Open Questions for Phase 4

- **Selector Granularity**: Create individual selectors for each video setting, or just one for the whole group?
  - *Recommendation*: Start with selectVideoSettings and selectEnableVideo; add more as needed

</details>

---

<details open>
<summary><h3>Phase 5: Frontend UI - Settings View Components</h3></summary>

### Objective

Create UI components in the settings view to display and edit video settings, allowing users to toggle video capture functionality. This phase completes the user-facing implementation.

### Key Deliverables

- [ ] Video settings section component created (similar to player settings section)
- [ ] Enable Video toggle control added with proper binding
- [ ] Video settings section integrated into main settings view
- [ ] Settings form validation includes video settings
- [ ] Auto-save and history tracking work correctly for video settings

### High-Level Tasks

1. **Create Video Settings Section Component**: Build form section component with toggle control
2. **Integrate into Settings View**: Wire up video settings section in main settings component
3. **Bind Form Controls**: Connect form controls to settings store via form service
4. **Test User Interaction**: Verify toggle changes persist and trigger auto-save

### Open Questions for Phase 5

- **UI Placement**: Where should video settings section appear in the settings view hierarchy?
  - *Recommendation*: Place after Player Settings, before File Transfer Settings

</details>

---

<details open>
<summary><h3>Phase 6: Video Capture Integration - Conditional Rendering</h3></summary>

### Objective

Connect the video settings to the video capture component, implementing conditional rendering based on the `EnableVideo` setting. This phase delivers the actual user value by hiding/showing video capture based on user preference.

### Key Deliverables

- [ ] VideoCaptureComponent conditionally renders based on EnableVideo setting
- [ ] Player component subscribes to EnableVideo selector
- [ ] Video capture state cleanup when disabled
- [ ] UI gracefully handles enable/disable transitions

### High-Level Tasks

1. **Inject Settings Store into Player Component**: Access EnableVideo setting in player container
2. **Implement Conditional Rendering**: Use @if directive to show/hide video capture component
3. **Handle State Cleanup**: Ensure video streams stop when video capture is disabled
4. **Test Toggle Behavior**: Verify smooth enable/disable transitions without errors

### Open Questions for Phase 6

- **State Cleanup Strategy**: Should we destroy video component entirely or just hide it?
  - *Recommendation*: Destroy component (via @if) to properly clean up media streams

</details>

---

<details open>
<summary><h2>🏗️ Architecture Overview</h2></summary>

### Key Design Decisions

- **Consistent Settings Pattern**: VideoSettings follows the exact same pattern as PlayerSettings, ConnectionSettings, etc., ensuring architectural consistency across the settings system. This means a domain record in Core, a DTO in API Endpoints with validation, and frontend domain interfaces mirroring the backend.

- **Backend-First Approach**: We build backend domain models and API contracts before touching the frontend. This ensures the API contract is stable before regenerating the TypeScript client, avoiding rework and version mismatches.

- **Single Toggle for MVP**: Starting with a single `EnableVideo` boolean keeps the implementation simple and focused. Future video-related settings (quality, device selection, recording options) can be added incrementally to the same VideoSettings group.

- **Conditional Component Destruction**: Using Angular's `@if` directive (not hidden via CSS) ensures proper cleanup of MediaStream resources when video capture is disabled, preventing memory leaks and unnecessary camera access.

### Integration Points

- **TeensySettings Root Container**: VideoSettings integrates into the existing TeensySettings record as a peer to PlayerSettings, ConnectionSettings, etc. The SettingsService already handles serialization/deserialization of the entire settings tree to disk.

- **Settings Endpoints**: GetSettings and SaveSettings endpoints already exist and handle all settings groups. We extend their request/response models to include VideoSettings without creating new endpoints.

- **API Client Generation**: The existing OpenAPI generation pipeline (dotnet build → pnpm generate:api-client) automatically picks up VideoSettingsDto and generates TypeScript models when we run the regeneration script.

- **Settings Store**: The existing SettingsStore in the application layer already manages state for all settings groups. We add VideoSettings to the state interface and leverage existing actions/selectors patterns.

- **Settings View**: The settings-view component already provides a tabbed/sectioned interface for different settings groups. We add a new video settings section component following the established pattern (player-settings-section, file-transfer-settings-section, etc.).

- **Player Container Component**: The player-device-container component already hosts the VideoCaptureComponent. We inject the settings store and add conditional rendering logic based on the EnableVideo setting.

</details>

---

<details open>
<summary><h2>🧪 Testing Strategy</h2></summary>

### Unit Tests

- [ ] VideoSettings domain model serializes/deserializes correctly
- [ ] VideoSettingsDto validation rules enforce constraints
- [ ] Settings mappers correctly transform VideoSettings ↔ VideoSettingsDto
- [ ] Video settings selectors return correct state values
- [ ] Settings form service integrates video settings correctly
- [ ] Video settings section component renders correctly
- [ ] Enable Video toggle control updates state correctly

### Integration Tests

- [ ] GetSettings endpoint returns video settings in response
- [ ] SaveSettings endpoint persists video settings to disk
- [ ] Settings store loads video settings from API on initialization
- [ ] Settings store saves video settings via infrastructure service
- [ ] Settings view displays video settings section correctly
- [ ] Video settings changes trigger auto-save behavior

### E2E Tests

- [ ] User can navigate to settings view and see video settings section
- [ ] User can toggle Enable Video setting on/off
- [ ] Enable Video toggle persists across page refreshes
- [ ] Video capture component appears/disappears based on Enable Video setting
- [ ] Disabling video capture properly cleans up media streams

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

- [ ] VideoSettings domain model exists in backend Core layer with EnableVideo property
- [ ] VideoSettings fully integrated into backend API (DTOs, validation, endpoints, mappers)
- [ ] OpenAPI spec and TypeScript API client include VideoSettingsDto
- [ ] Frontend domain model and infrastructure mapper handle VideoSettings
- [ ] Settings store manages VideoSettings state with actions/selectors
- [ ] Settings view displays video settings section with Enable Video toggle
- [ ] Video capture component conditionally renders based on EnableVideo setting
- [ ] All unit, integration, and E2E tests pass successfully
- [ ] Settings persistence works correctly (save/load from disk)
- [ ] No console errors or warnings in browser when toggling video settings
- [ ] Feature ready for production deployment

</details>

---

<details open>
<summary><h2>🎭 User Scenarios</h2></summary>

### Settings Management Scenarios

<details open>
<summary><strong>Scenario 1: User Accesses Video Settings for First Time</strong></summary>

```gherkin
Given the user opens the settings view
When the settings load from the backend
Then the video settings section is displayed with "Enable Video" toggle
And the "Enable Video" toggle is set to false (default)
```

</details>

<details open>
<summary><strong>Scenario 2: User Enables Video Capture</strong></summary>

```gherkin
Given the user is viewing the settings page
And the "Enable Video" toggle is currently disabled
When the user clicks the "Enable Video" toggle
Then the toggle switches to enabled state
And the settings auto-save to the backend
And the player view shows the video capture component
```

</details>

<details open>
<summary><strong>Scenario 3: User Disables Video Capture</strong></summary>

```gherkin
Given the user is viewing the settings page
And the "Enable Video" toggle is currently enabled
When the user clicks the "Enable Video" toggle
Then the toggle switches to disabled state
And the settings auto-save to the backend
And the video capture component is removed from the player view
And any active media streams are properly cleaned up
```

</details>

---

### Video Capture Component Integration Scenarios

<details open>
<summary><strong>Scenario 4: Video Capture Respects EnableVideo Setting on Page Load</strong></summary>

```gherkin
Given video settings have "Enable Video" set to true in saved settings
When the user navigates to the player view
Then the video capture component is visible
And the video capture component initializes with device enumeration
```

</details>

<details open>
<summary><strong>Scenario 5: Video Capture Hidden When Disabled</strong></summary>

```gherkin
Given video settings have "Enable Video" set to false in saved settings
When the user navigates to the player view
Then the video capture component is not rendered
And no video device enumeration occurs
```

</details>

<details open>
<summary><strong>Scenario 6: Settings Persist Across Sessions</strong></summary>

```gherkin
Given the user has enabled video capture
And the settings have been saved
When the user closes and reopens the application
Then the video settings load with "Enable Video" set to true
And the video capture component is visible in the player view
```

</details>

---

### Edge Cases and Error Handling

<details open>
<summary><strong>Scenario 7: Backend Returns Null VideoSettings</strong></summary>

```gherkin
Given the backend settings file is from an older version without VideoSettings
When the user loads settings
Then the frontend applies default VideoSettings (EnableVideo = false)
And the settings view displays the default state
```

</details>

<details open>
<summary><strong>Scenario 8: Settings Save Fails</strong></summary>

```gherkin
Given the user toggles the "Enable Video" setting
And the backend API is unavailable
When the auto-save attempt fails
Then an error alert is displayed to the user
And the settings revert to the last saved state
```

</details>

</details>

---

<details open>
<summary><h2>📚 Related Documentation</h2></summary>

- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)
- **API Client Generation**: [API_CLIENT_GENERATION.md](../../API_CLIENT_GENERATION.md)
- **Architecture Overview**: [OVERVIEW_CONTEXT.md](../../OVERVIEW_CONTEXT.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Domain Standards**: [DOMAIN_STANDARDS.md](../../DOMAIN_STANDARDS.md)

</details>

---

<details open>
<summary><h2>📝 Notes</h2></summary>

### Design Considerations

- **Minimal First Implementation**: Starting with a single boolean toggle keeps complexity low and validates the full-stack flow. Future video-related settings can be added incrementally without changing the architecture.

- **Clean Architecture Compliance**: This feature strictly follows Clean Architecture with domain models in Core, DTOs in API, and frontend layers properly separated (domain contracts, infrastructure services, application store, feature components).

- **Existing Patterns**: VideoSettings follows the exact pattern established by PlayerSettings, ConnectionSettings, and other settings groups, ensuring consistency and maintainability.

- **Resource Management**: Conditional rendering via `@if` (not CSS display:none) ensures proper cleanup of MediaStream resources when video capture is disabled, preventing resource leaks.

### Future Enhancement Ideas

- **Video Quality Settings**: Add resolution, frame rate, and bitrate controls
- **Device Selection Persistence**: Remember user's preferred video capture device
- **Recording Options**: Enable/disable recording, set recording directory
- **Multiple Video Sources**: Support multiple video capture devices simultaneously
- **Video Overlays**: Add title cards, timestamps, or device info overlays

### Summary of Open Questions

**Phase 1:**
- Default EnableVideo value (Recommendation: false)

**Phase 2:**
- Additional validation rules (Recommendation: Keep simple for MVP)

**Phase 3:**
- Domain model structure match (Recommendation: Match backend exactly)

**Phase 4:**
- Selector granularity (Recommendation: selectVideoSettings + selectEnableVideo)

**Phase 5:**
- UI placement in settings view (Recommendation: After Player Settings)

**Phase 6:**
- State cleanup strategy (Recommendation: Destroy component via @if)

</details>

---

**Document Version**: 1.0  
**Created**: November 25, 2025  
**Project Status**: Planning Complete - Ready for Phase 1 Execution
