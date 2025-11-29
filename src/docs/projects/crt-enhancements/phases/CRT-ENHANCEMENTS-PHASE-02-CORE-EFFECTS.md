# Phase 2: Core Effect Parameters (User-Requested)

## 🎯 Objective

Add the most-requested effect parameters that enable authentic CRT reproduction: scanline opacity control, color hue/temperature adjustment, and vertical scanlines with grid modes. These parameters unlock the ability to emulate specific hardware like Trinitron aperture grille monitors and properly color-match different video connection types.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Enhancements Master Plan](../CRT-ENHANCEMENTS-MASTER-PLAN.md) - High-level project plan
- [ ] [CRT Enhancements Brainstorming](../CRT_ENHANCEMENTS_BRAINSTORMING.md) - Feature research with CSS implementation details
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Existing CRT component documentation
- [ ] Phase 1 Report (when complete) - Dropdown infrastructure details

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Application styling standards

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.interface.ts              📝 Modified - Add new parameters
│   ├── crt-settings.defaults.ts               📝 Modified - Add defaults for new params
│   ├── crt-effect-wrapper.component.ts        📝 Modified - Add new CSS bindings
│   └── crt-effect-wrapper.component.scss      📝 Modified - Implement new CSS effects
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts        📝 Modified - Add new slider configs
│   ├── crt-settings-panel.component.html      📝 Modified - Add collapsible sections
│   ├── crt-settings-panel.component.scss      📝 Modified - Style collapsible sections
│   └── crt-settings-panel.component.spec.ts   📝 Modified - Test new controls
└── collapsible-section/                        ✨ New - Optional reusable component
    ├── collapsible-section.component.ts       ✨ New
    ├── collapsible-section.component.html     ✨ New
    └── collapsible-section.component.scss     ✨ New
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Extend CrtSettings Interface</h3></summary>

**Purpose**: Add new parameters to the CrtSettings interface for scanline opacity, color adjustments, vertical scanlines, and grid modes.

**New Properties**:

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `scanlineOpacity` | `number` | 0-1 | Darkness of scanlines (0.6 = soft, 1 = pure black) |
| `hueRotate` | `number` | -180 to 180 | Color hue shift in degrees |
| `colorTemperature` | `number` | -1 to 1 | Cool (blue) to warm (orange) adjustment |
| `verticalScanlineIntensity` | `number` | 0-0.5 | Visibility of vertical scanlines |
| `verticalScanlineOpacity` | `number` | 0-1 | Darkness of vertical scanlines |
| `verticalScanlineThickness` | `number` | 1-4 | Width of vertical dark bands (px) |
| `verticalScanlineSpacing` | `number` | 1-8 | Gap between vertical bands (px) |
| `gridMode` | `GridMode` | enum | 'none', 'horizontal', 'vertical', 'grid', 'dot-matrix' |
| `gridBlendMode` | `GridBlendMode` | enum | 'multiply', 'overlay', 'darken' |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

**Testing**:
- [ ] TypeScript compiles with new interface
- [ ] Existing code continues to work with new optional properties

</details>

---

<details open>
<summary><h3>Task 2: Extend CrtSettingsConfig Interface</h3></summary>

**Purpose**: Add new feature flags to control visibility of new setting groups in the panel.

**New Config Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `showAdvancedScanlines` | `boolean` | Show scanline opacity control |
| `showVerticalScanlines` | `boolean` | Show vertical scanline controls |
| `showGridMode` | `boolean` | Show grid mode selector |
| `showColorTint` | `boolean` | Show hue/temperature controls |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

**Testing**:
- [ ] Config flags control slider visibility
- [ ] Default config includes new flags appropriately

</details>

---

<details open>
<summary><h3>Task 3: Update Default Settings and Configs</h3></summary>

**Purpose**: Define sensible default values for all new parameters and update preset configurations.

**Default Values**:

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `scanlineOpacity` | 0.7 | Match current visual behavior |
| `hueRotate` | 0 | No color shift by default |
| `colorTemperature` | 0 | Neutral temperature |
| `verticalScanlineIntensity` | 0 | Disabled by default |
| `verticalScanlineOpacity` | 0.7 | Match horizontal default |
| `verticalScanlineThickness` | 1 | Subtle when enabled |
| `verticalScanlineSpacing` | 2 | Reasonable gap |
| `gridMode` | 'horizontal' | Match current behavior |
| `gridBlendMode` | 'multiply' | Standard darkening |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Testing**:
- [ ] All presets continue to work with new defaults
- [ ] New configs export correctly

</details>

---

<details open>
<summary><h3>Task 4: Implement Scanline Opacity CSS</h3></summary>

**Purpose**: Modify the scanline CSS to use opacity parameter for controlling darkness of lines.

**CSS Changes**:
- Add `--scanline-opacity` CSS custom property
- Update repeating-linear-gradient to use `rgba(0, 0, 0, calc(var(--scanline-opacity) * var(--scanline-intensity)))`

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add opacity binding
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Update gradient

**Testing**:
- [ ] Scanlines at opacity 0.6 appear soft/transparent
- [ ] Scanlines at opacity 1.0 appear pure black
- [ ] Visual effect matches brainstorming document examples

</details>

---

<details open>
<summary><h3>Task 5: Implement Hue and Temperature Filters</h3></summary>

**Purpose**: Add CSS filters for hue rotation and color temperature adjustment.

**CSS Changes**:
- Add `hue-rotate()` filter using `--crt-hue-rotate` variable
- Implement color temperature using combination of sepia filter and saturation adjustment
- Warm shift: Apply sepia filter with saturation compensation
- Cool shift: Apply slight blue tint via hue-rotate or invert+hue technique

**Implementation Approach for Temperature**:
```scss
// Warm shift (positive temperature)
filter: ... sepia(calc(max(0, var(--crt-color-temp)) * 0.3))
           saturate(calc(1 + max(0, var(--crt-color-temp)) * 0.2));

// Cool shift (negative temperature) - use hue-rotate toward blue
filter: ... hue-rotate(calc(min(0, var(--crt-color-temp)) * 30deg));
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add bindings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Add filters

**Testing**:
- [ ] Hue rotate at -30° shifts colors toward red
- [ ] Hue rotate at +30° shifts colors toward green
- [ ] Temperature +0.5 produces warm orange tint
- [ ] Temperature -0.5 produces cool blue tint

</details>

---

<details open>
<summary><h3>Task 6: Implement Vertical Scanlines CSS</h3></summary>

**Purpose**: Add vertical scanline overlay that mirrors horizontal scanline parameters.

**CSS Changes**:
- Add vertical scanline CSS custom properties (same pattern as horizontal)
- Layer vertical gradient on top of horizontal gradient
- Use 90deg angle for vertical lines

**CSS Pattern**:
```scss
.crt-wrapper.crt-enabled::before {
  background-image: 
    // Horizontal scanlines
    repeating-linear-gradient(0deg, ...),
    // Vertical scanlines  
    repeating-linear-gradient(90deg,
      rgba(0, 0, 0, calc(var(--v-scanline-opacity) * var(--v-scanline-intensity))) 0px,
      rgba(0, 0, 0, calc(var(--v-scanline-opacity) * var(--v-scanline-intensity))) var(--v-scanline-thickness),
      transparent var(--v-scanline-thickness),
      transparent calc(var(--v-scanline-thickness) + var(--v-scanline-spacing))
    );
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add bindings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Add vertical gradient

**Testing**:
- [ ] Vertical scanlines render as vertical dark bands
- [ ] All four parameters control vertical scanlines correctly
- [ ] Works independently from horizontal scanlines

</details>

---

<details open>
<summary><h3>Task 7: Implement Grid Mode Selector</h3></summary>

**Purpose**: Add grid mode switching that controls which scanline patterns are visible.

**Grid Mode Behavior**:

| Mode | Horizontal | Vertical | Notes |
|------|------------|----------|-------|
| `none` | Off | Off | No scanline overlay |
| `horizontal` | On | Off | Classic CRT look |
| `vertical` | Off | On | Trinitron/aperture grille |
| `grid` | On | On | Shadow mask simulation |
| `dot-matrix` | Special | Special | Circular aperture pattern |

**CSS Implementation**:
- Add host binding classes for each grid mode
- Conditionally include background-image layers based on mode
- Implement dot-matrix using radial-gradient pattern

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add mode class binding
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Add mode-specific CSS

**Testing**:
- [ ] Each grid mode produces expected visual pattern
- [ ] Dot-matrix mode creates circular aperture pattern
- [ ] Grid blend mode affects how patterns combine

</details>

---

<details open>
<summary><h3>Task 8: Create Collapsible Section Component (Optional)</h3></summary>

**Purpose**: Create a reusable collapsible section component for organizing the settings panel, OR implement inline collapsible sections using Angular animations.

**Component Features**:
- Expandable/collapsible header with chevron indicator
- Smooth animation for expand/collapse
- Compact styling matching settings panel aesthetic

**Alternative**: Implement directly in settings panel using `@if` and CSS transitions.

**Files to Create** (if component approach):
- `libs/ui/components/src/lib/collapsible-section/collapsible-section.component.ts`
- `libs/ui/components/src/lib/collapsible-section/collapsible-section.component.html`
- `libs/ui/components/src/lib/collapsible-section/collapsible-section.component.scss`

**Testing**:
- [ ] Section expands/collapses on header click
- [ ] Animation is smooth
- [ ] Accessibility: keyboard navigation works

</details>

---

<details open>
<summary><h3>Task 9: Update Settings Panel UI</h3></summary>

**Purpose**: Add new sliders and controls to the settings panel, organized into collapsible sections.

**Section Organization**:

1. **Horizontal Scanlines** (existing + opacity)
   - Intensity, Thickness, Spacing, Opacity

2. **Vertical Scanlines** (new)
   - Intensity, Opacity, Thickness, Spacing

3. **Grid Mode** (new)
   - Grid mode selector
   - Grid blend mode selector

4. **Color Adjustments** (mixed)
   - Hue Rotate
   - Color Temperature
   - (Existing: Contrast, Brightness, Saturation)

5. **Screen Effects** (existing)
   - Vignette
   - Curvature

**Slider Configurations** (new):

| Slider | Min | Max | Step | Format |
|--------|-----|-----|------|--------|
| Scanline Opacity | 0 | 1 | 0.05 | 2 decimals |
| Hue Rotate | -180 | 180 | 5 | ° suffix |
| Color Temperature | -1 | 1 | 0.1 | 1 decimal |
| V-Scanline Intensity | 0 | 0.5 | 0.01 | 2 decimals |
| V-Scanline Opacity | 0 | 1 | 0.05 | 2 decimals |
| V-Scanline Thickness | 1 | 4 | 1 | px suffix |
| V-Scanline Spacing | 1 | 8 | 1 | px suffix |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add slider configs
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add sections and sliders
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Style sections

**Testing**:
- [ ] All new sliders render correctly
- [ ] Sections collapse/expand properly
- [ ] Slider changes emit updated settings
- [ ] Config flags hide/show appropriate sections

</details>

---

<details open>
<summary><h3>Task 10: Add Grid Mode and Blend Mode Selectors</h3></summary>

**Purpose**: Add dropdown or radio button selectors for grid mode and blend mode options.

**UI Options**:
- Use `mat-select` for dropdown selection
- Or use `mat-button-toggle-group` for quick visual selection
- Labels should be user-friendly: "Horizontal Only", "Vertical Only", "Grid", "Dot Matrix"

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add mode handling
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add selectors

**Testing**:
- [ ] Grid mode selector shows all options
- [ ] Selection updates settings correctly
- [ ] Blend mode selector appears when grid mode is 'grid'

</details>

---

<details open>
<summary><h3>Task 11: Unit Tests for New Features</h3></summary>

**Purpose**: Add comprehensive unit tests for all new parameters and UI controls.

**Test Categories**:

**CRT Effect Wrapper Tests**:
- [ ] Scanline opacity CSS variable binds correctly
- [ ] Hue rotate CSS variable binds correctly
- [ ] Color temperature CSS variable binds correctly
- [ ] Vertical scanline CSS variables bind correctly
- [ ] Grid mode class binding works for all modes
- [ ] Grid blend mode applies correctly

**Settings Panel Tests**:
- [ ] New slider configs render correctly
- [ ] Slider changes emit correct updated settings
- [ ] Collapsible sections expand/collapse
- [ ] Grid mode selector changes mode correctly
- [ ] Config flags hide/show sections correctly

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

</details>

---

## ✅ Definition of Done

- [ ] CrtSettings interface includes all 9 new parameters
- [ ] CrtSettingsConfig has 4 new feature flag groups
- [ ] Default settings define sensible values for all new parameters
- [ ] CSS implements scanline opacity effect
- [ ] CSS implements hue rotate and color temperature filters
- [ ] CSS implements vertical scanlines
- [ ] CSS implements all 5 grid modes including dot-matrix
- [ ] Grid blend mode affects visual output
- [ ] Settings panel has collapsible sections
- [ ] All new sliders render and function correctly
- [ ] Grid mode selector works
- [ ] All config flags control visibility properly
- [ ] All unit tests pass
- [ ] Existing presets continue to work (backward compatibility)
- [ ] Visual effects match brainstorming document examples

---

## 📝 Notes

- The dot-matrix grid mode uses radial-gradient which may need size tuning for different resolutions
- Color temperature implementation using sepia/saturation is an approximation - true color matrices would require SVG filters
- Consider adding a "reset section" button within each collapsible section for convenience
