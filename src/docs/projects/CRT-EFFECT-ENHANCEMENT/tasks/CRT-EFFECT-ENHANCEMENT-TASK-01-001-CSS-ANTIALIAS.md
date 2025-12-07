# Task Handoff: CSS Anti-Aliasing Fixes

## 📋 Task Identity

**Task ID**: CRT-EFFECT-ENHANCEMENT-TASK-01-001-CSS-ANTIALIAS  
**Task Name**: Implement CSS Anti-Aliasing Fixes for Scanline Banding  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (2 files)

---

## 🎯 Objective

**What**: Add CSS anti-aliasing properties to the CRT scanline overlay to reduce Moiré pattern banding at non-100% browser zoom levels.

**Why**: Users experience visible banding artifacts when viewing the application at zoom levels like 110%, 125%, or 150%. The hard edges of the CSS gradient-based scanlines don't align with physical screen pixels, causing interference patterns.

**Success Criteria**:
- [x] GPU compositing hints added to scanline overlay *(implemented but reverted)*
- [x] Subtle anti-aliasing blur applied to scanline edges *(implemented but reverted)*
- [x] Image rendering optimization set *(implemented but reverted)*
- [x] Font smoothing applied to content container *(implemented but reverted)*
- [ ] No visual regression at 100% zoom *(not tested - reverted)*
- [❌] Visible improvement at 125% zoom (primary test case) - **FAILED**
- [x] All existing tests pass

**⚠️ TASK BLOCKED**: CSS approach ineffective. See [report](../reports/CRT-EFFECT-ENHANCEMENT-TASK-01-001-REPORT.md) for details. Recommend skipping to Phase 2 (WebGL).

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- None - this is the first task

**Dependencies**:
- Existing `crt-effect-wrapper.component.scss` with scanline gradient implementation

**Constraints**:
- CSS-only changes (no TypeScript modifications)
- Must not break existing 100% zoom appearance
- Scanlines must remain visually crisp (not overly blurred)
- Performance impact must be negligible

---

## 📁 File Scope

**Files to Modify**:

1. `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.scss`
   - Add GPU compositing hints to `::before` pseudo-element
   - Add anti-aliasing filter
   - Add image rendering optimization
   - Add font smoothing to content container

2. `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.spec.ts`
   - Add tests verifying CSS properties are applied correctly

**Files to Review** (for context):

- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.html` - Template structure
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-effect-wrapper.component.ts` - Component logic

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Style Guide](../../../../STYLE_GUIDE.md) - SCSS conventions
- [Testing Standards](../../../../TESTING_STANDARDS.md) - Test patterns

**Key Requirements**:

### 1. GPU Compositing Hints (on `::before` scanline overlay)

Add these properties to promote the scanline layer to GPU for smoother compositing:

```scss
will-change: transform, opacity;
transform: translateZ(0);
backface-visibility: hidden;
```

### 2. Anti-Aliasing Blur (on `::before` scanline overlay)

Add subtle blur to soften gradient edge transitions:

```scss
filter: blur(0.3px);
```

**Note**: The existing code may already have transition properties. Ensure the filter doesn't interfere. The blur value (0.3px) may need adjustment - try 0.2px if too soft, 0.4px if still seeing artifacts.

### 3. Image Rendering (on `::before` scanline overlay)

Explicitly set rendering mode:

```scss
image-rendering: auto;
```

### 4. Font Smoothing (on `.crt-content`)

Add subpixel rendering optimization:

```scss
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

**Anti-Patterns to Avoid**:
- Don't use `image-rendering: pixelated` or `crisp-edges` - makes aliasing worse
- Don't apply blur to the entire wrapper - only to the scanline overlay
- Don't use excessive blur (>0.5px) - makes scanlines too soft
- Don't modify the vignette `::after` element - only the scanlines need anti-aliasing

---

## 🧪 Testing Requirements

**Test Coverage Required**:

1. **Unit Tests** - Verify CSS properties are applied when CRT is enabled:
   - Test `will-change` property on scanline overlay
   - Test `filter` includes blur
   - Test `image-rendering` is set

2. **Manual Testing** - Verify visual improvement:
   - Screenshot before changes at 125% zoom
   - Screenshot after changes at 125% zoom
   - Compare banding reduction
   - Verify 100% zoom still looks correct

**Test Execution**:

```bash
# Run component tests
pnpm nx test ui-components --testFile=crt-effect-wrapper

# Run all UI component tests
pnpm nx test ui-components
```

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 1 Plan](../phases/CRT-EFFECT-ENHANCEMENT-PHASE-01-CSS-ANTIALIAS.md)
- [Master Plan](../CRT-EFFECT-ENHANCEMENT-MASTER-PLAN.md)
- [COMPONENT_LIBRARY_CRT.md](../../../../COMPONENT_LIBRARY_CRT.md)

**External References**:
- [MDN will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [MDN image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering)

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/CRT-EFFECT-ENHANCEMENT/reports/CRT-EFFECT-ENHANCEMENT-TASK-01-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: File path of saved report

---

## ✅ Completion Checklist

Before marking complete:

- [ ] All CSS properties added to SCSS file
- [ ] Tests added/updated for new CSS properties
- [ ] All existing tests pass
- [ ] Manual verification at 100% and 125% zoom completed
- [ ] Report saved to specified location
- [ ] Discoveries documented in report

---

## 💡 Hints for Success

1. **Locate the right section**: The scanline styles are in `&.crt-enabled::before` - add new properties there alongside existing ones.

2. **Preserve transitions**: The existing `opacity: 1; transition: opacity 0.3s ease-in-out;` should remain.

3. **Test incrementally**: Add one property at a time and test to understand each one's impact.

4. **Document blur value**: If you find 0.3px isn't optimal, document what value you chose and why.

5. **Check filter syntax**: If the scanline overlay needs multiple filters, combine them: `filter: blur(0.3px) [other filters if any];`
