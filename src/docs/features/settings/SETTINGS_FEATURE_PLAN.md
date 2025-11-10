# Settings Feature - High-Level Planning

**Project Overview**: Implement a comprehensive application settings feature that enables users to configure TeensyROM behavior across player preferences, file transfer automation, search customization, and application lifecycle. The feature provides a modern, card-based settings interface with reactive forms, auto-save functionality, and undo/redo capability. Settings are persisted to the backend and apply globally across all connected devices.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Store Testing**: [STORE_TESTING.md](../../STORE_TESTING.md)
- **Smart Component Testing**: [SMART_COMPONENT_TESTING.md](../../SMART_COMPONENT_TESTING.md)
- **Domain Standards**: [DOMAIN_STANDARDS.md](../../DOMAIN_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Service Standards**: [SERVICE_STANDARDS.md](../../SERVICE_STANDARDS.md)
- **NX Library Standards**: [NX_LIBRARY_STANDARDS.md](../../NX_LIBRARY_STANDARDS.md)
- **API Client Generation**: [API_CLIENT_GENERATION.md](../../API_CLIENT_GENERATION.md)
- **E2E Testing**: [../../apps/teensyrom-ui-e2e/E2E_TESTS.md](../../apps/teensyrom-ui-e2e/E2E_TESTS.md)

---

## 🎯 Project Objective

Create a unified settings management system that allows users to configure application-wide preferences for TeensyROM. Settings cover four key areas: player behavior (repeat mode, timers, startup actions), file transfer automation (watch folders, auto-launch), search customization (weights, stop words, filters), and application setup state. The feature delivers a modern, intuitive interface using card-based layouts with reactive forms that automatically save changes to the backend while maintaining full undo/redo history. Settings load during application bootstrap, ensuring preferences are available before any user interactions.

**User Value**: Users gain centralized control over TeensyROM behavior without navigating multiple screens or dialogs. The auto-save functionality eliminates "save button anxiety" while undo/redo provides safety to experiment with settings. The card-based layout organizes related settings logically, making configuration intuitive even for users unfamiliar with the application's capabilities. Settings persist across sessions and apply consistently to all connected devices, creating a predictable, personalized experience.

**System Benefits**: This feature establishes foundational patterns for application-wide configuration management that can be extended for future settings categories (including connection settings when needed). The reactive forms architecture demonstrates form decomposition patterns for complex UIs, while the auto-save + undo/redo system provides a model for other features requiring change tracking. The settings infrastructure (store, service, API integration) becomes a reference implementation for Clean Architecture principles in the codebase. Bootstrap integration ensures settings are available system-wide before user interactions begin.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: Backend API & Type Generation</h3></summary>

### Objective

Regenerate the TypeScript API client from existing backend endpoints to enable frontend integration. The backend GET and POST settings endpoints are already implemented and ready for use.

### Key Deliverables

- [ ] TypeScript API client regenerated with `SettingsApiService`
- [ ] Generated DTOs include all settings sections (Player, FileTransfer, Search, App)
- [ ] API client integration verified through manual API testing

### Existing Backend Endpoints

**GET `/settings`** - [GetSettingsEndpoint.cs](../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsEndpoint.cs)
- Returns all current user settings
- No request parameters required
- Always returns 200 OK with settings data

**POST `/settings`** - [SaveSettingsEndpoint.cs](../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsEndpoint.cs)
- Saves user settings to persistent storage
- Includes comprehensive validation for all settings sections
- Returns 200 OK on success, 400 Bad Request on validation errors, 500 on save failures

### High-Level Tasks

1. **Generate API Client**: Run `pnpm run generate:api-client` to create TypeScript client from OpenAPI spec
2. **Verify Type Generation**: Confirm all DTOs match backend models (PlayerSettingsDto, FileTransferSettingsDto, SearchSettingsDto, AppSettingsDto)
3. **Manual API Testing**: Use Postman/Scalar to verify GET returns defaults and POST persists changes
4. **Test Validation**: Verify validation errors return clear problem details (already tested in backend integration tests)

### Testing in This Phase

- Backend integration tests validate endpoint behavior (already complete in backend plan)
- Manual API testing confirms TypeScript client generation matches OpenAPI spec
- No frontend tests yet (no frontend code exists)

### Open Questions

- ❓ Should we version the settings API (e.g., `/v1/settings`) for future backward compatibility?
  - **Decision**: Start without versioning - can add in Phase 2 if breaking changes emerge

</details>

<details open>
<summary><h3>Phase 2: Domain Contracts & Infrastructure Layer</h3></summary>

### Objective

Define domain-layer contracts for settings services and implement infrastructure-layer service that communicates with the backend API. This establishes the architectural foundation following Clean Architecture principles.

### Key Deliverables

- [ ] `ISettingsService` contract defined in domain layer with clear service interface
- [ ] `SettingsService` implementation in infrastructure layer calls generated API client
- [ ] Domain mapper transforms API DTOs to domain models
- [ ] Settings domain models defined (mirroring backend structure but as domain types)
- [ ] Infrastructure service has comprehensive unit tests mocking API client
- [ ] Error handling translates API sucess and errors to user-friendly messages using the [Alert Service](../../../libs/app/src/lib/alert.service.ts)

### High-Level Tasks

1. **Define Domain Contract**: Create `ISettingsService` interface in `libs/domain/src/lib/contracts` with methods like `getSettings()` and `saveSettings()`
2. **Create Domain Models**: Define domain representations of settings in `libs/domain/src/lib/models` (e.g., `Settings`, `PlayerSettings`, `FileTransferSettings`, `SearchSettings`, `AppSettings`)
3. **Implement Infrastructure Service**: Create `SettingsService` in `libs/infrastructure/src/lib/settings` that implements domain contract
4. **Build Domain Mapper**: Create mapper to transform API DTOs ↔ domain models, handling nested structures
5. **Write Service Tests**: Unit test infrastructure service with mocked API client, covering success and error scenarios

### Testing in This Phase

- **Infrastructure Layer Tests**: Unit test `SettingsService` in isolation with mocked `SettingsApiService`
  - Test successful settings retrieval
  - Test successful settings save
  - Test error handling and user-friendly succes/error messages calls to [Alert Service](../../../libs/app/src/lib/alert.service.ts)
  - Test DTO-to-domain mapping correctness
- **Mapper Tests**: Verify bidirectional mapping (API DTOs ↔ domain models) handles all nested structures

### Open Questions

- ❓ Should domain models be immutable records or classes with methods?
  - **Decision**: Use TypeScript interfaces for domain models (simple data structures) - matches existing domain patterns

</details>

<details open>
<summary><h3>Phase 3: Application State & Store</h3></summary>

### Objective

Create application-layer state management for settings using NgRx Signal Store with separate actions and selectors. The store manages current settings, change history for undo/redo, loading states, and coordinates auto-save behavior.

### Key Deliverables

- [ ] `SettingsStore` created following Signal Store patterns with state interface
- [ ] Store actions handle load, save, undo, redo operations
- [ ] Store selectors provide granular access to settings sections and metadata
- [ ] Context service orchestrates store operations and debounced auto-save logic
- [ ] Change history tracked for undo/redo (snapshot-based approach)
- [ ] Store has behavioral tests verifying state transitions and command pattern

### High-Level Tasks

1. **Define Store State**: Create state interface with current settings, undo/redo stacks, loading/saving flags, error state, hasInitialized flag
2. **Implement Store Actions**: Build actions for loading settings, saving settings, undo, redo, and error handling
3. **Create Selectors**: Define selectors for entire settings, individual sections (player, fileTransfer, search, app), dirty state, can undo/redo flags, initialization status
4. **Build Context Service**: Create orchestration layer that calls infrastructure service and coordinates store updates
5. **Implement Command Pattern**: Track full settings snapshots in undo/redo stacks for each change
6. **Add Debounced Auto-Save**: Use RxJS operators to batch rapid changes before triggering backend save

### Testing in This Phase

- **Store Behavioral Tests**: Integrate real store with mocked infrastructure service
  - Test loading settings populates store state and sets hasInitialized flag
  - Test saving settings updates backend and store
  - Test undo reverts to previous snapshot and triggers save
  - Test redo advances to next snapshot and triggers save
  - Test undo/redo stack management (max size, boundaries)
  - Test error states surface correctly
  - Test auto-save debouncing (rapid changes trigger single save)
- **Context Service Tests**: Verify orchestration logic coordinates store and service correctly

### Open Questions

- ❓ What's the maximum undo history size (prevent unbounded memory growth)?
  - **Decision**: 50 snapshots - balances memory usage with practical undo depth

</details>

<details open>
<summary><h3>Phase 4: Bootstrap Integration</h3></summary>

### Objective

Integrate settings loading into application bootstrap process, ensuring settings are available before user interactions begin. This establishes settings as a first-class system concern alongside device discovery.

### Key Deliverables

- [ ] Settings store loads during app bootstrap initialization
- [ ] Bootstrap service waits for settings to initialize before resolving
- [ ] Error handling during bootstrap shows graceful degradation
- [ ] Settings available globally via store signals after bootstrap
- [ ] Bootstrap tests verify settings load correctly on app start

### High-Level Tasks

1. **Update Bootstrap Service**: Add settings store context injection to `AppBootstrapService`
2. **Load Settings on Init**: Call settings context service `loadSettings()` during bootstrap
3. **Wait for Initialization**: Use effect pattern (like device store) to wait for settings initialization signal
4. **Handle Bootstrap Errors**: If settings fail to load, log error but don't block app startup (store will use defaults)
5. **Test Bootstrap Flow**: Verify settings load before app becomes interactive

### Testing in This Phase

- **Bootstrap Service Tests**: Unit test bootstrap integration with mocked settings context
  - Test successful settings load sets initialized flag
  - Test bootstrap waits for settings initialization
  - Test bootstrap resolves after settings load
  - Test bootstrap handles settings load errors gracefully
- **Integration Tests**: Verify settings available after bootstrap
  - Test settings store populated after app init
  - Test settings signals emit values after bootstrap
  - Test app doesn't block on settings errors

### Open Questions

- ❓ Should app startup fail if settings can't load?
  - **Decision**: No - use default settings if load fails, the service will show a warning to the user, so don't worry about it and don't block.

</details>

<details open>
<summary><h3>Phase 5: Feature Library & Settings View Component</h3></summary>

### Objective

Create the settings feature library with the main view component that displays settings in a card-based layout. This phase establishes the visual structure and navigation integration without form interactivity yet.

### Key Deliverables

- [ ] Settings feature library created following Nx library standards linked at the top of the document.
- [ ] Settings view component displays all settings sections in card layouts
- [ ] Each section component (Player, FileTransfer, Search, App) wrapped in `lib-scaling-card` following Player View and Device View patterns for inspiration
- [ ] Navigation menu includes settings item with icon
- [ ] Routing configured for `/settings` path
- [ ] Component integrates with store to display current settings (read-only initially)
- [ ] Empty state handling when settings haven't loaded
- [ ] Loading and error states display appropriately

### High-Level Tasks

1. **Generate Feature Library**: Create `libs/features/settings` following Nx conventions listed at the top of the document.
2. **Create Settings View Component**: Build main component with card-based layout for each settings section (4 cards)
3. **Add Navigation**: Update navigation service with settings menu item (icon: `settings`)
4. **Configure Routing**: Add `/settings` route with lazy-loaded settings component
5. **Display Settings Data**: Connect component to store signals to show current settings values

### Testing in This Phase

- **Component Tests**: Unit test settings view component with mocked store
  - Test renders all 4 settings sections when loaded
  - Test shows loading state during initial load
  - Test shows error message on load failure
  - Test navigation integration (menu click routes to settings)
- **E2E Tests**: Add settings navigation smoke test
  - Test clicking settings menu item navigates to `/settings`
  - Test settings page displays with all sections visible

### Open Questions

- ❓ Should settings page have a title/header describing its purpose?
  - **Decision**: Yes -- Follow the Player View pattern with a header "Application Settings".

</details>

<details open>
<summary><h3>Phase 6: Reactive Forms & Section Components</h3></summary>

### Objective

Implement reactive forms architecture with decomposed section components. Each settings section (Player, FileTransfer, Search, App) becomes a child component receiving its FormGroup as input, creating a clean hierarchy for form management.

### Key Deliverables

- [ ] Main settings view component builds root FormGroup with nested section groups
- [ ] Section components created for each settings area (4 components: Player, FileTransfer, Search, App)
- [ ] Sub-section component created for complex nested settings (SearchWeights)
- [ ] FormGroups passed down component hierarchy as inputs
- [ ] Form controls bound to settings values from store
- [ ] Form validation integrated using Angular validators
- [ ] Dirty state tracking per section and globally

### High-Level Tasks

1. **Build Root Form**: Create FormGroup in settings view with nested groups for each section
2. **Create Section Components**: Build components for Player, FileTransfer, Search, App settings
3. **Create Sub-Section Component**: Build SearchWeights component for nested search settings
4. **Pass FormGroups Down**: Use component inputs to pass section FormGroups to child components
5. **Bind Form Controls**: Connect form controls to Material form fields (inputs, selects, checkboxes, sliders)
6. **Add Validation**: Apply validators (required, min/max, pattern) matching backend validation rules
7. **Track Dirty State**: Use form dirty state to show unsaved changes indicator

### Testing in This Phase

- **Component Tests**: Unit test each section component with mocked FormGroup
  - Test form controls render with initial values
  - Test form validation triggers on invalid input
  - Test dirty state updates when user changes values
- **Integration Tests**: Test full form hierarchy with real FormGroups
  - Test parent form updates when child section changes
  - Test validation propagates from children to parent
  - Test form reset clears all sections

### Open Questions

- ❓ Should validation errors show inline or in a summary at the top?
  - **Decision**: Inline validation (Material Design standard) with error messages below each field

</details>

<details open>
<summary><h3>Phase 7: Auto-Save Functionality</h3></summary>

### Objective

Implement debounced auto-save that persists form changes to the backend after user stops typing. Changes trigger store updates which save to the backend via the infrastructure service, with visual feedback during save operations.

### Key Deliverables

- [ ] Form value changes stream to store through context service
- [ ] Debounced auto-save triggers backend save after 500ms idle time
- [ ] Save status indicator shows "Saving..." and "Saved" states
- [ ] Error handling displays failures without losing user changes
- [ ] Save operation adds snapshot to undo stack
- [ ] Optimistic UI updates (form stays responsive during save)

### High-Level Tasks

1. **Wire Form Changes**: Subscribe to form `valueChanges` observable in settings view component
2. **Debounce Changes**: Use RxJS `debounceTime(500)` to batch rapid changes
3. **Trigger Store Save**: Call context service `saveSettings()` with current form values
4. **Update UI State**: Show save status indicator (icon + text) based on store saving/saved signals
5. **Handle Save Errors**: Display error alert without discarding form values, allow retry
6. **Add to Undo Stack**: Store successful saves as snapshots in undo history

### Testing in This Phase

- **Store Tests**: Behavioral tests for auto-save logic
  - Test rapid form changes trigger single debounced save
  - Test successful save adds snapshot to undo stack
  - Test failed save preserves form state and shows error
  - Test undo after auto-save reverts to previous state
- **Component Tests**: Test save status indicator updates
  - Test indicator shows "Saving..." during save operation
  - Test indicator shows "Saved" with checkmark on success
  - Test indicator shows error state on failure
- **E2E Tests**: End-to-end auto-save workflow
  - Test changing setting triggers auto-save after delay
  - Test rapid changes result in single save
  - Test save persists across page refresh

### Open Questions

- ❓ Should we show a toast notification on successful save or is the indicator enough?
  - **Decision**: Service is handling error/success alerts.

</details>

<details open>
<summary><h3>Phase 8: Undo/Redo Functionality</h3></summary>

### Objective

Implement undo/redo capability that allows users to revert and reapply settings changes. Each undo/redo operation updates the form, triggers auto-save, and provides visual feedback about command history position.

### Key Deliverables

- [ ] Undo button reverts to previous settings snapshot
- [ ] Redo button advances to next settings snapshot
- [ ] Undo/redo operations update form values reactively
- [ ] Each undo/redo triggers debounced auto-save
- [ ] Buttons disabled when at stack boundaries (can't undo/redo further)
- [ ] Keyboard shortcuts for undo (Ctrl+Z) and redo (Ctrl+Y / Ctrl+Shift+Z)
- [ ] History position indicator shows current state in timeline

### High-Level Tasks

1. **Add Undo/Redo Buttons**: Create toolbar with Material icon buttons for undo/redo
2. **Wire Button Actions**: Connect buttons to context service undo/redo methods
3. **Update Form on Undo/Redo**: Patch form values when store state changes after undo/redo
4. **Disable Buttons**: Bind button disabled state to store selectors (canUndo, canRedo)
5. **Add Keyboard Shortcuts**: Implement HostListener for Ctrl+Z and Ctrl+Y combinations
6. **Show History Position**: Display indicator like "3 of 10 changes" showing position in history

### Testing in This Phase

- **Store Tests**: Behavioral tests for undo/redo logic
  - Test undo reverts to previous snapshot
  - Test redo advances to next snapshot
  - Test undo at stack beginning does nothing
  - Test redo at stack end does nothing
  - Test new changes after undo clear redo stack
- **Component Tests**: Test undo/redo UI interactions
  - Test undo button disabled when can't undo
  - Test redo button disabled when can't redo
  - Test keyboard shortcuts trigger undo/redo
  - Test form updates when undo/redo executes
- **E2E Tests**: End-to-end undo/redo workflow
  - Test make change, undo reverts change, redo reapplies change
  - Test multiple undo operations walk back through history
  - Test undo/redo both trigger auto-save

### Open Questions

- ❓ Should undo/redo history show change descriptions (e.g., "Changed Player repeat mode")?
  - **Decision**: Phase 9 enhancement - start with simple position indicator

</details>

<details open>
<summary><h3>Phase 9: Polish & Complete E2E Tests</h3></summary>

### Objective

Add final polish to the settings UI, implement comprehensive E2E test coverage, and address any UX refinements discovered during development. This phase ensures production-readiness and thorough validation of all user workflows.

### Key Deliverables

- [ ] Complete E2E test suite covering all settings workflows
- [ ] Accessibility improvements (ARIA labels, keyboard navigation, screen reader support)
- [ ] Responsive design adjustments for mobile/tablet viewports
- [ ] Loading skeletons for better perceived performance
- [ ] Settings page help text/tooltips explaining complex options
- [ ] Performance optimization (form change detection, render optimization)
- [ ] Documentation updates (user guide, architecture docs)
- [ ] "Reset to Defaults" button with confirmation dialog

### High-Level Tasks

1. **Build E2E Test Suite**: Create comprehensive Cypress tests with fixtures and interceptors
   - Settings page navigation and load
   - Form interaction and validation
   - Auto-save behavior
   - Undo/redo workflows
   - Error handling
   - Cross-section settings changes
   - **Endpoint Interceptors**: Mock backend API calls to:
     - GET `/settings` - [GetSettingsEndpoint.cs](../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/GetSettings/GetSettingsEndpoint.cs)
     - POST `/settings` - [SaveSettingsEndpoint.cs](../../../apps/api/src/TeensyRom.Api/Endpoints/Settings/SaveSettings/SaveSettingsEndpoint.cs)
2. **Improve Accessibility**: Add ARIA labels, ensure keyboard navigation works, test with screen readers
3. **Responsive Design**: Test and adjust layouts for mobile/tablet, ensure form usability on small screens
4. **Add Loading Skeletons**: Replace spinners with skeleton screens for each settings section
5. **Add Help Content**: Tooltips or info icons explaining complex settings (e.g., search weights, file transfer paths)
6. **Optimize Performance**: Reduce unnecessary re-renders, optimize form change detection, lazy-load heavy components
7. **Add Reset to Defaults**: Toolbar button that resets all settings to factory defaults with confirmation
8. **Update Documentation**: Add settings feature to user documentation and architecture overview

### Testing in This Phase

- **E2E Test Coverage**: Comprehensive end-to-end tests
  - **Navigation**: Test all entry points to settings page
  - **Load Settings**: Test settings load from backend on page init
  - **Form Interaction**: Test changing each settings section
  - **Validation**: Test validation errors for invalid inputs
  - **Auto-Save**: Test changes auto-save after debounce period
  - **Undo/Redo**: Test full undo/redo workflows
  - **Error Handling**: Test network errors, validation errors, save failures
  - **Persistence**: Test settings persist across page refresh
  - **Cross-Section Changes**: Test changing multiple sections in single session
  - **Reset to Defaults**: Test reset functionality with confirmation
- **Accessibility Testing**: Manual testing with keyboard navigation and screen readers
- **Performance Testing**: Measure form interaction responsiveness, optimize if needed

### Open Questions

- ❓ Should reset to defaults also clear undo history?
  - **Decision**: Yes - reset is a fresh start, clear all history.  This should trigger a save.

</details>

---

## 🏗️ Architecture Overview

### Clean Architecture Layer Responsibilities

This feature follows Clean Architecture principles with clear separation of concerns across layers:

**Domain Layer** (`libs/domain`):
- `ISettingsService` contract defines service interface for loading and saving settings
- Settings domain models (interfaces) represent application settings structure
- Four main settings models: `PlayerSettings`, `FileTransferSettings`, `SearchSettings`, `AppSettings`
- Injection token (`SETTINGS_SERVICE`) for dependency inversion
- No implementation details - pure contracts and data structures

**Infrastructure Layer** (`libs/infrastructure`):
- `SettingsService` implements `ISettingsService` contract
- Calls generated `SettingsApiService` from API client library
- Domain mapper transforms API DTOs ↔ domain models
- Error handling translates API errors to user-friendly messages
- Unit tested in isolation with mocked API client

**Application Layer** (`libs/application`):
- `SettingsStore` manages settings state using NgRx Signal Store
- Store actions handle load, save, undo, redo operations
- Store selectors provide reactive access to settings sections (player, fileTransfer, search, app) and metadata
- `SettingsContextService` orchestrates store and infrastructure service
- Context service implements debounced auto-save and command pattern
- Behavioral tests integrate real store with mocked infrastructure

**App Layer** (`libs/app/bootstrap`):
- `AppBootstrapService` coordinates application initialization
- Loads settings during bootstrap alongside device discovery
- Ensures settings available before user interactions
- Graceful error handling (use defaults if load fails)

**Features Layer** (`libs/features/settings`):
- `SettingsViewComponent` is smart component managing root reactive form
- Four section components (Player, FileTransfer, Search, App) receive FormGroups as inputs
- One sub-section component (SearchWeights) handles nested search configuration
- Components subscribe to store signals for settings values and status
- Components call context service for user actions (load, save, undo, redo)
- Unit tested with mocked store and context service

### Settings Structure

The settings domain models mirror the backend structure (minus ConnectionSettings):

```
Settings
├── PlayerSettings
│   ├── RepeatModeOnStartup (boolean)
│   ├── PlayTimerEnabled (boolean)
│   ├── MuteFastForward (boolean)
│   ├── MuteRandomSeek (boolean)
│   ├── StartupFilter (enum: All, Games, Music, Images)
│   ├── StartupLaunchEnabled (boolean)
│   └── StartupLaunchRandom (boolean)
├── FileTransferSettings
│   ├── WatchDirectoryLocation (string path)
│   ├── AutoTransferPath (string path)
│   ├── AutoFileCopyEnabled (boolean)
│   ├── AutoLaunchOnCopyEnabled (boolean)
│   ├── NavToDirOnLaunch (boolean)
│   └── SyncFilesEnabled (boolean)
├── SearchSettings
│   ├── SearchWeights (nested object)
│   │   ├── Title (number)
│   │   ├── FileName (number)
│   │   ├── FilePath (number)
│   │   ├── Creator (number)
│   │   └── Description (number)
│   ├── SearchStopWords (string array)
│   ├── BannedDirectories (string array)
│   └── BannedFiles (string array)
└── AppSettings
    └── FirstTimeSetup (boolean)
```

### State Flow & Data Architecture

**Bootstrap Settings Flow**:
1. Application starts, `AppBootstrapService` initializes
2. Bootstrap service calls settings context `loadSettings()`
3. Context service calls infrastructure service `getSettings()`
4. Infrastructure service calls API client, maps DTOs to domain models
5. Context service updates store with loaded settings, sets `hasInitialized` flag
6. Bootstrap service waits for `hasInitialized` signal via effect
7. Bootstrap resolves, app becomes interactive with settings available

**Loading Settings Flow** (user navigation):
1. User navigates to `/settings` route
2. Settings view component checks store initialization status
3. If not initialized, display loading state
4. Store emits settings through signals
5. Components reactively update form and display

**Saving Settings Flow**:
1. User changes form value (types, selects, toggles)
2. Form `valueChanges` observable emits new values
3. Settings view component debounces changes (500ms)
4. Component calls context service `saveSettings(newValues)`
5. Context service updates store (optimistic update, set saving flag)
6. Context service calls infrastructure service `saveSettings()`
7. Infrastructure service calls API client, maps domain to DTOs
8. On success: store updates saved state, adds snapshot to undo stack
9. On failure: store updates error state, form retains user values

**Undo/Redo Flow**:
1. User clicks undo button or presses Ctrl+Z
2. Component calls context service `undo()`
3. Context service pops previous snapshot from undo stack
4. Store updates current settings to previous snapshot
5. Component patches form values to match new store state
6. Debounced auto-save triggers backend save (undo persists)
7. Redo follows similar pattern using redo stack

### Form Architecture

The reactive forms follow a two-to-three-level hierarchy with `FormGroup` passing:

```
SettingsViewComponent (root FormGroup)
├── PlayerSettingsComponent (playerFormGroup)
├── FileTransferSettingsComponent (fileTransferFormGroup)
├── SearchSettingsComponent (searchFormGroup)
│   └── SearchWeightsComponent (weightsFormGroup)
└── AppSettingsComponent (appFormGroup)
```

**Parent → Child Communication**:
- Parent creates FormGroup for each section
- Parent passes section FormGroup as `@Input()` to child components
- Children render form controls bound to their FormGroup
- Children emit events for complex interactions (not form changes)
- Form value changes bubble up through FormGroup hierarchy automatically

**Benefits**:
- Clear component boundaries and responsibilities
- Reusable section components (testable in isolation)
- Type-safe form structure (mirrors domain models)
- Automatic validation aggregation from children to parent
- Simple testing (mock FormGroup inputs)
- Only one sub-section needed (SearchWeights) - simpler than originally planned

### Auto-Save & Undo/Redo Architecture

**Debounced Auto-Save Pattern**:
- Form `valueChanges` observable uses RxJS `debounceTime(500)`
- Rapid changes (user typing) batch into single save operation
- Reduces backend load while maintaining auto-save UX
- Save indicator shows "Saving..." → "Saved" transitions

**Command Pattern for Undo/Redo**:
- Store maintains two stacks: `undoStack` and `redoStack`
- Each successful save creates snapshot and pushes to undo stack
- Undo pops from undo stack, pushes to redo stack, applies snapshot
- Redo pops from redo stack, pushes back to undo stack, applies snapshot
- New changes after undo clear redo stack (standard undo behavior)
- Maximum stack size (50 snapshots) prevents unbounded memory growth

**Why Snapshot-Based Approach**:
- Simpler than command objects (no "reverse" logic needed)
- Settings objects are small (minimal memory overhead)
- Entire state can be reverted/reapplied atomically
- Easier to reason about and test
- Matches Redux/NgRx patterns familiar to team

### Bootstrap Integration Architecture

**Bootstrap Service Pattern**:
- Follows existing pattern established by device discovery
- Uses Angular effect to wait for store initialization signal
- Settings loading happens in parallel with device discovery
- Both must complete before app resolves bootstrap

**Error Handling Strategy**:
- Settings load failure doesn't block app startup
- Store uses sensible defaults if load fails
- Warning alert shown to user (settings unavailable)
- User can manually retry from settings page
- Graceful degradation maintains app functionality

**Why Bootstrap Integration**:
- Settings needed globally across all features
- Prevents race conditions (settings available before use)
- Consistent initialization pattern (like device store)
- Clean separation (bootstrap orchestrates, store manages state)

### API Integration Architecture

**Generated API Client**:
- OpenAPI spec generated at .NET build time
- TypeScript client generated via OpenAPI Generator
- `SettingsApiService` provides type-safe HTTP methods
- DTOs automatically generated matching backend models (4 sections)

**Domain Mapping Strategy**:
- API DTOs use primitive types (string, number, boolean)
- Domain models use semantic types where beneficial
- Mapper handles bidirectional transformation
- Validation happens at backend (frontend mirrors rules)

**Error Handling Strategy**:
- API errors caught in infrastructure service
- Transformed to user-friendly messages via error utilities
- Alert service displays errors to user
- Store captures error state for UI feedback
- Form retains user values on save failure (no data loss)

---

## 🧪 Testing Strategy

### Testing by Architectural Layer

**Domain Layer**:
- No tests needed (contracts and interfaces don't have logic)
- Domain models are simple TypeScript interfaces

**Infrastructure Layer** (Unit Tests):
- Test `SettingsService` with mocked `SettingsApiService`
- Verify successful API calls map to domain models correctly
- Verify API errors transform to user-friendly messages
- Test domain mapper bidirectional transformations
- Mock API client responses using Vitest

**Application Layer** (Behavioral Tests):
- Test store + context service integration with mocked infrastructure
- Verify loading settings populates store state and sets initialized flag
- Verify saving settings updates backend and store
- Verify undo/redo command pattern (stacks, boundaries, snapshots)
- Verify auto-save debouncing (rapid changes → single save)
- Verify error handling surfaced correctly
- Use real `SettingsStore` and `SettingsContextService`, mock `ISettingsService`

**App Layer** (Bootstrap Tests):
- Test `AppBootstrapService` with mocked settings context
- Verify settings load during bootstrap
- Verify bootstrap waits for initialization signal
- Verify bootstrap resolves after settings ready
- Verify graceful error handling (defaults used on failure)

**Features Layer** (Unit Tests):
- Test components with mocked store and context service
- Verify form controls render with store values
- Verify form validation triggers appropriately
- Verify user interactions call context service methods
- Verify loading/error states display correctly
- Mock store signals using Vitest

**E2E Layer** (Integration Tests):
- Test complete user workflows end-to-end
- Use Cypress with fixture-driven interceptors
- Mock backend API responses (no real backend)
- Test navigation, form interaction, auto-save, undo/redo
- Test error scenarios and edge cases
- Verify settings persist across page refresh

### Test Coverage by Phase

- **Phase 1**: Backend integration tests (in backend codebase)
- **Phase 2**: Infrastructure service unit tests, mapper tests
- **Phase 3**: Store behavioral tests, context service tests
- **Phase 4**: Bootstrap service tests, initialization tests
- **Phase 5**: Component unit tests, E2E navigation test
- **Phase 6**: Section component tests, form integration tests
- **Phase 7**: Auto-save behavior tests, save status tests
- **Phase 8**: Undo/redo workflow tests, keyboard shortcut tests
- **Phase 9**: Comprehensive E2E test suite, accessibility testing

### Behavioral Testing Focus

Following `TESTING_STANDARDS.md`, tests focus on **observable behaviors** not implementation:

✅ **Test behaviors**:
- Settings load and display in UI
- Settings available after bootstrap
- Form changes trigger auto-save after debounce
- Undo reverts to previous settings
- Validation errors prevent invalid saves
- Settings persist across page refresh

❌ **Don't test internals**:
- Store action implementations
- Form control creation logic
- RxJS operator chains
- Component lifecycle methods
- Private helper functions

---

## 📖 Given-When-Then Scenarios

<details open>
<summary><h3>Bootstrap & Initialization</h3></summary>

---

<details open>
<summary><strong>Scenario 1: Application starts and loads settings</strong></summary>

```gherkin
Given the user launches the application
When the bootstrap process initializes
Then settings are loaded from the backend
And the settings store is populated
And the bootstrap process waits for settings initialization
And after settings load, the app becomes interactive
```

</details>

<details open>
<summary><strong>Scenario 2: Settings load fails during bootstrap</strong></summary>

```gherkin
Given the user launches the application
When the bootstrap process attempts to load settings
And the backend API is unavailable
Then the settings store uses default values
And a warning alert displays to the user
And the app continues to initialize (doesn't block)
And the user can manually retry loading settings later
```

</details>

</details>

---

<details open>
<summary><h3>Settings Loading & Display</h3></summary>

---

<details open>
<summary><strong>Scenario 3: User navigates to settings for first time</strong></summary>

```gherkin
Given the user has launched the app successfully
And settings loaded during bootstrap
When the user clicks "Settings" in the navigation menu
Then the app navigates to /settings route
And the settings page displays loaded settings values
And all 4 settings sections display in card layouts
And form fields show current values
```

</details>

<details open>
<summary><strong>Scenario 4: Settings failed to load, user visits settings page</strong></summary>

```gherkin
Given settings failed to load during bootstrap
When the user navigates to /settings
Then the settings page shows a "load failed" message
And a retry button is available
And clicking retry attempts to reload settings
```

</details>

<details open>
<summary><strong>Scenario 5: User returns to settings page</strong></summary>

```gherkin
Given the user previously saved custom settings
When the user navigates to /settings again
Then the settings page displays saved settings
And form fields display previously saved values
And no "unsaved changes" indicator appears
```

</details>

</details>

---

<details open>
<summary><h3>Form Interaction & Validation</h3></summary>

---

<details open>
<summary><strong>Scenario 6: User changes a simple setting</strong></summary>

```gherkin
Given the user is viewing the settings page
When the user toggles "Repeat Mode on Startup" checkbox
Then the form marks that field as dirty
And the change is added to the form's value changes stream
And the auto-save timer starts (500ms debounce)
```

</details>

<details open>
<summary><strong>Scenario 7: User enters invalid value</strong></summary>

```gherkin
Given the user is editing search weight settings
When the user enters a negative weight value
Then the form control shows validation error
And the error message displays below the field
And the save operation is blocked until fixed
```

</details>

<details open>
<summary><strong>Scenario 8: User modifies search weights</strong></summary>

```gherkin
Given the user is viewing search settings
When the user adjusts title weight slider to 1.5
And adjusts description weight to 0.8
Then both changes are captured in the form
And validation ensures weights are non-negative
And the auto-save timer batches both changes
```

</details>

</details>

---

<details open>
<summary><h3>Auto-Save Functionality</h3></summary>

---

<details open>
<summary><strong>Scenario 9: User makes single change</strong></summary>

```gherkin
Given the user is viewing player settings
When the user toggles "Play Timer Enabled" checkbox
And waits 500ms without making other changes
Then the settings auto-save to the backend
And the save status indicator shows "Saving..."
And after save completes, indicator shows "Saved" with checkmark
```

</details>

<details open>
<summary><strong>Scenario 10: User makes rapid changes (debouncing)</strong></summary>

```gherkin
Given the user is editing search weights
When the user adjusts "Title weight" slider to 0.8
And within 500ms adjusts "Description weight" slider to 0.5
And within 500ms adjusts "Creator weight" slider to 0.3
Then only one save operation triggers (after final change + 500ms)
And all three changes are included in the single save
```

</details>

<details open>
<summary><strong>Scenario 11: Auto-save fails</strong></summary>

```gherkin
Given the user makes a change to player settings
When the auto-save triggers but backend returns error
Then the save status indicator shows error state
And an error alert displays to the user
And the form retains the user's unsaved changes
And the user can retry the save operation
```

</details>

</details>

---

<details open>
<summary><h3>Undo/Redo Functionality</h3></summary>

---

<details open>
<summary><strong>Scenario 12: User undoes recent change</strong></summary>

```gherkin
Given the user changed "Repeat Mode" from off to on
And the change auto-saved successfully
When the user clicks the undo button
Then the "Repeat Mode" reverts to off
And the form updates to show previous value
And the change auto-saves (persisting undo)
And the redo button becomes enabled
```

</details>

<details open>
<summary><strong>Scenario 13: User undoes multiple times</strong></summary>

```gherkin
Given the user made 5 changes to various settings
When the user clicks undo 3 times
Then the form reverts through the last 3 changes in reverse order
And each undo triggers an auto-save
And the undo button remains enabled (2 more undos available)
And the redo button allows re-applying the 3 undone changes
```

</details>

<details open>
<summary><strong>Scenario 14: User makes change after undo</strong></summary>

```gherkin
Given the user undid the last 2 changes
And the redo stack contains those 2 changes
When the user makes a new change to any setting
Then the redo stack is cleared (can't redo after new change)
And the redo button becomes disabled
And the new change becomes the latest undo point
```

</details>

<details open>
<summary><strong>Scenario 15: User uses keyboard shortcuts</strong></summary>

```gherkin
Given the user is viewing the settings page
When the user presses Ctrl+Z
Then the last change is undone
When the user presses Ctrl+Y
Then the undone change is reapplied
```

</details>

<details open>
<summary><strong>Scenario 16: Undo at stack boundary</strong></summary>

```gherkin
Given the user has undone all available changes
And is viewing the original settings state
When the user clicks the undo button
Then nothing happens (can't undo further)
And the undo button remains disabled
```

</details>

</details>

---

<details open>
<summary><h3>Complex Workflow Scenarios</h3></summary>

---

<details open>
<summary><strong>Scenario 17: User configures multiple settings sections</strong></summary>

```gherkin
Given the user is viewing the settings page
When the user toggles player "Startup Launch Random" to on
And sets file transfer "Watch Directory" to "C:\Downloads"
And adjusts search "Title weight" to 1.2
Then each change triggers independent auto-save
And all changes persist to backend
And undo stack contains all changes in order
```

</details>

<details open>
<summary><strong>Scenario 18: Settings persist across sessions</strong></summary>

```gherkin
Given the user configured custom settings
And all changes auto-saved successfully
When the user closes the browser
And reopens the application later
And the app bootstraps
Then settings load with previously saved values
And navigating to /settings shows the same values
```

</details>

<details open>
<summary><strong>Scenario 19: User resets to defaults</strong></summary>

```gherkin
Given the user has customized many settings
When the user clicks "Reset to Defaults" button
And confirms the action in the dialog
Then all settings revert to factory defaults
And the change auto-saves to backend
And undo history is cleared (fresh start)
```

</details>

</details>

---

<details open>
<summary><h3>Accessibility & Responsive Design</h3></summary>

---

<details open>
<summary><strong>Scenario 20: Keyboard navigation</strong></summary>

```gherkin
Given the user is viewing settings page
When the user navigates using Tab key
Then focus moves through form fields in logical order
And all interactive elements are keyboard accessible
And pressing Enter on checkboxes toggles them
And pressing Space on buttons activates them
```

</details>

<details open>
<summary><strong>Scenario 21: Screen reader usage</strong></summary>

```gherkin
Given a screen reader user is viewing settings
When the screen reader reads each form field
Then each field has descriptive ARIA label
And validation errors are announced
And save status changes are announced
And section headings create logical navigation structure
```

</details>

<details open>
<summary><strong>Scenario 22: Mobile viewport</strong></summary>

```gherkin
Given the user views settings on mobile device
When the settings page loads
Then cards stack vertically for mobile layout
And form fields resize for touch input
And all interactive elements are touch-friendly
And scrolling works smoothly through all sections
```

</details>

</details>

---

## ✅ Success Criteria

### Functional Requirements

- [ ] **Bootstrap Integration**: Settings load during app initialization before user interactions
- [ ] **Settings Load**: Application loads settings from backend on settings page navigation
- [ ] **Settings Display**: All 4 settings sections display in card-based layouts with correct values
- [ ] **Form Interaction**: Users can modify all settings through intuitive form controls
- [ ] **Validation**: Invalid inputs show clear error messages and prevent saves
- [ ] **Auto-Save**: Changes automatically save to backend after 500ms idle time
- [ ] **Save Feedback**: Visual indicators show save status (Saving → Saved → Error states)
- [ ] **Undo**: Users can revert settings changes through undo button or Ctrl+Z
- [ ] **Redo**: Users can reapply undone changes through redo button or Ctrl+Y
- [ ] **Persistence**: Settings persist across browser sessions and page refreshes
- [ ] **Error Handling**: Network errors display user-friendly messages with retry options
- [ ] **Bootstrap Error Handling**: Bootstrap failures use defaults and show warning
- [ ] **Navigation**: Settings page accessible via navigation menu item
- [ ] **Routing**: Settings page accessible at `/settings` route
- [ ] **Keyboard Support**: All functionality accessible via keyboard shortcuts
- [ ] **Responsive Design**: Settings page adapts to mobile and tablet viewports
- [ ] **Reset to Defaults**: Users can restore factory settings with confirmation

### Non-Functional Requirements

- [ ] **Performance**: Form interactions feel responsive (< 100ms response time)
- [ ] **Bootstrap Speed**: Settings load doesn't significantly delay app startup
- [ ] **Debouncing**: Rapid changes batch into single save (reduce backend load)
- [ ] **Memory Management**: Undo history capped at 50 snapshots (prevent unbounded growth)
- [ ] **Accessibility**: WCAG 2.1 AA compliance (keyboard navigation, screen readers, ARIA labels)
- [ ] **Type Safety**: End-to-end type safety from API DTOs through store to UI components
- [ ] **Test Coverage**: >90% code coverage across all layers (infrastructure, application, app, features)
- [ ] **E2E Coverage**: Complete user workflow coverage in Cypress tests
- [ ] **Clean Architecture**: Clear layer separation with dependency inversion
- [ ] **Code Consistency**: Follows all project coding standards and conventions
- [ ] **Documentation**: Architecture documented, user guide created, inline comments where needed

### User Experience Criteria

- [ ] **Immediate Availability**: Settings loaded and available when app becomes interactive
- [ ] **Intuitive Layout**: Settings organized logically by category (clear mental model)
- [ ] **Visual Clarity**: Card-based design provides clear section boundaries
- [ ] **Save Confidence**: Auto-save eliminates "save button anxiety"
- [ ] **Safety Net**: Undo/redo allows experimentation without fear
- [ ] **Clear Feedback**: Loading, saving, and error states always visible
- [ ] **Fast Interaction**: No perceptible lag when changing settings
- [ ] **Help Available**: Tooltips or help text explain complex options
- [ ] **Consistent Design**: Matches existing application visual language
- [ ] **Mobile Friendly**: Usable on smartphones and tablets
- [ ] **Error Recovery**: Clear paths to recover from validation or network errors

---

## 📝 Notes

### Design Considerations

- **Simplified Settings Structure**: Removed ConnectionSettings reduces complexity - only 4 sections instead of 5. Future enhancement can add connection settings when networking features expand.

- **Bootstrap Integration Pattern**: Following device discovery pattern establishes consistency in application initialization. Settings and device state both load in parallel, both required before app becomes interactive.

- **Global vs Device Settings**: Current implementation treats settings as global (application-wide). Future enhancement could add per-device overrides if users request it. The architecture supports this (add deviceId context to store) but YAGNI principle applies for MVP.

- **Undo Stack Size**: 50 snapshots balances memory usage with practical undo depth. Average settings object ~1.5KB (4 sections), max memory ~75KB for undo history. Can tune based on real-world usage patterns.

- **Debounce Timing**: 500ms debounce balances responsiveness with backend efficiency. Too short (< 300ms) causes excessive saves during typing. Too long (> 1s) feels unresponsive. Can make configurable if needed.

- **Validation Strategy**: Frontend mirrors backend validation rules for immediate feedback. Backend remains source of truth for data integrity. This prevents invalid data from reaching persistence layer while providing good UX.

- **Form Architecture Trade-offs**: Two-to-three-level component hierarchy (only SearchWeights needs sub-component) provides reusability without over-engineering. Alternative flat approach would be simpler but harder to test and reuse.

- **Snapshot vs Command Pattern**: Snapshot-based undo/redo simpler than command objects (no reverse operations needed). Settings objects are small (~1.5KB) making memory overhead negligible. Alternative command pattern would be more memory-efficient but significantly more complex to implement and test.

### Future Enhancement Ideas

- **Connection Settings Integration**: Add back connection settings when networking features are implemented (TCP/Serial configuration)
- **Settings Import/Export**: Allow users to export settings JSON and import on different machines
- **Settings Presets**: Provide "Recommended", "Performance", "Quality" preset configurations
- **Search within Settings**: Add search bar to filter settings by keyword
- **Settings Categories Collapse**: Allow collapsing card sections user doesn't frequently modify
- **Change History View**: Visual timeline showing all settings changes with timestamps
- **Per-Device Settings**: Override global settings for specific devices
- **Settings Sync**: Cloud sync settings across multiple installations
- **Advanced Mode Toggle**: Hide advanced/dangerous settings behind toggle for beginners
- **Validation Hints**: Real-time hints as user types (e.g., "Valid path format")
- **Keyboard Shortcuts Customization**: Let users customize undo/redo keyboard shortcuts

### Architecture Evolution Notes

- **Phase 4 Addition**: Bootstrap integration added as new phase between store creation and UI development. This ensures settings available before any feature needs them.

- **Simplified Component Tree**: Removing ConnectionSettings reduces component count from 7 to 5 (SettingsView + 4 sections + SearchWeights). Less complexity, faster implementation.

- **Bootstrap Dependencies**: Settings store must initialize before device features that might depend on settings (like player startup configuration). Bootstrap service coordinates this dependency.

### Open Questions Summary

**Phase 1**:
- ❓ Should we version the settings API?
  - **Decision**: No versioning initially - add if breaking changes emerge

**Phase 2**:
- ❓ Domain models as interfaces or classes?
  - **Decision**: TypeScript interfaces (matches existing patterns)

**Phase 3**:
- ❓ Maximum undo history size?
  - **Decision**: 50 snapshots (balances memory with usability)

**Phase 4**:
- ❓ Should app startup fail if settings can't load?
  - **Decision**: No - use defaults, show warning, allow manual retry

**Phase 5**:
- ❓ Settings page title/header?
  - **Decision**: "Application Settings" with subtitle

**Phase 6**:
- ❓ Inline vs summary validation errors?
  - **Decision**: Inline (Material Design standard)

**Phase 7**:
- ❓ Toast notification on save?
  - **Decision**: Indicator only (toasts too noisy)

**Phase 8**:
- ❓ Show change descriptions in history?
  - **Decision**: Phase 9 enhancement (start simple)

**Phase 9**:
- ❓ Reset to defaults clear history?
  - **Decision**: Yes - reset is fresh start

---

## 📚 Related Documentation

- **Backend Implementation**: [BASIC_SETTINGS_ENDPOINT_PLAN.md](./BASIC_SETTINGS_ENDPOINT_PLAN.md) - Backend API endpoints and validation
- **Architecture Overview**: [OVERVIEW_CONTEXT.md](../../OVERVIEW_CONTEXT.md) - Clean Architecture layers and patterns
- **Player Feature**: [../../libs/features/player](../../libs/features/player) - Similar feature architecture to follow
- **Device Bootstrap**: [../../libs/app/bootstrap](../../libs/app/bootstrap) - Bootstrap service pattern reference
- **State Management**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md) - NgRx Signal Store patterns
- **Form Patterns**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md) - Reactive forms conventions
- **Testing Guide**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md) - Testing strategies by layer
- **E2E Testing**: [../../apps/teensyrom-ui-e2e/E2E_TESTS.md](../../apps/teensyrom-ui-e2e/E2E_TESTS.md) - Cypress testing patterns
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md) - Reusable UI components
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md) - Visual design system

---

_Last Updated: 2025-01-10_
_Document Author: Architect_
_Status: Ready for Phase Implementation_
_Version: 2.0 - Updated to remove ConnectionSettings and add bootstrap integration_
