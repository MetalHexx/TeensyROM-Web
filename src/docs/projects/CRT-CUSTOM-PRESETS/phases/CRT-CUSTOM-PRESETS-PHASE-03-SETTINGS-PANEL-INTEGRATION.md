# Phase 3: Settings Panel Integration

## 🎯 Objective

Integrate custom preset management into the existing CRT settings panel, extending the preset dropdown with save/delete/rename actions and wiring up the dialog components from Phase 2. This phase completes the feature by enabling users to create, manage, and apply custom presets through the settings UI.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Custom Presets Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md) - Complete feature overview
- [ ] [Phase 1: Storage Infrastructure](./CRT-CUSTOM-PRESETS-PHASE-01-STORAGE-INFRASTRUCTURE.md) - Storage layer
- [ ] [Phase 2: UI Dialog Components](./CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md) - Dialog components

**Component Documentation:**

- [ ] [CRT Settings Panel](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts) - Existing panel implementation
- [ ] [CRT Component Library](../../../../docs/COMPONENT_LIBRARY_CRT.md) - CRT system documentation
- [ ] [Dropdown Menu Component](../../../../libs/ui/components/src/lib/dropdown-menu/) - Menu patterns

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches
- [ ] [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Styling patterns

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts              📝 Modified - Add custom preset logic
├── crt-settings-panel.component.html            📝 Modified - Extend dropdown menu
├── crt-settings-panel.component.scss            📝 Modified - Add custom preset styles
├── crt-settings-panel.component.spec.ts         📝 Modified - Add custom preset tests
└── crt-slider-configs.ts                        (unchanged)

libs/features/player/src/lib/player-view/player-device-container/
├── video-capture/
│   ├── video-capture.component.ts               📝 Modified - Wire up custom presets
│   └── video-dialog/
│       └── video-dialog.component.ts            📝 Modified - Wire up custom presets
└── file-image/
    └── file-image.component.ts                  📝 Modified - Wire up custom presets
```

---

<details open>
<summary><h3>Task 1: Extend CRT Settings Panel State</h3></summary>

**Purpose**: Add state management to CRT settings panel for custom presets, including loading, tracking, and managing preset list.

**Related Documentation:**

- [Master Plan - Data Flow](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#data-flow)
- [CRT Settings Panel Component](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)

**Implementation Subtasks:**

- [ ] **Inject CrtStorageService**: Add `CRT_STORAGE` dependency injection
- [ ] **Add Custom Presets Signal**: Create `customPresets` signal storing `CustomPreset[]`
- [ ] **Add Dialog Visibility Signals**: Create `showNameDialog`, `showConfirmDialog` signals
- [ ] **Add Dialog Data Signals**: Create signals for dialog state (preset being edited/deleted)
- [ ] **Load Custom Presets**: Call `loadCustomPresets()` in constructor
- [ ] **Add Preset List Computed**: Combine built-in and custom presets for dropdown
- [ ] **Add Current Preset Detection**: Update `currentPresetName` to check custom presets

**Testing Subtask:**

- [ ] **Write Tests**: Test state initialization and preset loading (see Testing section below)

**Key Implementation Notes:**

- CrtStorageService injected via `CRT_STORAGE` token from domain contracts
- Custom presets loaded once on component initialization
- Preset list sorted: built-in presets first, then custom presets alphabetically
- Current preset detection checks custom presets by comparing full settings object
- Dialog signals control when dialogs are visible and what data they show

**State Signals:**

```typescript
private crtStorage = inject(CRT_STORAGE);
protected customPresets = signal<CustomPreset[]>([]);
protected showNameDialog = signal<boolean>(false);
protected showConfirmDialog = signal<boolean>(false);
protected dialogPresetName = signal<string>('');
protected isRenaming = signal<boolean>(false);

protected allPresets = computed(() => {
  // Combine built-in + custom, with section metadata
});
```

**Testing Focus for Task 1:**

**Behaviors to Test:**

- [ ] CrtStorageService injected correctly
- [ ] Custom presets loaded on component init
- [ ] Custom presets signal populated with loaded presets
- [ ] All presets computed correctly combines built-in and custom
- [ ] Current preset detection works for both built-in and custom
- [ ] Dialog visibility signals control dialog display

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 2: Extend Preset Dropdown Menu</h3></summary>

**Purpose**: Update dropdown menu HTML to show built-in presets, custom presets with action buttons, and save action in separate sections.

**Related Documentation:**

- [Master Plan - UI Component Structure](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#ui-component-structure)
- [Dropdown Menu Component](../../../../libs/ui/components/src/lib/dropdown-menu/)

**Implementation Subtasks:**

- [ ] **Add Built-in Presets Section**: Show `default-*` presets with "Built-in Presets" label
- [ ] **Add Section Divider**: Visual separator between sections
- [ ] **Add Custom Presets Section**: Show `custom-*` presets with "Custom Presets" label
- [ ] **Add Preset Action Buttons**: Rename and delete icon buttons for each custom preset
- [ ] **Add Empty State**: Show "No custom presets" when custom list empty
- [ ] **Add Section Divider**: Separator before save action
- [ ] **Add Save Action**: "💾 Save Current as Preset" menu item at bottom
- [ ] **Add Hover Styles**: Show action buttons only on preset item hover

**Testing Subtask:**

- [ ] **Write Tests**: Test dropdown rendering and interactions (see Testing section below)

**Key Implementation Notes:**

- Use `@if` and `@for` for conditional rendering and iteration
- Section labels use `.dropdown-section-label` class from dropdown component
- Rename button uses `lib-icon-button` with `edit` icon, size `small`
- Delete button uses `lib-icon-button` with `delete` icon, size `small`, color `error`
- Action buttons container positioned absolute on right side of preset item
- Save action uses `save` icon and appears always (not just on hover)

**Template Structure:**

```html
<lib-dropdown-menu #presetDropdown>
  <!-- Trigger button -->
  
  <div dropdown-content>
    <!-- Built-in Presets Section -->
    <span class="dropdown-section-label">Built-in Presets</span>
    @for (preset of builtInPresets(); track preset.name) { /* items */ }
    
    <div class="dropdown-divider"></div>
    
    <!-- Custom Presets Section -->
    <span class="dropdown-section-label">Custom Presets</span>
    @if (customPresets().length > 0) {
      @for (preset of customPresets(); track preset.name) { 
        <!-- Preset item with action buttons -->
      }
    } @else {
      <span class="dropdown-empty-state">No custom presets</span>
    }
    
    <div class="dropdown-divider"></div>
    
    <!-- Save Action -->
    <lib-dropdown-menu-item (itemClick)="onSaveAsPreset()">
      💾 Save Current as Preset
    </lib-dropdown-menu-item>
  </div>
</lib-dropdown-menu>
```

**Testing Focus for Task 2:**

**Behaviors to Test:**

- [ ] Built-in presets section displays all default-* presets
- [ ] Custom presets section displays all custom-* presets
- [ ] Custom presets sorted alphabetically
- [ ] Section dividers render correctly
- [ ] Empty state shows when no custom presets exist
- [ ] Action buttons (rename/delete) visible on hover
- [ ] Save action always visible at bottom
- [ ] Clicking preset applies it
- [ ] Clicking rename button opens name dialog
- [ ] Clicking delete button opens confirmation dialog

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 3: Implement Save Preset Workflow</h3></summary>

**Purpose**: Wire up the save preset action to open the name dialog and persist the new custom preset.

**Related Documentation:**

- [Master Plan - Data Flow: Save Custom Preset](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#data-flow)
- [Phase 2 - Preset Name Dialog](./CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Implementation Subtasks:**

- [ ] **Create onSaveAsPreset Method**: Opens name dialog, clears isRenaming flag
- [ ] **Create onNameDialogConfirmed Method**: Handles confirmed name from dialog
- [ ] **Add Validation**: Pass existing custom preset names to dialog as reserved
- [ ] **Save to Storage**: Call `crtStorage.saveCustomPreset()` with name and current settings
- [ ] **Refresh Preset List**: Reload custom presets after save
- [ ] **Close Dialog**: Set `showNameDialog` to false after save
- [ ] **Handle Errors**: Show error message if save fails

**Testing Subtask:**

- [ ] **Write Tests**: Test complete save workflow (see Testing section below)

**Key Implementation Notes:**

- Reserved names include: built-in preset names (stripped of `default-` prefix) + existing custom names (stripped of `custom-` prefix)
- Validation happens in name dialog - component just provides reserved names list
- After successful save, custom presets list refreshes automatically
- Error handling uses logging standards for user-facing errors

**Save Workflow Methods:**

```typescript
protected onSaveAsPreset(): void {
  this.isRenaming.set(false);
  this.dialogPresetName.set('');
  this.showNameDialog.set(true);
}

protected onNameDialogConfirmed(name: string): void {
  if (this.isRenaming()) {
    // Handle rename (Task 4)
  } else {
    // Save new preset
    try {
      this.crtStorage.saveCustomPreset(name, this.settings());
      this.refreshCustomPresets();
      this.showNameDialog.set(false);
    } catch (error) {
      // Log error and show user-friendly message
    }
  }
}

private refreshCustomPresets(): void {
  const presets = this.crtStorage.loadCustomPresets();
  this.customPresets.set(presets);
}
```

**Testing Focus for Task 3:**

**Behaviors to Test:**

- [ ] Clicking "Save Current as Preset" opens name dialog
- [ ] Name dialog receives correct reserved names list
- [ ] Valid name saves preset successfully
- [ ] Custom presets list updates after save
- [ ] Name dialog closes after successful save
- [ ] Error logged and shown if save fails
- [ ] Maximum preset limit enforced (50 presets)

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

<details open>
<summary><h3>Task 4: Implement Rename Preset Workflow</h3></summary>

**Purpose**: Wire up rename action to open name dialog with prefilled value and update the preset name in storage.

**Related Documentation:**

- [Master Plan - Data Flow](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#data-flow)
- [Phase 1 - CrtStorageService.renameCustomPreset](./CRT-CUSTOM-PRESETS-PHASE-01-STORAGE-INFRASTRUCTURE.md)

**Implementation Subtasks:**

- [ ] **Create onRenamePreset Method**: Opens name dialog with current preset name
- [ ] **Prefill Dialog**: Set `dialogPresetName` with preset name (stripped of `custom-` prefix)
- [ ] **Set Rename Flag**: Set `isRenaming` signal to true
- [ ] **Update onNameDialogConfirmed**: Branch logic for rename vs save
- [ ] **Call Rename Method**: Call `crtStorage.renameCustomPreset()` with old/new names
- [ ] **Refresh Preset List**: Reload custom presets after rename
- [ ] **Close Dialog**: Set dialog visibility to false

**Testing Subtask:**

- [ ] **Write Tests**: Test complete rename workflow (see Testing section below)

**Key Implementation Notes:**

- Rename reuses same name dialog as save - `isRenaming` flag controls behavior
- Initial value passed to dialog has `custom-` prefix stripped for user display
- Validation excludes current preset name from reserved names (allow keeping same name)
- Rename preserves settings - only updates name property

**Rename Workflow Methods:**

```typescript
protected onRenamePreset(presetName: CustomPresetName): void {
  this.isRenaming.set(true);
  this.dialogPresetName.set(stripCustomPrefix(presetName));
  this.showNameDialog.set(true);
}

protected onNameDialogConfirmed(name: string): void {
  if (this.isRenaming()) {
    try {
      const oldName = `custom-${this.dialogPresetName()}` as CustomPresetName;
      this.crtStorage.renameCustomPreset(oldName, name);
      this.refreshCustomPresets();
      this.showNameDialog.set(false);
    } catch (error) {
      // Log and show error
    }
  } else {
    // Save logic (Task 3)
  }
}
```

**Testing Focus for Task 4:**

**Behaviors to Test:**

- [ ] Clicking rename button opens name dialog
- [ ] Name dialog shows current preset name (without custom- prefix)
- [ ] Valid new name renames preset successfully
- [ ] Custom presets list updates with new name
- [ ] Preset settings unchanged after rename
- [ ] Name dialog closes after successful rename
- [ ] Error logged and shown if rename fails

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 5: Implement Delete Preset Workflow</h3></summary>

**Purpose**: Wire up delete action to open confirmation dialog and remove preset from storage after confirmation.

**Related Documentation:**

- [Master Plan - Data Flow: Delete Custom Preset](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md#data-flow)
- [Phase 2 - Confirmation Dialog](./CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Implementation Subtasks:**

- [ ] **Create onDeletePreset Method**: Opens confirmation dialog with preset name
- [ ] **Set Dialog Data**: Store preset name being deleted in signal
- [ ] **Create onDeleteConfirmed Method**: Handles confirmed deletion
- [ ] **Call Delete Method**: Call `crtStorage.deleteCustomPreset()` with preset name
- [ ] **Refresh Preset List**: Reload custom presets after deletion
- [ ] **Close Dialog**: Set dialog visibility to false
- [ ] **Handle Current Preset**: If deleted preset was active, reset to default

**Testing Subtask:**

- [ ] **Write Tests**: Test complete delete workflow (see Testing section below)

**Key Implementation Notes:**

- Confirmation dialog shows preset name (stripped of `custom-` prefix) in message
- Message format: "Delete preset '{name}'? This action cannot be undone."
- If currently applied preset is deleted, settings remain but current preset name resets
- Delete is permanent - no undo functionality (future enhancement)

**Delete Workflow Methods:**

```typescript
protected onDeletePreset(presetName: CustomPresetName): void {
  this.dialogPresetName.set(presetName);
  this.showConfirmDialog.set(true);
}

protected onDeleteConfirmed(): void {
  try {
    const presetName = this.dialogPresetName() as CustomPresetName;
    this.crtStorage.deleteCustomPreset(presetName);
    this.refreshCustomPresets();
    this.showConfirmDialog.set(false);
    
    // Reset current preset if deleted preset was active
    if (this.currentPresetName() === presetName) {
      // Logic to reset or clear current preset
    }
  } catch (error) {
    // Log and show error
  }
}

protected getConfirmationMessage(): string {
  const displayName = stripCustomPrefix(this.dialogPresetName() as CustomPresetName);
  return `Delete preset '${displayName}'? This action cannot be undone.`;
}
```

**Testing Focus for Task 5:**

**Behaviors to Test:**

- [ ] Clicking delete button opens confirmation dialog
- [ ] Confirmation message displays preset name correctly
- [ ] Clicking confirm deletes preset from storage
- [ ] Custom presets list updates after deletion
- [ ] Confirmation dialog closes after deletion
- [ ] If active preset deleted, current preset resets appropriately
- [ ] Clicking cancel closes dialog without deleting
- [ ] Error logged and shown if delete fails

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 6: Add Dialog Components to Template</h3></summary>

**Purpose**: Add preset name dialog and confirmation dialog components to the settings panel template with proper bindings.

**Implementation Subtasks:**

- [ ] **Add PresetNameDialog**: Add `lib-preset-name-dialog` to template
- [ ] **Bind Dialog Inputs**: Wire up title, initialValue, reservedNames inputs
- [ ] **Bind Dialog Outputs**: Wire up confirmed, cancelled event handlers
- [ ] **Add ConfirmationDialog**: Add `lib-confirmation-dialog` to template
- [ ] **Bind Confirmation Inputs**: Wire up title, message inputs
- [ ] **Bind Confirmation Outputs**: Wire up confirmed, cancelled event handlers
- [ ] **Add Visibility Bindings**: Use `@if` to control when dialogs display

**Testing Subtask:**

- [ ] **Write Tests**: Test dialog bindings and event handling (see Testing section below)

**Key Implementation Notes:**

- Dialogs should overlay the settings panel using absolute positioning
- Use `@if` with dialog visibility signals to mount/unmount dialogs
- Reserved names computed dynamically based on current custom presets
- Title for name dialog changes based on rename vs save context

**Template Additions:**

```html
<!-- Preset Name Dialog -->
@if (showNameDialog()) {
  <lib-preset-name-dialog
    [title]="isRenaming() ? 'Rename Preset' : 'Save Preset'"
    [initialValue]="dialogPresetName()"
    [reservedNames]="getReservedNames()"
    (confirmed)="onNameDialogConfirmed($event)"
    (cancelled)="showNameDialog.set(false)">
  </lib-preset-name-dialog>
}

<!-- Confirmation Dialog -->
@if (showConfirmDialog()) {
  <lib-confirmation-dialog
    [title]="'Delete Preset'"
    [message]="getConfirmationMessage()"
    [confirmLabel]="'Delete'"
    [cancelLabel]="'Cancel'"
    (confirmed)="onDeleteConfirmed()"
    (cancelled)="showConfirmDialog.set(false)">
  </lib-confirmation-dialog>
}
```

**Testing Focus for Task 6:**

**Behaviors to Test:**

- [ ] Dialogs only render when visibility signals are true
- [ ] Name dialog receives correct title (Save vs Rename)
- [ ] Name dialog receives prefilled value when renaming
- [ ] Name dialog receives reserved names list
- [ ] Confirmation dialog receives correct message
- [ ] Confirmed events trigger correct methods
- [ ] Cancelled events close dialogs
- [ ] Dialogs unmount when visibility signal set to false

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)

</details>

---

<details open>
<summary><h3>Task 7: Style Custom Preset Items</h3></summary>

**Purpose**: Add styling for custom preset items in dropdown, including hover states and action button positioning.

**Implementation Subtasks:**

- [ ] **Style Preset Item Container**: Position relative for action button positioning
- [ ] **Style Action Buttons Container**: Position absolute on right, hidden by default
- [ ] **Add Hover State**: Show action buttons on preset item hover
- [ ] **Style Section Label**: Subtle, uppercase, smaller font for section headers
- [ ] **Style Section Divider**: Horizontal line with appropriate spacing
- [ ] **Style Empty State**: Dimmed text for "No custom presets" message
- [ ] **Add Mobile Styles**: Always show action buttons on mobile (no hover)

**Testing Subtask:**

- [ ] **Write Tests**: Visual review of styling (manual testing)

**Key Implementation Notes:**

- Action buttons should not cause layout shift on hover - use absolute positioning
- Section labels use style guide's `.dropdown-section-label` or similar pattern
- Dividers use border-top with dimmed color from style guide
- Mobile breakpoint: ≤768px width always shows action buttons
- Ensure sufficient contrast for action buttons (WCAG AA)

**SCSS Structure:**

```scss
.custom-preset-item {
  position: relative;
  
  .preset-actions {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  &:hover .preset-actions {
    opacity: 1;
  }
  
  @media (max-width: 768px) {
    .preset-actions {
      opacity: 1; // Always visible on mobile
    }
  }
}

.dropdown-section-label {
  // Section header styling
}

.dropdown-empty-state {
  // Empty state styling
}
```

**Testing Focus for Task 7:**

**Behaviors to Test:**

- [ ] Action buttons hidden by default on desktop
- [ ] Action buttons visible on hover
- [ ] Action buttons always visible on mobile
- [ ] Section labels clearly distinguish sections
- [ ] Dividers provide visual separation
- [ ] Empty state message clear and readable
- [ ] No layout shift when buttons appear

**Testing Reference:**

- See [Style Guide](../../../STYLE_GUIDE.md)

</details>

---

<details open>
<summary><h3>Task 8: Update Consumer Components</h3></summary>

**Purpose**: Update components that use CRT settings panel to handle custom preset events correctly.

**Related Documentation:**

- [Video Capture Component](../../../../libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts)
- [File Image Component](../../../../libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts)

**Implementation Subtasks:**

- [ ] **Update VideoCaptureComponent**: Handle custom preset selection
- [ ] **Update VideoDialogComponent**: Handle custom preset selection
- [ ] **Update FileImageComponent**: Handle custom preset selection
- [ ] **Update onCrtPresetSelected**: Accept AnyPresetName type instead of just built-in
- [ ] **Load Custom Presets**: When custom preset selected, load from storage
- [ ] **Apply Settings**: Apply custom preset settings same as built-in presets

**Testing Subtask:**

- [ ] **Write Tests**: Test custom preset application in consumer components (see Testing section below)

**Key Implementation Notes:**

- Consumer components should not need major changes - just type updates
- onCrtPresetSelected signature changes from `CrtPresetName` to `AnyPresetName`
- Logic branches: if built-in preset, use CRT_PRESETS; if custom preset, load from storage
- Use type guard `isBuiltInPreset()` from Phase 1 to distinguish preset types

**Updated Event Handler:**

```typescript
onCrtPresetSelected(presetName: AnyPresetName): void {
  let settings: CrtSettings;
  
  if (isBuiltInPreset(presetName)) {
    settings = CRT_PRESETS[presetName];
  } else {
    const customPresets = this.crtStorage.loadCustomPresets();
    const preset = customPresets.find(p => p.name === presetName);
    if (preset) {
      settings = preset.settings;
    } else {
      // Handle missing preset - log warning
      return;
    }
  }
  
  this.crtSettings.set(settings);
  this.crtStorage.save(this.deviceId(), this.context, settings);
}
```

**Testing Focus for Task 8:**

**Behaviors to Test:**

- [ ] Built-in preset selection works as before
- [ ] Custom preset selection loads settings correctly
- [ ] Custom preset settings applied to CRT effect wrapper
- [ ] Custom preset settings persisted to device storage
- [ ] Missing custom preset handled gracefully
- [ ] Type guards distinguish preset types correctly

**Testing Reference:**

- See [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md)
- See [Testing Standards](../../../TESTING_STANDARDS.md)

</details>

---

## 🗂️ Files Modified or Created

**Modified Files:**

- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-capture.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/video-capture/video-dialog/video-dialog.component.ts`
- `libs/features/player/src/lib/player-view/player-device-container/file-image/file-image.component.ts`

**Total**: 7 modified files

---

## ✅ Success Criteria

**Functional Requirements:**

- [ ] All implementation tasks completed and checked off
- [ ] Settings panel loads and displays custom presets
- [ ] Save preset workflow creates new custom presets
- [ ] Rename preset workflow updates preset names
- [ ] Delete preset workflow removes presets with confirmation
- [ ] Custom presets apply correctly when selected
- [ ] Built-in presets unaffected by custom preset features

**Testing Requirements:**

- [ ] All testing subtasks completed
- [ ] Complete workflows tested (save/apply/rename/delete)
- [ ] Integration with consumer components tested
- [ ] Error scenarios tested
- [ ] All tests passing with no failures
- [ ] Test coverage ≥80%

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes with no errors
- [ ] UI responsive and accessible
- [ ] Keyboard navigation works
- [ ] Mobile-friendly interactions

**Ready for Production:**

- [ ] Feature complete and tested
- [ ] No known bugs or issues
- [ ] Documentation updated
- [ ] Ready for user acceptance testing

---

## 📝 Notes & Considerations

### Design Decisions

- **Unified Dropdown**: Single dropdown for all presets maintains simplicity and discoverability
- **Hover Actions**: Action buttons on hover reduces visual clutter while remaining accessible
- **Alphabetical Sorting**: Custom presets sorted alphabetically for predictable location

### Implementation Constraints

- **Consumer Component Updates**: Multiple components need updates to handle custom presets
- **Type Safety**: Type system ensures compile-time safety between built-in and custom presets
- **Mobile Support**: Touch interactions require always-visible action buttons

### Future Enhancements

- **Preset Export/Import**: JSON export for sharing presets
- **Preset Reordering**: Drag-and-drop custom preset ordering
- **Preset Favorites**: Pin favorite presets to top of list

### Discoveries During Implementation

> Add notes here as you discover important details during implementation
