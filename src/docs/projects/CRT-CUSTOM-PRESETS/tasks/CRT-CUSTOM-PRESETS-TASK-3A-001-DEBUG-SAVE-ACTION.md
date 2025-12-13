# Task 3A-001: Debug Save Action Click Handler

**Task ID**: CRT-CUSTOM-PRESETS-TASK-3A-001  
**Task Name**: Debug Save Action Click Handler  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Blocker)  
**Estimated Context Size**: Small-Medium

---

## 🎯 What & Why

**What**: Debug the "Save Current as Preset" dropdown menu item click handler to identify why clicking the save action does not open the preset name dialog.

**Why**: Users cannot create custom presets because the save action appears non-functional. While unit tests pass in isolation, the actual UI interaction fails, suggesting an event handling or signal binding issue.

**Success Criteria**:
- [ ] Clicking "Save Current as Preset" calls `onSaveAsPreset()` method
- [ ] `showNameDialog` signal transitions from `false` → `true` when clicked
- [ ] `isRenaming` signal is set to `false` when save action clicked
- [ ] `dialogPresetName` signal is cleared when save action clicked
- [ ] Console logs clearly show event flow and signal state changes
- [ ] Root cause identified and documented

---

## Context & Dependencies

**Prerequisites Completed**:
- CRT-CUSTOM-PRESETS-TASK-03-003: Consumer component integration
- CRT-CUSTOM-PRESETS-TASK-03-004: E2E testing of custom preset workflows
- Phase 3 complete with all tests passing

**Dependencies**:
- `CrtSettingsPanelComponent` - Contains save action handler
- `DropdownMenuComponent` - Contains menu item that triggers save action
- `PresetNameDialogComponent` - Dialog that should appear after save click

**Constraints**:
- Must not break existing functionality (preset selection, rename, delete)
- Must maintain test coverage
- Must use existing logging patterns from [LOGGING_STANDARDS.md](../../LOGGING_STANDARDS.md)

---

## File Scope

**Files to Review** (for context):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Save action handler
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Template bindings
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu.component.ts` - Menu item click handling
- `libs/ui/components/src/lib/dropdown-menu/dropdown-menu-item.component.ts` - Item event emission

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add debug logging
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts` - Add reproduction test

**Files to Create**:
- `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-3A-001-REPORT.md` - Debug findings

---

## Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../CODING_STANDARDS.md) - Component patterns, signal usage
- [Testing Standards](../../TESTING_STANDARDS.md) - Behavioral testing approach
- [Smart Component Testing](../../SMART_COMPONENT_TESTING.md) - Component test patterns
- [Logging Standards](../../LOGGING_STANDARDS.md) - Console logging conventions

**Key Requirements**:

1. **Add Console Logging**: Add comprehensive logging to track event flow
   - Log method entry/exit
   - Log signal state before and after changes
   - Log event handler execution
   - Use consistent prefix: `[CrtSettingsPanel]`

2. **Browser Inspection**: Use browser DevTools to verify:
   - Click event listener is registered on save menu item
   - Event propagation reaches component
   - Signal values change in Angular DevTools
   - Template re-renders after signal changes

3. **Reproduction Test**: Create test that simulates exact user interaction:
   - Open preset dropdown
   - Find and click "Save Current as Preset" menu item
   - Verify `onSaveAsPreset()` is called
   - Verify signals change correctly

4. **Document Findings**: Create detailed report with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Console log output
   - DevTools observations
   - Root cause hypothesis

**Anti-Patterns to Avoid**:
- Don't make code changes before understanding the issue
- Don't assume the problem - verify with evidence
- Don't skip logging steps - they're critical for diagnosis
- Don't test only in unit tests - verify in actual UI

---

## Testing Requirements

**Test Coverage Required**:

**Reproduction Test** (Add to `crt-settings-panel.component.spec.ts`):
```typescript
it('should open dialog when save action is clicked in UI', async () => {
  fixture.detectChanges();
  
  // Open dropdown
  const tuneButton = findIconButton(fixture.nativeElement, 'tune');
  tuneButton?.querySelector('button')?.click();
  fixture.detectChanges();
  await fixture.whenStable();
  
  // Find save action in overlay
  const overlay = document.querySelector('.cdk-overlay-container');
  const saveAction = overlay?.querySelector('[data-testid="save-preset-action"]') as HTMLElement;
  
  // Verify save action exists
  expect(saveAction).toBeTruthy();
  
  // Click save action
  saveAction?.click();
  fixture.detectChanges();
  await fixture.whenStable();
  
  // Verify dialog opens
  expect((component as any).showNameDialog()).toBe(true);
  
  // Verify dialog is rendered
  const dialog = fixture.nativeElement.querySelector('lib-preset-name-dialog');
  expect(dialog).toBeTruthy();
});
```

**Behavioral Expectations**:
- Clicking save action triggers `onSaveAsPreset()` method
- Method execution sets `showNameDialog` signal to `true`
- Signal change causes template to render dialog component
- Dialog component receives correct input bindings
- Console logs show complete event flow

---

## Reference Materials

**Related Documentation**:
- [Phase 3A Plan](../CRT-CUSTOM-PRESETS-PHASE-3A-BUG-FIXES.md) - Overall debugging strategy
- [Phase 3 Task 3 Report](../reports/CRT-CUSTOM-PRESETS-TASK-03-003-REPORT.md) - Previous implementation
- [Dropdown Menu Component](../../COMPONENT_LIBRARY.md#dropdown-menu) - Menu behavior

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-03-003: Consumer component integration (completed)
- CRT-CUSTOM-PRESETS-TASK-3A-002: Debug dialog rendering (next)
- CRT-CUSTOM-PRESETS-TASK-3A-003: Debug validation binding (next)

**Debugging Checklist**:

1. **Add Logging**:
   ```typescript
   protected onSaveAsPreset(): void {
     console.log('[CrtSettingsPanel] onSaveAsPreset called');
     console.log('[CrtSettingsPanel] Current state:', {
       showNameDialog: this.showNameDialog(),
       isRenaming: this.isRenaming(),
       dialogPresetName: this.dialogPresetName(),
       customPresetsCount: this.customPresets().length
     });
     
     this.isRenaming.set(false);
     this.dialogPresetName.set('');
     this.showNameDialog.set(true);
     
     console.log('[CrtSettingsPanel] After updates:', {
       showNameDialog: this.showNameDialog(),
       isRenaming: this.isRenaming(),
       dialogPresetName: this.dialogPresetName()
     });
   }
   ```

2. **Test in Browser**:
   - Start dev server: `pnpm start`
   - Open browser DevTools console
   - Navigate to CRT settings
   - Click save action
   - Observe console logs
   - Check Angular DevTools for signal values

3. **Inspect DOM**:
   - Open Elements tab in DevTools
   - Find save menu item element
   - Check event listeners in Event Listeners panel
   - Verify `itemClick` event is bound
   - Set breakpoint in event handler

4. **Document Findings**: Create report with:
   - Observed behavior
   - Console log output
   - DevTools screenshots (if relevant)
   - Root cause hypothesis
   - Recommended fix

---

## Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-3A-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../subagent-planning/SUBAGENT_REPORT.md)

**Required Report Sections**:
1. **Executive Summary** - Issue description and root cause
2. **Investigation Steps** - What was checked and how
3. **Findings** - Observed behavior vs expected
4. **Console Logs** - Complete log output from testing
5. **Root Cause** - Definitive cause of the issue
6. **Reproduction Steps** - How to reproduce the issue
7. **Recommendations** - Suggested fixes for next task

**Return Value**: Return the file path when complete: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-3A-001-REPORT.md`

---

## Investigation Strategy

**Phase 1: Observation** (15 minutes)
- Run app in browser
- Navigate to CRT settings panel
- Click "Save Current as Preset"
- Observe: Does anything happen at all?
- Note any console errors or warnings

**Phase 2: Logging** (30 minutes)
- Add console.log statements to `onSaveAsPreset()`
- Add logging to signal setters
- Run app again
- Click save action
- Verify logs appear (if not, event isn't reaching handler)

**Phase 3: Event Flow** (30 minutes)
- Inspect dropdown menu item event binding
- Check if `itemClick` event is emitted
- Check if parent component receives event
- Set breakpoints in event handler
- Step through code execution

**Phase 4: Signal State** (15 minutes)
- Use Angular DevTools
- Watch signal values as you click
- Verify `showNameDialog` changes
- Verify template reactivity to signal changes

**Phase 5: Documentation** (30 minutes)
- Compile all findings
- Create comprehensive report
- Include screenshots/logs
- Provide clear root cause analysis
- Recommend specific fixes

**Total Estimated Time**: 2 hours

---

## Success Validation

Before marking this task complete, verify:

- [ ] Console logging added to all relevant methods
- [ ] Reproduction test written and passing/failing as expected
- [ ] Issue root cause identified with evidence
- [ ] Browser testing completed with observations documented
- [ ] DevTools inspection completed
- [ ] Complete report written with findings
- [ ] Recommendations provided for Task 3A-002
- [ ] No new TypeScript errors introduced
- [ ] Existing tests still pass

---

**Remember**: The goal is **diagnosis**, not fixing. Document everything you observe. The fix will come in Task 3A-005 after all issues are identified.
