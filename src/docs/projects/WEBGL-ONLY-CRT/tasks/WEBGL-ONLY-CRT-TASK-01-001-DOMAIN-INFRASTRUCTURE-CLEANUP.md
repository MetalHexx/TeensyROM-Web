# Task Handoff: Domain & Infrastructure Cleanup

**Task ID**: WEBGL-ONLY-CRT-TASK-01-001-DOMAIN-INFRASTRUCTURE-CLEANUP  
**Task Name**: Remove WebGL Detector and CSS Presets from Domain/Infrastructure  
**Assigned To**: Clean Coder  
**Priority**: High  
**Estimated Context Size**: Medium (4-8 files)

---

## 🎯 Objective

**What**: Remove the WebGL detector service, contract, and all related infrastructure. Remove CSS preset constants and the `renderMode` property from the CrtSettings interface.

**Why**: CSS rendering mode is being eliminated, making WebGL detection unnecessary. This removes unused code and simplifies the architecture.

**Success Criteria**:
- [ ] `webgl-detector.contract.ts` deleted from domain
- [ ] `webgl-detector.service.ts` and `webgl-detector.ts` deleted from infrastructure
- [ ] `WEBGL_DETECTOR` exports removed from all index files
- [ ] CSS preset keys (SMALL_CSS, LARGE_CSS) removed from CRT_PRESET_KEYS
- [ ] `renderMode` property removed from CrtSettings interface
- [ ] `CrtRenderMode` type removed
- [ ] All unit tests passing (30+ tests updated)
- [ ] No TypeScript compilation errors

---

## 📋 Context & Dependencies

**Prerequisites Completed**: None (this is first task in project)

**Dependencies**: None (self-contained cleanup)

**Constraints**:
- Must maintain backward compatibility for saved settings (old settings may have renderMode property)
- Cannot break existing imports until all consumers updated
- Must follow Clean Architecture layer rules

---

## 📂 File Scope

**Files to DELETE**:
- `libs/domain/src/lib/contracts/webgl-detector.contract.ts` - IWebGLDetector interface and injection token
- `libs/infrastructure/src/lib/webgl/webgl-detector.service.ts` - Service implementation
- `libs/infrastructure/src/lib/webgl/webgl-detector.ts` - Detection utility function

**Files to MODIFY**:
- `libs/domain/src/lib/models/crt-settings.model.ts` - Remove renderMode property and CrtRenderMode type
- `libs/domain/src/lib/models/crt-preset-names.const.ts` - Remove SMALL_CSS, LARGE_CSS from CRT_PRESET_KEYS
- `libs/domain/src/lib/contracts/index.ts` - Remove WEBGL_DETECTOR and IWebGLDetector exports
- `libs/domain/src/index.ts` - Remove webgl-detector contract exports
- `libs/infrastructure/src/lib/webgl/providers.ts` - Remove WEBGL_DETECTOR_PROVIDERS
- `libs/infrastructure/src/lib/webgl/index.ts` - Remove webgl-detector exports
- `libs/infrastructure/src/index.ts` - Remove webgl-detector exports

**Tests to UPDATE**:
- `libs/domain/src/lib/models/crt-settings.model.spec.ts` - Remove renderMode tests
- `libs/domain/src/lib/models/crt-preset-names.const.spec.ts` - Remove CSS preset tests
- Any infrastructure tests referencing WebGL detector

---

## 🛠️ Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md)
- [Testing Standards](../../../TESTING_STANDARDS.md)

### Key Requirements

1. **Delete WebGL Detector Files**:
   - Remove `webgl-detector.contract.ts` - Contains `IWebGLDetector` interface and `WEBGL_DETECTOR` injection token
   - Remove `webgl-detector.service.ts` - Contains `WebGLDetectorService` implementation
   - Remove `webgl-detector.ts` - Contains `detectWebGLSupport()` utility function

2. **Update CrtSettings Model** (`crt-settings.model.ts`):
   - Remove `CrtRenderMode` type definition (was `'css' | 'webgl'`)
   - Remove `renderMode: CrtRenderMode` property from `CrtSettings` interface
   - Keep all other properties intact (scanlineIntensity, brightness, etc.)
   - Update JSDoc comments if they reference renderMode

3. **Update Preset Constants** (`crt-preset-names.const.ts`):
   - Remove `SMALL_CSS: 'default-small-css'` from CRT_PRESET_KEYS
   - Remove `LARGE_CSS: 'default-large-css'` from CRT_PRESET_KEYS
   - Keep `SMALL_WEBGL` and `LARGE_WEBGL` keys
   - Update type exports to reflect only WebGL variants

4. **Clean Up Exports**:
   - Remove all `webgl-detector` exports from `contracts/index.ts`
   - Remove all `webgl-detector` exports from `infrastructure` index files
   - Verify no other files export WebGL detector symbols

5. **Update Infrastructure Providers**:
   - Remove `WEBGL_DETECTOR_PROVIDERS` array from `libs/infrastructure/src/lib/webgl/providers.ts`
   - If file becomes empty, delete it
   - Update infrastructure index to not export WEBGL_DETECTOR_PROVIDERS

### Testing Requirements

**Unit Tests** (30+ tests):
- [ ] Domain: Verify CRT_PRESET_KEYS only has SMALL_WEBGL and LARGE_WEBGL
- [ ] Domain: Verify CrtSettings interface no longer has renderMode
- [ ] Domain: Verify removed CSS preset keys not in type system
- [ ] Infrastructure: Verify WebGL detector imports fail with clear error
- [ ] All existing domain tests still pass

**Test Strategy**:
- Run baseline tests before changes: `pnpm nx test domain --watch=false`
- Run baseline tests before changes: `pnpm nx test infrastructure --watch=false`
- Update tests as you remove code
- Verify all tests pass after changes
- Check TypeScript compilation: `pnpm nx build domain && pnpm nx build infrastructure`

**Known Test Locations**:
- `libs/domain/src/lib/models/crt-settings.model.spec.ts`
- `libs/domain/src/lib/models/crt-preset-names.const.spec.ts`
- `libs/infrastructure/src/lib/webgl/webgl-detector.service.spec.ts` (delete this file)

---

## ⚠️ Important Notes

### Critical CSS Classes to KEEP

Do NOT remove these CSS filters - they are used by WebGL renderer:
- `filter: brightness()` - Color correction
- `filter: contrast()` - Color correction
- `filter: saturate()` - Color correction
- `filter: hue-rotate()` - Color correction

These CSS properties are NOT part of CSS rendering mode - they're used by WebGL for post-processing.

### Backward Compatibility

Old saved settings may contain:
```typescript
{
  renderMode: 'css' | 'webgl',  // This property will be ignored when loading
  // ... other settings
}
```

The storage layer will continue to work - it just ignores the renderMode field. No migration needed.

### Search Before Deleting

Before deleting files, verify no other code imports them:
```bash
# Search for WebGL detector references
pnpm grep-search "WEBGL_DETECTOR|IWebGLDetector|webglDetector" --isRegexp true
```

If any feature components still use it, document as blocker. (Task 3 will handle component cleanup.)

---

## 📤 Output

**Report Location**: `docs/projects/WEBGL-ONLY-CRT/reports/WEBGL-ONLY-CRT-TASK-01-001-REPORT.md`

**Report Template**: [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

---

## ✅ Definition of Done

- [ ] All WebGL detector files deleted
- [ ] CSS preset keys removed from constants
- [ ] renderMode property removed from CrtSettings
- [ ] All exports updated
- [ ] 30+ unit tests passing
- [ ] No TypeScript compilation errors
- [ ] No lingering references to deleted code
- [ ] Completion report written and saved
