import { CRT_PRESETS, CRT_PRESET_LABELS, DEFAULT_CRT_SETTINGS, CRT_CONFIGS } from './crt-settings.defaults';
import { CRT_PRESET_KEYS, CRT_PHOSPHOR_PATTERNS } from './crt-settings.interface';
import type { CrtSettings } from './crt-settings.interface';

describe('CRT_PRESETS', () => {
  it('should have exactly 3 presets', () => {
    expect(Object.keys(CRT_PRESETS)).toHaveLength(3);
  });

  it('should have preset keys matching domain layer constants', () => {
    expect(CRT_PRESETS).toHaveProperty(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL);
    expect(CRT_PRESETS).toHaveProperty(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL);
    expect(CRT_PRESETS).toHaveProperty(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL);
  });

  describe('Small video preset', () => {
    it('should have no screen curvature', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].screenCurvature).toBe(0);
    });

    it('should have subtle scanline values', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].scanlineIntensity).toBe(0.3);
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].scanlineSize).toBe(1.5);
    });

    it('should have minimal vignette', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].vignetteStrength).toBe(0.7);
    });
  });

  describe('Large video preset', () => {
    it('should have no screen curvature', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].screenCurvature).toBe(0);
    });

    it('should have strong scanline values', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].scanlineIntensity).toBe(1);
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].scanlineSize).toBe(2);
    });

    it('should have moderate vignette', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].vignetteStrength).toBe(0.95);
    });
  });

  describe('Small image preset', () => {
    it('should have no screen curvature', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].screenCurvature).toBe(0);
    });

    it('should have balanced scanline values', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].scanlineIntensity).toBe(1);
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].scanlineSize).toBe(1);
    });

    it('should have minimal vignette', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].vignetteStrength).toBe(0.31);
    });
  });

  describe('WebGL presets', () => {

    it('should have appropriate phosphor patterns', () => {
      // SMALL_VIDEO_WEBGL uses aperture-grille for subtle effect
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].phosphorPattern).toBe(
        CRT_PHOSPHOR_PATTERNS.APERTURE_GRILLE
      );
      // LARGE_VIDEO_WEBGL uses dot-triad for immersive effect
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].phosphorPattern).toBe(
        CRT_PHOSPHOR_PATTERNS.DOT_TRIAD
      );
      // SMALL_IMAGE_WEBGL uses dot-triad for balanced effect
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].phosphorPattern).toBe(
        CRT_PHOSPHOR_PATTERNS.DOT_TRIAD
      );
    });

    it('should have non-zero phosphor intensity', () => {
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL].phosphorIntensity).toBeGreaterThan(0);
      expect(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL].phosphorIntensity).toBeGreaterThan(0);
      expect(CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL].phosphorIntensity).toBeGreaterThan(0);
    });
  });

  describe('Complete CrtSettings structure', () => {
    const requiredProperties: (keyof CrtSettings)[] = [
      'scanlineIntensity',
      'scanlineSize',
      'vignetteStrength',
      'screenCurvature',
      'contrast',
      'brightness',
      'saturation',
      'hue',
      'phosphorPattern',
      'phosphorIntensity',
      'bloomIntensity',
      'barrelDistortion',
      'chromaticAberration',
    ];

    it('should have all required properties in each preset', () => {
      Object.values(CRT_PRESETS).forEach((preset) => {
        requiredProperties.forEach((prop) => {
          expect(preset).toHaveProperty(prop);
        });
      });
    });

    it('should have numeric values for numeric properties', () => {
      const numericProperties: (keyof CrtSettings)[] = [
        'scanlineIntensity',
        'scanlineSize',
        'vignetteStrength',
        'screenCurvature',
        'contrast',
        'brightness',
        'saturation',
        'hue',
        'phosphorIntensity',
        'bloomIntensity',
        'barrelDistortion',
        'chromaticAberration',
      ];

      Object.values(CRT_PRESETS).forEach((preset) => {
        numericProperties.forEach((prop) => {
          expect(typeof preset[prop]).toBe('number');
        });
      });
    });



    it('should have string phosphorPattern property', () => {
      Object.values(CRT_PRESETS).forEach((preset) => {
        expect(typeof preset.phosphorPattern).toBe('string');
      });
    });
  });

  describe('Value inheritance verification', () => {
    it('should maintain Small Video WebGL values', () => {
      const smallVideoWebgl = CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL];
      // Verify key values
      expect(smallVideoWebgl.scanlineIntensity).toBe(0.3);
      expect(smallVideoWebgl.scanlineSize).toBe(1.5);
      expect(smallVideoWebgl.vignetteStrength).toBe(0.7);
      expect(smallVideoWebgl.screenCurvature).toBe(0);
      expect(smallVideoWebgl.phosphorIntensity).toBe(0.1);
    });

    it('should maintain Large Video WebGL values', () => {
      const largeVideoWebgl = CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL];
      // Verify key values
      expect(largeVideoWebgl.scanlineIntensity).toBe(1);
      expect(largeVideoWebgl.scanlineSize).toBe(2);
      expect(largeVideoWebgl.vignetteStrength).toBe(0.95);
      expect(largeVideoWebgl.screenCurvature).toBe(0);
      expect(largeVideoWebgl.phosphorIntensity).toBe(0.31);
    });

    it('should define Small Image WebGL values for static image viewing', () => {
      const smallImageWebgl = CRT_PRESETS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL];
      // Verify balanced values for image content
      expect(smallImageWebgl.scanlineIntensity).toBe(1);
      expect(smallImageWebgl.scanlineSize).toBe(1);
      expect(smallImageWebgl.vignetteStrength).toBe(0.31);
      expect(smallImageWebgl.screenCurvature).toBe(0);
      expect(smallImageWebgl.phosphorIntensity).toBe(0.5);
    });
  });
});

describe('CRT_PRESET_LABELS', () => {
  it('should have exactly 3 labels', () => {
    expect(Object.keys(CRT_PRESET_LABELS)).toHaveLength(3);
  });

  it('should have labels for all preset keys', () => {
    expect(CRT_PRESET_LABELS).toHaveProperty(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL);
    expect(CRT_PRESET_LABELS).toHaveProperty(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL);
    expect(CRT_PRESET_LABELS).toHaveProperty(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL);
  });

  it('should have label keys matching CRT_PRESET_KEYS values', () => {
    const presetKeys = Object.values(CRT_PRESET_KEYS);
    const labelKeys = Object.keys(CRT_PRESET_LABELS);

    expect(labelKeys.sort()).toEqual(presetKeys.sort());
  });

  it('should have concise human-readable labels', () => {
    expect(CRT_PRESET_LABELS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]).toBe('Small Video (WebGL)');
    expect(CRT_PRESET_LABELS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]).toBe('Large Video (WebGL)');
    expect(CRT_PRESET_LABELS[CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL]).toBe('Small Image (WebGL)');
  });

  it('should follow Size (WebGL) or Size Type (WebGL) format', () => {
    Object.values(CRT_PRESET_LABELS).forEach((label) => {
      expect(label).toMatch(/^(Small|Large)( (Video|Image))? \(WebGL\)$/);
    });
  });
});

describe('CRT_CONFIGS', () => {
  it('should have exactly 4 config variants', () => {
    expect(Object.keys(CRT_CONFIGS)).toHaveLength(4);
  });

  it('should have small, smallVideo, large, and none variants', () => {
    expect(CRT_CONFIGS.small).toBeDefined();
    expect(CRT_CONFIGS.smallVideo).toBeDefined();
    expect(CRT_CONFIGS.large).toBeDefined();
    expect(CRT_CONFIGS.none).toBeDefined();
  });

  it('should hide curvature in small config', () => {
    expect(CRT_CONFIGS.small.showCurvature).toBe(false);
    
    // But other controls should be visible
    expect(CRT_CONFIGS.small.showScanlines).toBe(true);
    expect(CRT_CONFIGS.small.showVignette).toBe(true);
    expect(CRT_CONFIGS.small.showColorFilters).toBe(true);
    expect(CRT_CONFIGS.small.showPhosphor).toBe(true);
    expect(CRT_CONFIGS.small.showBloom).toBe(true);
    expect(CRT_CONFIGS.small.showDistortion).toBe(true);
    expect(CRT_CONFIGS.small.showChromaticAberration).toBe(true);
  });

  it('should show all controls in large config', () => {
    const allTrue = Object.values(CRT_CONFIGS.large).every((val) => val === true);
    expect(allTrue).toBe(true);
  });

  it('should hide all controls in none config', () => {
    const allFalse = Object.values(CRT_CONFIGS.none).every((val) => val === false);
    expect(allFalse).toBe(true);
  });

  it('should have complete CrtSettingsConfig structure', () => {
    const requiredProps = [
      'showScanlines',
      'showVignette',
      'showCurvature',
      'showColorFilters',
      'showPhosphor',
      'showBloom',
      'showDistortion',
      'showChromaticAberration',
    ];

    Object.values(CRT_CONFIGS).forEach((config) => {
      requiredProps.forEach((prop) => {
        expect(config).toHaveProperty(prop);
        expect(typeof (config as Record<string, unknown>)[prop]).toBe('boolean');
      });
    });
  });
});

describe('DEFAULT_CRT_SETTINGS', () => {
  it('should reference LARGE_WEBGL preset', () => {
    expect(DEFAULT_CRT_SETTINGS).toBe(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]);
  });

  it('should be a valid CrtSettings object', () => {
    expect(DEFAULT_CRT_SETTINGS).toBeDefined();
    expect(typeof DEFAULT_CRT_SETTINGS).toBe('object');
  });

  it('should have large preset characteristics', () => {
    expect(DEFAULT_CRT_SETTINGS.screenCurvature).toBe(0);
    expect(DEFAULT_CRT_SETTINGS.phosphorPattern).toBe(CRT_PHOSPHOR_PATTERNS.DOT_TRIAD);
    expect(DEFAULT_CRT_SETTINGS.phosphorIntensity).toBeGreaterThan(0);
  });

  it('should have all required CrtSettings properties', () => {
    const requiredProps: (keyof CrtSettings)[] = [
      'scanlineIntensity',
      'scanlineSize',
      'vignetteStrength',
      'screenCurvature',
      'contrast',
      'brightness',
      'saturation',
      'hue',
      'phosphorPattern',
      'phosphorIntensity',
      'bloomIntensity',
      'barrelDistortion',
      'chromaticAberration',
    ];

    requiredProps.forEach((prop) => {
      expect(DEFAULT_CRT_SETTINGS).toHaveProperty(prop);
    });
  });
});
