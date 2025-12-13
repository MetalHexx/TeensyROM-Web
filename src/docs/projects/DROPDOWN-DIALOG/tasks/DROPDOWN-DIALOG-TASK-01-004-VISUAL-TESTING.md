# Task Handoff: Visual & Manual Testing Validation

## 📋 Task Identity

**Task ID**: DROPDOWN-DIALOG-TASK-01-004-VISUAL-TESTING  
**Task Name**: Visual and Manual Testing in Development Environment  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Validation)  
**Estimated Context Size**: Small (1-2 files)

---

## 🎯 Objective

**What**: Create a test harness page for manual testing of dropdown dialog in the development environment. Validate visual positioning, animations, interactions, and edge cases that are difficult to test programmatically.

**Why**: Automated tests verify logic, but visual testing catches positioning issues, animation glitches, and UX problems. Manual testing ensures the component feels right and works correctly across different viewport sizes and contexts.

**Success Criteria**:
- [ ] Test harness page created with multiple examples
- [ ] Visual positioning verified (below, above, start, end)
- [ ] Animations smooth and match dropdown menu
- [ ] Backdrop click-to-close works intuitively
- [ ] Fullscreen positioning tested and working
- [ ] Multiple instances don't interfere visually
- [ ] Responsive behavior validated
- [ ] No visual glitches or layout shifts

---

## 🔗 Context & Dependencies

**Prerequisites Completed**:
- DROPDOWN-DIALOG-TASK-01-001-CORE-COMPONENT - Component exists
- DROPDOWN-DIALOG-TASK-01-002-COMPOSABILITY-TESTS - Automated tests pass
- DROPDOWN-DIALOG-TASK-01-003-COMPONENT-EXPORT - Component importable

**Dependencies**:
- Working dropdown dialog component
- Dev server running (`pnpm start`)
- Existing dialog components for wrapping examples

**Constraints**:
- Must test in actual browser (not just automated tests)
- Must validate across different viewport sizes
- Must test fullscreen contexts
- Should use real dialog components (preset-name, confirmation)

---

## 📂 File Scope

**Files to Create**:
- `apps/teensyrom-ui/src/app/test-harness/dropdown-dialog-test.component.ts` - Test harness
- `apps/teensyrom-ui/src/app/test-harness/dropdown-dialog-test.component.html` - Test template
- `apps/teensyrom-ui/src/app/test-harness/dropdown-dialog-test.component.scss` - Test styles (optional)

**Files to Modify**:
- App routing if needed to add test route

**Files to Review**:
- Dropdown menu component for reference animations
- CRT settings panel for fullscreen context examples

---

## 🛠️ Implementation Guidance

### Standards to Follow

- [Coding Standards](../../../CODING_STANDARDS.md) - Component structure
- [Component Library](../../../COMPONENT_LIBRARY.md) - Usage patterns

### Key Requirements

**1. Test Harness Component Structure**

Create standalone component with multiple test scenarios:

```typescript
@Component({
  selector: 'app-dropdown-dialog-test',
  standalone: true,
  imports: [
    DropdownDialogComponent,
    PresetNameDialogComponent,
    ConfirmationDialogComponent,
    ScalingCompactCardComponent,
    IconButtonComponent,
    CommonModule
  ],
  templateUrl: './dropdown-dialog-test.component.html',
  styleUrl: './dropdown-dialog-test.component.scss'
})
export class DropdownDialogTestComponent {
  // Test data
  presetNames = ['Custom 1', 'Custom 2'];
  
  // Event handlers
  onPresetSaved(name: string) {
    console.log('Preset saved:', name);
  }
  
  onDeleteConfirmed() {
    console.log('Delete confirmed');
  }
  
  validatePresetName(name: string, reserved: string[]): string {
    if (!name.trim()) return 'Name is required';
    if (reserved.includes(name)) return 'Name already exists';
    return '';
  }
}
```

**2. Test Scenarios in Template**

Create sections testing different aspects:

```html
<div class="test-harness">
  <h1>Dropdown Dialog Test Harness</h1>
  
  <!-- Section 1: Basic Positioning -->
  <section>
    <h2>Basic Positioning</h2>
    <p>Test dialog positioning below, above, left, right</p>
    
    <div class="test-row">
      <lib-dropdown-dialog #dialog1>
        <button (click)="dialog1.open()">Open Below</button>
        <div dialog-content>
          <lib-scaling-compact-card>
            <h3>Dialog Content</h3>
            <p>Positioned below trigger</p>
            <button (click)="dialog1.close()">Close</button>
          </lib-scaling-compact-card>
        </div>
      </lib-dropdown-dialog>
    </div>
  </section>
  
  <!-- Section 2: Preset Name Dialog -->
  <section>
    <h2>Preset Name Dialog</h2>
    <p>Test wrapping preset-name-dialog component</p>
    
    <lib-dropdown-dialog #presetDialog>
      <lib-icon-button
        icon="save"
        (buttonClick)="presetDialog.open()">
      </lib-icon-button>
      
      <div dialog-content>
        <lib-preset-name-dialog
          title="Save Preset"
          [reservedNames]="presetNames"
          [validationFn]="validatePresetName.bind(this)"
          (confirmed)="onPresetSaved($event); presetDialog.close()"
          (cancelled)="presetDialog.close()">
        </lib-preset-name-dialog>
      </div>
    </lib-dropdown-dialog>
  </section>
  
  <!-- Section 3: Confirmation Dialog -->
  <section>
    <h2>Confirmation Dialog</h2>
    <p>Test wrapping confirmation-dialog component</p>
    
    <lib-dropdown-dialog #confirmDialog>
      <lib-icon-button
        icon="delete"
        color="error"
        (buttonClick)="confirmDialog.open()">
      </lib-icon-button>
      
      <div dialog-content>
        <lib-confirmation-dialog
          title="Delete Preset"
          message="Are you sure you want to delete this preset?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          (confirmed)="onDeleteConfirmed(); confirmDialog.close()"
          (cancelled)="confirmDialog.close()">
        </lib-confirmation-dialog>
      </div>
    </lib-dropdown-dialog>
  </section>
  
  <!-- Section 4: Multiple Instances -->
  <section>
    <h2>Multiple Instances</h2>
    <p>Test multiple dialogs on same page</p>
    
    <div class="test-row">
      <!-- Create 3-4 dialog instances -->
    </div>
  </section>
  
  <!-- Section 5: Edge Cases -->
  <section>
    <h2>Edge Cases</h2>
    
    <!-- Near viewport edges -->
    <div class="edge-test top-left">
      <lib-dropdown-dialog #topLeft>
        <button (click)="topLeft.open()">Top Left</button>
        <div dialog-content>
          <lib-scaling-compact-card>
            <p>Should position below (fallback)</p>
            <button (click)="topLeft.close()">Close</button>
          </lib-scaling-compact-card>
        </div>
      </lib-dropdown-dialog>
    </div>
    
    <div class="edge-test bottom-right">
      <lib-dropdown-dialog #bottomRight>
        <button (click)="bottomRight.open()">Bottom Right</button>
        <div dialog-content>
          <lib-scaling-compact-card>
            <p>Should position above (fallback)</p>
            <button (click)="bottomRight.close()">Close</button>
          </lib-scaling-compact-card>
        </div>
      </lib-dropdown-dialog>
    </div>
  </section>
  
  <!-- Section 6: Fullscreen Context -->
  <section>
    <h2>Fullscreen Context</h2>
    <button (click)="enterFullscreen()">Enter Fullscreen</button>
    
    <div #fullscreenContainer class="fullscreen-test">
      <lib-dropdown-dialog #fullscreenDialog>
        <button (click)="fullscreenDialog.open()">Open in Fullscreen</button>
        <div dialog-content>
          <lib-scaling-compact-card>
            <p>Should position relative to fullscreen container</p>
            <button (click)="fullscreenDialog.close()">Close</button>
          </lib-scaling-compact-card>
        </div>
      </lib-dropdown-dialog>
    </div>
  </section>
</div>
```

**3. Styling for Test Harness**

Add styles to make testing easier:

```scss
.test-harness {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  
  section {
    margin-bottom: 3rem;
    padding: 2rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    
    h2 {
      margin-top: 0;
    }
    
    p {
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }
  }
  
  .test-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .edge-test {
    position: absolute;
    
    &.top-left {
      top: 10px;
      left: 10px;
    }
    
    &.bottom-right {
      bottom: 10px;
      right: 10px;
    }
  }
  
  .fullscreen-test {
    min-height: 400px;
    background: var(--background-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

**4. Manual Testing Checklist**

Create checklist in component or README:

```markdown
## Manual Testing Checklist

### Visual Positioning
- [ ] Dialog appears below trigger by default
- [ ] Dialog repositions above when no space below
- [ ] Dialog aligns correctly (start/end)
- [ ] Offset spacing is consistent (8px)

### Animations
- [ ] Fade-in animation smooth
- [ ] Scale animation smooth
- [ ] Timing matches dropdown menu
- [ ] No flicker or jump

### Interactions
- [ ] Backdrop click closes dialog
- [ ] Close button works
- [ ] Multiple dialogs don't interfere
- [ ] Can open/close repeatedly without issues

### Fullscreen
- [ ] Dialog positions correctly in fullscreen
- [ ] Backdrop covers fullscreen area
- [ ] Elements restore correctly on close

### Responsive
- [ ] Works on desktop (1920px)
- [ ] Works on tablet (768px)
- [ ] Works on mobile (375px)
- [ ] Repositions on window resize

### Content Projection
- [ ] Preset name dialog renders correctly
- [ ] Confirmation dialog renders correctly
- [ ] Custom content renders correctly
- [ ] Forms work inside dialog
```

**5. Fullscreen Test Helper**

Add method to enter fullscreen for testing:

```typescript
@ViewChild('fullscreenContainer') fullscreenContainer!: ElementRef;

enterFullscreen(): void {
  const element = this.fullscreenContainer.nativeElement;
  if (element.requestFullscreen) {
    element.requestFullscreen();
  }
}
```

### Anti-Patterns to Avoid

❌ **Don't skip edge case testing** - Viewport edges are critical  
❌ **Don't only test happy path** - Test failure scenarios  
❌ **Don't ignore animations** - Visual polish matters  
❌ **Don't test only on desktop** - Responsive behavior important  
❌ **Don't rush testing** - Take time to verify quality

### Testing Process

**Systematic Approach**:
1. Open dev server and navigate to test harness
2. Go through each section methodically
3. Test each checklist item
4. Document any issues found
5. Verify fixes visually
6. Test across different browsers (Chrome, Firefox, Edge)

---

## 🧪 Testing Requirements

### Visual Testing Checklist

**Positioning Tests**:
- [ ] Dialog below trigger (default)
- [ ] Dialog above trigger (when no space below)
- [ ] Dialog left-aligned (start)
- [ ] Dialog right-aligned (end)
- [ ] Correct offset spacing (8px)
- [ ] Repositions on scroll
- [ ] Repositions on viewport resize

**Animation Tests**:
- [ ] Fade-in smooth (150ms)
- [ ] Scale animation (0.95 → 1.0)
- [ ] Fade-out smooth (100ms)
- [ ] No visual flicker
- [ ] Timing matches dropdown menu

**Interaction Tests**:
- [ ] Backdrop click closes
- [ ] Close button works
- [ ] Multiple opens/closes stable
- [ ] Rapid clicking handled gracefully
- [ ] Keyboard navigation works (Tab, Escape)

**Content Tests**:
- [ ] Preset name dialog renders correctly
- [ ] Confirmation dialog renders correctly
- [ ] Custom content renders correctly
- [ ] Forms functional inside dialog
- [ ] Buttons clickable

**Fullscreen Tests**:
- [ ] Dialog positions in fullscreen
- [ ] Backdrop covers fullscreen area
- [ ] Exit fullscreen restores correctly
- [ ] No orphaned overlays

**Responsive Tests**:
- [ ] Desktop layout (1920px+)
- [ ] Tablet layout (768-1024px)
- [ ] Mobile layout (375-767px)
- [ ] Repositions on orientation change

### Browser Compatibility

Test in these browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

### Edge Cases

- [ ] Trigger at top of viewport
- [ ] Trigger at bottom of viewport
- [ ] Trigger at left edge
- [ ] Trigger at right edge
- [ ] Very long dialog content (scrolling)
- [ ] Very wide dialog content
- [ ] Rapid open/close cycles
- [ ] Multiple dialogs simultaneously

---

## 📚 Reference Materials

### Related Documentation

- [Master Plan](../DROPDOWN-DIALOG-MASTER-PLAN.md) - Visual requirements
- [Phase 1 Plan](../phases/DROPDOWN-DIALOG-PHASE-01-CORE-COMPONENT.md) - Testing section
- [Style Guide](../../../STYLE_GUIDE.md) - Visual consistency

### Related Tasks

- DROPDOWN-DIALOG-TASK-01-001-CORE-COMPONENT - Component being tested
- DROPDOWN-DIALOG-TASK-01-002-COMPOSABILITY-TESTS - Automated tests
- DROPDOWN-DIALOG-TASK-03-001-CRT-INTEGRATION - Real-world usage

### Key Architectural Decisions

**Decision 1: Manual Testing Required**
- Automated tests can't catch visual issues
- Manual testing ensures quality UX
- Catches animation and timing problems

**Decision 2: Test Harness Approach**
- Dedicated page for testing scenarios
- Easier than testing in production context
- Can be kept for regression testing

**Decision 3: Comprehensive Edge Cases**
- Test viewport edges explicitly
- Test fullscreen explicitly
- Test responsive behavior explicitly

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DROPDOWN-DIALOG/reports/DROPDOWN-DIALOG-TASK-01-004-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Report Should Include**:
- Visual testing results (checklist completion)
- Screenshots of working examples
- Any issues discovered and fixed
- Browser compatibility notes
- Responsive behavior notes

**Return Value**: File path of saved report when complete

---

## 💡 Implementation Notes

### Getting Started

1. **Create Test Harness**: Scaffold component with sections
2. **Add Basic Examples**: Start with simple dialogs
3. **Add Real Components**: Wrap preset-name and confirmation dialogs
4. **Add Edge Cases**: Position tests near viewport edges
5. **Add Fullscreen**: Test fullscreen context
6. **Manual Testing**: Go through checklist systematically

### Visual Testing Tips

- **Use Browser DevTools**: Inspect overlay positioning
- **Test Scrolling**: Scroll page and verify repositioning
- **Test Resizing**: Resize viewport and verify adaptation
- **Compare to Dropdown Menu**: Ensure consistent behavior
- **Take Screenshots**: Document working examples

### Issue Documentation

If issues found:
```markdown
### Issue: Dialog Flickers on Open

**Description**: Dialog briefly appears in wrong position before repositioning.

**Reproduction Steps**:
1. Open dialog near bottom of viewport
2. Observe initial position
3. Notice flicker as CDK repositions

**Expected**: Smooth appearance in correct position
**Actual**: Brief flicker in default position then repositioning

**Fix**: [Describe fix or defer to bug report]
```

### Success Validation

Before marking complete:
- [ ] Test harness page created and accessible
- [ ] All checklist items tested
- [ ] Visual positioning verified
- [ ] Animations smooth and correct
- [ ] No visual glitches found (or documented)
- [ ] Screenshots captured
- [ ] Report written with findings

---

## 🎯 Completion Checklist

When you've finished this task:

- [ ] Test harness component created
- [ ] All test scenarios implemented
- [ ] Manual testing checklist completed
- [ ] Visual validation done across browsers
- [ ] Edge cases tested
- [ ] Issues documented (if any)
- [ ] Screenshots captured
- [ ] Completion report written
- [ ] Report saved to specified location

---

## 🤝 Questions Before Starting?

If anything is unclear:
1. Should test harness be temporary or permanent?
2. How detailed should issue documentation be?
3. Should screenshots be included in report?
4. Are there specific browsers to prioritize?

Clarify early to ensure thorough testing!

---

**Task Status**: Ready to assign  
**Expected Effort**: 2-3 hours  
**Blocking Issues**: Requires Tasks 01-001, 01-002, 01-003 complete  
**Ready to Begin**: ✅ After Tasks 01-001, 01-002, 01-003
