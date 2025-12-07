# Task 04-006: Settings Panel Organization & Polish

## 📋 Task Overview

| Property | Value |
|----------|-------|
| **Task ID** | CRT-EFFECT-ENHANCEMENT-TASK-04-006 |
| **Phase** | 4 - Advanced WebGL Effects |
| **Size** | Small (2-3 files) |
| **Priority** | Medium |
| **Dependencies** | TASK-04-001 through TASK-04-005 |

---

## 🎯 Objective

Organize all advanced effect controls (added in Tasks 04-002 through 04-005) into logical visual groups with section headers, consistent styling, and improved UX. This task focuses on **polish and organization** rather than initial control implementation.

> **Note**: Individual controls for each effect are implemented within their respective tasks (04-002 through 04-005) to enable immediate manual testing. This task consolidates and organizes those controls.

---

## 📚 Required Reading

- [ ] [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [ ] [Task 04-002: Phosphor Pattern](./CRT-EFFECT-ENHANCEMENT-TASK-04-002-PHOSPHOR-PATTERN.md) - implements phosphor controls
- [ ] [Task 04-003: Bloom Effect](./CRT-EFFECT-ENHANCEMENT-TASK-04-003-BLOOM-EFFECT.md) - implements bloom controls
- [ ] [Task 04-004: Barrel Distortion](./CRT-EFFECT-ENHANCEMENT-TASK-04-004-BARREL-DISTORTION.md) - implements distortion controls
- [ ] [Task 04-005: Chromatic Aberration](./CRT-EFFECT-ENHANCEMENT-TASK-04-005-CHROMATIC-ABERRATION.md) - implements CA controls
- [ ] [Current settings panel](../../../../libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts)

---

## 📂 Files to Modify

```
libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.html     📝 Add section headers and grouping
├── crt-settings-panel.component.scss     📝 Style section headers and groups
└── crt-settings-panel.component.spec.ts  📝 Add integration tests
```

---

## 🏗️ Technical Design

### Visual Layout with Section Headers

After Tasks 04-002 through 04-005 are complete, the controls will be scattered without visual grouping. This task adds section headers and organizes controls:

```
┌─────────────────────────────────┐
│ CRT Effect             [⚙️] [↺] │
├─────────────────────────────────┤
│ ── Scanlines ──                 │  ← Section header
│ Intensity     [━━━━━●━━] 50%    │
│ Size          [━━━●━━━━] 2.5px  │
│                                 │
│ ── Phosphor ──                  │  ← Section header
│ Pattern       [▼ Aperture Grill]│
│ Intensity     [━━●━━━━━] 30%    │
│                                 │
│ ── Bloom ──                     │  ← Section header
│ Enabled       [✓]               │
│ Intensity     [━━━●━━━━] 40%    │
│ Radius        [━━━●━━━━] 4px    │
│                                 │
│ ── Distortion ──                │  ← Section header
│ Barrel        [━━━●━━━━] 0.15   │
│ Chromatic     [━━━●━━━━] 2px    │
│                                 │
│ ── Vignette ──                  │  ← Section header
│ Strength      [━━━━●━━━] 65%    │
│                                 │
│ ── Color Filters ──             │  ← Section header
│ Contrast      [━━━●━━━━] 110%   │
│ Brightness    [━━━━●━━━] 150%   │
│ Saturation    [━━━●━━━━] 130%   │
│ Hue           [━━━━●━━━] 0°     │
└─────────────────────────────────┘
```

### Section Header Styling

**File**: `crt-settings-panel.component.scss`

```scss
// Section header styling
.crt-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 8px 0;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
  }
  
  &:first-child {
    margin-top: 0;
  }
}

// Control group styling within sections
.crt-control-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

### Template Organization

**File**: `crt-settings-panel.component.html`

```html
<!-- Scanlines Section -->
@if (config().showScanlines) {
  <span class="crt-section-header">Scanlines</span>
  <div class="crt-control-section">
    <!-- Existing scanline controls -->
  </div>
}

<!-- Phosphor Section (new) -->
@if (config().showPhosphor) {
  <span class="crt-section-header">Phosphor</span>
  <div class="crt-control-section">
    <!-- Phosphor pattern dropdown -->
    <!-- Phosphor intensity slider -->
  </div>
}

<!-- Bloom Section (new) -->
@if (config().showBloom) {
  <span class="crt-section-header">Bloom</span>
  <div class="crt-control-section">
    <!-- Bloom enabled toggle -->
    <!-- Bloom intensity slider (conditional) -->
    <!-- Bloom radius slider (conditional) -->
  </div>
}

<!-- Distortion Section (new) -->
@if (config().showDistortion || config().showChromaticAberration) {
  <span class="crt-section-header">Distortion</span>
  <div class="crt-control-section">
    <!-- Barrel distortion slider (conditional) -->
    <!-- Chromatic aberration slider (conditional) -->
  </div>
}

<!-- Vignette Section -->
@if (config().showVignette) {
  <span class="crt-section-header">Vignette</span>
  <div class="crt-control-section">
    <!-- Existing vignette controls -->
  </div>
}

<!-- Color Filters Section -->
@if (config().showColorFilters) {
  <span class="crt-section-header">Color Filters</span>
  <div class="crt-control-section">
    <!-- Existing color filter controls -->
  </div>
}
```

### Polish: Consistent Control Styling

Ensure all controls from Tasks 04-002 through 04-005 have consistent styling:

```scss
// Dropdown consistency (from Task 04-002)
.phosphor-select {
  // Ensure consistent with other inputs
}

// Toggle consistency (from Task 04-003)
.crt-toggle-group {
  // Ensure consistent alignment
}

// Slider consistency (all tasks)
.crt-control-group {
  // Unified spacing and layout
}
```

---

## 📋 Implementation Steps

### Step 1: Add Section Header Styling

**File**: `crt-settings-panel.component.scss`

1. Add `.crt-section-header` class with styling
2. Add `.crt-control-section` wrapper class
3. Ensure consistent spacing between sections

### Step 2: Reorganize Template with Section Headers

**File**: `crt-settings-panel.component.html`

1. Group existing scanline controls under "Scanlines" header
2. Group phosphor controls (from Task 04-002) under "Phosphor" header
3. Group bloom controls (from Task 04-003) under "Bloom" header
4. Group distortion controls (from Tasks 04-004, 04-005) under "Distortion" header
5. Group existing vignette controls under "Vignette" header
6. Group existing color filter controls under "Color Filters" header

### Step 3: Polish Control Consistency

Review and ensure consistent styling across all controls:
- Dropdown styling matches slider inputs
- Toggle alignment is consistent
- Spacing is uniform across all sections

### Step 4: Add Integration Tests

**File**: `crt-settings-panel.component.spec.ts`

Add tests verifying all controls work together with proper section grouping.

```typescript
describe('section organization', () => {
  it('should render section headers for visible control groups', () => {
    const config: CrtSettingsConfig = {
      ...DEFAULT_CRT_CONFIG,
      showScanlines: true,
      showPhosphor: true,
      showBloom: true,
      showDistortion: true,
      showChromaticAberration: true,
    };
    spectator.setInput('config', config);
    spectator.detectChanges();
    
    const headers = spectator.queryAll('.crt-section-header');
    expect(headers.length).toBeGreaterThanOrEqual(4);
  });
  
  it('should group distortion controls in same section', () => {
    const config: CrtSettingsConfig = {
      ...DEFAULT_CRT_CONFIG,
      showDistortion: true,
      showChromaticAberration: true,
    };
    spectator.setInput('config', config);
    spectator.detectChanges();
    
    // Both controls should be within the Distortion section
    const distortionHeader = spectator.query('.crt-section-header', { text: 'Distortion' });
    expect(distortionHeader).toBeTruthy();
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] Section headers visually separate control groups
- [ ] All Phase 4 controls (phosphor, bloom, distortion, CA) are properly grouped
- [ ] Section headers only appear when corresponding controls are enabled
- [ ] Consistent spacing and alignment across all sections
- [ ] All controls from Tasks 04-002 through 04-005 integrate seamlessly
- [ ] Integration tests pass
- [ ] TypeScript compiles without errors

---

## 🧪 Testing

### Unit Tests

```bash
pnpm nx test ui-components --testFile=crt-settings-panel --watch=false
```

### Manual Verification

1. **Start dev server**: `pnpm start`
2. **Navigate to player view** with active video/media content
3. **Open CRT settings panel**
4. **Verify section headers**:
   - Each logical group has a header (Scanlines, Phosphor, Bloom, etc.)
   - Headers only appear when controls are visible
   - Visual separation is clear and consistent
5. **Test all controls together**:
   - Enable all effects and verify no overlap or layout issues
   - Verify scrolling works if content exceeds panel height
6. **Test with different configs**:
   - Enable only some sections to verify conditional rendering

---

## 📝 Notes

### Accessibility

- Section headers should use semantic markup (or ARIA) for screen readers
- Ensure keyboard navigation flows logically through sections
- All controls should be keyboard accessible

### Mobile Considerations

- Consider collapsible sections for mobile (future enhancement)
- Ensure touch targets are adequately sized
- Test scrolling behavior on small screens

---

## 🔗 Related Files

- [Phase 4 Document](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-04-ADVANCED-EFFECTS.md)
- [Task 04-002: Phosphor Pattern](./CRT-EFFECT-ENHANCEMENT-TASK-04-002-PHOSPHOR-PATTERN.md)
- [Task 04-003: Bloom Effect](./CRT-EFFECT-ENHANCEMENT-TASK-04-003-BLOOM-EFFECT.md)
- [Task 04-004: Barrel Distortion](./CRT-EFFECT-ENHANCEMENT-TASK-04-004-BARREL-DISTORTION.md)
- [Task 04-005: Chromatic Aberration](./CRT-EFFECT-ENHANCEMENT-TASK-04-005-CHROMATIC-ABERRATION.md)
- Existing panel: `libs/ui/components/src/lib/crt-settings-panel/`
