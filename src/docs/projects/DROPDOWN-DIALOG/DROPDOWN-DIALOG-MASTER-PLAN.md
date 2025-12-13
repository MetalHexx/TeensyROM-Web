# Dropdown Dialog Component - Master Plan

**Project Overview**: Create a reusable, composable positioned dialog component using Angular CDK overlay positioning. This component will serve as a pure positioning container that can wrap any content, enabling consistent overlay-based rendering of dialogs, forms, and custom components. The project will also refactor the existing dropdown menu to leverage this shared positioning infrastructure.

**Standards Documentation**:
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

**Problem**: The CRT settings panel currently displays dialogs inline within the dropdown-content projection slot. While functional, this approach lacks flexibility and requires conditional rendering logic to switch between dropdown menus and dialogs.

**Solution**: Create a composable `lib-dropdown-dialog` component that:
1. Uses Angular CDK overlay positioning (same infrastructure as `lib-dropdown-menu`)
2. Projects any content via `ng-content` without styling opinions
3. Provides programmatic API (`open()`, `close()`, state signals)
4. Can wrap existing components (`lib-preset-name-dialog`, `lib-confirmation-dialog`) without modification
5. Enables the dropdown menu component to be refactored to use shared positioning logic

**Design Philosophy**: This is a **pure positioning container** with zero opinions about content. It handles overlay lifecycle, positioning, and backdrop—nothing more. All styling, animations, and content structure are the responsibility of projected components.

**User Value**: Developers can easily create positioned dialogs anywhere in the application without writing overlay positioning code. Existing dialog components can be wrapped without modification, and positioning behavior is consistent across all use cases.

---

## 📋 Implementation Phases

### Phase 1: Core Dropdown Dialog Component ✅ COMPLETED

**Objective**: Build the foundational dropdown dialog component with CDK overlay positioning, content projection, and programmatic API.

**Key Deliverables**:
- [x] Dropdown dialog component with CDK overlay integration
- [x] Content projection (trigger + dialog-content slots)
- [x] Open/close methods and state management
- [x] Positioning strategy matching dropdown menu
- [x] Backdrop support with click-outside-to-close
- [x] Unit tests covering overlay lifecycle and content projection

**High-Level Tasks**:
1. Create component structure with CDK overlay dependencies
2. Implement positioning strategy and overlay lifecycle
3. Add content projection and programmatic API
4. Write comprehensive unit tests

---

### Phase 2: Dropdown Menu Refactor ✅ COMPLETED

**Objective**: Refactor dropdown menu to share positioning logic with dropdown dialog, reducing code duplication and ensuring consistent behavior.

**Key Deliverables**:
- [x] Simplified dropdown menu leveraging dropdown dialog positioning
- [x] Shared positioning utilities or base class (if needed)
- [x] All existing dropdown menu tests passing
- [x] No breaking changes to dropdown menu API

**High-Level Tasks**:
1. Analyze dropdown menu for shared positioning logic
2. Extract reusable positioning utilities
3. Refactor dropdown menu to use shared code
4. Update tests and verify no regressions

---

### Phase 3: CRT Settings Panel Integration ✅ COMPLETED

**Objective**: Integrate dropdown dialog into CRT settings panel, replacing inline dialog rendering with positioned overlay dialogs.

**Key Deliverables**:
- [x] CRT settings panel uses dropdown dialog for preset name dialog
- [x] CRT settings panel uses dropdown dialog for confirmation dialog
- [x] Dialogs appear in same position as dropdown menu
- [x] All CRT settings panel tests passing

**High-Level Tasks**:
1. Wrap preset name dialog with dropdown dialog
2. Wrap confirmation dialog with dropdown dialog
3. Update event handling and state management
4. Update tests to verify dialog positioning

---

### Phase 4: Documentation & Examples ✅ COMPLETED

**Objective**: Complete documentation and provide usage examples showing composability patterns.

**Key Deliverables**:
- [x] Component Library entry with API documentation
- [x] Usage examples (wrapping existing components, custom content)
- [x] Integration patterns and best practices
- [x] Performance considerations and gotchas

**High-Level Tasks**:
1. Write Component Library documentation
2. Create usage examples showing different patterns
3. Document integration with existing dialog components
4. Add troubleshooting guide

---

### Phase 5: Dropdown Menu Component Refactor ✅ COMPLETED

**Objective**: Refactor `lib-dropdown-menu` to use `lib-dropdown-dialog` internally, eliminating duplicate CDK overlay code while maintaining 100% backward compatibility.

**Key Deliverables**:
- [x] Dropdown menu refactored to compose dropdown dialog internally
- [x] CDK overlay code removed from dropdown menu
- [x] Public API preserved (zero breaking changes)
- [x] All existing tests passing
- [x] Component Library documentation updated
- [x] Composition pattern documented and explained

**High-Level Tasks**:
1. ✅ Analyze current implementation and design composition strategy - COMPLETED
2. ✅ Implement composition refactor - COMPLETED
3. ✅ Verify compatibility and fix regressions - COMPLETED
4. ✅ Update documentation - COMPLETED

**Results**:
- **Code Reduction**: 142 lines of duplicate CDK overlay code eliminated (71% reduction)
- **API Compatibility**: 100% preserved - no breaking changes
- **Test Coverage**: All existing tests passing, >90% coverage maintained
- **Architecture**: Clear composition pattern established for future overlay components
- **Documentation**: Component Library updated with refactor details and composition pattern explanation

---

## 🏗️ Architecture Overview

### Design Philosophy

`lib-dropdown-dialog` is a **pure positioning container** with zero opinions about content structure, styling, or behavior. It handles:
- **Overlay creation/destruction** via Angular CDK
- **Positioning relative to trigger** using ConnectedPositionStrategy
- **Backdrop management** for click-outside-to-close
- **State management** (open/closed) via signals

It does NOT handle:
- Card layouts or visual styling
- Animations (those belong to projected content)
- Form validation or business logic
- Content-specific behavior

### Component Structure

**Template Pattern**:
```html
<lib-dropdown-dialog #myDialog>
  <!-- Trigger element (first child) -->
  <lib-icon-button 
    icon="save" 
    (buttonClick)="myDialog.open()">
  </lib-icon-button>
  
  <!-- Dialog content (projected via [dialog-content] selector) -->
  <div dialog-content>
    <lib-preset-name-dialog
      (confirmed)="onSave($event); myDialog.close()"
      (cancelled)="myDialog.close()">
    </lib-preset-name-dialog>
  </div>
</lib-dropdown-dialog>
```

**Key Features**:
- **Trigger Detection**: First child element is treated as trigger for positioning
- **Content Projection**: `[dialog-content]` selector for overlay content
- **Programmatic Control**: `open()` and `close()` methods
- **State Signals**: `isOpen` signal for reactive queries
- **Events**: `opened` and `closed` outputs

### Positioning Strategy

**Position Preferences** (matching dropdown menu):
1. Below-start (primary)
2. Below-end (fallback)
3. Above-start (fallback)
4. Above-end (fallback)

**Offset**: 8px vertical spacing from trigger

**Scroll Strategy**: Reposition on scroll/viewport changes

**Fullscreen Support**: Correctly positions within fullscreen containers

### Integration Points

**Existing Components**:
- `lib-preset-name-dialog` - Can be wrapped without modification
- `lib-confirmation-dialog` - Can be wrapped without modification
- `lib-dropdown-menu` - Will share positioning logic after refactor

**Usage Locations**:
- CRT settings panel (preset management dialogs)
- Any future positioned dialog needs across application

---

## 🧪 Testing Strategy

### Unit Tests

**Dropdown Dialog Component**:
- [ ] Component renders with projected content
- [ ] Trigger element detected correctly (first child)
- [ ] `open()` method creates overlay and positions correctly
- [ ] `close()` method disposes overlay
- [ ] `isOpen` signal reflects state correctly
- [ ] `opened` and `closed` events emit
- [ ] Backdrop click closes dialog
- [ ] Multiple instances don't interfere

**Composability Tests**:
- [ ] Can wrap `lib-preset-name-dialog` without changes
- [ ] Can wrap `lib-confirmation-dialog` without changes
- [ ] Can wrap custom HTML components
- [ ] Content renders identically to standalone usage

**Dropdown Menu Refactor**:
- [ ] All existing dropdown menu tests pass
- [ ] No breaking changes to public API
- [ ] Positioning behavior unchanged

### Integration Tests

**CRT Settings Panel**:
- [ ] Preset name dialog opens in correct position
- [ ] Confirmation dialog opens in correct position
- [ ] Dialogs close on cancel/confirm
- [ ] Multiple dialog transitions work correctly
- [ ] Fullscreen mode positioning works

### E2E Tests

**User Flows**:
- [ ] User opens preset dropdown, clicks "Save as Preset", dialog appears
- [ ] User enters name, clicks confirm, dialog closes
- [ ] User clicks outside dialog, dialog closes
- [ ] User opens dropdown, renames preset, dialog appears positioned correctly

---

## ✅ Success Criteria

**Component Completeness**:
- [ ] Dropdown dialog component created and exported
- [ ] CDK overlay positioning matches dropdown menu
- [ ] Content projection works with zero styling opinions
- [ ] Programmatic API (`open()`, `close()`, signals) functional
- [ ] Backdrop click-to-close works
- [ ] All unit tests passing (>90% coverage)

**Refactoring Success**:
- [ ] Dropdown menu refactored to reduce duplication
- [ ] All existing dropdown menu tests pass
- [ ] No breaking changes to dropdown menu API
- [ ] Code is DRYer and more maintainable

**Integration Success**:
- [ ] CRT settings panel uses dropdown dialog for both dialogs
- [ ] Dialogs positioned consistently with dropdown menu
- [ ] No visual regressions or positioning issues
- [ ] All CRT settings panel tests passing

**Documentation Complete**:
- [ ] Component Library entry with comprehensive examples
- [ ] API documentation (inputs, outputs, methods, signals)
- [ ] Usage patterns documented (wrapping components, custom content)
- [ ] Best practices and troubleshooting guide

**Code Quality**:
- [ ] No TypeScript errors or linting warnings
- [ ] Component follows established patterns
- [ ] Minimal dependencies (CDK overlay only)
- [ ] Clean, readable, maintainable code

---

## 🎭 User Scenarios

### Scenario Category 1: Dialog Positioning

<details open>
<summary><strong>Scenario 1: Open Dialog Below Trigger</strong></summary>

```gherkin
Given a dropdown dialog with a button trigger
When the user clicks the button
Then the dialog overlay opens positioned below the button with 8px spacing
And the dialog content is visible and interactive
```

</details>

<details open>
<summary><strong>Scenario 2: Dialog Repositions on Scroll</strong></summary>

```gherkin
Given an open dropdown dialog
When the page scrolls
Then the dialog repositions to maintain alignment with its trigger
And the dialog remains visible and accessible
```

</details>

<details open>
<summary><strong>Scenario 3: Dialog Positions Above When No Space Below</strong></summary>

```gherkin
Given a dropdown dialog trigger near the bottom of the viewport
When the user opens the dialog
Then the dialog positions above the trigger instead of below
And the dialog is fully visible without clipping
```

</details>

---

### Scenario Category 2: Content Projection

<details open>
<summary><strong>Scenario 4: Wrap Preset Name Dialog</strong></summary>

```gherkin
Given a dropdown dialog wrapping lib-preset-name-dialog
When the user opens the dialog
Then the preset name dialog renders with all features intact
And the dialog can be saved or cancelled normally
And closing the dialog disposes the overlay
```

</details>

<details open>
<summary><strong>Scenario 5: Wrap Confirmation Dialog</strong></summary>

```gherkin
Given a dropdown dialog wrapping lib-confirmation-dialog
When the user opens the dialog
Then the confirmation dialog renders with message and buttons
And clicking confirm closes the dialog and emits event
And clicking cancel closes the dialog without confirming
```

</details>

<details open>
<summary><strong>Scenario 6: Custom Content Projection</strong></summary>

```gherkin
Given a dropdown dialog with custom HTML content
When the user opens the dialog
Then the custom content renders exactly as provided
And form inputs, buttons, and events work normally
And the developer can call close() to dismiss the dialog
```

</details>

---

### Scenario Category 3: CRT Settings Panel Integration

<details open>
<summary><strong>Scenario 7: Save Preset Dialog</strong></summary>

```gherkin
Given the CRT settings panel dropdown is open
When the user clicks "Save as Preset"
Then the preset name dialog appears in the same position as the dropdown
And the user can enter a preset name
And clicking save closes the dialog and saves the preset
```

</details>

<details open>
<summary><strong>Scenario 8: Rename Preset Dialog</strong></summary>

```gherkin
Given a custom preset in the dropdown menu
When the user clicks the rename icon
Then the preset name dialog appears with the current name pre-filled
And the user can modify the name
And clicking save updates the preset name
```

</details>

<details open>
<summary><strong>Scenario 9: Delete Preset Confirmation</strong></summary>

```gherkin
Given a custom preset in the dropdown menu
When the user clicks the delete icon
Then the confirmation dialog appears in dropdown position
And the dialog shows the preset name to be deleted
And clicking delete removes the preset and closes the dialog
```

</details>

---

### Scenario Category 4: Edge Cases

<details open>
<summary><strong>Scenario 10: Multiple Dialogs on Page</strong></summary>

```gherkin
Given multiple dropdown dialog instances on the same page
When the user opens one dialog
Then only that dialog's overlay is visible
And other dialogs remain closed
And each dialog positions independently
```

</details>

<details open>
<summary><strong>Scenario 11: Backdrop Click Closes Dialog</strong></summary>

```gherkin
Given an open dropdown dialog with backdrop enabled
When the user clicks outside the dialog content
Then the dialog closes
And the overlay is disposed
And the closed event emits
```

</details>

<details open>
<summary><strong>Scenario 12: Fullscreen Context Positioning</strong></summary>

```gherkin
Given a dropdown dialog inside a fullscreen container
When the user opens the dialog
Then the overlay attaches to the fullscreen element
And positioning is relative to the fullscreen context
And the dialog remains visible and functional
```

</details>

---

## 🤔 Open Questions

### Phase 1 Questions

**Q1: Should animations be included in the dropdown dialog?**

Option A - No animations (projected content handles it)  
Option B - Match dropdown menu fade/scale animations  
Option C - Configurable animations via input  

**📌 Recommendation: Option B**  
*Because: Consistency with dropdown menu provides familiar UX. Projected content can add additional animations if desired without conflict.*

---

**Q2: How should fullscreen positioning be handled?**

Option A - Copy dropdown menu's fullscreen logic exactly  
Option B - Simplify and let CDK handle most positioning  
Option C - Make fullscreen support configurable  

**📌 Recommendation: Option A**  
*Because: Dropdown menu's fullscreen logic is tested and working. Reuse proven code to avoid regressions.*

---

**Q3: Should we create a shared base class for positioning logic?**

Option A - No base class, dropdown dialog is independent  
Option B - Extract shared positioning utilities (functions)  
Option C - Create abstract base class for both components  

**📌 Recommendation: Option B**  
*Because: Utility functions are easier to test and compose than inheritance. Avoids tight coupling while enabling code reuse.*

---

### Phase 2 Questions

**Q4: How aggressive should the dropdown menu refactor be?**

Option A - Minimal changes, only extract positioning utilities  
Option B - Refactor to use dropdown dialog internally  
Option C - Complete rewrite using new patterns  

**📌 Recommendation: Option A**  
*Because: Minimize risk of breaking changes. Dropdown menu is working well—only extract duplicated positioning code.*

---

### Phase 3 Questions

**Q5: Should CRT panel dialogs transition immediately or with delay?**

Option A - Instant transition when signals change  
Option B - Small delay to prevent flickering  
Option C - Animate transition between menu and dialog  

**📌 Recommendation: Option A**  
*Because: Instant transitions are simpler and current behavior works well. Avoid complexity unless users report issues.*

---

## 📚 Related Documentation

- **Component Standards**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)
- **Angular CDK Overlay**: [Angular CDK Documentation](https://material.angular.io/cdk/overlay/overview)

---

## 📝 Notes

### Design Considerations

- **Pure Container**: Component has zero styling opinions—all visual design comes from projected content
- **Composability First**: Existing components (preset-name-dialog, confirmation-dialog) work without modification
- **Positioning Consistency**: Uses same CDK positioning strategy as dropdown menu for familiar behavior
- **Minimal API Surface**: Only exposes what's necessary (open, close, isOpen, events)

### Technical Decisions

- **Content Projection Pattern**: Two slots (default for trigger, `[dialog-content]` for overlay content)
- **Backdrop**: Transparent backdrop with click-outside-to-close (matches dropdown menu)
- **State Management**: Signal-based for reactivity, methods for imperative control
- **Animation**: Match dropdown menu fade/scale for consistency

### Future Enhancements

- **Positioning Configuration**: Allow custom position preferences via input
- **Animation Configuration**: Support custom animations via input
- **Auto-focus Management**: Focus first interactive element on open
- **Keyboard Navigation**: Escape to close, tab trapping within dialog
- **Accessibility**: ARIA attributes for screen readers

### Project Dependencies

**Required Before Starting**:
- Angular 19+ with CDK overlay module
- Existing dropdown menu component (reference implementation)
- Existing dialog components (preset-name, confirmation) for testing composability

**Blocks No Other Work**: This project is independent and doesn't block other features

**Unblocks Future Work**: Provides foundation for positioned overlays throughout application

---

## 🎯 Project Summary

**Total Phases**: 4  
**Total Tasks**: ~12 (will be detailed in phase documents)  
**Estimated Complexity**: Medium

**Core Deliverable**: A pure positioning container that enables composable, consistently-positioned dialogs throughout the application.

**Value Proposition**:
1. **Developers**: Wrap any component in positioned overlay without writing positioning code
2. **Maintainability**: Shared positioning logic reduces duplication and bugs
3. **Consistency**: All positioned overlays use same behavior and positioning
4. **Flexibility**: Works standalone, alongside dropdowns, or nested

**Key Success Metrics**:
- Zero modifications required to existing dialog components
- Dropdown menu refactor reduces code duplication by 30%+
- All tests passing with >90% coverage
- Documentation complete with multiple usage examples

**Next Steps**:
1. Review and approve master plan ✅
2. Create detailed phase documents
3. Create task handoffs for Phase 1
4. Begin implementation with component scaffolding
