# Phase 4: Phosphor Patterns & Noise Effects

## 🎯 Objective

Add aesthetic variations for phosphor patterns (shadow mask, aperture grille, slot mask) and environmental effects (static noise, screen reflection/glare). These effects add visual texture that differentiates between display technologies and creates authentic hardware aesthetics.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Enhancements Master Plan](../CRT-ENHANCEMENTS-MASTER-PLAN.md) - High-level project plan
- [ ] [CRT Enhancements Brainstorming](../CRT_ENHANCEMENTS_BRAINSTORMING.md) - Feature research with CSS implementation details
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Existing CRT component documentation
- [ ] Phase 2 Report - Core effects implementation
- [ ] Phase 3 Report - Realism effects implementation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Application styling standards

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.interface.ts              📝 Modified - Add pattern, noise, reflection
│   ├── crt-settings.defaults.ts               📝 Modified - Add defaults
│   ├── crt-effect-wrapper.component.ts        📝 Modified - Add CSS bindings
│   └── crt-effect-wrapper.component.scss      📝 Modified - Implement pattern/noise CSS
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts        📝 Modified - Add new controls
│   ├── crt-settings-panel.component.html      📝 Modified - Add pattern/noise sections
│   └── crt-settings-panel.component.spec.ts   📝 Modified - Test new controls
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Extend CrtSettings for Aesthetic Effects</h3></summary>

**Purpose**: Add new parameters to the CrtSettings interface for phosphor patterns, noise, and reflection.

**New Properties**:

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `phosphorPattern` | `PhosphorPattern` | enum | 'none', 'shadow-mask', 'aperture-grille', 'slot-mask' |
| `phosphorScale` | `number` | 1-3 | Size multiplier for pattern visibility |
| `noiseIntensity` | `number` | 0-0.3 | Static/snow visibility |
| `noiseAnimated` | `boolean` | - | Static vs animated noise |
| `reflectionIntensity` | `number` | 0-0.3 | Glass glare strength |
| `reflectionAngle` | `number` | 0-360 | Light source direction (degrees) |

**New Types**:
```typescript
type PhosphorPattern = 'none' | 'shadow-mask' | 'aperture-grille' | 'slot-mask';
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

**Testing**:
- [ ] TypeScript compiles with new interface
- [ ] Existing code continues to work with new optional properties

</details>

---

<details open>
<summary><h3>Task 2: Extend CrtSettingsConfig for Aesthetic Effects</h3></summary>

**Purpose**: Add feature flags to control visibility of pattern and noise controls.

**New Config Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `showPhosphorPattern` | `boolean` | Show phosphor pattern selector and scale |
| `showNoise` | `boolean` | Show noise intensity and animation toggle |
| `showReflection` | `boolean` | Show reflection intensity and angle |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

**Testing**:
- [ ] Config flags control visibility of new controls
- [ ] Default config updated appropriately

</details>

---

<details open>
<summary><h3>Task 3: Update Default Settings</h3></summary>

**Purpose**: Define sensible default values for all new aesthetic parameters.

**Default Values**:

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `phosphorPattern` | 'none' | Disabled by default (subtle effect) |
| `phosphorScale` | 1 | Base scale when enabled |
| `noiseIntensity` | 0 | Disabled by default |
| `noiseAnimated` | false | Static noise by default |
| `reflectionIntensity` | 0 | Disabled by default |
| `reflectionAngle` | 135 | Standard top-left light source |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Testing**:
- [ ] All defaults are defined
- [ ] Existing presets continue to work

</details>

---

<details open>
<summary><h3>Task 4: Implement Shadow Mask Pattern CSS</h3></summary>

**Purpose**: Create RGB dot triad pattern simulating classic shadow mask CRT phosphor arrangement.

**Implementation Approach**:
Use radial gradients to create circular RGB dot pattern:

```scss
.phosphor-overlay.shadow-mask {
  background-image: 
    radial-gradient(circle at 33% 50%, rgba(255,0,0,0.15) 30%, transparent 30%),
    radial-gradient(circle at 50% 50%, rgba(0,255,0,0.15) 30%, transparent 30%),
    radial-gradient(circle at 67% 50%, rgba(0,0,255,0.15) 30%, transparent 30%);
  background-size: calc(3px * var(--phosphor-scale)) calc(2px * var(--phosphor-scale));
}
```

**Layering Strategy**:
- Add new pseudo-element for phosphor overlay (separate from scanlines)
- Or layer phosphor pattern within existing ::before pseudo-element
- Use appropriate z-index to layer above content but below scanlines (or vice versa)

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] RGB dots visible at scale 2-3
- [ ] Pattern tiles seamlessly
- [ ] Works over video content

</details>

---

<details open>
<summary><h3>Task 5: Implement Aperture Grille Pattern CSS</h3></summary>

**Purpose**: Create vertical stripe pattern simulating Sony Trinitron-style aperture grille.

**Implementation Approach**:
Use repeating linear gradient for vertical RGB stripes:

```scss
.phosphor-overlay.aperture-grille {
  background-image: repeating-linear-gradient(
    90deg,
    rgba(255,0,0,0.1) 0px,
    rgba(255,0,0,0.1) calc(1px * var(--phosphor-scale)),
    rgba(0,255,0,0.1) calc(1px * var(--phosphor-scale)),
    rgba(0,255,0,0.1) calc(2px * var(--phosphor-scale)),
    rgba(0,0,255,0.1) calc(2px * var(--phosphor-scale)),
    rgba(0,0,255,0.1) calc(3px * var(--phosphor-scale))
  );
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] Vertical RGB stripes visible
- [ ] Pattern is continuous
- [ ] Complements vertical scanline effect

</details>

---

<details open>
<summary><h3>Task 6: Implement Slot Mask Pattern CSS</h3></summary>

**Purpose**: Create rectangular slot pattern simulating slot mask CRT phosphor arrangement.

**Implementation Approach**:
Hybrid of shadow mask and aperture grille - rectangular cells:

```scss
.phosphor-overlay.slot-mask {
  background-image: 
    linear-gradient(90deg, 
      rgba(255,0,0,0.1) 0%, rgba(255,0,0,0.1) 33%,
      rgba(0,255,0,0.1) 33%, rgba(0,255,0,0.1) 67%,
      rgba(0,0,255,0.1) 67%, rgba(0,0,255,0.1) 100%
    );
  background-size: calc(3px * var(--phosphor-scale)) calc(2px * var(--phosphor-scale));
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] Rectangular pattern visible
- [ ] Distinct from shadow mask and aperture grille

</details>

---

<details open>
<summary><h3>Task 7: Add Phosphor Pattern Class Binding</h3></summary>

**Purpose**: Bind phosphor pattern setting to appropriate CSS class on wrapper element.

**Implementation**:
- Add host binding for phosphor pattern class
- Set CSS custom property for phosphor scale
- Apply appropriate pattern class based on setting

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts`

**Testing**:
- [ ] Class changes when pattern changes
- [ ] Scale variable updates correctly

</details>

---

<details open>
<summary><h3>Task 8: Implement Static Noise Overlay CSS</h3></summary>

**Purpose**: Create static/snow noise pattern using CSS or SVG.

**Implementation Options**:

**Option A: CSS Gradient Noise (simpler, less authentic)**:
```scss
.noise-overlay {
  background-image: 
    linear-gradient(90deg, transparent 50%, rgba(255,255,255,0.03) 50%),
    linear-gradient(rgba(255,255,255,0.05) 50%, transparent 50%);
  background-size: 4px 4px;
}
```

**Option B: SVG Filter Noise (more authentic)**:
```scss
.noise-overlay {
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: var(--noise-intensity, 0);
}
```

**Option C: Pre-generated Noise Image**:
Generate noise texture and embed as data URI.

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] Noise visible at intensity > 0
- [ ] Noise covers entire display area
- [ ] Static version shows fixed pattern

</details>

---

<details open>
<summary><h3>Task 9: Implement Animated Noise CSS</h3></summary>

**Purpose**: Add animation to noise overlay for RF/static effect.

**Implementation Approach**:
```scss
@keyframes noise-shift {
  0% { background-position: 0 0; }
  10% { background-position: -5% 5%; }
  20% { background-position: 10% -10%; }
  30% { background-position: -10% 5%; }
  40% { background-position: 5% -5%; }
  50% { background-position: -5% 10%; }
  60% { background-position: 10% 0; }
  70% { background-position: 0 -10%; }
  80% { background-position: -10% 10%; }
  90% { background-position: 5% 5%; }
  100% { background-position: 0 0; }
}

.noise-overlay.animated {
  animation: noise-shift 100ms infinite steps(10);
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] Animated noise shows shifting pattern
- [ ] Animation is not distracting at low intensity
- [ ] Can toggle between static and animated

</details>

---

<details open>
<summary><h3>Task 10: Implement Screen Reflection CSS</h3></summary>

**Purpose**: Create glass reflection/glare effect simulating ambient light on CRT screen.

**Implementation Approach**:
```scss
.reflection-overlay {
  background: linear-gradient(
    calc(var(--reflection-angle, 135) * 1deg),
    transparent 40%,
    rgba(255, 255, 255, var(--reflection-intensity, 0)) 50%,
    transparent 60%
  );
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`

**Testing**:
- [ ] Reflection visible at intensity > 0
- [ ] Angle changes position of highlight
- [ ] Effect is subtle and realistic

</details>

---

<details open>
<summary><h3>Task 11: Add Pattern and Noise Bindings</h3></summary>

**Purpose**: Bind all new aesthetic settings to CSS custom properties and classes.

**Bindings to Add**:
- `--phosphor-scale` CSS variable
- `--noise-intensity` CSS variable
- `--reflection-intensity` CSS variable
- `--reflection-angle` CSS variable
- Phosphor pattern class (e.g., `phosphor-shadow-mask`)
- Noise animated class (e.g., `noise-animated`)

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts`

**Testing**:
- [ ] All CSS variables bind correctly
- [ ] Classes apply based on settings

</details>

---

<details open>
<summary><h3>Task 12: Update Settings Panel UI</h3></summary>

**Purpose**: Add new controls for aesthetic effects in the settings panel.

**New Sections**:

1. **Phosphor Pattern**
   - Pattern selector (dropdown or visual picker)
   - Scale slider (1-3)

2. **Noise**
   - Intensity slider (0-0.3)
   - Animated toggle

3. **Screen Reflection**
   - Intensity slider (0-0.3)
   - Angle slider (0-360°)

**Slider Configurations**:

| Slider | Min | Max | Step | Format |
|--------|-----|-----|------|--------|
| Phosphor Scale | 1 | 3 | 0.5 | 1 decimal |
| Noise Intensity | 0 | 0.3 | 0.01 | 2 decimals |
| Reflection Intensity | 0 | 0.3 | 0.01 | 2 decimals |
| Reflection Angle | 0 | 360 | 15 | ° suffix |

**Pattern Selector Options**:
- "None" - No phosphor pattern
- "Shadow Mask" - Dot triads (consumer TVs)
- "Aperture Grille" - Vertical stripes (Trinitron)
- "Slot Mask" - Rectangular slots (hybrid)

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss`

**Testing**:
- [ ] Pattern selector shows all options
- [ ] All new sliders render correctly
- [ ] Animated toggle works
- [ ] Config flags hide/show sections

</details>

---

<details open>
<summary><h3>Task 13: Unit Tests for Aesthetic Effects</h3></summary>

**Purpose**: Add comprehensive unit tests for all new aesthetic parameters.

**Test Categories**:

**CRT Effect Wrapper Tests**:
- [ ] Phosphor pattern class binding works for all patterns
- [ ] Phosphor scale CSS variable binds correctly
- [ ] Noise intensity CSS variable binds correctly
- [ ] Noise animated class toggles correctly
- [ ] Reflection intensity CSS variable binds correctly
- [ ] Reflection angle CSS variable binds correctly

**Settings Panel Tests**:
- [ ] Pattern selector renders all options
- [ ] Pattern selection emits correct updated settings
- [ ] Noise toggle updates settings correctly
- [ ] All new sliders function correctly
- [ ] Config flags hide/show sections correctly

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

</details>

---

## ✅ Definition of Done

- [ ] CrtSettings interface includes all 6 new aesthetic parameters
- [ ] CrtSettingsConfig has 3 new feature flag groups
- [ ] Default settings define sensible values for all new parameters
- [ ] CSS implements shadow mask phosphor pattern
- [ ] CSS implements aperture grille phosphor pattern
- [ ] CSS implements slot mask phosphor pattern
- [ ] CSS implements static noise overlay
- [ ] CSS implements animated noise overlay
- [ ] CSS implements screen reflection effect
- [ ] Settings panel has phosphor pattern selector
- [ ] Settings panel has noise controls with animated toggle
- [ ] Settings panel has reflection controls
- [ ] All config flags control visibility properly
- [ ] All unit tests pass
- [ ] Patterns work correctly over video content
- [ ] Effects combine well with Phase 2 and Phase 3 effects

---

## 📝 Notes

- Phosphor patterns at small scales may not be visible on high-DPI displays - consider auto-scaling
- SVG filter noise may perform differently across browsers - test on major browsers
- Reflection effect should be subtle to avoid looking artificial
- Consider providing visual previews in pattern selector to help users understand options
