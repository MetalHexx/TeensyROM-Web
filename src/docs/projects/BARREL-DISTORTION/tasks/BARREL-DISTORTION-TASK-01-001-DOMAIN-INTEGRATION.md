# BARREL-DISTORTION-TASK-01-001-DOMAIN-INTEGRATION

**Project**: BARREL-DISTORTION  
**Phase**: 01 - Domain Model & Interface Updates  
**Task**: 001  
**Status**: Not Started

---

## 📋 Task Overview

Complete integration of the `barrelDistortion` property across the domain layer, including the `CrtSettings` interface, all preset configurations, config flags, and comprehensive unit tests. This single task ensures all related changes are made together for consistency.

**Task Type**: Domain Model Integration  
**Size**: Medium (5 files)  
**Estimated Effort**: 90-120 minutes

---

## 🎯 Objective

Add barrel distortion support to the CRT system's domain layer by:
1. Extending `CrtSettings` interface with `barrelDistortion: number` property
2. Updating all three built-in presets with appropriate default values
3. Verifying `showDistortion` config flag exists and is properly configured
4. Writing comprehensive unit tests to validate all changes

---

## 📁 Files to Modify

### Primary Files
- `libs/domain/src/lib/models/crt-settings.model.ts` - Add `barrelDistortion` property to interface
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts` - Update presets and verify configs
- `libs/domain/src/lib/models/crt-settings.model.spec.ts` - Domain model tests (create if missing)
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts` - Preset/config tests
- `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.interface.spec.ts` - Interface tests

---

## 🔧 Implementation Details

### Step 1: Add Property to CrtSettings Interface

**File**: `libs/domain/src/lib/models/crt-settings.model.ts`  
**Location**: After `bloomRadius` property (around line 115)

```typescript
  /**
   * Radius of bloom spread in pixels (1-10).
   * Higher values = softer, wider glow.
   * @default 3
   */
  bloomRadius: number;

  /**
   * Amount of barrel distortion (0-0.5).
   * 0 = flat screen, higher = more curved/bulging.
   * Different from screenCurvature (border-radius) - this warps the image.
   * Only visible in WebGL mode.
   * @default 0
   */
  barrelDistortion: number;

  /**
   * Amount of RGB channel separation at edges (0-5).
   * Simulates lens aberration in CRT monitors.
   * 0 = no separation, higher = more visible RGB fringing.
   * Only visible in WebGL mode.
   * @default 0
   */
  chromaticAberration: number;
```

**Key Points**:
- Position after `bloomRadius`, before `chromaticAberration`
- Range: 0-0.5 (matching complexity of chromatic aberration)
- Clearly distinguish from `screenCurvature` (CSS border-radius vs. image warping)
- Note "Only visible in WebGL mode"
- Include `@default 0` tag

---

### Step 2: Update CRT Presets

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`  
**Locations**: Lines ~106, ~140, ~175 (each preset object)

**Add to each preset** (after `bloomRadius`, before `chromaticAberration`):

```typescript
// SMALL_VIDEO_WEBGL (line ~106)
  bloomRadius: 1,
  barrelDistortion: 0,        // ADD THIS
  chromaticAberration: 0,

// LARGE_VIDEO_WEBGL (line ~140)
  bloomRadius: 1,
  barrelDistortion: 0.15,     // ADD THIS
  chromaticAberration: 0,

// SMALL_IMAGE_WEBGL (line ~175)
  bloomRadius: 1,
  barrelDistortion: 0,        // ADD THIS
  chromaticAberration: 0,
```

**Rationale**:
- **SMALL_VIDEO_WEBGL = 0**: Compact displays don't benefit from distortion
- **LARGE_VIDEO_WEBGL = 0.15**: Moderate distortion for fullscreen immersion
- **SMALL_IMAGE_WEBGL = 0**: Static images prioritize clarity

---

### Step 3: Verify CRT Configs

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.ts`

**Verify** (should already exist around lines 8-17, 42-93):

1. **DEFAULT_CRT_CONFIG** has `showDistortion: true`
2. **CRT_CONFIGS.small** has `showDistortion: true`
3. **CRT_CONFIGS.large** has `showDistortion: true`
4. **CRT_CONFIGS.none** has `showDistortion: false`

**Note**: These values should already be correct. Only update if missing or incorrect.

---

### Step 4: Write Unit Tests

#### Test File 1: Domain Model Tests

**File**: `libs/domain/src/lib/models/crt-settings.model.spec.ts` *(create if missing)*

```typescript
import { CrtSettings } from './crt-settings.model';

describe('CrtSettings Interface', () => {
  describe('barrelDistortion Property', () => {
    it('should include barrelDistortion property', () => {
      const settings: CrtSettings = {
        scanlineIntensity: 0.5,
        scanlineSize: 2.5,
        vignetteStrength: 1.5,
        screenCurvature: 115,
        contrast: 1.1,
        brightness: 1.5,
        saturation: 1.3,
        hue: 0,
        phosphorPattern: 'none',
        phosphorIntensity: 0,
        bloomEnabled: false,
        bloomIntensity: 0,
        bloomRadius: 1,
        barrelDistortion: 0.15,  // Test new property
        chromaticAberration: 0,
      };

      expect(settings.barrelDistortion).toBeDefined();
      expect(typeof settings.barrelDistortion).toBe('number');
    });

    it('should accept barrelDistortion values in valid range', () => {
      const testValues = [0, 0.1, 0.25, 0.5];
      
      testValues.forEach((value) => {
        const settings: Partial<CrtSettings> = {
          barrelDistortion: value,
        };
        
        expect(settings.barrelDistortion).toBe(value);
        expect(settings.barrelDistortion).toBeGreaterThanOrEqual(0);
        expect(settings.barrelDistortion).toBeLessThanOrEqual(0.5);
      });
    });
  });
});
```

#### Test File 2: Preset Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts`

**Add these test suites** (look for existing preset tests around line 50-100):

```typescript
describe('CRT Presets - Barrel Distortion', () => {
  describe('SMALL_VIDEO_WEBGL', () => {
    it('should include barrelDistortion property', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].barrelDistortion).toBeDefined();
    });

    it('should have barrelDistortion = 0 for compact display', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].barrelDistortion).toBe(0);
    });

    it('should have barrelDistortion in valid range', () => {
      const distortion = CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].barrelDistortion;
      expect(distortion).toBeGreaterThanOrEqual(0);
      expect(distortion).toBeLessThanOrEqual(0.5);
    });
  });

  describe('LARGE_VIDEO_WEBGL', () => {
    it('should include barrelDistortion property', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].barrelDistortion).toBeDefined();
    });

    it('should have barrelDistortion = 0.15 for fullscreen display', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].barrelDistortion).toBe(0.15);
    });

    it('should have barrelDistortion in valid range', () => {
      const distortion = CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].barrelDistortion;
      expect(distortion).toBeGreaterThanOrEqual(0);
      expect(distortion).toBeLessThanOrEqual(0.5);
    });
  });

  describe('SMALL_IMAGE_WEBGL', () => {
    it('should include barrelDistortion property', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].barrelDistortion).toBeDefined();
    });

    it('should have barrelDistortion = 0 for image clarity', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].barrelDistortion).toBe(0);
    });

    it('should have barrelDistortion in valid range', () => {
      const distortion = CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].barrelDistortion;
      expect(distortion).toBeGreaterThanOrEqual(0);
      expect(distortion).toBeLessThanOrEqual(0.5);
    });
  });

  describe('All Presets', () => {
    it('should satisfy CrtSettings interface with barrelDistortion', () => {
      Object.values(CRT_PRESETS).forEach((preset) => {
        expect(preset.barrelDistortion).toBeDefined();
        expect(typeof preset.barrelDistortion).toBe('number');
      });
    });
  });
});
```

#### Test File 3: Config Tests

**File**: `libs/ui/components/src/lib/crt-effect-wrapper/crt-settings.defaults.spec.ts`

**Add these test suites** (in same file as preset tests):

```typescript
describe('CRT Configs - showDistortion Flag', () => {
  describe('DEFAULT_CRT_CONFIG', () => {
    it('should include showDistortion flag', () => {
      expect(DEFAULT_CRT_CONFIG.showDistortion).toBeDefined();
    });

    it('should have showDistortion = true by default', () => {
      expect(DEFAULT_CRT_CONFIG.showDistortion).toBe(true);
    });
  });

  describe('CRT_CONFIGS.small', () => {
    it('should include showDistortion flag', () => {
      expect(CRT_CONFIGS.small.showDistortion).toBeDefined();
    });

    it('should have showDistortion = true for flexibility', () => {
      expect(CRT_CONFIGS.small.showDistortion).toBe(true);
    });
  });

  describe('CRT_CONFIGS.large', () => {
    it('should include showDistortion flag', () => {
      expect(CRT_CONFIGS.large.showDistortion).toBeDefined();
    });

    it('should have showDistortion = true for full control', () => {
      expect(CRT_CONFIGS.large.showDistortion).toBe(true);
    });
  });

  describe('CRT_CONFIGS.none', () => {
    it('should include showDistortion flag', () => {
      expect(CRT_CONFIGS.none.showDistortion).toBeDefined();
    });

    it('should have showDistortion = false to hide all controls', () => {
      expect(CRT_CONFIGS.none.showDistortion).toBe(false);
    });
  });

  describe('All Configs', () => {
    it('should satisfy CrtSettingsConfig interface with showDistortion', () => {
      Object.values(CRT_CONFIGS).forEach((config) => {
        expect(config.showDistortion).toBeDefined();
        expect(typeof config.showDistortion).toBe('boolean');
      });
    });
  });
});
```

---

## ✅ Acceptance Criteria

### Domain Model
- [ ] `barrelDistortion: number` property added to `CrtSettings` interface
- [ ] Property positioned after `bloomRadius` and before `chromaticAberration`
- [ ] JSDoc includes description, range (0-0.5), distinction from screenCurvature, and `@default 0`
- [ ] TypeScript compilation succeeds

### Presets
- [ ] All three presets include `barrelDistortion` property
- [ ] SMALL_VIDEO_WEBGL has `barrelDistortion: 0`
- [ ] LARGE_VIDEO_WEBGL has `barrelDistortion: 0.15`
- [ ] SMALL_IMAGE_WEBGL has `barrelDistortion: 0`
- [ ] Presets satisfy `CrtSettings` interface type constraint

### Configs
- [ ] `CrtSettingsConfig` interface includes `showDistortion: boolean`
- [ ] `DEFAULT_CRT_CONFIG` has `showDistortion: true`
- [ ] `CRT_CONFIGS.small` has `showDistortion: true`
- [ ] `CRT_CONFIGS.large` has `showDistortion: true`
- [ ] `CRT_CONFIGS.none` has `showDistortion: false`

### Tests
- [ ] Domain model tests verify property exists with correct type
- [ ] Domain model tests verify valid range (0-0.5)
- [ ] Preset tests verify all three presets have correct values
- [ ] Config tests verify flag exists with correct boolean values
- [ ] All tests pass: `pnpm nx test domain` and `pnpm nx test ui-components`

---

## 🧪 Testing Requirements

### Run Tests Locally
```bash
# Test domain layer
pnpm nx test domain

# Test UI components
pnpm nx test ui-components

# Run specific test files
pnpm nx test domain --testFile=crt-settings.model.spec.ts
pnpm nx test ui-components --testFile=crt-settings.defaults.spec.ts
```

### Expected Output
- All new tests pass ✅
- No existing tests break ✅
- TypeScript compilation succeeds ✅

---

## 📝 Implementation Notes

### Why Single Task?

Combining all Phase 1 work into one task provides several benefits:
1. **Consistency**: Domain model, presets, and tests are updated together, avoiding partial states
2. **Efficiency**: No coordination overhead between sub-tasks
3. **Simplicity**: Single handoff, single execution, single report
4. **Cohesion**: All changes are tightly related and belong together

### Implementation Order

**Recommended sequence**:
1. Add property to domain model (foundation)
2. Update presets immediately (uses new property)
3. Verify configs (quick check)
4. Write all tests together (validates everything at once)

### Value Range Rationale

**Range: 0-0.5**
- **0**: No distortion (flat screen) - default for most scenarios
- **0.05-0.10**: Subtle, barely noticeable warping
- **0.15**: Moderate, authentic CRT appearance (LARGE_VIDEO_WEBGL default)
- **0.25-0.30**: Strong distortion for dramatic effect
- **0.5**: Maximum before looking unrealistic

Higher values (>0.5) create extreme warping that doesn't match real CRT behavior.

### Preset Philosophy

**Small presets (0)**: Compact displays don't benefit from geometric warping. Distortion at small scales looks odd and distracts from content. Users can enable manually if desired.

**Large preset (0.15)**: Fullscreen displays gain authenticity from moderate distortion. Value is conservative - strong enough to notice, subtle enough not to overwhelm. Can be adjusted in Phase 4 after visual testing.

**Image preset (0)**: Static images prioritize clarity. Text and fine details become harder to read when warped. Effect is more appropriate for dynamic video content.

---

## 🔗 Related Documentation

- **Phase Plan**: [BARREL-DISTORTION-PHASE-01-DOMAIN-MODEL.md](../phases/BARREL-DISTORTION-PHASE-01-DOMAIN-MODEL.md)
- **Master Plan**: [BARREL-DISTORTION-MASTER-PLAN.md](../BARREL-DISTORTION-MASTER-PLAN.md)
- **CRT System Docs**: [COMPONENT_LIBRARY_CRT.md](../../../COMPONENT_LIBRARY_CRT.md)
- **Testing Standards**: [TESTING_STANDARDS.md](../../../TESTING_STANDARDS.md)
- **Coding Standards**: [CODING_STANDARDS.md](../../../CODING_STANDARDS.md)

---

## ❓ Questions & Clarifications

### Resolved Assumptions

**Q**: Should small presets have minimal distortion (0.05) instead of zero?  
**A**: Start with zero for backward compatibility and clarity. Users can enable manually. Reassess after Phase 4 visual testing.

**Q**: Is 0.15 too conservative for LARGE_VIDEO_WEBGL?  
**A**: Start conservative. Too much distortion can be distracting. Can increase to 0.20-0.25 after Phase 4 validation.

**Q**: Should distortion be automatically coupled to screenCurvature in presets?  
**A**: No coupling in domain model. Coupling happens in WebGL shader (Phase 2). Presets set explicit distortion values.

---

## ✨ Success Indicators

- [ ] TypeScript compiles without errors across all layers
- [ ] Domain model IntelliSense shows new property
- [ ] All presets are valid `CrtSettings` objects
- [ ] All configs are valid `CrtSettingsConfig` objects
- [ ] All unit tests pass locally and in CI
- [ ] Phase 1 is complete and ready for Phase 2 (WebGL implementation)
