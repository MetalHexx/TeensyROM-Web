# Phase 1: CSS Anti-Aliasing Improvements

## 🎯 Objective

Reduce scanline banding artifacts at non-100% browser zoom levels using CSS-only techniques. This phase delivers immediate improvement to the CRT effect quality without adding WebGL complexity.

**Expected Outcome**: ~60-70% reduction in visible Moiré pattern banding.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md) - Project overview
- [ ] [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md) - CRT component documentation

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Style Guide](../../../STYLE_GUIDE.md) - CSS/SCSS conventions

---

## 📂 File Structure Overview

```
libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-effect-wrapper.component.scss    📝 Modified - Add anti-aliasing CSS
└── crt-effect-wrapper.component.spec.ts 📝 Modified - Add CSS property tests
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Add GPU Compositing Hints</h3></summary>

**Purpose**: Hint the browser to use GPU-accelerated compositing for the scanline overlay, which can reduce aliasing artifacts.

**Related Documentation:**

- [CSS will-change MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)

**Implementation Subtasks:**

- [ ] Add `will-change: transform, opacity` to scanline `::before` pseudo-element
- [ ] Add `transform: translateZ(0)` to force GPU layer creation
- [ ] Add `backface-visibility: hidden` for additional GPU hint

**Testing Subtask:**

- [ ] Verify CSS properties applied correctly via component test

**Key Implementation Notes:**

- Apply only to `&.crt-enabled::before` (the scanline overlay)
- These hints tell browser to optimize this layer for animation/compositing

</details>

---

<details open>
<summary><h3>Task 2: Add Scanline Edge Anti-Aliasing</h3></summary>

**Purpose**: Soften the hard edges of the repeating gradient to reduce aliasing when gradient lines don't align with screen pixels.

**Implementation Subtasks:**

- [ ] Add subtle `filter: blur(0.3px)` to scanline `::before` overlay
- [ ] Test blur values: 0.2px, 0.3px, 0.5px - document which works best
- [ ] Ensure blur doesn't make scanlines too soft/washed out

**Testing Subtask:**

- [ ] Verify filter property applied correctly

**Key Implementation Notes:**

- Start with 0.3px blur - adjust based on visual testing
- The blur softens gradient transitions, reducing Moiré interference
- Too much blur will make scanlines look fuzzy rather than crisp

</details>

---

<details open>
<summary><h3>Task 3: Optimize Image Rendering</h3></summary>

**Purpose**: Set explicit image rendering mode to allow browser to use its best algorithm for the gradient pattern.

**Implementation Subtasks:**

- [ ] Add `image-rendering: auto` to scanline overlay (allows browser optimization)
- [ ] Consider `image-rendering: smooth` as alternative if `auto` doesn't help

**Testing Subtask:**

- [ ] Verify image-rendering property applied correctly

**Key Implementation Notes:**

- `auto` is the default but being explicit can help some browsers
- `smooth` uses bilinear/bicubic filtering which may help with gradients
- Avoid `crisp-edges` or `pixelated` - these make aliasing worse

</details>

---

<details open>
<summary><h3>Task 4: Add Subpixel Rendering Optimization</h3></summary>

**Purpose**: Improve text and edge rendering within the CRT effect area.

**Implementation Subtasks:**

- [ ] Add `-webkit-font-smoothing: antialiased` to `.crt-content`
- [ ] Add `-moz-osx-font-smoothing: grayscale` to `.crt-content`
- [ ] Add `text-rendering: optimizeLegibility` for any text content

**Testing Subtask:**

- [ ] Verify font smoothing properties applied

**Key Implementation Notes:**

- These primarily help text, but can improve overall rendering quality
- Only apply to `.crt-content`, not the overlays

</details>

---

<details open>
<summary><h3>Task 5: Manual Verification</h3></summary>

**Purpose**: Visually verify the improvements at multiple zoom levels.

**Verification Subtasks:**

- [ ] Test at 100% zoom - verify no visual regression
- [ ] Test at 110% zoom - compare before/after banding
- [ ] Test at 125% zoom - compare before/after banding
- [ ] Test at 150% zoom - compare before/after banding
- [ ] Test on Chrome, Firefox, Edge
- [ ] Document results in task report

**Key Notes:**

- Take screenshots before making changes for comparison
- Focus on areas where banding was most visible
- Note any side effects (blurriness, performance impact)

</details>

---

## 🗂️ Files Modified or Created

**Modified Files:**

- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`

---

<details open>
<summary><h2>📝 Testing Summary</h2></summary>

### Unit Tests

**Behaviors to Test:**

- [ ] GPU compositing hints (`will-change`, `transform`) applied to scanline overlay
- [ ] Anti-aliasing blur filter applied correctly
- [ ] Image rendering mode set explicitly
- [ ] Font smoothing applied to content container

### Manual Testing

- [ ] Verify banding reduction at 110%, 125%, 150% zoom
- [ ] Verify no visual regression at 100% zoom
- [ ] Test across Chrome, Firefox, Safari, Edge

### Test Execution Commands

```bash
# Run component tests
pnpm nx test ui-components --testFile=crt-effect-wrapper

# Or in watch mode
pnpm nx test ui-components --testFile=crt-effect-wrapper --watch
```

</details>

---

<details open>
<summary><h2>✅ Success Criteria</h2></summary>

**Functional Requirements:**

- [ ] All anti-aliasing CSS properties applied correctly
- [ ] Visible reduction in banding at non-100% zoom levels
- [ ] No visual regression at 100% zoom
- [ ] Scanlines remain crisp (not overly blurred)

**Testing Requirements:**

- [ ] Unit tests verify CSS properties are applied
- [ ] Manual testing completed across browsers and zoom levels
- [ ] All existing tests still pass

**Quality Checks:**

- [ ] No TypeScript errors or warnings
- [ ] Linting passes (`pnpm nx lint ui-components`)
- [ ] Code follows SCSS conventions from Style Guide

**Ready for Evaluation:**

- [ ] All success criteria met
- [ ] Decision can be made whether WebGL phase is needed

</details>

---

<details open>
<summary><h2>📝 Notes & Considerations</h2></summary>

### Design Decisions

- **Blur Amount**: Starting with 0.3px as a balance between anti-aliasing and crispness. May need adjustment based on testing.
- **Layer Promotion**: Using transform hints to promote to GPU layer, which typically provides smoother rendering.

### Implementation Constraints

- CSS-only changes - no TypeScript modifications needed
- Must not break existing scanline appearance at 100% zoom
- Performance impact should be negligible

### Discoveries During Implementation

> Add notes here as you discover important details during implementation

- 

</details>

---

## 💡 Expected CSS Changes

The following CSS additions should be made to the scanline `::before` pseudo-element:

```scss
// Inside &.crt-enabled::before
// Existing content...

// NEW: GPU compositing hints for smoother rendering
will-change: transform, opacity;
transform: translateZ(0);
backface-visibility: hidden;

// NEW: Anti-aliasing for gradient edges  
filter: blur(0.3px);

// NEW: Allow browser to optimize gradient rendering
image-rendering: auto;
```

And for content container:

```scss
// Inside .crt-content
// NEW: Subpixel rendering optimization
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

This provides architectural guidance without writing the full implementation - the worker will integrate these into the existing SCSS structure properly.
