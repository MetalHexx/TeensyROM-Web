# Technical Debt

This document tracks known technical debt items that should be addressed in future iterations.

## UI Components Layer

### CRT_PRESET_LABELS Test Failures

**Priority**: Low  
**Effort**: 2-4 hours  
**Created**: 2025-12-14  
**Discovered During**: BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION

**Issue**: 4 test failures in `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts` related to `CRT_PRESET_LABELS` format. Tests reference legacy 2-preset system, but current implementation uses 3 context-based presets.

**Affected Files**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts` (lines 181-205)

**Current Problems**:
- Test expects 2 labels, actual count is 3
- Tests reference undefined legacy keys (`SMALL_WEBGL`, `LARGE_WEBGL`)
- Tests expect format "Small (WebGL)", actual is "Small Video (WebGL)"
- Regex validation expects no "Video/Image" in label text

**Failing Tests**:
1. "should have exactly 3 labels" - expects 2, got 3
2. "should have labels for all preset keys" - Cannot read properties of undefined
3. "should have concise human-readable labels" - expects "Small (WebGL)", got undefined
4. "should follow Size (WebGL) format" - expects `/^(Small|Large) \(WebGL\)$/`, got "Small Video (WebGL)"

**Root Cause**: Tests written for legacy preset system before context-based naming migration. Current system has:
- `SMALL_VIDEO_WEBGL` (was `SMALL_WEBGL`)
- `LARGE_VIDEO_WEBGL` (was `LARGE_WEBGL`)
- `SMALL_IMAGE_WEBGL` (new preset)

**Impact**: Test failures only - no runtime impact. `CRT_PRESET_LABELS` is properly defined and used correctly in production code.

**Recommended Solution**:
```typescript
// Update test expectations:
1. Change expected count from 2 to 3
2. Replace CRT_PRESET_KEYS.SMALL_WEBGL → CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL
3. Replace CRT_PRESET_KEYS.LARGE_WEBGL → CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL
4. Update label format regex to: /^(Small|Large) (Video|Image)? \(WebGL\)$/
5. Update expected label values to match current format
```

**Benefits**:
- Test suite back to 100% passing
- Proper validation of current preset naming
- Clear documentation of preset label format

**Blockers**: None  
**Blocks**: None (does not block barrel distortion feature or other work)

**Related**: BARREL-DISTORTION project Phase 1 (verified domain integration was not affected by these failures)

---

## Testing Infrastructure

### HTTP Backend Mocking in Integration Tests

**Priority**: Medium  
**Effort**: 2-3 days  
**Created**: 2025-01-08

**Issue**: Several integration tests are using real HTTP backends instead of mocked services, which creates dependencies on external services and makes tests less reliable.

**Affected Files**:

- `libs/domain/device/services/src/lib/device.service.integration.spec.ts` - Uses real HTTP client with `localhost:5168`
- `libs/domain/device/services/src/lib/storage.service.integration.spec.ts` - Uses real HTTP client with `localhost:5168`

**Current Problems**:

- Tests require backend API to be running on `localhost:5168`
- Tests are fragile and can fail due to network issues
- Difficult to test error scenarios consistently
- CI/CD pipelines require backend setup
- Slower test execution due to real HTTP calls

**Recommended Solution**:
Migrate to MSW (Mock Service Worker) for all integration tests:

- Replace real HTTP clients with MSW handlers
- Mock all API endpoints used in integration tests
- Create reusable MSW setup utilities
- Test both success and error scenarios with controlled responses
- Follow the patterns established in `TESTING_STANDARDS.md`

**Benefits**:

- Faster, more reliable tests
- Better error scenario coverage
- No backend dependencies
- CI/CD friendly
- Consistent with testing standards

**Breaking Changes**: None - tests will continue to work the same way

---

### SCSS Mixin Consolidation

**Priority**: Low  
**Effort**: 1-2 hours  
**Created**: 2026-01-30  
**Discovered During**: CUSTOM-TOOLTIP Phase 3 polish

**Issue**: Interactive element mixins (`bounce-hover`, `selectable-item`, `pulsing-highlight`) are still defined in `styles.scss` instead of the extracted `_mixins.scss` file. This creates inconsistency with the glassy mixin refactoring and prevents components from importing these reusable patterns.

**Affected Files**:
- `libs/ui/styles/src/lib/theme/styles.scss` (lines ~156-216)
- `libs/ui/components/src/lib/nav-rail/nav-rail-item.component.scss` (manual glassy effect)
- `libs/ui/components/src/lib/menu-item/menu-item.component.scss` (manual border-radius)
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu-item.component.scss` (should use selectable-item)

**Current Problems**:
- Mixins split across two files (glassy in `_mixins.scss`, interactive in `styles.scss`)
- Components implement hover/active patterns inconsistently
- Cannot import interactive mixins without side effects
- nav-rail-item uses manual `rgba(var(--glassy-color), 0.15)` instead of mixin
- Missing `@keyframes pulsing-highlight` in component-importable location

**Recommended Solution**:
1. Move `bounce-hover`, `selectable-item`, `pulsing-highlight` mixins to `_mixins.scss`
2. Move `@keyframes pulsing-highlight` to `_mixins.scss`
3. Update `styles.scss` to use namespaced mixin imports
4. Refactor nav-rail-item, menu-item, dropdown-menu-item to use standard mixins
5. Update STYLE_GUIDE.md with interactive mixin usage examples

**Benefits**:
- Consistent architecture (all mixins in one place)
- Reusable interactive patterns across components
- Smaller CSS bundle (shared mixin code)
- Enforced design token compliance
- Easier to maintain interactive behavior globally

**Blockers**: None

---

### Angular TestBed Initialization Timing in Domain Library Tests

**Priority**: Low  
**Effort**: 1-2 days  
**Created**: 2025-01-09

**Issue**: Domain library tests that import Angular dependencies experience TestBed initialization timing issues, causing the first test in each file to fail with "Need to call TestBed.initTestEnvironment() first".

**Affected Files**:

- `libs/domain/storage/state/src/lib/storage-key.util.spec.ts` - First test fails, 11/12 pass
- `libs/domain/storage/state/src/lib/storage-store.spec.ts` - First test fails, 6/7 pass

**Current Problems**:

- First test in each domain library test file fails due to TestBed timing
- Subsequent tests pass normally, indicating logic is correct
- Tests work properly in application context (app builds successfully)
- Inconsistent test results due to initialization race condition

**Root Cause**:
TestBed environment initialization occurs after the first test begins execution, but before subsequent tests run. The `test-setup.ts` calls `initTestEnvironment()` but timing with individual test execution is inconsistent.

**Current Workaround**:
Tests demonstrate correct implementation logic (11/12 and 6/7 tests pass), and application integration works properly. The failing tests are environment setup issues, not implementation problems.

**Recommended Solution**:

- Investigate TestBed initialization timing in isolated library tests
- Compare with working component tests that use similar patterns
- Consider moving pure utility tests (like StorageKeyUtil) to not require Angular TestBed
- Align test setup with successful patterns from `libs/app/navigation/`

**Benefits**:

- 100% test pass rate for domain libraries
- More reliable CI/CD test execution
- Better developer experience during testing

**Breaking Changes**: None - implementation logic is already correct

---

## Code Quality

### Replace String Literals with Strongly Typed Button Colors

**Priority**: Medium  
**Effort**: 1-2 days  
**Created**: 2025-09-30

**Issue**: Button color properties are currently using string literals instead of strongly typed values, which reduces type safety and can lead to runtime errors from invalid color values.

**Affected Files**:

- `libs/features/player/src/lib/player-view/player-device-container/storage-container/filter-toolbar/random-roll-button/random-roll-button.component.ts` - Uses `input<IconButtonColor>('normal')`
- `libs/ui/components/src/lib/icon-button/icon-button.component.ts` - Likely has similar string literal usage
- Any other components that accept color properties as inputs

**Current Problems**:

- String literals like `'normal'` can be mistyped without compile-time errors
- No IntelliSense/autocomplete for available color options
- Runtime errors possible from invalid color values
- Inconsistent color naming across components
- Difficult to refactor color values across the codebase

**Example of Current Issue**:

```typescript
getButtonColor = input<IconButtonColor>('normal'); // 'normal' is a magic string
```

**Recommended Solution**:
Create strongly typed color constants and enums:

1. Define `IconButtonColor` enum or const assertion object with all valid colors
2. Replace string literals with typed constants (e.g., `IconButtonColor.NORMAL`)
3. Update all components to use typed color values
4. Create type-safe color utilities and validation
5. Ensure consistent color naming and theming across components

**Example of Desired Solution**:

```typescript
// Define typed colors
export const IconButtonColors = {
  NORMAL: 'normal',
  ERROR: 'error',
  HIGHLIGHT: 'highlight',
  SUCCESS: 'success',
} as const;

export type IconButtonColor = (typeof IconButtonColors)[keyof typeof IconButtonColors];

// Usage with type safety
getButtonColor = input<IconButtonColor>(IconButtonColors.NORMAL);
```

**Benefits**:

- Compile-time type safety for color values
- IntelliSense support and autocomplete
- Easier refactoring and renaming of colors
- Consistent color system across components
- Prevention of runtime errors from typos
- Better maintainability and documentation

**Breaking Changes**: Minor - existing string values will continue to work, but imports may need updating

### Remove Remaining `any` Usage

**Priority**: Low  
**Effort**: 1 day  
**Created**: 2025-01-08

**Issue**: There may still be some `any` types in the codebase that should be replaced with proper TypeScript types.

**Action Items**:

- Search codebase for remaining `any` usage
- Replace with proper types where possible
- Add type annotations for better type safety
- Update ESLint rules to prevent new `any` usage

---

## Architecture

### Create Domain Enum Types for API Client Enums

**Priority**: Medium  
**Effort**: 2-3 days  
**Created**: 2025-01-09

**Issue**: The generated API client contains enum types that create unwanted Angular dependencies in pure utility functions and domain logic that should be framework-agnostic.

**Current Problems**:

- Pure utility functions are forced to import Angular-specific types from `@teensyrom-nx/data-access/api-client`
- Testing pure utility functions becomes difficult due to Angular dependencies
- Domain logic is tightly coupled to API client implementation details
- Violates separation of concerns between domain and infrastructure layers

**Examples**:

- `TeensyStorageType` from API client is used in storage domain services
- `FileItemType` from API client is used in storage mappers and utilities
- Domain logic cannot be tested in isolation without Angular test setup

**Recommended Solution**:

1. Create domain-specific enum types in appropriate domain libraries:
   - `libs/domain/storage/models/` for storage-related enums
   - `libs/domain/device/models/` for device-related enums
2. Create mapper functions to convert between API client enums and domain enums
3. Update domain services and utilities to use domain enums only
4. Keep API client enum usage confined to infrastructure/API layers

**Benefits**:

- Pure domain logic can be tested without Angular dependencies
- Better separation of concerns between domain and infrastructure
- Easier to unit test utility functions
- More maintainable and flexible architecture
- Aligns with domain-driven design principles

**Breaking Changes**: Minor - will require updating imports in affected files

---

## UI/UX

### Material Menu Flicker on Close

**Priority**: Medium  
**Effort**: 2-3 days  
**Created**: 2025-11-25

**Issue**: When Material menus close (specifically the play timer menu in player toolbar), the entire browser content flickers briefly. This affects both the video dialog and the main player view where the toolbar is used.

**Affected Components**:
- `libs/features/player/src/lib/player-view/player-device-container/player-toolbar/player-toolbar-actions/player-toolbar-actions.component.html` - Timer menu trigger
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.scss` - Toolbar visibility during menu interaction
- Global Material menu behavior

**Current Problems**:
- Entire page content flickers when menu closes (not just toolbars)
- Affects user experience across all views using the player toolbar
- Not isolated to dialog backdrop or overlay - occurs on regular page content
- Appears to be a browser repaint/rendering issue triggered by Material's menu close behavior

**Attempted Solutions**:
- Added `body:has(.mat-mdc-menu-panel)` selector to force toolbar visibility during menu interaction
- Disabled transitions with `transition: none !important` while menu is open
- Tried `matMenuTriggerRestoreFocus="false"` to prevent focus restoration
- Added pointer-events disabling via MutationObserver
- Attempted to disable backdrop/overlay transitions
- Added `will-change: auto` reset on menu close

**Recommended Solution**:
- Investigate Material menu lifecycle hooks and overlay rendering
- Consider using custom menu implementation or dropdown component
- Research browser-specific rendering optimizations
- Look into Material CDK overlay configuration options
- Test with different Angular Material versions to identify regression

**Benefits**:
- Smoother user experience when interacting with menus
- Professional appearance without visual glitches
- Better overall UI polish

**Breaking Changes**: May require replacing Material menu with custom implementation

### Player View Responsiveness Issues

**Priority**: Medium
**Effort**: 1-2 days
**Created**: 2025-01-20

**Issue**: The player view layout has general responsiveness problems at various screen resolutions that need further refinement and testing across different device sizes.

**Affected Files**:

- `libs/features/player/src/lib/player-view/player-device-container/storage-container/storage-container.component.scss`
- `libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-files/directory-files.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree.component.ts`

**Current Problems**:

- Layout behavior needs refinement across different screen sizes
- May need additional breakpoint adjustments for optimal user experience
- Component sizing and responsive behavior could be improved

**Recommended Solution**:

- Comprehensive testing across different screen sizes and devices
- Fine-tune responsive breakpoints and component sizing
- Implement additional responsive improvements as needed
- Consider user feedback on layout behavior

**Benefits**:

- Better user experience across all screen sizes
- Optimal layout behavior on various devices
- Smoother responsive transitions
- Improved overall usability

**Breaking Changes**: None - purely layout and responsiveness improvements

### Directory Tree Placeholder Animation Issue

**Priority**: Low
**Effort**: 0.5-1 day
**Created**: 2025-01-19

**Issue**: The directory tree view uses placeholders for unloaded directories to ensure collapse/expand chevrons are always rendered. However, when a directory loads and contains no subdirectories, it causes a quick expand/collapse animation that creates a jarring user experience.

**Affected Files**:

- `libs/features/player/src/lib/player-view/player-device-container/storage-container/directory-tree/directory-tree.component.html`

**Current Problems**:

- Placeholder nodes ensure chevrons are visible before directory loading
- When directory loads with zero subdirectories, node briefly expands then immediately collapses
- Creates visual flicker and poor user experience
- Unnecessary DOM manipulation and animation triggers

**Recommended Solution**:

- Modify directory loading logic to check subdirectory count before rendering
- Only show chevron for directories that actually contain subdirectories
- Remove placeholder nodes or make them conditional based on actual directory contents
- Consider lazy loading of chevron visibility based on directory metadata

**Benefits**:

- Smoother user experience without jarring animations
- Reduced unnecessary DOM updates
- More intuitive visual feedback (chevron only appears when expandable)
- Better performance by avoiding placeholder manipulation

**Breaking Changes**: None - purely visual behavior improvement

---

## Performance

_No current items_

---

## Security

_No current items_

---

## Completed

### Player Toolbar Component Helper Method Tests Failing

**Priority**: Medium  
**Effort**: 1 day  
**Created**: 2025-11-26  
**Resolved**: 2025-11-26

**Issue**: 22 tests in `player-toolbar.component.spec.ts` were failing because helper methods were removed or renamed during refactoring, but tests were not updated accordingly.

**Solution Applied**:
Updated all 22 failing tests to use computed signals instead of method calls:
- Changed `getPlayPauseIcon()` → `getPlayPauseIconComputed()`
- Changed `getPlayPauseLabel()` → `getPlayPauseLabelComputed()`
- Changed `isCurrentFileMusicType()` → `isCurrentFileMusicTypeComputed()`
- Changed `canNavigate()` → `canNavigateComputed()`
- Changed `canNavigatePrevious()` → `canNavigatePreviousComputed()`
- Changed `getPlayButtonColor()` → `getPlayButtonColorComputed()`

**Result**: All 44 tests in player-toolbar.component.spec.ts now pass successfully.

### Player Toolbar Actions Timer Menu Template Test Failing

**Priority**: Low  
**Effort**: 1 hour  
**Created**: 2025-11-26  
**Resolved**: 2025-11-26

**Issue**: 1 test in `player-toolbar-actions.component.spec.ts` expected a `mat-menu` element in the template, but the component was using `lib-dropdown-menu` instead.

**Solution Applied**:
Updated test selector from `mat-menu` to `lib-dropdown-menu` to match actual template implementation.

**Result**: All 69 tests in player-toolbar-actions.component.spec.ts now pass successfully.

---

## Notes

- Items should be prioritized as: Critical > High > Medium > Low
- Effort estimates: < 1 day (Small), 1-3 days (Medium), 1+ weeks (Large)
- Include creation date for tracking
- Archive completed items to "Completed" section with resolution date
- Archive completed items to a "Completed" section with resolution date
