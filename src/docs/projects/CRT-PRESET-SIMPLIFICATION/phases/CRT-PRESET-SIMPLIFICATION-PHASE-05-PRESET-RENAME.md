# Phase 5: Preset Rename & Context Separation

## 🎯 Objective

Rename built-in CRT presets to reflect their intended use contexts (video vs. image) and create a dedicated image preset. This phase ensures each component type (video-capture, video-dialog, file-image) has its own semantically appropriate default preset while maintaining the internal size-based architecture.

**User Value**: Clear semantic naming that reflects the actual use case (video vs. static image) rather than generic size labels.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Standards & Guidelines:**

- [ ] [Coding Standards](../../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Testing Standards](../../../TESTING_STANDARDS.md) - Testing approaches and best practices
- [ ] [Component Library](../../../COMPONENT_LIBRARY.md) - Reusable UI components

---

## 📂 File Structure Overview

```
libs/domain/src/lib/models/
├── crt-preset-names.const.ts                📝 Modified - Rename keys & add SMALL_IMAGE_WEBGL
├── crt-preset-names.const.spec.ts           📝 Modified - Update tests for 3 presets

libs/ui/components/src/lib/crt-effect-wrapper/
├── crt-settings.defaults.ts                 📝 Modified - Rename preset keys & add image preset
├── crt-settings.interface.spec.ts           📝 Modified - Update tests for new keys

libs/features/player/src/lib/player-view/player-device-container/
├── video-capture/
│   └── video-capture.component.ts           📝 Modified - Use SMALL_VIDEO_WEBGL key
├── video-capture/video-dialog/
│   └── video-dialog.component.ts            📝 Modified - Use LARGE_VIDEO_WEBGL key
├── file-image/
│   └── file-image.component.ts              📝 Modified - Use SMALL_IMAGE_WEBGL key

libs/ui/components/src/lib/crt-settings-panel/
├── crt-settings-panel.component.ts          📝 Modified - Update default preset reference
```

---

## 📋 Implementation Guidelines

> **IMPORTANT - Code Reference Policy:**
>
> - Focus on **WHAT** to implement, not **HOW** to implement it
> - Use **class names**, **method names**, **property names**
> - Small code snippets OK for critical type definitions only
> - Link to standards docs for detailed patterns

> **IMPORTANT - Testing Policy:**
>
> - Include tests **within the task** as work progresses
> - Update existing tests to reflect new preset names
> - Verify all components still function with renamed presets

> **IMPORTANT - Progress Tracking:**
>
> - **Mark checkboxes ✅ as you complete each subtask**
> - Update progress throughout implementation

---

<details open>
<summary><h3>Task 1: Rename Presets & Add Image Preset</h3></summary>

**Purpose**: Rename existing presets to reflect video context and create a dedicated image preset. Update all references across domain, UI, and feature layers.

**Affected Files**:
- Domain: `crt-preset-names.const.ts`, `crt-preset-names.const.spec.ts`
- UI Components: `crt-settings.defaults.ts`, `crt-settings.interface.spec.ts`, `crt-settings-panel.component.ts`
- Features: `video-capture.component.ts`, `video-dialog.component.ts`, `file-image.component.ts`

**Key Changes**:
1. Rename `SMALL_WEBGL` → `SMALL_VIDEO_WEBGL` in domain constants
2. Rename `LARGE_WEBGL` → `LARGE_VIDEO_WEBGL` in domain constants
3. Add new `SMALL_IMAGE_WEBGL` constant in domain layer
4. Update preset definitions in UI layer with renamed keys
5. Create new image preset configuration (copy from small video preset)
6. Update component default preset references
7. Update component exclusion lists
8. Update all test files to reflect new preset names

**Subtasks**:

- [ ] **Domain Layer Updates**
  - [ ] Update `CRT_PRESET_KEYS` constant in `crt-preset-names.const.ts`
    - Rename `SMALL_WEBGL` → `SMALL_VIDEO_WEBGL`
    - Rename `LARGE_WEBGL` → `LARGE_VIDEO_WEBGL`
    - Add `SMALL_IMAGE_WEBGL` key
  - [ ] Update `crt-preset-names.const.spec.ts` tests
    - Update test to expect 3 keys instead of 2
    - Update key name assertions
    - Update value assertions for renamed keys

- [ ] **UI Layer Preset Definitions**
  - [ ] Update `CRT_PRESETS` object in `crt-settings.defaults.ts`
    - Rename `SMALL_WEBGL` key → `SMALL_VIDEO_WEBGL`
    - Rename `LARGE_WEBGL` key → `LARGE_VIDEO_WEBGL`
    - Add `SMALL_IMAGE_WEBGL` preset (copy config from SMALL_VIDEO_WEBGL)
  - [ ] Update JSDoc comments to reflect new naming (video vs. image contexts)
  - [ ] Update `crt-settings.interface.spec.ts` tests
    - Update `isBuiltInPreset()` tests for new keys
    - Update other preset validation tests

- [ ] **Settings Panel Component Updates**
  - [ ] Update default preset reference in `crt-settings-panel.component.ts`
    - Change `CRT_PRESET_KEYS.LARGE_WEBGL` → `CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL`

- [ ] **Feature Component Updates**
  - [ ] Update `video-capture.component.ts`
    - Change default to `CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL`
    - Update `excludePresets` to exclude `LARGE_VIDEO_WEBGL` and `SMALL_IMAGE_WEBGL`
  - [ ] Update `video-dialog.component.ts`
    - Change default to `CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL`
    - Update `excludePresets` to exclude `SMALL_VIDEO_WEBGL` and `SMALL_IMAGE_WEBGL`
  - [ ] Update `file-image.component.ts`
    - Change default to `CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL`
    - Update `excludePresets` to exclude `SMALL_VIDEO_WEBGL` and `LARGE_VIDEO_WEBGL`

- [ ] **Testing & Verification**
  - [ ] Run unit tests: `pnpm nx test domain`
  - [ ] Run unit tests: `pnpm nx test ui-components`
  - [ ] Run unit tests: `pnpm nx test player`
  - [ ] Verify all components load with correct defaults
  - [ ] Verify preset exclusion works correctly (users only see "Default")
  - [ ] Verify custom presets still function

**Success Criteria**:
- ✅ Domain layer has 3 preset keys with semantic names
- ✅ UI layer has 3 preset configurations
- ✅ All components use context-appropriate defaults
- ✅ Exclusion lists prevent users from seeing inappropriate presets
- ✅ All tests pass
- ✅ No TypeScript errors

</details>

---

## ✅ Phase Completion Checklist

Before marking this phase complete, verify:

- [ ] All preset keys renamed in domain layer
- [ ] New image preset created with appropriate configuration
- [ ] All component references updated to use new keys
- [ ] Exclusion lists updated for all three components
- [ ] All unit tests passing (`domain`, `ui-components`, `player`)
- [ ] No TypeScript compilation errors
- [ ] Manual verification: each component shows only "Default" in preset dropdown

---

## 📊 Deliverables

1. **Domain Constants** - Updated `CRT_PRESET_KEYS` with 3 semantically named keys
2. **UI Presets** - Updated `CRT_PRESETS` with 3 preset configurations
3. **Component Defaults** - Each component uses its context-appropriate preset
4. **Exclusion Logic** - Components hide inappropriate presets from users
5. **Test Coverage** - All tests updated and passing

---

## 🔗 Related Documentation

- [Master Plan](../CRT-PRESET-SIMPLIFICATION-MASTER-PLAN.md)
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)
