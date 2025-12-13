# Task Handoff: Preset Name Dialog Styles

**Task ID**: CRT-CUSTOM-PRESETS-TASK-02-003-PRESET-NAME-DIALOG-STYLES  
**Task Name**: Style Preset Name Dialog  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small (~2 files)

---

## 🎯 Objective

**What**: Apply consistent styling to the preset name dialog using established style guide patterns, Material component overrides, and responsive design principles.

**Why**: Cohesive styling ensures the dialog feels integrated with the CRT settings panel aesthetic while maintaining accessibility and mobile responsiveness.

**Success Criteria**:
- [ ] Dialog width set to ~400px for comfortable reading
- [ ] Dialog header styled with proper spacing and typography
- [ ] Material form field overrides applied for glassy theme
- [ ] Validation error message styled with clear visibility
- [ ] Character counter styled with state-based coloring
- [ ] Action buttons styled with proper spacing
- [ ] Focus indicators meet WCAG 2.1 AA contrast requirements
- [ ] Mobile responsive (tested at 360px width)
- [ ] All styles compile without errors
- [ ] Visual regression test passes (manual review)

---

## 📋 Prerequisites Completed

- ✅ **CRT-CUSTOM-PRESETS-TASK-02-001-PRESET-NAME-DIALOG-CLASS**: Component class implemented
- ✅ **CRT-CUSTOM-PRESETS-TASK-02-002-PRESET-NAME-DIALOG-TEMPLATE**: Template created

---

## 📦 Dependencies

**Style System**:
- Style Guide CSS variables (from global styles)
- Material Design component styles
- Glassy theme patterns

**Constraints**:
- Must use CSS variables from style guide (no hardcoded colors)
- Must maintain Material component structure (don't break encapsulation)
- Must be mobile-responsive (min-width: 360px)
- Must meet WCAG 2.1 AA contrast ratios (4.5:1 for normal text)

---

## 📂 File Scope

**Files to Create**:
- `libs/ui/components/src/lib/preset-name-dialog/preset-name-dialog.component.scss` - Dialog styles

**Files to Review** (for patterns):
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Similar dialog styling
- `libs/ui/components/src/lib/scaling-compact-card/scaling-compact-card.component.scss` - Card wrapper styles
- `libs/ui/styles/src/lib/_variables.scss` - CSS variables reference

**Files to Reference**:
- [Style Guide](../../../STYLE_GUIDE.md) - Design system documentation

---

## 🔧 Implementation Guidance

### SCSS Structure

```scss
:host {
  display: block;
}

// Dialog container sizing
lib-scaling-compact-card {
  max-width: 400px;
  width: 100%;
}

// Dialog header
.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  
  mat-icon {
    color: var(--primary-color);
    font-size: 24px;
    width: 24px;
    height: 24px;
  }
  
  h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--text-primary);
  }
}

// Material form field overrides
.preset-name-field {
  width: 100%;
  margin-bottom: var(--spacing-md);
  
  // Glassy input styling
  ::ng-deep .mat-mdc-form-field-outline {
    color: var(--border-color);
  }
  
  ::ng-deep .mat-mdc-form-field-outline-thick {
    color: var(--primary-color);
  }
  
  // Input text color
  ::ng-deep input {
    color: var(--text-primary);
  }
  
  // Label color
  ::ng-deep .mat-mdc-form-field-label {
    color: var(--text-secondary);
  }
  
  // Hint text (character counter)
  ::ng-deep .mat-mdc-form-field-hint {
    color: var(--text-dimmed);
  }
  
  // Error text
  ::ng-deep .mat-mdc-form-field-error {
    color: var(--error-color);
  }
}

// Character counter error state
.error-text {
  color: var(--error-color) !important;
  font-weight: 500;
}

// Button row
.button-row {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

// Focus indicators (accessibility)
input:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

// Mobile responsiveness
@media (max-width: 600px) {
  lib-scaling-compact-card {
    max-width: 100%;
    margin: var(--spacing-sm);
  }
  
  .button-row {
    flex-direction: column-reverse;
    gap: var(--spacing-xs);
    
    lib-icon-button {
      width: 100%;
    }
  }
}
```

### Key Requirements

1. **Dialog Sizing**:
   - Max-width: 400px (comfortable reading width)
   - Width: 100% (responsive within max-width)
   - Applied to `lib-scaling-compact-card` selector

2. **Dialog Header**:
   - Flexbox layout: `display: flex`, `align-items: center`
   - Gap between icon and title: `var(--spacing-md)` (16px typically)
   - Icon size: 24x24px
   - Icon color: `var(--primary-color)` (purple theme)
   - Title: No margin, medium-large font size, semi-bold weight

3. **Material Form Field Overrides**:
   - **Why `::ng-deep`**: Material components use ViewEncapsulation.Emulated, requires piercing
   - **Outline colors**: Border uses `--border-color`, focus uses `--primary-color`
   - **Input text**: `--text-primary` for high contrast
   - **Label text**: `--text-secondary` for hierarchy
   - **Hint text**: `--text-dimmed` for subtle counter
   - **Error text**: `--error-color` for validation messages

4. **Character Counter Error State**:
   - Class: `.error-text` (applied conditionally in template)
   - Color: `var(--error-color)` (red/pink)
   - Font weight: 500 (semi-bold for emphasis)
   - `!important`: Override Material hint styling

5. **Action Buttons**:
   - Flexbox: `display: flex`, `justify-content: flex-end`
   - Gap: `var(--spacing-sm)` (8px typically)
   - Margin-top: `var(--spacing-md)` (separation from form)
   - Buttons aligned right (common dialog pattern)

6. **Focus Indicators**:
   - Use `:focus-visible` (keyboard only, not mouse clicks)
   - Outline: 2px solid primary color
   - Offset: 2px (space between element and outline)
   - Meets WCAG 2.1 AA requirements

7. **Mobile Responsiveness**:
   - Breakpoint: 600px (Material standard)
   - Dialog: Full width with margin
   - Buttons: Stack vertically, full width
   - Order: Cancel on top, Save on bottom (reverse flex direction)

### CSS Variables Reference

From Style Guide (`libs/ui/styles/src/lib/_variables.scss`):

```scss
// Colors
--primary-color: #9b4dca;           // Purple accent
--error-color: #ff6b6b;             // Error red
--text-primary: rgba(255,255,255,0.9); // High contrast text
--text-secondary: rgba(255,255,255,0.7); // Medium contrast
--text-dimmed: rgba(255,255,255,0.5);    // Low contrast
--border-color: rgba(255,255,255,0.2);   // Subtle borders

// Spacing
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;

// Typography
--font-size-lg: 18px;
```

**Note**: Verify actual variable names in style guide. May differ slightly.

---

## 🧪 Testing Requirements

### Visual Regression Testing

**Manual Review Checklist** (no automated tests for styles):

**Desktop (1920x1080)**:
- [ ] Dialog width is ~400px, centered
- [ ] Header icon and title properly aligned
- [ ] Form field has clear outline
- [ ] Input text readable (high contrast)
- [ ] Character counter subtle but visible
- [ ] Buttons aligned right with proper spacing
- [ ] Focus indicators visible on tab navigation

**Mobile (360x640)**:
- [ ] Dialog fills screen width with margins
- [ ] Buttons stack vertically
- [ ] Cancel button appears above Save button
- [ ] Form field remains readable
- [ ] Touch targets ≥44px tall

**Validation States**:
- [ ] Error message clearly visible (red color)
- [ ] Character counter turns red when over limit
- [ ] Save button visually disabled (grayed out)

**Glassy Theme Integration**:
- [ ] Dialog background matches CRT settings panel
- [ ] Colors consistent with theme palette
- [ ] Focus states match existing components

**Accessibility**:
- [ ] Focus indicators have 4.5:1 contrast ratio
- [ ] Text colors have 4.5:1 contrast ratio
- [ ] Keyboard navigation clear and visible

### Testing Approach

1. **Run dev server**: `pnpm start`
2. **Navigate to dialog**: Create test page or use Storybook (if available)
3. **Test desktop layout**: Verify sizing and spacing
4. **Test mobile layout**: Resize browser to 360px width
5. **Test validation states**: Enter invalid input, check error styling
6. **Test keyboard navigation**: Tab through form, verify focus indicators
7. **Compare with CRT settings panel**: Ensure visual consistency

**Testing Reference**:
- See [Style Guide](../../../STYLE_GUIDE.md) for design system compliance
- See [Testing Standards](../../../TESTING_STANDARDS.md)

---

## 📚 Related Documentation

**Planning Documents**:
- [Phase 2: UI Dialog Components](../phases/CRT-CUSTOM-PRESETS-PHASE-02-UI-DIALOG-COMPONENTS.md)

**Design System**:
- [Style Guide](../../../STYLE_GUIDE.md) - CSS variables, utility classes, design tokens
- [Component Library](../../../COMPONENT_LIBRARY.md) - Component styling patterns

**Reference Components**:
- CRT Settings Panel SCSS - Similar dialog styling
- Scaling Compact Card SCSS - Card wrapper styles

**Standards**:
- [Coding Standards](../../../CODING_STANDARDS.md) - SCSS patterns

**Related Tasks**:
- CRT-CUSTOM-PRESETS-TASK-02-001-PRESET-NAME-DIALOG-CLASS: Component class
- CRT-CUSTOM-PRESETS-TASK-02-002-PRESET-NAME-DIALOG-TEMPLATE: Template

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-CUSTOM-PRESETS/reports/CRT-CUSTOM-PRESETS-TASK-02-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## 🎯 Anti-Patterns to Avoid

❌ **Don't hardcode colors** - Always use CSS variables from style guide  
❌ **Don't skip `::ng-deep`** - Material components require piercing ViewEncapsulation  
❌ **Don't forget mobile breakpoint** - Test at 360px width minimum  
❌ **Don't skip focus indicators** - Required for accessibility  
❌ **Don't use arbitrary spacing** - Use spacing variables from design system  
❌ **Don't override Material structure** - Work within Material's component classes  

---

## 💡 Implementation Tips

1. **Start with layout** - Get sizing and spacing right first
2. **Add Material overrides incrementally** - Test each override in browser
3. **Use browser DevTools** - Inspect Material component classes
4. **Test with validation errors** - Ensure error state styling works
5. **Test keyboard navigation early** - Focus states are critical
6. **Compare with CRT settings panel** - Match existing aesthetic
7. **Take screenshots** - Document visual states for report

---

**Ready to implement?** Create cohesive styles that integrate with the design system. Test thoroughly across desktop, mobile, and validation states. Prioritize accessibility and visual consistency.
