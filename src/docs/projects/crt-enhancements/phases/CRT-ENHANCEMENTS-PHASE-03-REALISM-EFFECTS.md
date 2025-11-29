# Phase 3: Enhanced Realism Effects

## 🎯 Objective

Add visual effects that increase CRT authenticity: bloom/glow around bright areas, chromatic aberration (RGB fringing), phosphor persistence (motion blur/ghosting), interlace flicker, and barrel distortion. These effects differentiate between casual retro aesthetics and authentic hardware emulation.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT Enhancements Master Plan](../CRT-ENHANCEMENTS-MASTER-PLAN.md) - High-level project plan
- [ ] [CRT Enhancements Brainstorming](../CRT_ENHANCEMENTS_BRAINSTORMING.md) - Feature research with CSS implementation details
- [ ] [Component Library CRT](../../../COMPONENT_LIBRARY_CRT.md) - Existing CRT component documentation
- [ ] Phase 2 Report - Core effects implementation details

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - Application styling standards

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/
├── crt-effect-wrapper/
│   ├── crt-settings.interface.ts              📝 Modified - Add bloom, aberration, etc.
│   ├── crt-settings.defaults.ts               📝 Modified - Add defaults
│   ├── crt-effect-wrapper.component.ts        📝 Modified - Add CSS bindings, animations
│   └── crt-effect-wrapper.component.scss      📝 Modified - Implement new CSS effects
├── crt-settings-panel/
│   ├── crt-settings-panel.component.ts        📝 Modified - Add new slider configs
│   ├── crt-settings-panel.component.html      📝 Modified - Add effects sections
│   └── crt-settings-panel.component.spec.ts   📝 Modified - Test new controls
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Extend CrtSettings for Realism Effects</h3></summary>

**Purpose**: Add new parameters to the CrtSettings interface for bloom, chromatic aberration, phosphor persistence, interlace, and barrel distortion.

**New Properties**:

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `bloomIntensity` | `number` | 0-1 | Strength of glow around bright areas |
| `bloomRadius` | `number` | 1-10 | Blur radius for bloom effect (px) |
| `chromaticAberration` | `number` | 0-3 | RGB channel offset distance (px) |
| `phosphorPersistence` | `number` | 0-1 | Ghosting/blur for motion simulation |
| `interlaceMode` | `InterlaceMode` | enum | 'none', 'subtle', 'authentic' |
| `flickerIntensity` | `number` | 0-0.1 | Brightness variation amount |
| `barrelDistortion` | `number` | 0-1 | Geometric warping amount |

**New Types**:
```typescript
type InterlaceMode = 'none' | 'subtle' | 'authentic';
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

**Testing**:
- [ ] TypeScript compiles with new interface
- [ ] Existing code continues to work with new optional properties

</details>

---

<details open>
<summary><h3>Task 2: Extend CrtSettingsConfig for Realism Effects</h3></summary>

**Purpose**: Add feature flags to control visibility of new effect groups.

**New Config Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `showBloom` | `boolean` | Show bloom intensity/radius controls |
| `showChromaticAberration` | `boolean` | Show aberration control |
| `showPhosphor` | `boolean` | Show phosphor persistence control |
| `showInterlace` | `boolean` | Show interlace mode and flicker controls |
| `showBarrelDistortion` | `boolean` | Show distortion control |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts`

**Testing**:
- [ ] Config flags control visibility of new controls
- [ ] Default config updated appropriately

</details>

---

<details open>
<summary><h3>Task 3: Update Default Settings</h3></summary>

**Purpose**: Define sensible default values for all new realism parameters.

**Default Values**:

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `bloomIntensity` | 0 | Disabled by default (subtle effect) |
| `bloomRadius` | 3 | Moderate blur when enabled |
| `chromaticAberration` | 0 | Disabled by default |
| `phosphorPersistence` | 0 | Disabled by default |
| `interlaceMode` | 'none' | Disabled by default (accessibility) |
| `flickerIntensity` | 0 | Disabled by default |
| `barrelDistortion` | 0 | Disabled by default |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Testing**:
- [ ] All defaults are defined
- [ ] Existing presets continue to work

</details>

---

<details open>
<summary><h3>Task 4: Implement Bloom Effect CSS</h3></summary>

**Purpose**: Create a glow effect around bright areas using a dual-layer approach with blur and screen blend mode.

**Implementation Approach**:
1. Create pseudo-element that duplicates content appearance
2. Apply blur and brightness boost to pseudo-element
3. Use `mix-blend-mode: screen` to combine with original
4. Control opacity with `--bloom-intensity`

**CSS Pattern**:
```scss
.crt-wrapper.bloom-enabled::after {
  content: '';
  position: absolute;
  inset: 0;
  background: inherit;
  filter: blur(var(--bloom-radius, 3px)) brightness(1.3);
  mix-blend-mode: screen;
  opacity: var(--bloom-intensity, 0);
  pointer-events: none;
}
```

**Note**: The `background: inherit` approach may not work for video content. Alternative approach: apply blur directly to content layer as subtle effect.

**Alternative Approach for Video**:
```scss
.crt-content.bloom-enabled {
  filter: ... blur(calc(var(--bloom-intensity) * var(--bloom-radius) * 0.1px));
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add bindings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Implement bloom

**Testing**:
- [ ] Bloom effect visible when intensity > 0
- [ ] Radius controls blur amount
- [ ] Effect works on video content
- [ ] Performance acceptable with bloom enabled

</details>

---

<details open>
<summary><h3>Task 5: Implement Chromatic Aberration CSS</h3></summary>

**Purpose**: Create RGB color fringing effect simulating CRT phosphor misalignment.

**Implementation Approach**:
Use CSS `filter: drop-shadow()` to create offset color channels:

```scss
.crt-content.aberration-enabled {
  filter: 
    drop-shadow(calc(var(--chromatic-offset) * -1px) 0 0 rgba(255, 0, 0, 0.3))
    drop-shadow(calc(var(--chromatic-offset) * 1px) 0 0 rgba(0, 0, 255, 0.3))
    ...existing filters;
}
```

**Alternative with Text Shadow** (better for some content):
```scss
.crt-content.aberration-enabled {
  text-shadow: 
    calc(var(--chromatic-offset) * -1px) 0 0 rgba(255, 0, 0, 0.5),
    calc(var(--chromatic-offset) * 1px) 0 0 rgba(0, 0, 255, 0.5);
}
```

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add bindings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Implement aberration

**Testing**:
- [ ] RGB fringing visible at edges
- [ ] Offset amount controls fringe distance
- [ ] Effect works on video content

</details>

---

<details open>
<summary><h3>Task 6: Implement Phosphor Persistence CSS</h3></summary>

**Purpose**: Create subtle blur effect simulating phosphor decay and motion ghosting.

**Implementation Approach**:
Add slight blur to content layer, controlled by persistence parameter:

```scss
.crt-content.phosphor-enabled {
  filter: ... blur(calc(var(--phosphor-persistence) * 0.5px));
}
```

**Note**: True phosphor persistence (trailing ghost of previous frames) would require JavaScript frame buffering. This CSS approach simulates the visual softness without actual temporal effects.

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add bindings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Implement persistence

**Testing**:
- [ ] Subtle blur visible at higher values
- [ ] Video remains watchable at moderate settings
- [ ] Effect combines well with other filters

</details>

---

<details open>
<summary><h3>Task 7: Implement Interlace Flicker CSS</h3></summary>

**Purpose**: Create interlace simulation with optional brightness flicker using CSS animations.

**Implementation Approach**:

```scss
@keyframes interlace-flicker {
  0%, 100% { 
    --scanline-offset: 0px;
    opacity: 1;
  }
  50% { 
    --scanline-offset: var(--scanline-spacing);
    opacity: calc(1 - var(--flicker-intensity, 0));
  }
}

.crt-wrapper.interlace-subtle::before {
  animation: interlace-flicker 66ms infinite; // ~15Hz visible flicker
}

.crt-wrapper.interlace-authentic::before {
  animation: interlace-flicker 33ms infinite; // ~30Hz authentic flicker
}
```

**Accessibility Considerations**:
- Check `prefers-reduced-motion` media query
- Disable flicker animation when reduced motion preferred
- Consider adding warning when enabling flicker

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add mode class binding
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Add animation

**Testing**:
- [ ] Subtle mode has slower, less intense flicker
- [ ] Authentic mode has faster flicker
- [ ] Animation disabled when `prefers-reduced-motion` is set
- [ ] Flicker intensity controls brightness variation

</details>

---

<details open>
<summary><h3>Task 8: Implement Barrel Distortion CSS</h3></summary>

**Purpose**: Create geometric warping effect simulating curved CRT glass using CSS transforms.

**Implementation Approach** (approximation using perspective):

```scss
.crt-wrapper.barrel-enabled {
  perspective: calc(1000px / (1 + var(--barrel-distortion, 0)));
  
  .crt-content {
    transform: perspective(calc(1000px / (1 + var(--barrel-distortion))))
               scale(calc(1 + var(--barrel-distortion) * 0.02));
  }
}
```

**Note**: True barrel distortion requires SVG displacement mapping or WebGL. This CSS approach creates a subtle approximation using perspective transforms.

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Add bindings
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` - Implement distortion

**Testing**:
- [ ] Visual warping noticeable at higher values
- [ ] Combines well with screen curvature
- [ ] Video content remains viewable

</details>

---

<details open>
<summary><h3>Task 9: Add Accessibility Warning for Flicker</h3></summary>

**Purpose**: Display warning when user enables interlace/flicker effects, respecting accessibility preferences.

**Implementation**:
- Check `prefers-reduced-motion` via `matchMedia`
- Show warning snackbar/tooltip when enabling interlace modes
- Potentially disable interlace option entirely if motion preference set

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add motion check

**Testing**:
- [ ] Warning appears when enabling interlace
- [ ] Warning explains potential issues
- [ ] Option disabled or warning emphasized when reduced motion preferred

</details>

---

<details open>
<summary><h3>Task 10: Update Settings Panel UI</h3></summary>

**Purpose**: Add new controls for realism effects in the settings panel.

**New Sections**:

1. **Bloom Effects**
   - Intensity slider (0-1)
   - Radius slider (1-10px)

2. **Color Effects** (add to existing or new section)
   - Chromatic Aberration slider (0-3px)

3. **Phosphor Effects**
   - Persistence slider (0-1)

4. **Interlace Effects**
   - Mode selector (none/subtle/authentic)
   - Flicker intensity slider (0-0.1)
   - Accessibility warning indicator

5. **Geometry**
   - Barrel Distortion slider (0-1)
   - (Existing: Screen Curvature)

**Slider Configurations**:

| Slider | Min | Max | Step | Format |
|--------|-----|-----|------|--------|
| Bloom Intensity | 0 | 1 | 0.05 | 2 decimals |
| Bloom Radius | 1 | 10 | 1 | px suffix |
| Chromatic Aberration | 0 | 3 | 0.1 | 1 decimal, px suffix |
| Phosphor Persistence | 0 | 1 | 0.05 | 2 decimals |
| Flicker Intensity | 0 | 0.1 | 0.01 | 2 decimals |
| Barrel Distortion | 0 | 1 | 0.05 | 2 decimals |

**Files to Modify**:
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.ts` - Add slider configs
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.html` - Add sections
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.scss` - Style warning

**Testing**:
- [ ] All new sliders render correctly
- [ ] Interlace mode selector works
- [ ] Warning appears for flicker effects
- [ ] Config flags hide/show sections

</details>

---

<details open>
<summary><h3>Task 11: Unit Tests for Realism Effects</h3></summary>

**Purpose**: Add comprehensive unit tests for all new realism parameters.

**Test Categories**:

**CRT Effect Wrapper Tests**:
- [ ] Bloom CSS variables bind correctly
- [ ] Chromatic aberration CSS variable binds correctly
- [ ] Phosphor persistence CSS variable binds correctly
- [ ] Interlace mode class binding works for all modes
- [ ] Flicker intensity CSS variable binds correctly
- [ ] Barrel distortion CSS variable binds correctly
- [ ] Reduced motion check disables flicker animation

**Settings Panel Tests**:
- [ ] New sliders render correctly
- [ ] Interlace mode selector changes mode correctly
- [ ] Accessibility warning displays appropriately
- [ ] Config flags hide/show sections correctly

**Files to Modify**:
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`
- `libs/ui/components/src/lib/crt-settings-panel/crt-settings-panel.component.spec.ts`

</details>

---

## ✅ Definition of Done

- [ ] CrtSettings interface includes all 7 new realism parameters
- [ ] CrtSettingsConfig has 5 new feature flag groups
- [ ] Default settings define sensible values for all new parameters
- [ ] CSS implements bloom effect
- [ ] CSS implements chromatic aberration
- [ ] CSS implements phosphor persistence (blur approximation)
- [ ] CSS implements interlace flicker with three modes
- [ ] CSS implements barrel distortion approximation
- [ ] Flicker respects `prefers-reduced-motion`
- [ ] Settings panel has new sections for all effects
- [ ] Interlace mode selector works
- [ ] Accessibility warning for flicker effects
- [ ] All unit tests pass
- [ ] Visual effects work on video content
- [ ] Effects combine well together without performance issues

---

## 📝 Notes

- Bloom effect on video may need alternative implementation since `background: inherit` doesn't capture video frames
- True barrel distortion would require SVG/WebGL - CSS approximation may be sufficient for aesthetic purposes
- Phosphor persistence is a visual approximation; true temporal effects would require frame buffering
- Consider adding "performance mode" preset that disables expensive effects for lower-end devices
