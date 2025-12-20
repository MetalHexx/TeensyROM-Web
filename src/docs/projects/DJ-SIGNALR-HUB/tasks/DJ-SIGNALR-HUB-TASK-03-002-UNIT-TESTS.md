# Task Handoff: DJ-SIGNALR-HUB-TASK-03-002-UNIT-TESTS

---

## 📋 Task Identity

**Task ID**: `DJ-SIGNALR-HUB-TASK-03-002-UNIT-TESTS`  
**Task Name**: Unit Tests for DJ Toolbar Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/copilot-modes/ui-wizard.md`  
**Priority**: High  
**Estimated Context Size**: Small (1-3 files)

---

## 🎯 Objective

**What**: Create comprehensive unit tests for the DJ toolbar component using behavioral testing patterns. Tests should verify observable behaviors (checkbox interactions, service calls, file change resets) without testing implementation details.

**Why**: Unit tests provide confidence that the DJ toolbar behaves correctly in all scenarios (happy paths, errors, edge cases) and prevent regressions during future changes. Tests document expected behaviors and serve as living specifications for the component.

**Success Criteria**:
- [ ] Spec file created with >90% code coverage for DJ toolbar component
- [ ] All behavioral scenarios tested (see Test Scenarios section below)
- [ ] Tests use Testing Library patterns (@testing-library/angular)
- [ ] Mocks created for DJ_SERVICE and PLAYER_CONTEXT dependencies
- [ ] Tests verify observable outcomes, not implementation details
- [ ] All tests pass with no failures or warnings
- [ ] Test code follows Testing Standards and Smart Component Testing guide
- [ ] TypeScript compilation succeeds with no errors

---

## 🔗 Context & Dependencies

### Prerequisites Completed

**Phase 3 Task 03-001**:
- ✅ DJ toolbar component created with 3 voice checkboxes
- ✅ Component integrated into player-device-container
- ✅ File change detection effect implemented
- ✅ Checkbox toggle handlers call DJ service
- ✅ Loading state disables checkboxes during API calls
- ✅ Component renders only for SID files when player loaded

### Dependencies

**Testing Libraries**:
- `@testing-library/angular` - Component testing utilities
- `@testing-library/user-event` - User interaction simulation
- Vitest - Test runner (configured in workspace)

**Component Under Test**:
- `libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.ts`

**Mocked Dependencies**:
- `DJ_SERVICE` injection token (`@teensyrom-nx/domain`)
- `PLAYER_CONTEXT` service (`@teensyrom-nx/application`)

### Constraints

- **Behavioral Testing Philosophy**: Test what users observe, not how code implements it
- **No Implementation Details**: Don't test private methods, internal signals, or implementation specifics
- **Mock at Boundaries**: Mock DJ_SERVICE and PLAYER_CONTEXT, not internal component logic
- **Realistic Interactions**: Use Testing Library's `userEvent` for checkbox clicks, not direct method calls
- **Signal Mocking**: Use writable signals for mocked PLAYER_CONTEXT methods

---

## 📂 File Scope

### Files to Create

1. **`libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.spec.ts`**
   - Purpose: Comprehensive unit tests for DJ toolbar component
   - Structure: 4 describe blocks (Rendering, Checkbox Interactions, File Changes, Error Handling)
   - Coverage target: >90% code coverage

### Files to Modify

None. This task only creates the spec file.

### Files to Review (for context only)

2. **`libs/features/player/src/lib/player-view/player-device-container/dj-toolbar/dj-toolbar.component.ts`**
   - Review component implementation to understand behaviors to test
   - Identify public API (inputs, outputs, template interactions)

3. **`libs/infrastructure/src/lib/dj/dj.service.spec.ts`**
   - Reference example of mocking SignalR-based services
   - See patterns for mocking Observable-returning methods

4. **`libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.spec.ts`**
   - Reference example of similar toolbar component testing
   - See patterns for mocking PLAYER_CONTEXT service

---

## 🛠️ Implementation Guidance

### Standards to Follow

**Required Reading**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing philosophy
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns with Testing Library
- [Store Testing](../../../STORE_TESTING.md) - Signal mocking patterns (for PLAYER_CONTEXT)

### Key Requirements

#### 1. Test File Structure

**Organize tests into 4 describe blocks**:

```typescript
describe('DjToolbarComponent', () => {
  describe('Rendering', () => {
    // Tests for initial component state and DOM structure
  });

  describe('Checkbox Interactions', () => {
    // Tests for user toggling checkboxes and service calls
  });

  describe('File Change Behavior', () => {
    // Tests for automatic reset when current file changes
  });

  describe('Error Handling', () => {
    // Tests for graceful error handling when service fails
  });
});
```

#### 2. Mock Setup Pattern

**Create mock objects in `beforeEach`**:

```typescript
let mockDjService: {
  muteVoices: jest.Mock;
};

let mockPlayerContext: {
  getCurrentFile: jest.Mock;
};

let currentFileSignal: WritableSignal<FileItem | null>;

beforeEach(() => {
  currentFileSignal = signal<FileItem | null>(null);
  
  mockDjService = {
    muteVoices: jest.fn().mockReturnValue(of(void 0)), // Returns completed Observable
  };

  mockPlayerContext = {
    getCurrentFile: jest.fn().mockReturnValue(() => currentFileSignal),
  };
});
```

**Configure TestBed with mocks**:

```typescript
await TestBed.configureTestingModule({
  imports: [DjToolbarComponent],
  providers: [
    { provide: DJ_SERVICE, useValue: mockDjService },
    { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
  ],
}).compileComponents();
```

#### 3. Component Rendering Pattern

**Use Testing Library's `render` function**:

```typescript
const { fixture, getByLabelText, queryByLabelText } = await render(DjToolbarComponent, {
  componentInputs: {
    deviceId: 'test-device-id',
  },
  providers: [
    { provide: DJ_SERVICE, useValue: mockDjService },
    { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
  ],
});
```

**Why Testing Library?** Encourages testing through public APIs (template interactions) rather than component internals.

#### 4. Test Scenarios by Category

### Rendering Tests

**Behaviors to verify**:
1. ✅ **Component renders with all 3 checkboxes**
   - Query for checkboxes by accessible label
   - Verify all 3 are present in DOM

2. ✅ **All checkboxes initially checked (enabled)**
   - Check `checked` property on each checkbox input
   - Represents default "all voices enabled" state

3. ✅ **Checkbox labels are correct**
   - Verify labels read "Voice 1", "Voice 2", "Voice 3"
   - Use `getByLabelText()` to find by accessible name

### Checkbox Interaction Tests

**Behaviors to verify**:
4. ✅ **Clicking checkbox calls DJ service with correct parameters**
   - Use `userEvent.click()` to simulate user click
   - Verify `djService.muteVoices()` called with correct voice states
   - Example: Toggle Voice 1 off → service called with (Disabled, Enabled, Enabled)

5. ✅ **Clicking checkbox updates checkbox state**
   - Click unchecked checkbox → verify it becomes checked
   - Click checked checkbox → verify it becomes unchecked

6. ✅ **Multiple checkbox toggles send correct combined states**
   - Toggle Voice 1 and Voice 3 off → service called with (Disabled, Enabled, Disabled)
   - Toggle all 3 off → service called with (Disabled, Disabled, Disabled)

7. ✅ **Checkboxes disabled during service call (loading state)**
   - Mock service to return delayed Observable (use timer)
   - Click checkbox → verify all 3 checkboxes get `disabled` attribute
   - Wait for completion → verify checkboxes re-enabled

8. ✅ **Service success updates checkbox state**
   - Toggle checkbox → verify state updates after service resolves

### File Change Behavior Tests

**Behaviors to verify**:
9. ✅ **File change resets all checkboxes to checked**
   - Toggle checkboxes to mixed states (some checked, some unchecked)
   - Update `currentFileSignal` to new file
   - Verify all 3 checkboxes become checked

10. ✅ **File change does NOT call DJ service**
    - Toggle checkboxes, then change file
    - Verify `djService.muteVoices()` called only for user toggles, not file change
    - Clear mock call history before file change to isolate behavior

11. ✅ **File change to null does not crash component**
    - Set `currentFileSignal(null)` → verify component doesn't throw errors

### Error Handling Tests

**Behaviors to verify**:
12. ✅ **Service error does not crash component**
    - Mock `djService.muteVoices()` to return `throwError(() => new Error('Test error'))`
    - Toggle checkbox → verify component remains stable (no uncaught exceptions)

13. ✅ **Service error does not change checkbox state**
    - Checkbox checked → toggle (triggers error) → verify checkbox remains checked
    - User sees their attempted change reverted

14. ✅ **Service errors handled by DjService alert**
    - Note: Actual alert display tested in DjService tests
    - Component test just verifies error doesn't propagate

#### 5. Testing Library Query Patterns

**Accessible queries** (preferred):
```typescript
const voice1Checkbox = getByLabelText('Toggle Voice 1') as HTMLInputElement;
const voice2Checkbox = getByLabelText('Toggle Voice 2') as HTMLInputElement;
const voice3Checkbox = getByLabelText('Toggle Voice 3') as HTMLInputElement;
```

**Checkbox state checks**:
```typescript
expect(voice1Checkbox.checked).toBe(true);
expect(voice2Checkbox.disabled).toBe(true);
```

**User interactions**:
```typescript
import userEvent from '@testing-library/user-event';
const user = userEvent.setup();

await user.click(voice1Checkbox);
```

#### 6. Signal Mocking for File Changes

**Update signal to simulate file change**:
```typescript
// Initial state: file loaded
currentFileSignal.set({ 
  name: 'song.sid', 
  path: '/music/song.sid',
  // ... other FileItem properties
});

// Trigger file change
currentFileSignal.set({ 
  name: 'different-song.sid', 
  path: '/music/different-song.sid',
  // ... other FileItem properties
});

fixture.detectChanges(); // Trigger Angular change detection
await fixture.whenStable(); // Wait for effects to run
```

#### 7. Service Call Verification

**Verify service called with correct parameters**:
```typescript
expect(mockDjService.muteVoices).toHaveBeenCalledWith(
  'test-device-id',
  VoiceState.Disabled, // Voice 1
  VoiceState.Enabled,  // Voice 2
  VoiceState.Enabled   // Voice 3
);
```

**Verify service NOT called**:
```typescript
mockDjService.muteVoices.mockClear(); // Clear previous calls
// ... trigger file change ...
expect(mockDjService.muteVoices).not.toHaveBeenCalled();
```

### Anti-Patterns to Avoid

❌ **Don't test implementation details**: Avoid testing private methods, internal signals, or component class properties directly
❌ **Don't call component methods directly**: Use `userEvent` to simulate user interactions, not `component.toggleVoice1()`
❌ **Don't test framework features**: Don't test Angular's signal reactivity or effect execution (trust the framework)
❌ **Don't duplicate service tests**: Don't test DjService error handling (already tested in DjService.spec.ts)
❌ **Don't skip async handling**: Always use `await` with `userEvent` and `fixture.whenStable()` for effects

---

## 🧪 Testing Requirements

**Test Coverage Target**: >90% code coverage for `dj-toolbar.component.ts`

**Coverage Areas**:
- All 3 checkbox toggle methods
- File change detection effect
- Loading state management
- Error handling (catch blocks)

**Test Execution Commands**:

```bash
# Run tests for player feature (includes DJ toolbar)
pnpm nx test player --watch=false

# Run with coverage report
pnpm nx test player --watch=false --coverage

# Run in watch mode during development
pnpm nx test player --watch
```

**Coverage Verification**:
- Check `coverage/libs/features/player/` folder for HTML report
- Verify `dj-toolbar.component.ts` shows >90% coverage (lines, branches, functions)

---

## 📚 Reference Materials

### Related Documentation

**Testing Standards**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Testing Library patterns for Angular
- [Store Testing](../../../STORE_TESTING.md) - Signal mocking patterns

**Reference Test Files**:
- [DjService Unit Tests](../../../../../../libs/infrastructure/src/lib/dj/dj.service.spec.ts) - Observable mocking patterns
- [Player Toolbar Tests](../../../../../../libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar.component.spec.ts) - Similar component testing

### Related Tasks

**Dependency (Completed)**:
- `DJ-SIGNALR-HUB-TASK-03-001-DJ-TOOLBAR-COMPONENT`: Component implementation to test

**Previous Phase Testing**:
- `DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE`: DjService tests (12 tests, all passing)

### Report from Previous Task

<details>
<summary><strong>Phase 3 Task 03-001 Report Summary</strong></summary>

*(This will be populated by Task 03-001's completion report)*

**Expected Artifacts**:
- DJ toolbar component with 3 voice checkboxes
- File change detection effect with `untracked()` pattern
- Checkbox toggle methods calling DJ service
- Integration into player-device-container
- Manual verification completed

**Key Behaviors to Test**:
- All behaviors described in Task 03-001 manual verification checklist
- Focus on user-observable outcomes (checkbox states, service calls, resets)

</details>

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-03-002-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Required Report Sections**:
1. **Status**: Mark as COMPLETE when all tests passing
2. **Files Created**: List spec file with line count
3. **Test Summary**: Total tests written, organized by describe block
4. **Test Results**: Show output from `pnpm nx test player --watch=false`
5. **Coverage Report**: Screenshot or summary showing >90% coverage
6. **Behaviors Verified**: List all 14 test scenarios with pass/fail status
7. **Next Steps**: Notes for Phase 3 completion and any follow-up items

**Return Value**: File path of saved report

---

## ✅ Completion Checklist

Before marking this task complete, verify:

- [ ] Spec file created with comprehensive test suite
- [ ] All 14 behavioral scenarios implemented as tests
- [ ] Tests organized into 4 describe blocks (Rendering, Interactions, File Changes, Errors)
- [ ] Mocks created for DJ_SERVICE and PLAYER_CONTEXT
- [ ] Testing Library patterns used (getByLabelText, userEvent, etc.)
- [ ] All tests pass with no failures or warnings
- [ ] Code coverage >90% for DJ toolbar component
- [ ] TypeScript compilation succeeds with no errors
- [ ] Tests follow behavioral testing philosophy (no implementation detail testing)
- [ ] Task completion report saved to specified output location

---

## 💡 Additional Notes

### Testing Philosophy Reminder

**Test behaviors users observe**:
- ✅ Checkbox appears checked after clicking unchecked checkbox
- ✅ Service receives correct parameters when checkbox toggled
- ✅ Checkboxes reset to checked when file changes

**Don't test implementation details**:
- ❌ Effect function called when signal updates
- ❌ Private method `calculateVoiceStates()` returns correct array
- ❌ Component's internal `voice1Enabled` signal has specific value

### Why Behavioral Testing Matters

1. **Refactoring Safety**: Implementation can change without breaking tests
2. **Better Documentation**: Tests describe what component does, not how it does it
3. **User-Focused**: Tests verify what users experience, not code structure
4. **Maintainability**: Tests remain valid as long as behavior stays same

### Common Pitfalls

**Loading State Testing**:
- Use `timer(100)` to delay Observable completion, simulating real API latency
- Check `disabled` attribute immediately after click, before Observable completes
- Wait for Observable completion to verify re-enabled state

**Signal Effect Testing**:
- Effects run in Angular's reactive context; use `fixture.detectChanges()` and `whenStable()`
- Don't test effect execution directly; test observable outcome (checkboxes reset)

**Mock Isolation**:
- Clear mock call history with `mockClear()` between test steps to isolate behaviors
- Use `mockReturnValueOnce()` for one-off error simulations

---

## 🎓 Example Test Structure

```typescript
describe('DjToolbarComponent', () => {
  let mockDjService: { muteVoices: jest.Mock };
  let currentFileSignal: WritableSignal<FileItem | null>;

  beforeEach(() => {
    // Setup mocks
  });

  describe('Rendering', () => {
    it('should render all 3 voice checkboxes', async () => {
      const { getByLabelText } = await render(DjToolbarComponent, { /* config */ });
      
      expect(getByLabelText('Toggle Voice 1')).toBeInTheDocument();
      expect(getByLabelText('Toggle Voice 2')).toBeInTheDocument();
      expect(getByLabelText('Toggle Voice 3')).toBeInTheDocument();
    });

    it('should have all checkboxes initially checked', async () => {
      const { getByLabelText } = await render(DjToolbarComponent, { /* config */ });
      
      const voice1 = getByLabelText('Toggle Voice 1') as HTMLInputElement;
      const voice2 = getByLabelText('Toggle Voice 2') as HTMLInputElement;
      const voice3 = getByLabelText('Toggle Voice 3') as HTMLInputElement;
      
      expect(voice1.checked).toBe(true);
      expect(voice2.checked).toBe(true);
      expect(voice3.checked).toBe(true);
    });
  });

  describe('Checkbox Interactions', () => {
    it('should call DJ service with correct parameters when toggling voice 1', async () => {
      const user = userEvent.setup();
      const { getByLabelText } = await render(DjToolbarComponent, { /* config */ });
      
      const voice1 = getByLabelText('Toggle Voice 1') as HTMLInputElement;
      await user.click(voice1);
      
      expect(mockDjService.muteVoices).toHaveBeenCalledWith(
        'test-device-id',
        VoiceState.Disabled, // Voice 1 toggled off
        VoiceState.Enabled,  // Voice 2 still on
        VoiceState.Enabled   // Voice 3 still on
      );
    });
  });

  describe('File Change Behavior', () => {
    it('should reset all checkboxes when file changes', async () => {
      const user = userEvent.setup();
      const { getByLabelText, fixture } = await render(DjToolbarComponent, { /* config */ });
      
      // Toggle some checkboxes off
      await user.click(getByLabelText('Toggle Voice 1'));
      await user.click(getByLabelText('Toggle Voice 2'));
      
      // Simulate file change
      currentFileSignal.set({ name: 'new-song.sid', /* ... */ });
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Verify all checkboxes reset to checked
      const voice1 = getByLabelText('Toggle Voice 1') as HTMLInputElement;
      const voice2 = getByLabelText('Toggle Voice 2') as HTMLInputElement;
      const voice3 = getByLabelText('Toggle Voice 3') as HTMLInputElement;
      
      expect(voice1.checked).toBe(true);
      expect(voice2.checked).toBe(true);
      expect(voice3.checked).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should not crash when service returns error', async () => {
      mockDjService.muteVoices.mockReturnValue(
        throwError(() => new Error('Test error'))
      );
      
      const user = userEvent.setup();
      const { getByLabelText } = await render(DjToolbarComponent, { /* config */ });
      
      const voice1 = getByLabelText('Toggle Voice 1') as HTMLInputElement;
      
      // Should not throw
      await expect(user.click(voice1)).resolves.not.toThrow();
    });
  });
});
```

---

**Task Ready for Execution**: ✅ All context provided, test scenarios defined, patterns documented.
