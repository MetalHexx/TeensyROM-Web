# Phase 2: Task Handoff - `lib-crt-effect-wrapper` Component

## 📋 Task Identity

**Task ID**: `TASK-02-001-CRT-WRAPPER`  
**Task Name**: Create `lib-crt-effect-wrapper` Presentation Component  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (6 new files + 1 modified)

---

## 🎯 Objective

**What**: Create a CSS-only wrapper component that applies CRT (cathode ray tube) visual effects to any projected content via CSS custom properties.

**Why**: Extract CRT effects from `VideoDialogComponent` into a reusable wrapper that can enhance any content (video, images, terminal output) with retro aesthetics. This enables future CRT effect reuse and separates visual styling from video logic.

### Success Criteria

- [ ] `CrtSettings` interface defined with all 8 effect parameters
- [ ] `DEFAULT_CRT_SETTINGS` constant with current production values
- [ ] Component accepts `settings` input and `enabled` input
- [ ] CSS custom properties bound from settings (scanlines, vignette, curvature, filters)
- [ ] Content projection via `ng-content` works correctly
- [ ] Enable/disable toggle with smooth CSS transitions
- [ ] All unit tests pass
- [ ] Component exported from `libs/ui/components` barrel
- [ ] Documentation added to `COMPONENT_LIBRARY.md`

---

## 📋 Context & Dependencies

### Prerequisites Completed

- ✅ Phase 1: `lib-video-stream` component (provides content to wrap)
- Report: [Phase 1 Report](../reports/phase-01-report.md)

### Dependencies

- Angular 19 signals API (`input()`, `signal()`)
- Angular `CommonModule` for `@if` control flow
- CSS custom properties for effect parameter binding

### Constraints

- **Pure Presentation Only**: No store dependencies, no service injections
- **CSS-Only Effects**: All effects implemented via CSS (pseudo-elements, filters, gradients)
- **Content Agnostic**: Must work with any projected content, not just video
- **Performance**: CSS transitions for enable/disable, no JS animations

---

## 📂 File Scope

### Files to Create

| File Path | Purpose |
|-----------|---------|
| `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` | Component class with settings binding and CSS property application |
| `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html` | Template with wrapper div and ng-content |
| `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss` | CRT effect styles (scanlines, vignette, curvature, filters) |
| `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts` | Unit tests for component behaviors |
| `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.ts` | `CrtSettings` interface definition |
| `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` | `DEFAULT_CRT_SETTINGS` constant |

### Files to Modify

| File Path | Change Description |
|-----------|-------------------|
| `libs/ui/components/src/index.ts` | Add exports for component, interface, and defaults |

### Files to Review (Context Only)

| File Path | Relevance |
|-----------|-----------|
| `libs/features/player/.../video-dialog/video-dialog.component.ts` | Current CRT signal parameters (lines 31-39) |
| `libs/features/player/.../video-dialog/video-dialog.component.scss` | Current CRT CSS effects (lines 165-224) |
| `libs/ui/components/src/lib/video-stream/video-stream.component.ts` | Pattern reference from Phase 1 |

---

## 🔧 Implementation Guidance

### CrtSettings Interface

Define interface with all 8 effect parameters matching current VideoDialogComponent:

| Property | Type | Description |
|----------|------|-------------|
| `scanlineIntensity` | `number` | Opacity of scanline overlay (0-1) |
| `scanlineThickness` | `number` | Pixel height of dark scanline bands |
| `scanlineSpacing` | `number` | Pixel gap between scanline bands |
| `vignetteStrength` | `number` | Intensity of edge darkening (0-2) |
| `screenCurvature` | `number` | Border-radius in pixels for curved screen |
| `contrast` | `number` | CSS filter contrast multiplier |
| `brightness` | `number` | CSS filter brightness multiplier |
| `saturation` | `number` | CSS filter saturation multiplier |

### Default Values (from current implementation)

Extract these exact values from `video-dialog.component.ts` lines 31-39:
- `scanlineIntensity`: 0.50
- `scanlineThickness`: 3
- `scanlineSpacing`: 2
- `vignetteStrength`: 1.30
- `screenCurvature`: 115
- `contrast`: 1.10
- `brightness`: 1.50
- `saturation`: 1.30

### Component Structure

**Class Name**: `CrtEffectWrapperComponent`  
**Selector**: `lib-crt-effect-wrapper`

### Inputs (Signal-Based)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `settings` | `InputSignal<CrtSettings>` | `DEFAULT_CRT_SETTINGS` | Effect parameters |
| `enabled` | `InputSignal<boolean>` | `true` | Whether effects are applied |

### Template Structure

Simple wrapper with conditional class:

```html
<div class="crt-wrapper" 
     [class.crt-enabled]="enabled()"
     [style.--scanline-intensity]="settings().scanlineIntensity"
     ... (bind all CSS custom properties)>
  <ng-content></ng-content>
</div>
```

### CSS Custom Properties to Bind

Map each setting to a CSS custom property:

| Setting | CSS Variable |
|---------|--------------|
| `scanlineIntensity` | `--scanline-intensity` |
| `scanlineThickness` | `--scanline-thickness` |
| `scanlineSpacing` | `--scanline-spacing` |
| `vignetteStrength` | `--vignette-strength` |
| `screenCurvature` | `--screen-curvature` |
| `contrast` | `--crt-contrast` |
| `brightness` | `--crt-brightness` |
| `saturation` | `--crt-saturation` |

### CSS Effect Implementation

Extract these effect patterns from `video-dialog.component.scss`:

**Scanlines** (::before pseudo-element):
- Repeating linear gradient creating horizontal dark bands
- Uses `--scanline-intensity`, `--scanline-thickness`, `--scanline-spacing`

**Vignette** (::after pseudo-element):
- Radial gradient for corner darkening
- Linear gradients for edge darkening
- Uses `--vignette-strength`

**Screen Curvature**:
- Border-radius on wrapper using `--screen-curvature`
- `overflow: hidden` to clip content

**Color Filters** (on content via `.crt-enabled` class):
- Apply `filter: contrast() brightness() saturate()` to nested content
- Use `--crt-contrast`, `--crt-brightness`, `--crt-saturation`

### Enable/Disable Behavior

When `enabled` is false:
- Remove CRT class from wrapper
- Effects should fade out via CSS transition (opacity or filter transition)
- Content should still project normally (just without effects)

---

## 🧪 Testing Requirements

### Test File Location

`libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`

### Behaviors to Test

| Behavior | Description |
|----------|-------------|
| **Component Creation** | Should create with default settings |
| **Default Settings Applied** | CSS custom properties should have default values |
| **Custom Settings Applied** | Passing custom settings should update CSS variables |
| **Content Projection** | Child content should render inside wrapper |
| **Enabled Class Applied** | `crt-enabled` class should be present when enabled |
| **Disabled Class Removed** | `crt-enabled` class should be absent when disabled |
| **CSS Variable Binding** | Each setting should map to correct CSS variable |

### Testing Patterns

Follow Phase 1 patterns:
- Use `TestBed.configureTestingModule({ imports: [Component] })`
- Use `componentRef.setInput()` for signal inputs
- Use `fixture.nativeElement.querySelector()` to verify DOM
- Check `getComputedStyle()` or element style attributes for CSS variables

### Testing CSS Variable Application

```typescript
// Verify CSS variable is set on wrapper element
const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
```

---

## 📚 Reference Materials

### Project Documentation

- [Master Plan](../master-plan.md) - Architecture decisions and composability patterns
- [Phase 2 Plan](../phases/phase-02-crt-effect-wrapper.md) - Detailed phase objectives
- [Phase 1 Report](../reports/phase-01-report.md) - Patterns established in Phase 1

### Standards Documentation

- [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) - Component patterns and naming
- [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md) - Behavioral testing approach
- [STYLE_GUIDE.md](../../../STYLE_GUIDE.md) - CSS conventions (update after completion)
- [COMPONENT_LIBRARY.md](../../../COMPONENT_LIBRARY.md) - Documentation format

### Source Material (Extract From)

- `libs/features/player/.../video-dialog/video-dialog.component.ts` lines 31-39 - CRT parameters
- `libs/features/player/.../video-dialog/video-dialog.component.scss` lines 165-224 - CRT CSS

---

## 📤 Output Specification

### Report Location

`docs/projects/video-component-extraction/reports/phase-02-report.md`

### Report Template

Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md) structure:

1. **Summary**: What was accomplished
2. **Files Created/Modified**: List with purposes
3. **Test Results**: Coverage and passing status
4. **Discoveries**: Any insights during implementation
5. **Technical Decisions**: Choices made and rationale
6. **Documentation Updates**: COMPONENT_LIBRARY.md and STYLE_GUIDE.md changes
7. **Next Phase Readiness**: Confirmation ready for Phase 3/4

---

## ✅ Completion Checklist

Before marking complete:

- [ ] `CrtSettings` interface exported from barrel
- [ ] `DEFAULT_CRT_SETTINGS` constant exported from barrel
- [ ] Component class created with all inputs
- [ ] Template correctly projects content
- [ ] All 8 CSS custom properties bound
- [ ] CRT effects render correctly (scanlines, vignette, curvature, filters)
- [ ] Enable/disable toggle works with transition
- [ ] All behavioral tests pass
- [ ] Export added to `libs/ui/components/src/index.ts`
- [ ] Entry added to `COMPONENT_LIBRARY.md`
- [ ] CSS variables documented in `STYLE_GUIDE.md`
- [ ] No lint errors (`pnpm nx lint ui-components`)
- [ ] No TypeScript errors
- [ ] Report saved to output location

---

## 💡 Implementation Notes

### Why CSS-Only

The CRT effects are purely visual and don't require JavaScript logic:
- Scanlines = CSS gradient overlay
- Vignette = CSS radial/linear gradient overlay
- Curvature = CSS border-radius
- Filters = CSS filter property

This makes the component lightweight, performant, and easily composable.

### Composition Example

After this phase, video can be enhanced with CRT effects:

```html
<lib-crt-effect-wrapper [settings]="crtSettings" [enabled]="showCrt">
  <lib-video-stream [stream]="mediaStream"></lib-video-stream>
</lib-crt-effect-wrapper>
```

### Future Use Cases

This wrapper enables CRT effects on any content:
- Screenshots/images in galleries
- Terminal/log output displays
- Retro-themed UI elements
- Preview thumbnails

---

**Handoff Complete** - Worker subagent should read this document, execute the task, and save completion report to the specified output location.
