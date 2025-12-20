# Task Handoff: DJ-SIGNALR-HUB-TASK-03-001-DJ-TOOLBAR-COMPONENT

---

## 📋 Task Identity

**Task ID**: `DJ-SIGNALR-HUB-TASK-03-001-DJ-TOOLBAR-COMPONENT`  
**Task Name**: Create DJ Toolbar Component with Player Integration  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-modes/ui-wizard.md`  
**Priority**: High  
**Estimated Context Size**: Medium (4-8 files)

---

## 🎯 Objective

**What**: Create a DJ toolbar component with 3 voice control checkboxes and integrate it into the player-device-container above the existing player-toolbar. The toolbar enables real-time SID voice muting/unmuting during playback and automatically resets voice states when a new file loads.

**Why**: DJs and music enthusiasts need real-time control over individual SID chip voices to create live mixes, isolate tracks, and perform creative audio manipulation with near-zero latency via the SignalR hub created in Phase 1.

**Success Criteria**:
- [ ] DJ toolbar component created with proper Angular 19 patterns (standalone, signals, modern control flow)
- [ ] Component has 3 voice checkboxes (Voice 1, 2, 3) using semantic HTML and accessibility attributes
- [ ] Checkboxes toggle voice mute states by calling DjService.muteVoices() with correct parameters
- [ ] File changes automatically reset checkboxes to all enabled (checked) without calling DJ service
- [ ] Checkboxes disabled during DJ service API calls (loading state)
- [ ] Component integrated into player-device-container above player-toolbar
- [ ] Conditional rendering: toolbar only visible when player has loaded file AND file is SID type
- [ ] Component follows glassy card styling pattern from player-toolbar
- [ ] All TypeScript compilation succeeds with no errors
- [ ] Linting passes with no violations

---

## 🔗 Context & Dependencies

### Prerequisites Completed

**Phase 1 (Core Hub)**:
- ✅ Backend DJHub created at `/api/djHub` endpoint
- ✅ MuteSidVoices command implemented and tested

**Phase 2 (DjService Infrastructure)**:
- ✅ `IDjService` domain contract created in `libs/domain/src/lib/contracts/dj.contract.ts`
- ✅ `DJ_SERVICE` injection token available
- ✅ `VoiceState` enum created in `libs/domain/src/lib/models/voice-state.model.ts`
  - Values: `Enabled = 'Enabled'`, `Disabled = 'Disabled'`
- ✅ `DjService` implemented in `libs/infrastructure/src/lib/dj/dj.service.ts`
  - SignalR hub connection with automatic reconnection
  - Lazy connection pattern (connects on first invocation)
  - Error handling via ALERT_SERVICE
  - 12 unit tests passing with comprehensive coverage
- ✅ `DJ_PROVIDERS` configured for dependency injection

### Dependencies

**Application Layer**:
- `PLAYER_CONTEXT` service (`@teensyrom-nx/application`) - provides `getCurrentFile(deviceId)` signal for file change detection

**Infrastructure Layer**:
- `DJ_SERVICE` injection token and `IDjService` contract (`@teensyrom-nx/domain`)
- `VoiceState` enum (`@teensyrom-nx/domain`)

**UI Components**:
- `ScalingCompactCardComponent` (`@teensyrom-nx/ui/components`) - glassy card wrapper
- `SlidingContainerComponent` (`@teensyrom-nx/ui/components`) - animation wrapper

### Constraints

- **SID File Type Only**: DJ toolbar should only be visible for SID music files (`.sid`, `.psid` extensions) when player is loaded
- **File Type Detection**: Use `getCurrentFile(deviceId)()?.name` to check file extension
- **No Backend Calls on Reset**: File change detection must reset checkbox states WITHOUT calling DJ service
- **Signal Effect Pattern**: Use Angular `effect()` with `untracked()` to prevent infinite loops
- **Clean Architecture**: Component depends on domain contracts only (DJ_SERVICE, PLAYER_CONTEXT), not concrete implementations
- **Accessibility**: Checkboxes must be keyboard-navigable with proper ARIA attributes

---

## 📂 File Scope

### Files to Create

1. **`libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.ts`**
   - Purpose: Standalone Angular component with 3 voice checkbox controls
   - Key elements: Signal-based state, DJ service integration, file change detection effect

2. **`libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.html`**
   - Purpose: Template with 3 labeled checkboxes wrapped in glassy card
   - Key elements: Checkbox bindings, loading state, accessibility attributes

3. **`libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.scss`**
   - Purpose: Component styles using glassy card pattern
   - Key elements: Checkbox layout (horizontal row), spacing, hover states

### Files to Modify

4. **`libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.ts`**
   - Add `DjToolbarComponent` to imports array
   - No other changes needed (component is standalone)

5. **`libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.html`**
   - Add `<lib-dj-toolbar>` above existing `<lib-player-toolbar>`
   - Wrap in `@if` directive with `isPlayerLoaded()` and SID file type check
   - Pass `deviceId` input binding

6. **`libs/features/player/src/lib/player-view/player-device-container/player-device-container.component.scss`**
   - Add `.dj-toolbar-container` styles for spacing between toolbars

### Files to Review (for context only)

7. **`libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.ts`**
   - Reference pattern for similar toolbar component structure
   - Shows ScalingCompactCard usage and signal patterns

8. **`libs/infrastructure/src/lib/dj/dj.service.ts`**
   - Review `muteVoices` method signature and return type
   - Understand error handling approach (ALERT_SERVICE integration)

9. **`libs/domain/src/lib/contracts/dj.contract.ts`**
   - Review `IDjService` interface method signature
   - Confirm `DJ_SERVICE` injection token usage

---

## 🛠️ Implementation Guidance

### Standards to Follow

**Required Reading**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Angular 19 patterns, component structure, naming conventions
- [Style Guide](../../../STYLE_GUIDE.md) - Glassy card styling, checkbox patterns, utility classes
- [Component Library](../../../COMPONENT_LIBRARY.md) - ScalingCompactCard, SlidingContainer usage

### Key Requirements

#### 1. Component Structure (TypeScript)

**Create standalone component** with:
- `@Component` decorator with `standalone: true`
- `selector: 'lib-dj-toolbar'`
- Required signal input: `deviceId = input.required<string>()`
- Inject dependencies: `DJ_SERVICE` token, `PLAYER_CONTEXT` service
- Writable signals for voice states: `voice1Enabled`, `voice2Enabled`, `voice3Enabled` (all initially `true`)
- `isLoading` signal to track DJ service call state
- Three async methods: `toggleVoice1()`, `toggleVoice2()`, `toggleVoice3()`
- File change detection effect that resets voice signals without calling DJ service

#### 2. File Change Detection Pattern

**Critical Pattern** - Use `effect()` with `untracked()` to avoid infinite loops:

```typescript
constructor() {
  // Watch for file changes and reset voice states
  effect(() => {
    const deviceId = this.deviceId(); // Track dependency
    const currentFile = this.playerContext.getCurrentFile(deviceId)();
    
    // When file changes, reset all voices to enabled
    if (currentFile) {
      untracked(() => {
        // Reset without triggering further effects
        this.voice1Enabled.set(true);
        this.voice2Enabled.set(true);
        this.voice3Enabled.set(true);
      });
    }
  });
}
```

**Why `untracked()`?**: Prevents the signal updates from triggering more effects, avoiding infinite loops.

#### 3. Checkbox Toggle Pattern

**Each toggle method should**:
1. Calculate new state (toggle current signal value)
2. Set `isLoading(true)` to disable checkboxes
3. Call `djService.muteVoices()` with all 3 voice states
4. Update local signal only on success
5. Error handling via ALERT_SERVICE (automatic from DjService)
6. Set `isLoading(false)` in finally block

**Reference implementation pattern**:
```typescript
async toggleVoice1(): Promise<void> {
  const newState = !this.voice1Enabled();
  this.isLoading.set(true);
  
  try {
    await firstValueFrom(
      this.djService.muteVoices(
        this.deviceId(),
        newState ? VoiceState.Enabled : VoiceState.Disabled,
        this.voice2Enabled() ? VoiceState.Enabled : VoiceState.Disabled,
        this.voice3Enabled() ? VoiceState.Enabled : VoiceState.Disabled
      )
    );
    this.voice1Enabled.set(newState);
  } catch (error) {
    // DjService already showed alert via ALERT_SERVICE
  } finally {
    this.isLoading.set(false);
  }
}
```

**Note**: All 3 voice states must be sent on every call (backend expects all voice parameters).

#### 4. Template Structure (HTML)

**Wrap in animation container**:
```html
<lib-sliding-container from-top>
  <lib-scaling-compact-card class="glassy-card">
    <!-- 3 checkboxes with labels here -->
  </lib-scaling-compact-card>
</lib-sliding-container>
```

**Checkbox pattern** - Use semantic HTML:
```html
<label class="voice-checkbox">
  <input 
    type="checkbox" 
    [checked]="voice1Enabled()"
    [disabled]="isLoading()"
    (change)="toggleVoice1()"
    aria-label="Toggle Voice 1"
  />
  Voice 1
</label>
```

**Layout**: Horizontal row of 3 checkboxes with consistent spacing.

#### 5. Styling (SCSS)

**Use glassy card pattern** from Style Guide:
- Base class: `.glassy-card` (inherit from parent ScalingCompactCard)
- Checkbox container: Flexbox horizontal layout with gap spacing
- Checkbox styles: Standard form control appearance with hover states
- Disabled state: Reduced opacity when `isLoading()` is true

**Reference** `player-toolbar.component.scss` for similar card styling patterns.

#### 6. Parent Container Integration

**In `player-device-container.component.html`**:

```html
@if (isPlayerLoaded() && isSidFile()) {
  <!-- DJ Toolbar -->
  <div class="dj-toolbar-container">
    <lib-dj-toolbar [deviceId]="deviceId()"></lib-dj-toolbar>
  </div>
  
  <!-- Existing Player Toolbar -->
  <div class="player-toolbar">
    <lib-player-toolbar [deviceId]="deviceId()"></lib-player-toolbar>
  </div>
}
```

**Add `isSidFile()` helper method**:
```typescript
protected isSidFile(): boolean {
  const currentFile = this.playerContext.getCurrentFile(this.deviceId())();
  if (!currentFile?.name) return false;
  const ext = currentFile.name.toLowerCase();
  return ext.endsWith('.sid') || ext.endsWith('.psid');
}
```

**In `player-device-container.component.scss`**:
```scss
.dj-toolbar-container {
  margin-bottom: 8px; // Spacing between DJ toolbar and player toolbar
}
```

### Anti-Patterns to Avoid

❌ **Don't call DJ service in effect**: File change effect should only reset local signals, not invoke backend
❌ **Don't use manual DOM manipulation**: Use Angular signals and template bindings only
❌ **Don't skip loading state**: Always disable checkboxes during API calls to prevent race conditions
❌ **Don't forget accessibility**: Checkboxes must be keyboard-navigable with proper ARIA labels
❌ **Don't import concrete implementations**: Inject `DJ_SERVICE` token, not `DjService` class

---

## 🧪 Testing Requirements

**Note**: Unit tests will be written in Task 03-002. This task focuses on implementation and integration.

**Manual Verification Checklist** (for this task):
- [ ] Component renders correctly in browser
- [ ] All 3 checkboxes appear checked (enabled) on initial load of SID file
- [ ] Clicking checkbox sends command to backend (verify in network tab - SignalR negotiation visible)
- [ ] Checkboxes disabled (grayed out) while API call in progress
- [ ] Loading new SID file resets all checkboxes to checked
- [ ] Loading non-SID file hides DJ toolbar
- [ ] TypeScript compilation succeeds
- [ ] Linting passes (`pnpm nx lint player`)

---

## 📚 Reference Materials

### Related Documentation

**Architecture & Standards**:
- [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md) - Complete feature overview
- [Phase 1: Core Hub](../phases/DJ-SIGNALR-HUB-PHASE-01-CORE-HUB.md) - Backend SignalR hub
- [Phase 2: DjService](../phases/DJ-SIGNALR-HUB-PHASE-02-DJ-SERVICE.md) - Infrastructure service
- [Phase 3: DJ Toolbar](../phases/DJ-SIGNALR-HUB-PHASE-03-DJ-TOOLBAR.md) - Full phase plan

**Component Patterns**:
- [Player Toolbar Component](../../../../../../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.ts) - Similar toolbar reference
- [Component Library - ScalingCompactCard](../../../COMPONENT_LIBRARY.md#lib-scaling-compact-card) - Card wrapper docs
- [Style Guide - Form Controls](../../../STYLE_GUIDE.md#form-controls) - Checkbox styling patterns

### Related Tasks

**Dependencies (Completed)**:
- `DJ-SIGNALR-HUB-TASK-01-001-CREATE-HUB`: Backend DJHub implementation
- `DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT`: IDjService contract and VoiceState enum
- `DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE`: DjService SignalR client (12 tests passing)
- `DJ-SIGNALR-HUB-TASK-02-003-PROVIDERS`: DI binding configuration

**Next Task**:
- `DJ-SIGNALR-HUB-TASK-03-002-UNIT-TESTS`: Comprehensive unit tests for DJ toolbar component

### Reports from Previous Tasks

<details>
<summary><strong>Phase 2 Task 02-001 Report Summary</strong></summary>

**Status**: ✅ COMPLETE

**Key Artifacts Created**:
- `IDjService` interface with `muteVoices(deviceId, voice1, voice2, voice3): Observable<void>`
- `DJ_SERVICE` injection token from `@angular/core`
- `VoiceState` enum with string values: `Enabled = 'Enabled'`, `Disabled = 'Disabled'`

**Design Decisions**:
- Observable return type completes when command sent to SignalR hub (fire-and-forget)
- String enum matches C# backend enum exactly for serialization
- Domain layer exports via barrel: `@teensyrom-nx/domain`

</details>

<details>
<summary><strong>Phase 2 Task 02-002 Report Summary</strong></summary>

**Status**: ✅ COMPLETE

**Implementation Highlights**:
- Lazy SignalR connection (connects on first `muteVoices` call)
- Automatic reconnection configured via `.withAutomaticReconnect()`
- Hub invocation: `hub.invoke('MuteSidVoices', deviceId, voice1, voice2, voice3)`
- Error handling: Catches all errors, shows friendly alert "Unable to adjust voice settings. Please try again."
- All 12 unit tests passing with comprehensive coverage

**How to Use**:
```typescript
// Inject via token
private djService = inject(DJ_SERVICE);

// Call method
this.djService.muteVoices(
  deviceId,
  VoiceState.Enabled,
  VoiceState.Disabled,
  VoiceState.Enabled
).subscribe();
```

</details>

<details>
<summary><strong>Phase 2 Task 02-003 Report Summary</strong></summary>

**Status**: ✅ COMPLETE

**Provider Configuration**:
```typescript
export const DJ_PROVIDERS: Provider[] = [
  {
    provide: DJ_SERVICE,
    useClass: DjService,
  },
];
```

**Integration**: DJ_PROVIDERS exported from infrastructure barrel for application registration.

</details>

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-03-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Required Report Sections**:
1. **Status**: Mark as COMPLETE when all success criteria met
2. **Files Created**: List all new files with line counts
3. **Files Modified**: List all modified files with changes summary
4. **Implementation Details**: Key design decisions and patterns used
5. **Manual Verification Results**: Checklist results from browser testing
6. **Integration Points**: How component integrates with DJ service and player context
7. **Next Steps**: Notes for Task 03-002 (unit testing)

**Return Value**: File path of saved report

---

## ✅ Completion Checklist

Before marking this task complete, verify:

- [ ] DJ toolbar component created with all required TypeScript files
- [ ] Component uses modern Angular 19 patterns (standalone, signals, @if/@for)
- [ ] File change detection effect implemented with `untracked()` pattern
- [ ] All 3 checkbox toggle methods call DJ service with correct parameters
- [ ] Component integrated into player-device-container above player-toolbar
- [ ] Conditional rendering checks both `isPlayerLoaded()` and `isSidFile()`
- [ ] Glassy card styling applied consistently with player-toolbar
- [ ] TypeScript compilation succeeds with no errors
- [ ] Linting passes with no violations (`pnpm nx lint player`)
- [ ] Manual browser testing confirms all behaviors work correctly
- [ ] Task completion report saved to specified output location

---

## 💡 Additional Notes

### Design Rationale

**Why 3 Separate Toggle Methods?** Each checkbox needs independent state management and error handling. Shared handler would complicate state updates and error recovery.

**Why Reset Without Backend Call?** File change implies new audio context; backend device driver resets voices automatically on file load. Frontend resets UI to match this implicit backend behavior.

**Why SID File Type Check?** Voice muting is SID chip-specific feature. Other file types (PRG, CRT, etc.) don't have voice channels, so showing the toolbar would be misleading.

**Why Loading State?** Prevents race conditions if user rapidly toggles checkboxes while previous command still processing. Ensures UI state matches backend state.

### Future Enhancements

*(Not in scope for this task - note for future phases)*

- Voice labels based on SID metadata (Lead/Bass/FX instead of Voice 1/2/3)
- Voice visualization (waveform or frequency indicators)
- Preset configurations for quick voice muting patterns
- Keyboard shortcuts (1/2/3 keys for voice toggles)

### Accessibility Considerations

- Semantic `<label>` elements wrapping checkboxes
- `aria-label` attributes for screen readers
- Keyboard navigation support (Tab to focus, Space to toggle)
- `aria-busy` attribute when loading state active
- Visual feedback for disabled state (opacity, cursor changes)

---

**Task Ready for Execution**: ✅ All context provided, dependencies verified, implementation guidance complete.
