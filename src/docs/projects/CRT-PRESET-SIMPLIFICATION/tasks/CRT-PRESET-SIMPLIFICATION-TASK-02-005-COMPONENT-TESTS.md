# Task Handoff: Update Component Tests

## 📋 Task Identity

**Task ID**: CRT-PRESET-SIMPLIFICATION-TASK-02-005-COMPONENT-TESTS  
**Task Name**: Update Component Tests  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (3-4 test files)

---

## 🎯 Objective

**What**: Comprehensively update all component test files to reflect new preset structure, WebGL detection behavior, and removed overrides.

**Why**: Ensure test coverage matches new implementation patterns and validates correct behavior of preset selection and initialization.

**Success Criteria**:
- [ ] All test files updated for new preset keys (SMALL/LARGE vs IMAGE/FULLSCREEN/DIALOG)
- [ ] WebGL detection mocked in all component tests
- [ ] Initialization scenarios tested: saved settings, WebGL true, WebGL false
- [ ] Override-related tests removed (no more forced curvature, brightness tests)
- [ ] Storage key backward compatibility verified in tests
- [ ] All tests passing with no failures
- [ ] Test coverage maintained or improved (>80% coverage)
- [ ] No hardcoded preset expectations remain in tests

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001-WEBGL-DETECTION: Detection utility created
- CRT-PRESET-SIMPLIFICATION-TASK-02-002-FILE-IMAGE: File-image implementation updated
- CRT-PRESET-SIMPLIFICATION-TASK-02-003-VIDEO-CAPTURE: Video-capture implementation updated
- CRT-PRESET-SIMPLIFICATION-TASK-02-004-VIDEO-DIALOG: Video-dialog implementation updated

**Dependencies**:
- Vitest testing framework
- Angular TestBed utilities
- Signal testing utilities
- Component mocking patterns

**Constraints**:
- Tests must not test implementation details (test behaviors)
- Must mock only at boundaries (infrastructure layer)
- Must use real stores/services where possible
- Must follow behavioral testing patterns

---

## 📂 File Scope

**Files to Modify**:
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.spec.ts`
  - Update preset key expectations (IMAGE_WEBGL → SMALL_WEBGL, IMAGE_CSS → SMALL_CSS)
  - Mock `detectWebGLSupport()` function
  - Add initialization scenario tests
  - Remove override-related tests (curvature forcing, brightness adjustments)
  - Verify storage key is `'file-image'`
  
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.spec.ts`
  - Update preset key expectations (IMAGE_WEBGL → SMALL_WEBGL, IMAGE_CSS → SMALL_CSS)
  - Mock `detectWebGLSupport()` function
  - Add initialization scenario tests
  - Verify storage key is `'video-compact'`
  - Verify device enumeration still works
  
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.spec.ts`
  - Update preset key expectations (FULLSCREEN_WEBGL → LARGE_WEBGL, FULLSCREEN_CSS → LARGE_CSS)
  - Mock `detectWebGLSupport()` function
  - Mock MAT_DIALOG_DATA for dialog tests
  - Add initialization scenario tests
  - Verify storage key is `'video-dialog'`
  - Verify dialog functionality (fullscreen, close)

**Files to Review** (for context):
- `libs/infrastructure/src/lib/utils/webgl-detector.ts` - Function to mock
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Testing patterns

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Testing philosophy and patterns
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component-specific patterns
- [Coding Standards](../../../CODING_STANDARDS.md) - Test file organization

**Key Requirements**:

### 1. Test Structure Pattern

Each component test file should have:
```typescript
describe('[Component]Component', () => {
  let component: [Component]Component;
  let fixture: ComponentFixture<[Component]Component>;
  let mockCrtStorage: any;
  let mockDetectWebGL: any;

  beforeEach(async () => {
    // Setup mocks
    mockCrtStorage = {
      load: vi.fn(),
      save: vi.fn()
    };
    
    // Mock WebGL detection
    mockDetectWebGL = vi.fn();
    vi.mock('@teensyrom-nx/infrastructure/utils', () => ({
      detectWebGLSupport: mockDetectWebGL
    }));
    
    await TestBed.configureTestingModule({
      imports: [[Component]Component],
      providers: [
        { provide: CrtStorageService, useValue: mockCrtStorage }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent([Component]Component);
    component = fixture.componentInstance;
  });

  describe('CRT Settings Initialization', () => {
    it('should load saved settings when available', () => {
      // Test saved settings scenario
    });
    
    it('should use SMALL_WEBGL when no saved settings and WebGL available', () => {
      // Test WebGL detection = true
    });
    
    it('should use SMALL_CSS when no saved settings and WebGL unavailable', () => {
      // Test WebGL detection = false
    });
  });

  describe('Configuration', () => {
    it('should use correct CRT config', () => {
      // Verify crtConfig property
    });
    
    it('should use correct storage key', () => {
      // Verify storage key unchanged
    });
  });
});
```

### 2. Mock Setup

**WebGL Detection Mock**:
```typescript
// Before each test, control return value
mockDetectWebGL.mockReturnValue(true);  // WebGL available
// OR
mockDetectWebGL.mockReturnValue(false); // WebGL unavailable
```

**Storage Mock**:
```typescript
// Saved settings scenario
mockCrtStorage.load.mockReturnValue({
  scanlineIntensity: 0.5,
  // ... mock settings
});

// First-time user scenario
mockCrtStorage.load.mockReturnValue(null);
```

### 3. Test Scenarios for Each Component

**File-Image Component**:
- [ ] Saved settings: Loads from storage, detection not called
- [ ] WebGL available: Uses SMALL_WEBGL preset
- [ ] WebGL unavailable: Uses SMALL_CSS preset
- [ ] Config is `CRT_CONFIGS.small`
- [ ] Storage key is `'file-image'`
- [ ] No curvature override applied

**Video-Capture Component**:
- [ ] Saved settings: Loads from storage, detection not called
- [ ] WebGL available: Uses SMALL_WEBGL preset
- [ ] WebGL unavailable: Uses SMALL_CSS preset
- [ ] Config is `CRT_CONFIGS.small`
- [ ] Storage key is `'video-compact'`
- [ ] Device enumeration works

**Video-Dialog Component**:
- [ ] Saved settings: Loads from storage, detection not called
- [ ] WebGL available: Uses LARGE_WEBGL preset
- [ ] WebGL unavailable: Uses LARGE_CSS preset
- [ ] Config is `CRT_CONFIGS.large`
- [ ] Storage key is `'video-dialog'`
- [ ] Dialog data injection works
- [ ] Fullscreen toggle works

### 4. Cleanup Tasks

**Remove Old Tests**:
- Tests checking for IMAGE_WEBGL, IMAGE_CSS, FULLSCREEN_WEBGL, FULLSCREEN_CSS, DIALOG_* presets
- Tests verifying curvature override behavior in file-image
- Tests checking for `fileImageDefaultSettings` constant
- Tests expecting hardcoded crtSettings in video-dialog

**Update Expectations**:
- Replace old preset key references with new keys
- Update config references (`full` → `large`)
- Update any hardcoded CRT setting values to match new preset values

---

## 🧪 Testing Requirements

**Test Execution**:

```powershell
# Run player feature tests (includes all three components)
pnpm nx test player --watch=false

# Run in watch mode for development
pnpm nx test player --watch

# Run with coverage
pnpm nx test player --coverage
```

**Expected Test Coverage**:
- [ ] File-image component: 6+ tests covering initialization and config
- [ ] Video-capture component: 7+ tests covering initialization, config, and devices
- [ ] Video-dialog component: 7+ tests covering initialization, config, and dialog behavior
- [ ] All tests passing
- [ ] Coverage >80% for all component files

**Behavioral Testing Focus**:
- Test what users/consumers observe (preset selection, settings persistence)
- Don't test internal implementation (how detection is called internally)
- Mock at boundaries (storage service, detection utility)
- Use real component logic (don't mock component methods)

---

## 📖 Reference Materials

**Related Documentation**:
- [Testing Standards](../../../TESTING_STANDARDS.md) - Core testing philosophy
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component patterns
- [Phase 2 Plan - Task 5](../phases/CRT-PRESET-SIMPLIFICATION-PHASE-02-COMPONENT-IMPLEMENTATION.md#task-5-update-component-tests)

**Related Tasks**:
- CRT-PRESET-SIMPLIFICATION-TASK-02-001: WebGL detection utility (function to mock)
- CRT-PRESET-SIMPLIFICATION-TASK-02-002: File-image implementation (test this)
- CRT-PRESET-SIMPLIFICATION-TASK-02-003: Video-capture implementation (test this)
- CRT-PRESET-SIMPLIFICATION-TASK-02-004: Video-dialog implementation (test this)

**Reports from Previous Tasks**:
- [Task 02-001 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-001-REPORT.md) - Detection utility
- [Task 02-002 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-002-REPORT.md) - File-image changes
- [Task 02-003 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-003-REPORT.md) - Video-capture changes
- [Task 02-004 Report](../reports/CRT-PRESET-SIMPLIFICATION-TASK-02-004-REPORT.md) - Video-dialog changes

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-PRESET-SIMPLIFICATION/reports/CRT-PRESET-SIMPLIFICATION-TASK-02-005-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 💡 Implementation Notes

**Testing Philosophy**:
- **Behavioral focus**: Test observable outcomes (which preset selected, settings persisted)
- **Mock at boundaries**: Mock storage service, detection utility, dialog data
- **Real logic**: Don't mock component methods or internal logic
- **Clear scenarios**: Each test clearly indicates scenario (saved/WebGL true/WebGL false)

**Common Testing Patterns**:

**Pattern 1: Saved Settings Override Detection**
```typescript
it('should load saved settings without calling detection', () => {
  mockCrtStorage.load.mockReturnValue(mockSettings);
  mockDetectWebGL.mockReturnValue(true); // Should not be used
  
  component.ngOnInit(); // or trigger effect
  
  expect(component.crtSettings()).toEqual(mockSettings);
  expect(mockDetectWebGL).not.toHaveBeenCalled();
});
```

**Pattern 2: WebGL Detection for First-Time User**
```typescript
it('should use SMALL_WEBGL when WebGL available', () => {
  mockCrtStorage.load.mockReturnValue(null);
  mockDetectWebGL.mockReturnValue(true);
  
  component.ngOnInit(); // or trigger effect
  
  expect(component.crtSettings()).toEqual(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_WEBGL]);
  expect(mockDetectWebGL).toHaveBeenCalledOnce();
});
```

**Vitest Mocking Notes**:
- Use `vi.fn()` for function mocks
- Use `vi.spyOn()` for spying on real functions
- Use `mockReturnValue()` to control return values
- Use `toHaveBeenCalled()` / `toHaveBeenCalledOnce()` for assertions

**Angular Testing Notes**:
- Use `TestBed.configureTestingModule()` for component setup
- Provide mocked services in `providers` array
- Use `ComponentFixture` for testing rendered output
- Call `fixture.detectChanges()` to trigger change detection when needed
