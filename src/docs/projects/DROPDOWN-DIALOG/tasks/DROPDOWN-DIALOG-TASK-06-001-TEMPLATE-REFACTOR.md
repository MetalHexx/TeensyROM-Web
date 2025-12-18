# Task: DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR

## 📋 Task Identity

**Task ID**: `DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR`
**Task Name**: Refactor CRT Settings Panel Template Structure
**Assigned To**: Clean Coder (UI Wizard)
**Agent Chatmode**: `.github/copilot-modes/clean-coder.prompt.md`
**Priority**: High
**Estimated Context Size**: Small (1 primary file, minimal complexity)

---

## 🎯 Objective

**What**: Move the `lib-preset-name-dialog` and `lib-confirmation-dialog` components from inside the `<div dropdown-content>` slot to sibling positions next to the `lib-dropdown-menu` component.

**Why**: The current implementation shows dialogs inline within the dropdown menu content using conditional rendering (`@if/@else if/@else`). This creates confusing UX where dialogs appear "inside" the dropdown styling/positioning. We want dialogs to be independent positioned overlays that appear where the dropdown was.

**Success Criteria**:
- [ ] `lib-preset-name-dialog` is a sibling of `lib-dropdown-menu`, not inside `dropdown-content` slot
- [ ] `lib-confirmation-dialog` is a sibling of `lib-dropdown-menu`, not inside `dropdown-content` slot
- [ ] Both dialogs use `@if` conditionals (not `@else if/@else`) for independent visibility control
- [ ] `dropdown-content` slot only contains the preset menu items (built-in presets, custom presets, save button)
- [ ] Template compiles without errors
- [ ] No changes to TypeScript logic (state management handled in next task)

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DROPDOWN-DIALOG-TASK-01-001 through DROPDOWN-DIALOG-TASK-05-004 (dropdown dialog component exists and CRT integration completed)
- Current implementation has dialogs working but showing inline within dropdown

**Dependencies**:
- `lib-preset-name-dialog` component (existing, no changes needed)
- `lib-confirmation-dialog` component (existing, no changes needed)
- `lib-dropdown-menu` component (existing, no changes needed)

**Constraints**:
- DO NOT modify dialog component implementations
- DO NOT modify dropdown menu component
- DO NOT change TypeScript logic in this task (state management comes in Task 06-002)
- Keep existing signal bindings (`showNameDialog()`, `showConfirmDialog()`, etc.)

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Restructure template to move dialogs outside dropdown

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Understand signal names and bindings
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.ts` - Verify input/output API
- `libs/ui/components/src/lib/confirmation-dialog/confirmation-dialog.component.ts` - Verify input/output API

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - Angular template patterns
- [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Component usage patterns

**Current Template Structure** (Lines 9-103):

```html
<lib-dropdown-menu #presetDropdown>
  <lib-icon-button
    icon="bookmark"
    ariaLabel="Select preset"
    (buttonClick)="presetDropdown.toggle()">
  </lib-icon-button>

  <div dropdown-content>
    @if (showNameDialog()) {
      <!-- Preset Name Dialog (shown in place of dropdown menu) -->
      <lib-preset-name-dialog ...></lib-preset-name-dialog>
    } @else if (showConfirmDialog()) {
      <!-- Confirmation Dialog (shown in place of dropdown menu) -->
      <lib-confirmation-dialog ...></lib-confirmation-dialog>
    } @else {
      <!-- Built-in Presets -->
      <lib-dropdown-menu-item ...></lib-dropdown-menu-item>
      <!-- Custom Presets -->
      <!-- Save Action -->
    }
  </div>
</lib-dropdown-menu>
```

**Desired Template Structure**:

```html
<!-- Dropdown menu with ONLY preset menu content -->
<lib-dropdown-menu #presetDropdown>
  <lib-icon-button
    icon="bookmark"
    ariaLabel="Select preset"
    (buttonClick)="presetDropdown.toggle()">
  </lib-icon-button>

  <div dropdown-content>
    <!-- Built-in Presets -->
    <lib-dropdown-menu-item ...></lib-dropdown-menu-item>
    <!-- Custom Presets -->
    <!-- Save Action -->
  </div>
</lib-dropdown-menu>

<!-- Dialogs as independent siblings -->
@if (showNameDialog()) {
  <lib-preset-name-dialog ...></lib-preset-name-dialog>
}

@if (showConfirmDialog()) {
  <lib-confirmation-dialog ...></lib-confirmation-dialog>
}
```

**Key Requirements**:

1. **Extract dialogs from dropdown-content**: Move both `<lib-preset-name-dialog>` and `<lib-confirmation-dialog>` outside the `<lib-dropdown-menu>` element
2. **Use independent conditionals**: Change from `@if/@else if/@else` to two separate `@if` blocks for each dialog
3. **Preserve all attributes**: Keep all existing `[inputs]` and `(outputs)` exactly as they are
4. **Keep dropdown-content clean**: The `<div dropdown-content>` should only contain the preset menu items
5. **Position after dropdown**: Place dialog elements immediately after the closing `</lib-dropdown-menu>` tag (as siblings in the header-actions div)

**Anti-Patterns to Avoid**:
- ❌ Don't change dialog component inputs/outputs
- ❌ Don't add positioning styles yet (that's Task 06-003)
- ❌ Don't modify TypeScript state management (that's Task 06-002)
- ❌ Don't change signal names or bindings

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Unit tests verify template structure (dialogs are siblings, not children)
- [ ] Template compiles without errors
- [ ] Component renders without runtime errors

**Behavioral Expectations**:
- Dialogs still conditionally render based on signals
- Dropdown menu content is simplified (no conditional dialogs)
- All existing event handlers still wire up correctly

**Testing Focus**:
- Verify template structure using Angular test queries (query for siblings, not children)
- Ensure signals still control visibility correctly
- No visual verification needed yet (positioning comes in Task 06-003)

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-06-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 📖 Reference Materials

**Related Documentation**:
- [Phase 6 Plan](../phases/DROPDOWN-DIALOG-PHASE-06-DIALOG-SEPARATION.md#task-1-refactor-template-structure) - Task context
- [Component Library - Dropdown Menu](../../../../docs/COMPONENT_LIBRARY.md) - Dropdown usage patterns

**Related Tasks**:
- DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT: Will add dropdown open/close logic
- DROPDOWN-DIALOG-TASK-06-003-POSITIONING: Will add dialog positioning

---

## ✅ Definition of Done

- [ ] Dialogs are siblings of dropdown menu in template
- [ ] `dropdown-content` only contains preset menu items
- [ ] Both dialogs use independent `@if` conditionals
- [ ] All existing signal bindings preserved
- [ ] Template compiles without errors
- [ ] Component renders without runtime errors
- [ ] Tests pass (after updating structural assertions)
- [ ] Report saved to output location
