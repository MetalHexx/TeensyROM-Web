# Task: DROPDOWN-DIALOG-TASK-06-003-POSITIONING

## 📋 Task Identity

**Task ID**: `DROPDOWN-DIALOG-TASK-06-003-POSITIONING`
**Task Name**: Add Dialog Positioning Anchored to Preset Button
**Assigned To**: Clean Coder (UI Wizard)
**Agent Chatmode**: `.github/copilot-modes/clean-coder.prompt.md`
**Priority**: Medium
**Estimated Context Size**: Medium (styling + positioning logic, may require viewport calculations)

---

## 🎯 Objective

**What**: Implement positioning logic to anchor the dialogs to the preset button, ensuring they appear in the same location where the dropdown menu was displayed.

**Why**: With dialogs now as siblings (Task 06-001) and state coordination in place (Task 06-002), the dialogs need proper positioning. Without anchored positioning, dialogs may appear in the wrong location or use default flow positioning. We want dialogs to appear exactly where the dropdown was for spatial consistency.

**Success Criteria**:
- [ ] Dialogs appear anchored to the preset button (same trigger as dropdown)
- [ ] Dialogs appear in the same visual position as the dropdown menu
- [ ] Dialogs have appropriate z-index to appear above other content
- [ ] Positioning handles viewport edges gracefully (no overflow)
- [ ] No layout shifts or flickers when switching between dropdown and dialogs
- [ ] Visual verification confirms smooth transitions

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR: Dialogs are siblings in template
- DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT: Dropdown closes/opens when dialogs show/hide

**Dependencies**:
- Preset button element (trigger for both dropdown and dialogs)
- Existing dropdown positioning (reference for matching position)
- Dialog components (unchanged, wrapper positioning only)

**Constraints**:
- DO NOT modify dialog components themselves
- Match dropdown positioning strategy (absolute, relative, CDK overlay, etc.)
- Ensure dialogs don't overflow viewport boundaries
- Maintain responsive behavior across screen sizes

---

## 📂 File Scope

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add positioning wrapper or attributes
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Add positioning styles
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add positioning logic (if dynamic calculation needed)

**Files to Review** (for context):
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - Understand dropdown positioning strategy
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.scss` - Review dropdown styles

---

## 📝 Implementation Guidance

**Standards to Follow**:
- [Style Guide](../../../../docs/STYLE_GUIDE.md) - Positioning patterns and utility classes
- [Coding Standards](../../../../docs/CODING_STANDARDS.md) - Component styling patterns

**Positioning Options** (choose based on dropdown implementation):

### Option A: Simple Absolute Positioning (Recommended)

If dropdown uses simple absolute positioning relative to header:

**Template** (wrap dialogs):
```html
<div class="dialog-container" [class.visible]="showNameDialog() || showConfirmDialog()">
  @if (showNameDialog()) {
    <lib-preset-name-dialog ...></lib-preset-name-dialog>
  }
  
  @if (showConfirmDialog()) {
    <lib-confirmation-dialog ...></lib-confirmation-dialog>
  }
</div>
```

**SCSS**:
```scss
.dialog-container {
  position: absolute;
  top: 100%; // Position below trigger button
  right: 0;   // Align to right edge (match dropdown)
  z-index: 1000; // Match dropdown z-index
  margin-top: 4px; // Small gap below trigger
  display: none;
  
  &.visible {
    display: block;
  }
}
```

### Option B: Dynamic Positioning (If Needed)

If dropdown uses dynamic positioning or CDK overlay:

**TypeScript** (add computed position):
```typescript
protected readonly dialogPosition = computed(() => {
  // Calculate position based on preset button element
  // Return { top: string, left: string } or similar
});
```

**Template**:
```html
<div class="dialog-container" [style]="dialogPosition()">
  @if (showNameDialog()) {
    <lib-preset-name-dialog ...></lib-preset-name-dialog>
  }
  ...
</div>
```

### Option C: CDK Overlay (If Dropdown Uses CDK)

If dropdown menu component uses Angular CDK overlay positioning, consider matching that approach:

- Use CDK overlay portal directives
- Match dropdown's positioning strategy (flexible, connected, etc.)
- Reuse dropdown's origin reference (preset button)

**Key Requirements**:

1. **Match Dropdown Position**: Inspect dropdown menu positioning and replicate it
   - Check `.header-actions` layout and dropdown positioning in devtools
   - Note: Dropdown menu positioning may use `position: absolute` relative to header
   
2. **Z-Index Management**: Ensure dialogs appear above other content
   - Match or exceed dropdown z-index
   - Typical range: 1000-1100 for overlays
   
3. **Viewport Handling**: Prevent dialogs from overflowing viewport
   - May need max-height constraints
   - May need to adjust position if near edges (optional for MVP)
   
4. **Responsive Behavior**: Test on different screen sizes
   - Ensure dialogs stay anchored to button on mobile
   - Verify no horizontal overflow

**Anti-Patterns to Avoid**:
- ❌ Don't use fixed positioning (breaks scrolling context)
- ❌ Don't hard-code pixel values (use relative positioning)
- ❌ Don't add inline styles to dialog components (use wrapper)
- ❌ Don't forget z-index (dialogs may appear behind other elements)

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] Unit tests verify dialog container positioning styles apply
- [ ] Unit tests verify z-index is set appropriately
- [ ] Visual testing confirms dialogs appear in correct position

**Behavioral Expectations**:

1. **Position Verification**:
   - Dialog container has `position: absolute` (or equivalent)
   - Dialog container has `top` and `left`/`right` values
   - Dialog container has `z-index >= 1000`
   
2. **Visual Consistency**:
   - Dialogs appear where dropdown was (visually verified)
   - No layout shift when transitioning between dropdown and dialogs
   - Smooth fade-in/fade-out if animations present

3. **Responsive Behavior**:
   - Dialogs stay anchored on different screen sizes
   - No horizontal overflow on mobile
   - Dialogs readable and accessible

**Testing Approach**:
- Unit tests: Verify CSS class application and style bindings
- Visual tests: Manual verification or screenshot comparison
- Responsive tests: Test on multiple viewport sizes

**Visual Testing Checklist**:
- [ ] Dialog appears in same position as dropdown (desktop)
- [ ] Dialog appears in same position as dropdown (mobile)
- [ ] Dialog doesn't overflow viewport right edge
- [ ] Dialog doesn't overflow viewport bottom edge
- [ ] No flickering or layout shifts during transitions
- [ ] Z-index correct (dialog appears above other panel content)

---

## 📤 Output Requirements

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-06-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 📖 Reference Materials

**Related Documentation**:
- [Phase 6 Plan](../phases/DROPDOWN-DIALOG-PHASE-06-DIALOG-SEPARATION.md#task-3-add-dialog-positioning) - Task context
- [Style Guide](../../../../docs/STYLE_GUIDE.md) - Positioning utility classes and patterns
- [Component Library](../../../../docs/COMPONENT_LIBRARY.md) - Overlay component patterns

**Related Tasks**:
- DROPDOWN-DIALOG-TASK-06-001-TEMPLATE-REFACTOR: Completed - dialogs structure
- DROPDOWN-DIALOG-TASK-06-002-STATE-MANAGEMENT: Completed - state coordination
- DROPDOWN-DIALOG-TASK-06-004-TESTING: Next - comprehensive testing

**Reports from Previous Tasks**:
- Review Task 06-001 and 06-002 reports for any positioning considerations discovered

---

## ✅ Definition of Done

- [ ] Dialog wrapper or container has positioning styles
- [ ] Positioning matches dropdown menu location (visually verified)
- [ ] Z-index ensures dialogs appear above other content
- [ ] No viewport overflow on typical screen sizes
- [ ] No layout shifts or flickers
- [ ] Positioning works on desktop and mobile viewports
- [ ] Unit tests verify positioning styles applied
- [ ] Visual verification completed (screenshots in report)
- [ ] Report saved to output location
