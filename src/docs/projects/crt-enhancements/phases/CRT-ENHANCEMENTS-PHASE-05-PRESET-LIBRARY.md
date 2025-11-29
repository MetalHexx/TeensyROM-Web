# Phase 5: Comprehensive Preset Library

## 🎯 Objective

Create 30+ curated presets organized into meaningful categories that leverage all the new effects added in previous phases. Presets should accurately emulate specific hardware and provide starting points for customization. Update the preset dropdown to display categories with section headers.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Enhancements Master Plan](../CRT-ENHANCEMENTS-MASTER-PLAN.md) - High-level project plan
- [ ] [CRT Enhancements Brainstorming](../CRT_ENHANCEMENTS_BRAINSTORMING.md) - Preset definitions and research
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Existing CRT component documentation
- [ ] Phase 2 Report - Core effects implementation
- [ ] Phase 3 Report - Realism effects implementation
- [ ] Phase 4 Report - Patterns and noise implementation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.defaults.ts               📝 Modified - Add all new presets
│   └── crt-presets.ts                         ✨ New - Separate preset definitions file
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts        📝 Modified - Add categorized dropdown
│   ├── crt-settings-panel.component.html      📝 Modified - Update dropdown with sections
│   └── crt-settings-panel.component.scss      📝 Modified - Style category headers
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Preset Definitions File</h3></summary>

**Purpose**: Create a separate file for preset definitions to keep the codebase organized and maintainable.

**File Structure**:
- Define preset categories as constants
- Define all presets with full parameter sets
- Export preset labels and descriptions
- Export category organization

**Categories**:
1. Consumer Electronics
2. Arcade Monitors
3. Professional Monitors
4. Computer Monitors
5. Connection Quality
6. Modern Scalers
7. Artistic/Stylized
8. Vector/Specialty

**Files to Create**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] All presets export correctly
- [ ] TypeScript validates all preset values

</details>

---

<details open>
<summary><h3>Task 2: Define Consumer Electronics Presets</h3></summary>

**Purpose**: Create presets for classic consumer CRT monitors and TVs.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `commodore-1702` | Commodore 1702 monitor | Warm, curved, shadow mask, visible scanlines |
| `sony-trinitron` | Sony Trinitron TV | Sharp, aperture grille vertical stripes |
| `jvc-d-series` | JVC D-Series (retro gaming favorite) | Warm colors, moderate scanlines |
| `rca-colortrak` | Generic 80s/90s TV | Heavy scanlines, RF-quality |
| `zenith-system-3` | Zenith consumer TV | Slightly warm, moderate curvature |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] All consumer presets defined with valid values
- [ ] Presets produce visually distinct results

</details>

---

<details open>
<summary><h3>Task 3: Define Arcade Monitor Presets</h3></summary>

**Purpose**: Create presets for classic arcade cabinet CRT monitors.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `arcade-cabinet` | Generic arcade CRT | Bright, saturated, heavy scanlines |
| `wells-gardner` | Wells Gardner K7000 | Common arcade monitor, grid pattern |
| `electrohome-g07` | Electrohome G07 | Vector/raster compatible |
| `sanyo-20ez` | Sanyo 20EZ | Budget arcade monitor |
| `hantarex-polo` | Hantarex Polo | European arcade standard |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] All arcade presets defined
- [ ] Presets have appropriately bright/saturated settings

</details>

---

<details open>
<summary><h3>Task 4: Define Professional Monitor Presets</h3></summary>

**Purpose**: Create presets for broadcast and professional video monitors.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `pvm-professional` | Sony PVM | Broadcast quality, aperture grille, minimal effects |
| `bvm-broadcast` | Sony BVM | Reference monitor, very accurate colors |
| `ikegami-htm` | Ikegami HTM | Broadcast monitor, neutral colors |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] Professional presets have minimal distortion
- [ ] Colors are more neutral/accurate

</details>

---

<details open>
<summary><h3>Task 5: Define Computer Monitor Presets</h3></summary>

**Purpose**: Create presets for computer terminals and monochrome monitors.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `amber-monochrome` | Amber phosphor (IBM PC era) | Orange/amber tint, monochrome |
| `green-phosphor` | Green terminal (VT100 style) | Green tint, long persistence |
| `white-phosphor` | White/paper white terminal | Neutral white, subtle scanlines |
| `apple-monitor-iii` | Apple Monitor III (green) | Apple II era green |
| `ibm-5151` | IBM 5151 Monochrome | Green, sharp text |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] Monochrome presets have saturation = 0
- [ ] Color tints match historical displays

</details>

---

<details open>
<summary><h3>Task 6: Define Connection Quality Presets</h3></summary>

**Purpose**: Create presets simulating different video connection qualities.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `rf-fuzzy` | Bad RF connection | Noise, chromatic aberration |
| `composite-bleed` | Composite video with bleeding | Color bleeding, soft |
| `s-video-clean` | Clean S-Video | Moderate scanlines, clean colors |
| `scart-rgb` | SCART RGB connection | Sharp, minimal artifacts |
| `component-hd` | Component HD | Clean, minimal CRT effects |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] RF preset has visible noise
- [ ] Quality progression from RF to RGB is clear

</details>

---

<details open>
<summary><h3>Task 7: Define Modern Scaler Presets</h3></summary>

**Purpose**: Create presets simulating LCD with retro filters (RetroTink style).

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `lcd-scanlines` | LCD with scanline filter | Flat, subtle scanlines |
| `lcd-grid` | LCD with pixel grid (GBA style) | Visible grid, flat |
| `dot-matrix-lcd` | Dot matrix (Game Boy style) | Green tint, dot pattern |
| `oled-scanlines` | OLED with scanlines | High contrast, deep blacks |
| `retrotink-clean` | RetroTink clean mode | Minimal processing |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] LCD presets have no curvature
- [ ] Dot matrix has appropriate green tint

</details>

---

<details open>
<summary><h3>Task 8: Define Artistic Presets</h3></summary>

**Purpose**: Create stylized non-realistic presets for creative use.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `vaporwave` | Vaporwave aesthetic | High saturation, magenta shift, bloom |
| `cyberpunk` | Neon cyberpunk | Dramatic hue shift, chromatic aberration |
| `horror-vhs` | Distorted VHS horror | Heavy noise, tracking lines |
| `synthwave` | 80s synthwave | Warm colors, bloom, slight aberration |
| `noir` | Black and white noir | Desaturated, high contrast |
| `sepia-vintage` | Sepia vintage film | Warm sepia tone |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] Artistic presets produce dramatic, stylized results
- [ ] Each has distinct visual identity

</details>

---

<details open>
<summary><h3>Task 9: Define Vector/Specialty Presets</h3></summary>

**Purpose**: Create presets for unique display technologies.

**Presets**:

| Preset Name | Description | Key Characteristics |
|-------------|-------------|---------------------|
| `vectrex` | Vectrex vector display | No scanlines, long persistence, glow |
| `oscilloscope` | Oscilloscope display | Green, no scanlines, high glow |
| `led-matrix` | LED matrix (scoreboard) | Dot matrix, bright |
| `plasma-display` | Plasma display | Deep blacks, slight glow |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] Vector presets have no scanlines
- [ ] LED matrix has appropriate dot pattern

</details>

---

<details open>
<summary><h3>Task 10: Create Preset Labels and Descriptions</h3></summary>

**Purpose**: Define user-friendly labels and descriptions for all presets.

**Label Format**:
- Short display name (e.g., "Commodore 1702")
- Category prefix optional in dropdown (category headers separate)

**Description Format**:
- One sentence describing the display type
- Key characteristics highlighted

**Example**:
```typescript
export const CRT_PRESET_METADATA = {
  'commodore-1702': {
    label: 'Commodore 1702',
    description: 'Classic Commodore monitor with warm colors and visible scanlines',
    category: 'consumer',
  },
  // ...
};
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.ts`

**Testing**:
- [ ] All presets have labels
- [ ] All presets have descriptions

</details>

---

<details open>
<summary><h3>Task 11: Update Preset Dropdown with Categories</h3></summary>

**Purpose**: Modify the preset dropdown to display presets organized by category with section headers.

**UI Design Options**:

**Option A: Section Headers in Single List**:
```html
<div class="category-header">Consumer Electronics</div>
<lib-dropdown-menu-item>Commodore 1702</lib-dropdown-menu-item>
<lib-dropdown-menu-item>Sony Trinitron</lib-dropdown-menu-item>
<div class="category-header">Arcade Monitors</div>
<lib-dropdown-menu-item>Arcade Cabinet</lib-dropdown-menu-item>
<!-- ... -->
```

**Option B: Accordion/Collapsible Categories**:
Each category expands to show its presets.

**Option C: Nested Submenus**:
Each category is a submenu item.

**Recommendation**: Option A (section headers) is simplest and most scannable.

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss`

**Testing**:
- [ ] Categories display with headers
- [ ] All presets appear under correct category
- [ ] Preset selection still works correctly
- [ ] Dropdown scrolls if content exceeds viewport

</details>

---

<details open>
<summary><h3>Task 12: Add Preset Tooltips</h3></summary>

**Purpose**: Show preset descriptions as tooltips when hovering over preset items.

**Implementation**:
- Use `matTooltip` directive on dropdown items
- Show preset description from metadata
- Tooltip should appear quickly for discoverability

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`

**Testing**:
- [ ] Tooltips appear on hover
- [ ] Descriptions are helpful and accurate

</details>

---

<details open>
<summary><h3>Task 13: Unit Tests for Preset Library</h3></summary>

**Purpose**: Add comprehensive tests for preset definitions and dropdown.

**Test Categories**:

**Preset Validation Tests**:
- [ ] All presets have valid values within parameter ranges
- [ ] All required parameters are defined for each preset
- [ ] No duplicate preset keys
- [ ] All presets have metadata (label, description, category)
- [ ] All presets assigned to valid categories

**Dropdown Tests**:
- [ ] Category headers render correctly
- [ ] Presets appear under correct categories
- [ ] Preset selection emits correct preset name
- [ ] Tooltips display correct descriptions

**Files to Create/Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-presets.spec.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

</details>

---

## 📊 Complete Preset List

| # | Category | Preset Key | Display Name |
|---|----------|------------|--------------|
| 1 | Consumer | `commodore-1702` | Commodore 1702 |
| 2 | Consumer | `sony-trinitron` | Sony Trinitron |
| 3 | Consumer | `jvc-d-series` | JVC D-Series |
| 4 | Consumer | `rca-colortrak` | RCA ColorTrak |
| 5 | Consumer | `zenith-system-3` | Zenith System 3 |
| 6 | Arcade | `arcade-cabinet` | Arcade Cabinet |
| 7 | Arcade | `wells-gardner` | Wells Gardner K7000 |
| 8 | Arcade | `electrohome-g07` | Electrohome G07 |
| 9 | Arcade | `sanyo-20ez` | Sanyo 20EZ |
| 10 | Arcade | `hantarex-polo` | Hantarex Polo |
| 11 | Professional | `pvm-professional` | Sony PVM |
| 12 | Professional | `bvm-broadcast` | Sony BVM |
| 13 | Professional | `ikegami-htm` | Ikegami HTM |
| 14 | Computer | `amber-monochrome` | Amber Monochrome |
| 15 | Computer | `green-phosphor` | Green Phosphor |
| 16 | Computer | `white-phosphor` | White Phosphor |
| 17 | Computer | `apple-monitor-iii` | Apple Monitor III |
| 18 | Computer | `ibm-5151` | IBM 5151 |
| 19 | Connection | `rf-fuzzy` | RF Fuzzy |
| 20 | Connection | `composite-bleed` | Composite Bleed |
| 21 | Connection | `s-video-clean` | S-Video Clean |
| 22 | Connection | `scart-rgb` | SCART RGB |
| 23 | Connection | `component-hd` | Component HD |
| 24 | Scaler | `lcd-scanlines` | LCD Scanlines |
| 25 | Scaler | `lcd-grid` | LCD Grid |
| 26 | Scaler | `dot-matrix-lcd` | Dot Matrix LCD |
| 27 | Scaler | `oled-scanlines` | OLED Scanlines |
| 28 | Scaler | `retrotink-clean` | RetroTink Clean |
| 29 | Artistic | `vaporwave` | Vaporwave |
| 30 | Artistic | `cyberpunk` | Cyberpunk |
| 31 | Artistic | `horror-vhs` | Horror VHS |
| 32 | Artistic | `synthwave` | Synthwave |
| 33 | Artistic | `noir` | Noir |
| 34 | Artistic | `sepia-vintage` | Sepia Vintage |
| 35 | Specialty | `vectrex` | Vectrex |
| 36 | Specialty | `oscilloscope` | Oscilloscope |
| 37 | Specialty | `led-matrix` | LED Matrix |
| 38 | Specialty | `plasma-display` | Plasma Display |

---

## ✅ Definition of Done

- [ ] 35+ presets defined across 8 categories
- [ ] All presets have complete parameter sets using new effects
- [ ] All presets have labels and descriptions
- [ ] Preset dropdown displays categories with section headers
- [ ] Tooltips show preset descriptions
- [ ] Dropdown scrolls appropriately for long list
- [ ] Preset selection works correctly
- [ ] All presets produce visually distinct results
- [ ] All unit tests pass
- [ ] Documentation updated with preset reference

---

## 📝 Notes

- Consider adding a "preview" thumbnail for each preset in future iteration
- User custom preset saving is out of scope for this phase
- Some presets may need tuning after visual testing on actual video content
- Consider "Featured" or "Most Popular" quick access section if 38 presets feels overwhelming
