# Custom Play Timer Feature Plan

**Project Overview**: This feature extends the existing timer system to support custom play timers for game and image files, enabling creative use cases like demo streaming, screen savers, and automated playback experiences. Currently, only music files have automatic timers based on their duration metadata. This feature adds user-configurable timers that can be enabled for any file type (except .Hex files), with customizable durations selected through a convenient dropdown interface in the player toolbar.

**Standards Documentation**:

- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **State Standards**: [STATE_STANDARDS.md](../../STATE_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

Enable users to configure custom play timers for games and images, allowing them to create automated playback experiences like demo reels, screen savers, and timed showcases. This feature extends the existing music timer system (which uses file metadata) to support user-defined timer durations for non-music file types.

**User Value**: Users can set up automated playback scenarios where files advance automatically after a chosen duration. Game enthusiasts can create demo reels that cycle through different games, photographers can build slideshow-style presentations, and creative users can set up retro-computing "screen savers" that rotate through content. The timer is optional and fully user-controlled, preserving the existing behavior when disabled.

**System Benefits**: This feature reuses the existing timer infrastructure, playback control flow, and auto-progression logic. The custom timer configuration seamlessly integrates with the current timer manager, requiring minimal architectural changes while delivering significant new capabilities.

---

## 📋 Implementation Phases

<details open>
<summary><h3>Phase 1: State Management & Core Timer Logic</h3></summary>

### Objective

Establish the state structure and core logic for custom play timers. This phase creates the foundation by adding state properties to track timer configuration, implementing store actions for managing timer settings, and updating the timer setup logic to respect custom timer configurations. The deliverable is a fully functional backend system that can enable/disable custom timers and apply user-specified durations, validated through unit tests.

### Key Deliverables

- [ ] New state model added to player state structure for timer configuration
- [ ] Store action created for updating custom timer settings
- [ ] Timer setup logic enhanced to check custom timer configuration
- [ ] Custom timer state properly initialized with device player initialization
- [ ] Unit tests verify state management and timer logic integration

### High-Level Tasks

1. **Define Timer Configuration Model**: Create state model with enable flag and duration properties
2. **Add State to Player Store**: Integrate timer configuration into device player state structure
3. **Implement Update Action**: Create store action to toggle timer and set duration
4. **Update Initialization**: Include custom timer defaults in player initialization logic
5. **Enhance Timer Setup Logic**: Modify timer setup to check custom configuration before using file metadata
6. **Write Unit Tests**: Test state structure, action behavior, and timer setup decision logic

### Open Questions for Phase 1

- **Default Timer State**: Should custom timer be disabled by default, or should we inherit a setting from user preferences?
  - **Option A**: Disabled by default - users must explicitly enable per session
  - **Option B**: Remember last state per device using local storage
  - **Option C**: Global default from settings (similar to startup filter)
  
  **📌 Recommendation: Option A**
  *Because: Custom timers are a power-user feature for specific use cases (demos, screensavers). Starting disabled keeps the UI predictable and prevents unexpected auto-progression. Users who want it enabled can quickly toggle it on and the state persists for that session.*

- **Duration Persistence**: Should the selected duration persist across file launches within a session?
  - **Option A**: Duration persists - once set, applies to all subsequent files until changed
  - **Option B**: Duration resets to default (3 minutes) when toggling timer off/on
  
  **📌 Recommendation: Option A**
  *Because: If a user sets 30 seconds for a demo reel, they likely want that duration for the entire session. Resetting forces unnecessary re-configuration. The selected duration should remain sticky until explicitly changed or the device player is removed.*

</details>

---

<details open>
<summary><h3>Phase 2: Player Context Service Integration</h3></summary>

### Objective

Integrate custom timer configuration with the player context service layer, exposing methods for the UI to interact with timer settings and ensuring the service coordinates timer setup based on custom configuration. This phase bridges the state management (Phase 1) with the UI layer (Phase 3), creating the application service contract that components will consume.

### Key Deliverables

- [ ] Player context interface extended with custom timer methods
- [ ] Player context service implements timer configuration methods
- [ ] Service methods properly delegate to store actions
- [ ] Timer setup coordination updated to respect custom settings
- [ ] Integration tests validate service coordination with store

### High-Level Tasks

1. **Extend Player Context Interface**: Add method signatures for setting custom timer configuration
2. **Implement Service Methods**: Create methods in player context service that delegate to store actions
3. **Update Selector Exposure**: Expose custom timer state through service layer signals
4. **Coordinate Timer Setup**: Ensure service layer timer setup checks custom configuration before defaults
5. **Write Integration Tests**: Test service methods and coordination logic with store integration

### Open Questions for Phase 2

- **Timer Control during Playback**: Should changing timer settings affect currently playing file?
  - **Option A**: Changes take effect immediately, resetting current timer
  - **Option B**: Changes take effect on next file launch only
  
  **📌 Recommendation: Option B**
  *Because: Modifying the timer mid-playback could be disruptive and unexpected. Better to let the current file complete with its original timer configuration. New settings take effect on the next file, providing predictable behavior.*

</details>

---

<details open>
<summary><h3>Phase 3: UI Components & Toolbar Integration</h3></summary>

### Objective

Create the UI components and integrate them into the player toolbar, providing users with intuitive controls for enabling custom timers and selecting durations. This phase delivers the visible, interactive part of the feature with a timer toggle button and dropdown for duration selection.

### Key Deliverables

- [ ] Play timer button component created with toggle functionality
- [ ] Duration dropdown component created with predefined time options
- [ ] Components integrated into player toolbar actions
- [ ] Dropdown visibility controlled by timer enabled state
- [ ] Component styling matches existing toolbar conventions
- [ ] Unit tests verify component behavior and state handling

### High-Level Tasks

1. **Create Timer Toggle Component**: Build icon button for enabling/disabling custom timer
2. **Create Duration Dropdown Component**: Build select dropdown with time duration options
3. **Define Duration Options**: Create list of standard durations (5s, 10s, 15s, 30s, 1m, 3m, 5m, 10m, 30m, 1h)
4. **Integrate into Toolbar Actions**: Add components to player toolbar actions template
5. **Implement Conditional Display**: Show/hide dropdown based on timer enabled state
6. **Apply Styling**: Match existing icon button and dropdown styling conventions
7. **Write Component Tests**: Test toggle behavior, dropdown options, and conditional rendering

### Open Questions for Phase 3

- **Dropdown Interaction Pattern**: How should the duration dropdown appear when timer is enabled?
  - **Option A**: Inline dropdown that appears next to toggle button
  - **Option B**: Pop-up/overlay dropdown that appears below toggle button
  - **Option C**: Menu-style dropdown attached to the button itself
  
  **📌 Recommendation: Option A**
  *Because: Inline dropdowns are consistent with the startup filter pattern in settings. It keeps controls grouped and visible, reducing the number of clicks needed. The toolbar has space, and the dropdown only appears when needed (timer enabled).*

- **Timer Button Visual State**: What should the timer button look like in different states?
  - **Option A**: Timer icon (schedule/timer) that highlights when enabled (like shuffle button)
  - **Option B**: Timer icon with badge/indicator showing selected duration
  - **Option C**: Timer icon with different icons for enabled/disabled states
  
  **📌 Recommendation: Option A**
  *Because: This matches the existing shuffle button pattern - simple highlight on enable. The duration is visible in the dropdown itself, no need for redundant displays. Keeps the UI clean and consistent with established patterns.*

- **Dropdown Default Selection**: What duration should be selected by default when enabling the timer?
  - **Option A**: 3 minutes (matches music file default)
  - **Option B**: Last used duration (persisted in state)
  - **Option C**: 5 minutes (middle-ground for games/images)
  
  **📌 Recommendation: Option B with fallback to Option A**
  *Because: Remembering the user's last selection improves usability - if they want 10 seconds for a demo reel, they shouldn't re-select it every time. Fall back to 3 minutes if no previous selection exists, maintaining consistency with the music timer default.*

</details>

---

<details open>
<summary><h3>Phase 4: E2E Testing & Integration Validation</h3></summary>

### Objective

Create comprehensive end-to-end tests that validate the complete custom timer workflow from user interaction through timer expiration and auto-progression. This phase ensures the feature works correctly in real-world scenarios and integrates properly with existing player functionality.

### Key Deliverables

- [ ] E2E tests for enabling/disabling custom timer
- [ ] E2E tests for changing timer duration
- [ ] E2E tests for timer behavior with different file types
- [ ] E2E tests for timer interaction with shuffle mode
- [ ] E2E tests for auto-progression when timer expires
- [ ] All tests pass with consistent, reliable results

### High-Level Tasks

1. **Create Timer Toggle Test Scenarios**: Test enabling/disabling timer and verify state changes
2. **Create Duration Selection Test Scenarios**: Test selecting different durations and verify applied values
3. **Create File Type Test Scenarios**: Verify timer behavior with games, images, and music files
4. **Create Shuffle Integration Test Scenarios**: Test custom timer with shuffle mode enabled
5. **Create Auto-Progression Test Scenarios**: Test files automatically advance when timer expires
6. **Create Edge Case Test Scenarios**: Test timer with incompatible files, errors, and state cleanup

### Open Questions for Phase 4

- **Timer Interaction with Music Files**: How should custom timer interact with music files that have metadata durations?
  - **Option A**: Custom timer is disabled/hidden for music files
  - **Option B**: Custom timer overrides music metadata when enabled
  - **Option C**: Custom timer is available but defaults to metadata (like current behavior)
  
  **📌 Recommendation: Option B**
  *Because: Power users may want to override music duration for demos or testing. If custom timer is enabled, it should take precedence regardless of file type. This provides maximum flexibility. If disabled, music files use metadata as they do today.*

</details>

---

<details open>
<summary><h2>🏗️ Architecture Overview</h2></summary>

### Key Design Decisions

- **Reuse Existing Timer Infrastructure**: The feature leverages the existing timer manager, timer service, and auto-progression logic without modification. Custom timer configuration is a new state property that influences existing timer setup logic, minimizing architectural changes and reducing risk.

- **State Model Design**: Create a `PlayTimerConfig` model with `enabled: boolean` and `duration: number` properties, stored as a property on `DevicePlayerState`. This keeps timer configuration co-located with other player state and follows the existing state structure patterns.

- **Timer Priority Logic**: When setting up a timer, check custom timer configuration first. If enabled and duration is set, use that value. Otherwise, fall back to existing logic (music file metadata or skip timer for non-music files). This preserves backward compatibility while enabling new functionality.

- **UI Integration Pattern**: Follow the existing shuffle button pattern - icon button with highlight-on-enable behavior, positioned to the left of the shuffle button in the toolbar. Dropdown appears inline when timer is enabled, matching the startup filter dropdown pattern in settings.

### Integration Points

- **Player Store State**: Custom timer configuration integrates into `DevicePlayerState` as a new property alongside existing player state (currentFile, timerState, etc.). Store actions manage timer configuration updates with standard state mutation patterns.

- **Player Context Service**: Service layer exposes custom timer configuration methods through the `IPlayerContext` interface contract. Components consume timer settings via these methods, maintaining clean layer separation per Clean Architecture principles.

- **Timer Manager Coordination**: Existing timer manager receives custom duration values through the timer setup flow without requiring internal changes. The service layer passes custom durations to timer creation methods when custom timer is enabled.

- **Player Toolbar UI**: Custom timer controls integrate into `PlayerToolbarActionsComponent` alongside existing shuffle and favorite buttons. Components use signals to reactively display timer state and conditionally show/hide the duration dropdown.

### File Type Compatibility

The feature applies to these file types:

- **Game Files**: Fully supported - custom timer enables demo reels
- **Image Files**: Fully supported - custom timer enables slideshows/screensavers
- **Music Files**: Supported - custom timer overrides metadata duration when enabled
- **Hex Files**: Explicitly excluded - .Hex files remain incompatible with timers

The existing file compatibility checks remain unchanged. Custom timer configuration is checked during timer setup, before file type validation.

</details>

---

<details open>
<summary><h2>🧪 Testing Strategy</h2></summary>

### Unit Tests

- [ ] Custom timer state model structure and initialization
- [ ] Store action for updating timer configuration (enable/disable, duration changes)
- [ ] Timer setup logic decision tree (custom enabled vs metadata vs no timer)
- [ ] Player context service timer configuration methods
- [ ] Service delegation to store actions
- [ ] Component timer button toggle behavior
- [ ] Component duration dropdown selection and display
- [ ] Conditional rendering of dropdown based on enabled state

### Integration Tests

- [ ] Player context service coordination with store state
- [ ] Timer manager receiving custom durations from service layer
- [ ] Timer setup flow respecting custom configuration priority

### E2E Tests

- [ ] User enables custom timer and selects duration - timer starts with selected value
- [ ] User disables custom timer - existing file timers are cleared, new files have no timer
- [ ] User changes duration while timer enabled - next file uses new duration
- [ ] Game file with custom timer enabled - file advances after custom duration
- [ ] Image file with custom timer enabled - file advances after custom duration  
- [ ] Music file with custom timer disabled - file uses metadata duration (existing behavior)
- [ ] Music file with custom timer enabled - file uses custom duration (override)
- [ ] Shuffle mode with custom timer - files advance automatically with custom duration
- [ ] Custom timer with incompatible .Hex file - timer is not created/applied
- [ ] Browser navigation with custom timer enabled - state and timer persist correctly

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

- [ ] Custom timer can be enabled/disabled via toolbar button for any device
- [ ] Duration dropdown appears when timer is enabled and hides when disabled
- [ ] Duration dropdown offers predefined options: 5s, 10s, 15s, 30s, 1m, 3m, 5m, 10m, 30m, 1h
- [ ] Selected duration persists for the session until explicitly changed
- [ ] Game files with custom timer enabled advance automatically after selected duration
- [ ] Image files with custom timer enabled advance automatically after selected duration
- [ ] Music files with custom timer enabled use custom duration instead of metadata
- [ ] Music files with custom timer disabled continue to use metadata (existing behavior)
- [ ] .Hex files remain incompatible with timers regardless of custom timer state
- [ ] Custom timer state initializes correctly when player is created
- [ ] Custom timer state cleans up correctly when player is removed
- [ ] Timer button visual state (highlight) correctly reflects enabled/disabled state
- [ ] UI styling matches existing toolbar conventions and is responsive
- [ ] All unit tests pass successfully
- [ ] All integration tests pass successfully  
- [ ] All E2E tests pass successfully
- [ ] Feature is ready for production deployment

</details>

---

<details open>
<summary><h2>🎭 User Scenarios</h2></summary>

### Custom Timer Basic Operations

<details open>
<summary><strong>Scenario 1: Enable Custom Timer with Default Duration</strong></summary>

```gherkin
Given a user has a game file loaded in the player
When the user clicks the play timer button in the toolbar
Then the timer button highlights to indicate enabled state
And a duration dropdown appears next to the timer button
And the dropdown shows "3m" selected as the default duration
```

</details>

<details open>
<summary><strong>Scenario 2: Select Custom Timer Duration</strong></summary>

```gherkin
Given the custom timer is enabled with dropdown visible
When the user opens the duration dropdown
Then the dropdown displays all predefined options: 5s, 10s, 15s, 30s, 1m, 3m, 5m, 10m, 30m, 1h
When the user selects "10s"
Then the dropdown closes and displays "10s" as selected
And the custom timer duration is set to 10 seconds
```

</details>

<details open>
<summary><strong>Scenario 3: Disable Custom Timer</strong></summary>

```gherkin
Given the custom timer is enabled with a duration selected
When the user clicks the play timer button again
Then the timer button unhighlights to indicate disabled state
And the duration dropdown disappears from the toolbar
And the custom timer configuration is disabled
```

</details>

---

### Custom Timer with Different File Types

<details open>
<summary><strong>Scenario 4: Launch Game with Custom Timer Enabled</strong></summary>

```gherkin
Given the custom timer is enabled with 30 seconds selected
When the user launches a game file
Then a timer starts counting up from 0:00
And a progress bar displays the timer progress
When the timer reaches 30 seconds
Then the next file in the context is automatically launched
```

</details>

<details open>
<summary><strong>Scenario 5: Launch Image with Custom Timer Enabled</strong></summary>

```gherkin
Given the custom timer is enabled with 5 seconds selected  
When the user launches an image file
Then a timer starts counting up from 0:00
And a progress bar displays the timer progress
When the timer reaches 5 seconds
Then the next file in the context is automatically launched
```

</details>

<details open>
<summary><strong>Scenario 6: Launch Music with Custom Timer Disabled</strong></summary>

```gherkin
Given the custom timer is disabled
When the user launches a music file with "3:45" duration metadata
Then a timer starts based on the file's metadata duration (3:45)
And the timer counts up to 3:45
And the file advances automatically when timer completes (existing behavior)
```

</details>

<details open>
<summary><strong>Scenario 7: Launch Music with Custom Timer Enabled (Override)</strong></summary>

```gherkin
Given the custom timer is enabled with 1 minute selected
When the user launches a music file with "3:45" duration metadata
Then a timer starts with the custom 1 minute duration
And the timer counts up to 1:00 (ignoring the metadata duration)
When the timer reaches 1:00
Then the next file in the context is automatically launched
```

</details>

<details open>
<summary><strong>Scenario 8: Launch .Hex File with Custom Timer Enabled</strong></summary>

```gherkin
Given the custom timer is enabled with 30 seconds selected
When the user launches a .Hex file
Then no timer is created (hex files remain incompatible)
And no progress bar is displayed
And the file does not advance automatically (existing behavior)
```

</details>

---

### Custom Timer Session Persistence

<details open>
<summary><strong>Scenario 9: Duration Persists Across File Launches</strong></summary>

```gherkin
Given the custom timer is enabled with 15 seconds selected
When the user launches a game file and waits for auto-progression
And the next file loads automatically
Then the custom timer remains enabled with 15 seconds
And the new file also uses the 15 second duration
```

</details>

<details open>
<summary><strong>Scenario 10: Timer State Resets When Player Removed</strong></summary>

```gherkin
Given the custom timer is enabled with 10 seconds selected
When the user navigates away from the player
And the device player is removed/cleaned up
Then the custom timer configuration is cleared
When the user returns and reinitializes the player
Then the custom timer is disabled (default state)
```

</details>

---

### Custom Timer with Shuffle Mode

<details open>
<summary><strong>Scenario 11: Custom Timer in Shuffle Mode</strong></summary>

```gherkin
Given shuffle mode is enabled
And the custom timer is enabled with 5 seconds selected
When a random game file is launched
Then the timer starts with 5 second duration
When the timer expires
Then a new random file is launched (shuffle mode behavior)
And the custom timer applies to the new random file
```

</details>

<details open>
<summary><strong>Scenario 12: Custom Timer with History Navigation</strong></summary>

```gherkin
Given shuffle mode is enabled with custom timer (10 seconds)
And the user has navigated through several random files
When the user presses the previous button
Then the previous file from history is relaunched
And the custom timer applies to the history file (10 seconds)
```

</details>

---

### Custom Timer Edge Cases

<details open>
<summary><strong>Scenario 13: Change Duration During Session</strong></summary>

```gherkin
Given the custom timer is enabled with 30 seconds selected
And a game file is currently playing with the timer counting
When the user opens the dropdown and selects 5 seconds
Then the current file continues with its original 30 second timer
When the file advances to the next file
Then the new file uses the updated 5 second duration
```

</details>

<details open>
<summary><strong>Scenario 14: Custom Timer with File Launch Error</strong></summary>

```gherkin
Given the custom timer is enabled with 10 seconds selected
When the user attempts to launch a corrupted/incompatible file
Then the file launch fails with an error
And no timer is created for the failed file
And the custom timer configuration remains enabled
```

</details>

<details open>
<summary><strong>Scenario 15: Disable Timer Mid-Playback</strong></summary>

```gherkin
Given a game file is playing with custom timer enabled (30 seconds)
And the timer is actively counting (e.g., at 15 seconds)
When the user clicks the timer button to disable custom timer
Then the current file's timer continues to its completion (30 seconds)
When the file advances to the next file
Then the new file has no timer (custom timer disabled)
```

</details>

</details>

---

<details open>
<summary><h2>📚 Related Documentation</h2></summary>

- **Architecture Overview**: [`OVERVIEW_CONTEXT.md`](../../OVERVIEW_CONTEXT.md)
- **Coding Standards**: [`CODING_STANDARDS.md`](../../CODING_STANDARDS.md)
- **Testing Standards**: [`TESTING_STANDARDS.md`](../../TESTING_STANDARDS.md)
- **State Standards**: [`STATE_STANDARDS.md`](../../STATE_STANDARDS.md)
- **Component Library**: [`COMPONENT_LIBRARY.md`](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [`STYLE_GUIDE.md`](../../STYLE_GUIDE.md)

</details>

---

<details open>
<summary><h2>📝 Notes</h2></summary>

### Design Considerations

- **Timer Manager Reuse**: The existing timer manager, timer service, and auto-progression logic require no modifications. Custom timer configuration is checked before timer creation, influencing which duration value is used. This approach minimizes risk and maintains backward compatibility.

- **State Initialization**: Custom timer configuration must initialize with safe defaults (disabled, 3-minute duration) to prevent unexpected behavior on first use. Initialization occurs during player creation, and cleanup occurs during player removal.

- **UI Responsiveness**: The timer button and dropdown must render correctly across all responsive breakpoints (mobile, tablet, desktop) per existing toolbar layout conventions. The dropdown should remain accessible and usable on small screens.

- **Performance**: Duration dropdown options are static and should be memoized to avoid unnecessary re-renders. Timer configuration changes should only trigger minimal re-renders of affected components.

### Future Enhancement Ideas

- **Custom Duration Input**: Allow users to enter arbitrary durations beyond predefined options
- **Per-File Type Defaults**: Remember different default durations for games vs images
- **Timer Profiles**: Save named timer configurations (e.g., "Demo Reel - 10s", "Slideshow - 30s")
- **Timer Visualization Options**: Provide alternative timer displays (circular progress, numeric countdown, etc.)
- **Global Timer Defaults**: Add global default custom timer settings in the settings view

### Summary of Open Questions

**Phase 1:**

- Default timer state (disabled by default recommended)
- Duration persistence across file launches (persist recommended)

**Phase 2:**

- Timer control during playback (changes take effect on next file recommended)

**Phase 3:**

- Dropdown interaction pattern (inline dropdown recommended)
- Timer button visual state (highlight on enable like shuffle recommended)
- Dropdown default selection (remember last selection recommended)

**Phase 4:**

- Timer interaction with music files (custom timer overrides metadata when enabled recommended)

</details>

---

## 💡 Implementation Notes

This plan provides architectural guidance and behavioral specifications without prescribing specific implementation details. The focus is on what the feature delivers to users and how it integrates with existing systems.

Key architectural principles to maintain during implementation:

- **Layer Separation**: Domain models, application state, infrastructure services, and UI components maintain clear boundaries
- **Backward Compatibility**: Existing timer behavior for music files remains unchanged when custom timer is disabled
- **State Management**: All state changes flow through store actions; no direct state mutations
- **Testability**: Each layer has appropriate test coverage validating its specific responsibilities
- **User Experience**: Timer controls are discoverable, intuitive, and consistent with existing UI patterns
