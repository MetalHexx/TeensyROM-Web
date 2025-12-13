# CRT-CUSTOM-PRESETS-TASK-03-001-SETTINGS-PANEL-STATE-AND-DROPDOWN

## 📋 Task Metadata

**Task ID**: CRT-CUSTOM-PRESETS-TASK-03-001-SETTINGS-PANEL-STATE-AND-DROPDOWN  
**Task Name**: Extend CRT Settings Panel with Custom Preset State and Dropdown UI  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (5-7 files)

---

## 🎯 Objective

**What**: Extend the CRT settings panel component with state management for custom presets and update the dropdown menu UI to display built-in and custom presets in separate sections with action buttons.

**Why**: This task establishes the foundation for custom preset management by adding the necessary signals, computed properties, and UI structure that will be wired up to full workflows in subsequent tasks.

**Success Criteria**:
- [ ] CrtStorageService injected and custom presets loaded on component initialization
- [ ] State signals created for custom presets, dialog visibility, and dialog data
- [ ] Computed signal created combining built-in and custom presets for unified dropdown
- [ ] Dropdown HTML updated with built-in presets section, custom presets section, and save action
- [ ] Action buttons (rename/delete) visible on hover for custom preset items
- [ ] Section labels, dividers, and empty state properly styled
- [ ] All tests pass with behavioral coverage for state and UI rendering
- [ ] No TypeScript or linting errors

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-01-001: Domain contracts for custom presets defined
- CRT-CUSTOM-PRESETS-TASK-01-004: CrtStorageService with custom preset methods implemented
- CRT-CUSTOM-PRESETS-TASK-02-001 through 02-005: Dialog components created and exported

**Dependencies**:
- `@teensyrom-nx/domain` - `CRT_STORAGE` injection token, `CustomCrtPreset` interface
- `@teensyrom-nx/ui/components` - `PresetNameDialogComponent`, `ConfirmationDialogComponent`
- Existing CRT settings panel component and dropdown menu components

**Constraints**:
- Must not break existing built-in preset functionality
- Must maintain Clean Architecture boundaries (inject via `CRT_STORAGE` token)
- Must use Angular 19 signal-based APIs (`signal()`, `computed()`)
- Must follow existing dropdown menu patterns from component library

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add state management
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Update dropdown UI
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Add custom preset styles
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Add tests

**Files to Review** (for context):
- `docs/projects/CRT-CUSTOM-PRESETS/CRT-CUSTOM-PRESETS-MASTER-PLAN.md` - Feature overview
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-01-004-REPORT.md` - CrtStorageService implementation
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-005-REPORT.md` - Dialog component exports
- `libs/ui/components/src/lib/dropdown-menu/` - Dropdown menu patterns
- `docs/COMPONENT_LIBRARY.md` - Dropdown menu documentation

---

## 🛠️ Implementation Guidance

### Part 1: Component State Management

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - Signal-based state, Angular 19 patterns
- [State Standards](../../../STATE_STANDARDS.md) - Signal patterns and computed values

**Key Requirements**:

1. **Inject CRT Storage Service**:
   - Import `CRT_STORAGE` from `@teensyrom-nx/domain`
   - Inject using `inject(CRT_STORAGE)` in component
   - Store in private field `crtStorage`

2. **Add Custom Preset Signals**:
   - `customPresets` signal storing `CustomCrtPreset[]` (initially empty)
   - `showNameDialog` boolean signal for name dialog visibility
   - `showConfirmDialog` boolean signal for confirmation dialog visibility
   - `dialogPresetName` string signal for current preset being edited/deleted
   - `isRenaming` boolean signal to distinguish save vs rename workflows

3. **Load Custom Presets on Init**:
   - In constructor, call `loadCustomPresets()` from storage service
   - Update `customPresets` signal with loaded data
   - Handle errors gracefully (empty array if load fails)

4. **Create All Presets Computed**:
   - Computed signal combining `CRT_PRESET_KEYS` (built-in) and `customPresets()`
   - Format: `{ builtIn: BuiltInPresetName[], custom: CustomCrtPreset[] }`
   - Built-in presets sorted per existing order
   - Custom presets sorted alphabetically by name

5. **Update Current Preset Detection**:
   - Extend `currentPresetName` computed to check custom presets
   - Compare current settings against both built-in and custom preset settings
   - Return matching preset name or empty string if no match

**Example Signal Structure**:
```typescript
private crtStorage = inject(CRT_STORAGE);

protected customPresets = signal<CustomCrtPreset[]>([]);
protected showNameDialog = signal(false);
protected showConfirmDialog = signal(false);
protected dialogPresetName = signal('');
protected isRenaming = signal(false);

protected allPresets = computed(() => ({
  builtIn: CRT_PRESET_KEYS,
  custom: this.customPresets().sort((a, b) => a.name.localeCompare(b.name))
}));
```

---

### Part 2: Dropdown Menu UI Updates

**Standards to Follow**:
- [Component Library](../../../COMPONENT_LIBRARY.md) - Dropdown menu patterns
- [Style Guide](../../../STYLE_GUIDE.md) - Section labels, dividers, empty states

**Key Requirements**:

1. **Add Built-in Presets Section**:
   - Section label: "Built-in Presets" (use `.dropdown-section-label` class)
   - Iterate over `allPresets().builtIn` with `@for`
   - Each item uses `lib-dropdown-menu-item` component
   - Track by preset name
   - Existing click handler `onCrtPresetSelected()` unchanged

2. **Add Section Divider**:
   - Use `<div class="dropdown-divider"></div>` between sections
   - Style as thin horizontal line with margin

3. **Add Custom Presets Section**:
   - Section label: "Custom Presets" (use `.dropdown-section-label` class)
   - Conditional rendering with `@if (allPresets().custom.length > 0)`
   - Iterate over `allPresets().custom` with `@for`, track by `preset.name`
   - Each item wraps preset name with action buttons container

4. **Add Preset Item with Actions**:
   - Preset item container with relative positioning (`.custom-preset-item`)
   - Preset name display (strip `custom-` prefix for display)
   - Action buttons container positioned absolute right (`.preset-actions`)
   - Rename button: `lib-icon-button` with `edit` icon, size `small`
   - Delete button: `lib-icon-button` with `delete` icon, size `small`, `error` color
   - Action buttons hidden by default, visible on hover

5. **Add Empty State**:
   - `@else` block when no custom presets exist
   - Display "No custom presets" with `.dropdown-empty-state` class
   - Dimmed, italic styling

6. **Add Save Action**:
   - Another section divider before save action
   - `lib-dropdown-menu-item` with click handler `onSaveAsPreset()`
   - Icon: 💾 emoji or `save` Material icon
   - Text: "Save Current as Preset"
   - Always visible (not hover-dependent)

**Template Structure Reference**:
```html
<lib-dropdown-menu #presetDropdown>
  <!-- Existing trigger button unchanged -->
  
  <div dropdown-content>
    <!-- Built-in Presets -->
    <span class="dropdown-section-label">Built-in Presets</span>
    @for (presetName of allPresets().builtIn; track presetName) {
      <lib-dropdown-menu-item (itemClick)="onCrtPresetSelected(presetName)">
        {{ getPresetLabel(presetName) }}
      </lib-dropdown-menu-item>
    }
    
    <div class="dropdown-divider"></div>
    
    <!-- Custom Presets -->
    <span class="dropdown-section-label">Custom Presets</span>
    @if (allPresets().custom.length > 0) {
      @for (preset of allPresets().custom; track preset.name) {
        <div class="custom-preset-item">
          <lib-dropdown-menu-item (itemClick)="onCrtPresetSelected(preset.name)">
            {{ stripCustomPrefix(preset.name) }}
          </lib-dropdown-menu-item>
          <div class="preset-actions">
            <lib-icon-button icon="edit" size="small" 
              (click)="onRenamePreset(preset.name); $event.stopPropagation()">
            </lib-icon-button>
            <lib-icon-button icon="delete" size="small" color="error"
              (click)="onDeletePreset(preset.name); $event.stopPropagation()">
            </lib-icon-button>
          </div>
        </div>
      }
    } @else {
      <span class="dropdown-empty-state">No custom presets</span>
    }
    
    <div class="dropdown-divider"></div>
    
    <!-- Save Action -->
    <lib-dropdown-menu-item (itemClick)="onSaveAsPreset()">
      <mat-icon>save</mat-icon> Save Current as Preset
    </lib-dropdown-menu-item>
  </div>
</lib-dropdown-menu>
```

---

### Part 3: Styling

**Standards to Follow**:
- [Style Guide](../../../STYLE_GUIDE.md) - Utility classes and mixins

**Key Requirements**:

1. **Custom Preset Item Container**:
   - Position: relative (for absolute positioning of action buttons)
   - Display: flex with align-items: center
   - Padding matching other dropdown items

2. **Action Buttons Container**:
   - Position: absolute, right: 8px, top: 50%
   - Transform: translateY(-50%) for vertical centering
   - Opacity: 0 by default
   - Transition: opacity 0.2s ease
   - Display: flex with gap: 4px

3. **Hover State**:
   - `.custom-preset-item:hover .preset-actions` → opacity: 1
   - No layout shift on hover (buttons always occupy space)

4. **Section Labels**:
   - Font-size: 0.75rem
   - Text-transform: uppercase
   - Color: dimmed text color from theme
   - Padding: 8px 16px
   - Font-weight: 600

5. **Divider**:
   - Border-top: 1px solid with dimmed border color
   - Margin: 8px 0

6. **Empty State**:
   - Font-style: italic
   - Color: dimmed text color
   - Padding: 8px 16px
   - Text-align: center

7. **Mobile Styles**:
   - @media (max-width: 768px): action buttons always visible (opacity: 1)

**SCSS Example**:
```scss
.custom-preset-item {
  position: relative;
  display: flex;
  align-items: center;
  
  .preset-actions {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  &:hover .preset-actions {
    opacity: 1;
  }
  
  @media (max-width: 768px) {
    .preset-actions {
      opacity: 1;
    }
  }
}

.dropdown-section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-dimmed);
  padding: 8px 16px;
  font-weight: 600;
}

.dropdown-divider {
  border-top: 1px solid var(--border-dimmed);
  margin: 8px 0;
}

.dropdown-empty-state {
  font-style: italic;
  color: var(--text-dimmed);
  padding: 8px 16px;
  text-align: center;
  display: block;
}
```

---

### Part 4: Helper Methods (Stub Implementations)

**Key Requirements**:

1. **Create Placeholder Methods**:
   - `onSaveAsPreset()` - Log "Save preset clicked" (implement in next task)
   - `onRenamePreset(presetName: CustomPresetName)` - Log "Rename clicked" (implement in next task)
   - `onDeletePreset(presetName: CustomPresetName)` - Log "Delete clicked" (implement in next task)
   - `stripCustomPrefix(name: CustomPresetName): string` - Remove `custom-` prefix for display
   - `getReservedNames(): string[]` - Return built-in + existing custom names (for validation)

2. **Update Existing Methods**:
   - `onCrtPresetSelected()` - Update type signature to accept `AnyPresetName` (built-in or custom)
   - Add branch logic: if custom preset, load from storage; if built-in, use existing logic
   - Keep implementation simple for now (full workflow in next task)

**Example Helper Methods**:
```typescript
protected onSaveAsPreset(): void {
  console.log('[CrtSettingsPanel] Save preset clicked');
  // Full implementation in Task 03-002
}

protected onRenamePreset(presetName: CustomPresetName): void {
  console.log('[CrtSettingsPanel] Rename preset clicked:', presetName);
  // Full implementation in Task 03-002
}

protected onDeletePreset(presetName: CustomPresetName): void {
  console.log('[CrtSettingsPanel] Delete preset clicked:', presetName);
  // Full implementation in Task 03-002
}

protected stripCustomPrefix(name: CustomPresetName): string {
  return name.replace(/^custom-/, '');
}

protected getReservedNames(): string[] {
  const builtInNames = CRT_PRESET_KEYS.map(k => k.replace(/^default-/, ''));
  const customNames = this.customPresets().map(p => this.stripCustomPrefix(p.name));
  return [...builtInNames, ...customNames];
}
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:

### State Management Tests

- [ ] CrtStorageService injected correctly via `CRT_STORAGE` token
- [ ] Custom presets loaded on component initialization
- [ ] Custom presets signal populated with loaded data
- [ ] Empty array set if loading fails or no presets exist
- [ ] All presets computed combines built-in and custom correctly
- [ ] Custom presets sorted alphabetically in computed
- [ ] Current preset detection works for built-in presets
- [ ] Current preset detection works for custom presets
- [ ] Dialog visibility signals default to false

### Dropdown UI Tests

- [ ] Built-in presets section renders with correct label
- [ ] All built-in presets displayed in built-in section
- [ ] Section divider renders between built-in and custom
- [ ] Custom presets section renders with correct label
- [ ] Custom presets displayed in custom section when presets exist
- [ ] Custom presets sorted alphabetically in UI
- [ ] Empty state displays when no custom presets exist
- [ ] Action buttons (rename/delete) present for each custom preset
- [ ] Action buttons hidden by default (opacity: 0)
- [ ] Action buttons visible on hover (CSS test or manual verification)
- [ ] Save action always visible at bottom
- [ ] Clicking built-in preset calls `onCrtPresetSelected()` correctly
- [ ] Clicking custom preset name calls `onCrtPresetSelected()` with custom name
- [ ] Clicking rename button calls `onRenamePreset()` with preset name
- [ ] Clicking delete button calls `onDeletePreset()` with preset name
- [ ] Clicking save action calls `onSaveAsPreset()`
- [ ] `$event.stopPropagation()` prevents dropdown close on action button click

### Helper Method Tests

- [ ] `stripCustomPrefix()` removes "custom-" prefix correctly
- [ ] `getReservedNames()` returns built-in names without "default-" prefix
- [ ] `getReservedNames()` returns custom names without "custom-" prefix
- [ ] `getReservedNames()` combines both lists correctly

**Behavioral Expectations**:
- Component loads and displays custom presets without errors
- Dropdown UI clearly separates built-in from custom presets
- Action buttons only appear when needed (hover state)
- Empty state provides clear feedback when no custom presets exist
- Placeholder methods log interactions for debugging

**Testing Reference**:
- [Smart Component Testing](../../../SMART_COMPONENT_TESTING.md) - Component testing patterns
- [Testing Standards](../../../TESTING_STANDARDS.md) - Behavioral testing approach

---

## 🔗 Related Documentation

**Planning Documents**:
- [Master Plan](../CRT-CUSTOM-PRESETS-MASTER-PLAN.md) - Complete feature overview
- [Phase 3 Plan](../phases/CRT-CUSTOM-PRESETS-PHASE-03-SETTINGS-PANEL-INTEGRATION.md) - This phase details

**Implementation Reports**:
- [Task 01-004 Report](../reports/CRT-CUSTOM-PRESETS-TASK-01-004-REPORT.md) - CrtStorageService methods
- [Task 02-005 Report](../reports/CRT-CUSTOM-PRESETS-TASK-02-005-REPORT.md) - Dialog component exports

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
- [Component Library](../../../COMPONENT_LIBRARY.md)
- [Style Guide](../../../STYLE_GUIDE.md)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-03-001-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete

---

## 💡 Implementation Notes

### Anti-Patterns to Avoid

- ❌ Don't implement full save/rename/delete workflows yet - stub methods only
- ❌ Don't import CrtStorageService directly - use `CRT_STORAGE` injection token
- ❌ Don't mutate preset arrays - use immutable patterns with signals
- ❌ Don't add dialog components to template yet - that's Task 03-002
- ❌ Don't break existing preset selection functionality

### Key Integration Points

- Custom preset loading happens once in constructor (not on every change detection)
- Preset selection logic branches on preset type (built-in vs custom)
- Action buttons use `$event.stopPropagation()` to prevent dropdown close
- Reserved names calculation needed for validation (used in next task)

### Type Guards and Utilities

Use type guards from Phase 1 to distinguish preset types:
- `isBuiltInPreset(name)` - Check if preset is built-in
- `isCustomPresetName(name)` - Check if preset is custom (starts with `custom-`)

These were implemented in Task 01-005 (Type System).
