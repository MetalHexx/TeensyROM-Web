# Dropdown Dialog Component - Master Plan

**Project Overview**: Create a reusable positioned dialog component that uses the same CDK overlay positioning mechanism as the dropdown menu component. This will enable dialogs to appear in the same visual location as dropdowns, providing a seamless transition between menu content and dialog content without complex workarounds.

**Standards Documentation**:
- **Coding Standards**: [CODING_STANDARDS.md](../../CODING_STANDARDS.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../TESTING_STANDARDS.md)
- **Component Library**: [COMPONENT_LIBRARY.md](../../COMPONENT_LIBRARY.md)
- **Style Guide**: [STYLE_GUIDE.md](../../STYLE_GUIDE.md)

---

## 🎯 Project Objective

The CRT settings panel needs to display dialogs (save preset, rename preset, delete confirmation) in the same position as its dropdown menu. Currently, these dialogs are rendered inline within the dropdown-content projection slot, which works but lacks flexibility for positioning dialogs independently of the dropdown.

We need a new **composable** `lib-dropdown-dialog` component that:
1. Uses Angular CDK's overlay positioning (same as `lib-dropdown-menu`)
2. Projects **any content** via `ng-content` (no opinions about what's inside)
3. Can be used standalone OR alongside dropdowns
4. Enables consistent positioning of dialogs relative to trigger elements

**Key Design Principle**: This component is a **pure positioning container**. It should be generic enough to wrap existing components like `lib-preset-name-dialog`, `lib-confirmation-dialog`, or any custom content without modification. Think of it as a "positioned overlay wrapper" rather than a "dialog component with features."

---

## 📋 Implementation Phases

### Phase 1: Create Dropdown Dialog Component

**Objective**: Build a composable positioning container using CDK overlay that can wrap any content.

**Key Deliverables**:
- [ ] Base dropdown dialog component with CDK overlay integration (pure container)
- [ ] Content projection via `ng-content` with no styling opinions
- [ ] Programmatic API (`open()`, `close()`, events)
- [ ] Example integration showing `lib-preset-name-dialog` wrapped in dropdown dialog

**High-Level Tasks**:
1. Create `lib-dropdown-dialog` component structure with CDK overlay
2. Implement positioning system matching `lib-dropdown-menu` behavior
3. Demonstrate composability by wrapping existing dialogs

**Dependencies**:
- Existing `lib-dropdown-menu` component as reference pattern
- Angular CDK overlay module
- Existing `lib-preset-name-dialog` and `lib-confirmation-dialog` as test cases

---

## 🏗️ Architecture Overview

**Design Philosophy**: `lib-dropdown-dialog` is a **pure positioning container** with zero opinions about content. It handles overlay lifecycle, positioning, and backdrop—nothing more.

**Component Structure**:
- New `lib-dropdown-dialog` component in `libs/ui/components`
- Uses Angular CDK ConnectedPositionStrategy for overlay positioning
- Projects ALL content via `ng-content` (no internal templates or layouts)
- Exposes `open()` and `close()` methods for programmatic control
- Emits `opened` and `closed` events for parent component integration

**Integration Pattern - Composable Approach**:
```html
<!-- Wrap any existing component or custom content -->
<lib-dropdown-dialog #saveDialog>
  <!-- Trigger element (button, icon, etc.) -->
  <button (click)="saveDialog.open()">Save Preset</button>
  
  <!-- Dialog content - can be ANY component or markup -->
  <div dialog-content>
    <lib-preset-name-dialog
      [title]="'Save Preset'"
      (confirmed)="onConfirmed($event); saveDialog.close()"
      (cancelled)="saveDialog.close()">
    </lib-preset-name-dialog>
  </div>
</lib-dropdown-dialog>

<!-- OR with custom markup -->
<lib-dropdown-dialog #customDialog>
  <lib-icon-button 
    icon="info" 
    (buttonClick)="customDialog.open()">
  </lib-icon-button>
  
  <div dialog-content>
    <lib-scaling-compact-card>
      <h2>Custom Content</h2>
      <p>Any HTML you want!</p>
      <button (click)="customDialog.close()">Close</button>
    </lib-scaling-compact-card>
  </div>
</lib-dropdown-dialog>
```

**Positioning Strategy**:
- Anchors to the **first child element** of the component (the trigger)
- Uses same position preferences as dropdown: below-start, below-end, above-start, above-end
- Automatically repositions on scroll/viewport changes via CDK
- Optional backdrop support (transparent backdrop for click-outside-to-close behavior)

**Why This Approach Works**:
- **Reusable**: Wraps existing components (`lib-preset-name-dialog`) without changes
- **Flexible**: Works with custom markup, forms, confirmations, menus, etc.
- **Consistent**: Same positioning logic as `lib-dropdown-menu`
- **Composable**: Can be nested, combined, or used independently

**No Styling Opinions**:
The component should NOT include any card layouts, animations, or visual styling. Those are the responsibility of the projected content. This component only handles:
- Overlay creation/destruction
- Positioning relative to trigger
- Backdrop (if enabled)
- Open/close state management

---

## 🧪 Testing Strategy

**Unit Tests**:
- Component renders with projected content
- Open/close methods toggle overlay correctly
- Positioning configuration uses CDK strategy
- Event emission (opened, closed)
- Backdrop behavior (if enabled)
- Multiple content projection slots work correctly

**Integration Tests**:
- Dialog positions relative to trigger element
- Content projection with complex templates (e.g., `lib-preset-name-dialog`)
- Multiple dialogs on same page don't interfere
- Works inside fullscreen contexts
- Responsive repositioning on scroll/resize

**Composability Tests**:
- Can wrap `lib-preset-name-dialog` without modification
- Can wrap `lib-confirmation-dialog` without modification
- Can wrap custom markup with buttons and forms
- Nested dialogs (dialog inside dialog) work correctly

**Visual/Manual Tests**:
- Dialog appears in correct position relative to trigger
- Content renders exactly as it would outside the dialog
- Backdrop click closes dialog (if enabled)
- Responsive positioning on viewport changes

---

## ✅ Success Criteria

**Component Completeness**:
- [ ] Dropdown dialog component created and exported
- [ ] CDK overlay positioning implemented (matches dropdown menu)
- [ ] Content projection works with zero styling opinions
- [ ] Programmatic API (`open()`, `close()`) works correctly
- [ ] Documentation added to COMPONENT_LIBRARY.md

**Composability Validation**:
- [ ] Can wrap `lib-preset-name-dialog` without changes to that component
- [ ] Can wrap `lib-confirmation-dialog` without changes
- [ ] Can wrap custom HTML/components
- [ ] Projected content renders identically to standalone usage

**Integration Success**:
- [ ] Example usage in CRT settings panel (or similar)
- [ ] Dialogs appear in same position as dropdown menu
- [ ] No visual jumps or positioning issues
- [ ] Works in fullscreen and normal contexts

**Code Quality**:
- [ ] All unit tests passing
- [ ] Component follows established patterns from dropdown menu
- [ ] No TypeScript errors or linting warnings
- [ ] Minimal dependencies (CDK overlay only)

**User Experience**:
- [ ] Seamless positioning relative to triggers
- [ ] Backdrop behavior works (if implemented)
- [ ] Content inside dialog behaves normally (forms, buttons, events)

---

## 🤔 Open Questions

### Phase 1 Questions

**Component Design**:
1. **Positioning Strategy**: Should we expose position configuration as an input, or hard-code to match dropdown behavior?
   - Option A: Hard-code positions (below/above start/end) like dropdown menu
   - Option B: Accept position array input for flexibility
   - Option C: Both - default to dropdown positions, allow override
   
   **📌 Recommendation: Option A** - Start simple, match dropdown exactly. Add configuration later if needed.

2. **Backdrop Behavior**: How should backdrop work?
   - Option A: No backdrop (content floats over page)
   - Option B: Transparent backdrop with click-outside-to-close
   - Option C: Configurable backdrop via input
   
   **📌 Recommendation: Option B** - Transparent backdrop provides expected UX (close on outside click) without visual obstruction.

3. **Animation Strategy**: Should we include animations or let content handle it?
   - Option A: No animations in container (projected content animates itself)
   - Option B: Fade-in/scale animation like dropdown menu
   - Option C: Configurable animation via input
   
   **📌 Recommendation: Option B** - Match dropdown menu animations for consistency. Projected content can add additional animations if desired.

**Content Projection Pattern**:
1. **Trigger Detection**: How do we identify the trigger element?
   - Option A: First child is always trigger (simple convention)
   - Option B: Require `[dialog-trigger]` directive on trigger element
   - Option C: Accept trigger element via `@ViewChild` or input
   
   **📌 Recommendation: Option A** - Matches dropdown menu pattern (first child is trigger). Simple and intuitive.

2. **Content Projection Slots**: How many projection slots do we need?
   - Option A: Two slots - default (trigger) and `[dialog-content]` selector
   - Option B: Single slot - use first child as trigger, rest as content
   - Option C: Three slots - trigger, content, optional footer
   
   **📌 Recommendation: Option A** - Explicit and clear. Matches dropdown menu pattern with `[dropdown-content]`.

**API Design**:
1. **Close Mechanism**: How should content trigger dialog closure?
   - Option A: Content calls `dialog.close()` via template reference
   - Option B: Dialog listens for custom event from content
   - Option C: Both options supported
   
   **📌 Recommendation: Option A** - Simple template reference pattern. Content components can call `(confirmed)="dialog.close()"` in their event bindings.

2. **State Management**: Should dialog state be exposed?
   - Option A: Private state, only `open()`/`close()` methods
   - Option B: Public `isOpen` signal for reactive queries
   - Option C: Both methods and signal
   
   **📌 Recommendation: Option C** - Signal for reactive use cases, methods for imperative control. Matches dropdown menu.

---

## 📦 Phase Breakdown

### Phase 1: Create Dropdown Dialog Component (Single Phase)

**Estimated Scope**: Small (3-5 files)

**Tasks**:
1. **TASK-01-001**: Create dropdown dialog component with CDK overlay positioning
   - Component structure with two content projection slots
   - CDK overlay integration with positioning strategy
   - Open/close methods and state management
   - Event emission (opened, closed)
   - Backdrop support (transparent, click-outside-to-close)
   - Match dropdown menu animations

2. **TASK-01-002**: Create unit tests and validate composability
   - Test overlay lifecycle (open, close, positioning)
   - Test content projection with `lib-preset-name-dialog`
   - Test content projection with `lib-confirmation-dialog`
   - Test content projection with custom markup
   - Test backdrop click-to-close behavior

3. **TASK-01-003**: Update component library documentation
   - Add component entry to COMPONENT_LIBRARY.md
   - Include composability examples (wrapping existing components)
   - Document API (inputs, outputs, methods)
   - Add usage patterns and best practices

**Success Gates**:
- Component builds without errors
- All tests pass
- Can wrap existing dialogs without modifying them
- Documentation complete with examples

---

## 🎯 Project Summary

**Total Phases**: 1  
**Total Tasks**: 3  
**Estimated Complexity**: Small

**Core Design Principle**: **Composability through content projection**. This component is a pure positioning container with zero opinions about what goes inside it. It should wrap existing components like `lib-preset-name-dialog` and `lib-confirmation-dialog` without requiring any changes to those components.

**Value Delivered**:
- **Reusability**: One component that works with any content (dialogs, forms, menus, custom HTML)
- **Consistency**: Same positioning logic as dropdown menus across the application
- **Simplicity**: No need to modify existing dialog components to use overlay positioning
- **Flexibility**: Can be used standalone, alongside dropdowns, or nested

**Key Technical Decision**: This is NOT a "dialog component with features"—it's a "positioning wrapper". All content (cards, forms, buttons, animations) is the responsibility of projected components. This keeps the component focused and composable.

**Example Use Cases**:
```html
<!-- Wrap existing preset name dialog -->
<lib-dropdown-dialog #saveDialog>
  <lib-icon-button icon="save" (buttonClick)="saveDialog.open()"></lib-icon-button>
  <div dialog-content>
    <lib-preset-name-dialog 
      (confirmed)="onSave($event); saveDialog.close()"
      (cancelled)="saveDialog.close()">
    </lib-preset-name-dialog>
  </div>
</lib-dropdown-dialog>

<!-- Wrap existing confirmation dialog -->
<lib-dropdown-dialog #deleteDialog>
  <lib-icon-button icon="delete" (buttonClick)="deleteDialog.open()"></lib-icon-button>
  <div dialog-content>
    <lib-confirmation-dialog
      (confirmed)="onDelete(); deleteDialog.close()"
      (cancelled)="deleteDialog.close()">
    </lib-confirmation-dialog>
  </div>
</lib-dropdown-dialog>

<!-- Or use with custom content -->
<lib-dropdown-dialog #customDialog>
  <button (click)="customDialog.open()">Show Info</button>
  <div dialog-content>
    <lib-scaling-compact-card>
      <h2>Custom Dialog</h2>
      <p>Any content you want!</p>
      <button (click)="customDialog.close()">Close</button>
    </lib-scaling-compact-card>
  </div>
</lib-dropdown-dialog>
```

**Next Steps**:
1. Review and approve master plan
2. Create Phase 1 task document (TASK-01-001)
3. Begin implementation with component scaffolding
