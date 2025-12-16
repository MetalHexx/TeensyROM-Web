import { describe, it, expect } from 'vitest';
import {
  SCANLINE_SLIDERS,
  VIGNETTE_SLIDER,
  DISTORTION_SLIDER,
  BLOOM_SLIDER,
  CURVATURE_SLIDER,
  COLOR_FILTER_SLIDERS,
  PHOSPHOR_SLIDER,
  PHOSPHOR_PATTERN_OPTIONS,
} from './crt-slider-configs';

describe('CRT Slider Configurations', () => {
  describe('SCANLINE_SLIDERS', () => {
    it('should have correct number of scanline sliders', () => {
      expect(SCANLINE_SLIDERS.length).toBe(2);
    });

    it('should have scanlineIntensity slider with correct properties', () => {
      const intensitySlider = SCANLINE_SLIDERS.find(s => s.key === 'scanlineIntensity');
      expect(intensitySlider).toBeDefined();
      expect(intensitySlider?.label).toBe('Scanline Intensity');
      expect(intensitySlider?.min).toBe(0);
      expect(intensitySlider?.max).toBe(1.0);
      expect(intensitySlider?.step).toBe(0.01);
      expect(intensitySlider?.format).toBe('percentage');
      expect(intensitySlider?.decimalPlaces).toBe(0);
    });

    it('should have scanlineSize slider with correct properties', () => {
      const sizeSlider = SCANLINE_SLIDERS.find(s => s.key === 'scanlineSize');
      expect(sizeSlider).toBeDefined();
      expect(sizeSlider?.label).toBe('Scanline Size');
      expect(sizeSlider?.min).toBe(1.0);
      expect(sizeSlider?.max).toBe(6.0);
      expect(sizeSlider?.step).toBe(1);
      expect(sizeSlider?.format).toBe('px');
      expect(sizeSlider?.decimalPlaces).toBe(0);
    });
  });

  describe('VIGNETTE_SLIDER', () => {
    it('should have correct key property', () => {
      expect(VIGNETTE_SLIDER.key).toBe('vignetteStrength');
    });

    it('should have correct label', () => {
      expect(VIGNETTE_SLIDER.label).toBe('Vignette');
    });

    it('should have correct range', () => {
      expect(VIGNETTE_SLIDER.min).toBe(0);
      expect(VIGNETTE_SLIDER.max).toBe(2);
    });

    it('should have correct step', () => {
      expect(VIGNETTE_SLIDER.step).toBe(0.01);
    });

    it('should have percentage format', () => {
      expect(VIGNETTE_SLIDER.format).toBe('percentage');
      expect(VIGNETTE_SLIDER.decimalPlaces).toBe(0);
    });
  });

  describe('DISTORTION_SLIDER', () => {
    it('should have correct key property', () => {
      expect(DISTORTION_SLIDER.key).toBe('barrelDistortion');
    });

    it('should have correct label', () => {
      expect(DISTORTION_SLIDER.label).toBe('Barrel Distortion');
    });

    it('should have correct range', () => {
      expect(DISTORTION_SLIDER.min).toBe(0);
      expect(DISTORTION_SLIDER.max).toBe(0.5);
    });

    it('should have correct step', () => {
      expect(DISTORTION_SLIDER.step).toBe(0.01);
    });

    it('should have percentage format', () => {
      expect(DISTORTION_SLIDER.format).toBe('percentage');
      expect(DISTORTION_SLIDER.decimalPlaces).toBe(0);
    });
  });

  describe('BLOOM_SLIDER', () => {
    it('should have correct key property', () => {
      expect(BLOOM_SLIDER.key).toBe('bloomIntensity');
    });

    it('should have correct label', () => {
      expect(BLOOM_SLIDER.label).toBe('Bloom');
    });

    it('should have correct range', () => {
      expect(BLOOM_SLIDER.min).toBe(0);
      expect(BLOOM_SLIDER.max).toBe(2.0);
    });

    it('should have correct step', () => {
      expect(BLOOM_SLIDER.step).toBe(0.05);
    });

    it('should have decimal format', () => {
      expect(BLOOM_SLIDER.format).toBe('decimal');
      expect(BLOOM_SLIDER.decimalPlaces).toBe(2);
    });
  });

  describe('CURVATURE_SLIDER', () => {
    it('should have correct key property', () => {
      expect(CURVATURE_SLIDER.key).toBe('screenCurvature');
    });

    it('should have correct label', () => {
      expect(CURVATURE_SLIDER.label).toBe('Screen Curvature');
    });

    it('should have correct range', () => {
      expect(CURVATURE_SLIDER.min).toBe(0);
      expect(CURVATURE_SLIDER.max).toBe(115);
    });

    it('should have correct step', () => {
      expect(CURVATURE_SLIDER.step).toBe(5);
    });

    it('should have px format', () => {
      expect(CURVATURE_SLIDER.format).toBe('px');
    });
  });

  describe('COLOR_FILTER_SLIDERS', () => {
    it('should have correct number of color filter sliders', () => {
      expect(COLOR_FILTER_SLIDERS.length).toBe(4);
    });

    it('should have contrast slider with correct properties', () => {
      const contrastSlider = COLOR_FILTER_SLIDERS.find(s => s.key === 'contrast');
      expect(contrastSlider).toBeDefined();
      expect(contrastSlider?.label).toBe('Contrast');
      expect(contrastSlider?.min).toBe(0.8);
      expect(contrastSlider?.max).toBe(1.5);
      expect(contrastSlider?.step).toBe(0.01);
      expect(contrastSlider?.format).toBe('percentage');
      expect(contrastSlider?.decimalPlaces).toBe(0);
    });

    it('should have brightness slider with correct properties', () => {
      const brightnessSlider = COLOR_FILTER_SLIDERS.find(s => s.key === 'brightness');
      expect(brightnessSlider).toBeDefined();
      expect(brightnessSlider?.label).toBe('Brightness');
      expect(brightnessSlider?.min).toBe(0.8);
      expect(brightnessSlider?.max).toBe(2.0);
      expect(brightnessSlider?.step).toBe(0.01);
      expect(brightnessSlider?.format).toBe('percentage');
      expect(brightnessSlider?.decimalPlaces).toBe(0);
    });

    it('should have saturation slider with correct properties', () => {
      const saturationSlider = COLOR_FILTER_SLIDERS.find(s => s.key === 'saturation');
      expect(saturationSlider).toBeDefined();
      expect(saturationSlider?.label).toBe('Saturation');
      expect(saturationSlider?.min).toBe(0.8);
      expect(saturationSlider?.max).toBe(1.5);
      expect(saturationSlider?.step).toBe(0.01);
      expect(saturationSlider?.format).toBe('percentage');
      expect(saturationSlider?.decimalPlaces).toBe(0);
    });

    it('should have hue slider with correct properties', () => {
      const hueSlider = COLOR_FILTER_SLIDERS.find(s => s.key === 'hue');
      expect(hueSlider).toBeDefined();
      expect(hueSlider?.label).toBe('Hue');
      expect(hueSlider?.min).toBe(-60);
      expect(hueSlider?.max).toBe(60);
      expect(hueSlider?.step).toBe(1);
      expect(hueSlider?.format).toBe('deg');
      expect(hueSlider?.decimalPlaces).toBe(0);
    });
  });

  describe('PHOSPHOR_SLIDER', () => {
    it('should have correct key property', () => {
      expect(PHOSPHOR_SLIDER.key).toBe('phosphorIntensity');
    });

    it('should have correct label', () => {
      expect(PHOSPHOR_SLIDER.label).toBe('Phosphor Intensity');
    });

    it('should have correct range', () => {
      expect(PHOSPHOR_SLIDER.min).toBe(0);
      expect(PHOSPHOR_SLIDER.max).toBe(1);
    });

    it('should have correct step', () => {
      expect(PHOSPHOR_SLIDER.step).toBe(0.01);
    });

    it('should have percentage format', () => {
      expect(PHOSPHOR_SLIDER.format).toBe('percentage');
      expect(PHOSPHOR_SLIDER.decimalPlaces).toBe(0);
    });
  });

  describe('PHOSPHOR_PATTERN_OPTIONS', () => {
    it('should have 4 phosphor pattern options', () => {
      expect(PHOSPHOR_PATTERN_OPTIONS.length).toBe(4);
    });

    it('should have none option', () => {
      const noneOption = PHOSPHOR_PATTERN_OPTIONS.find(o => o.value === 'none');
      expect(noneOption).toBeDefined();
      expect(noneOption?.label).toBe('None');
    });

    it('should have aperture-grille option', () => {
      const apertureOption = PHOSPHOR_PATTERN_OPTIONS.find(o => o.value === 'aperture-grille');
      expect(apertureOption).toBeDefined();
      expect(apertureOption?.label).toBe('Aperture Grille (Trinitron)');
    });

    it('should have shadow-mask option', () => {
      const shadowOption = PHOSPHOR_PATTERN_OPTIONS.find(o => o.value === 'shadow-mask');
      expect(shadowOption).toBeDefined();
      expect(shadowOption?.label).toBe('Shadow Mask (Traditional)');
    });

    it('should have dot-triad option', () => {
      const dotOption = PHOSPHOR_PATTERN_OPTIONS.find(o => o.value === 'dot-triad');
      expect(dotOption).toBeDefined();
      expect(dotOption?.label).toBe('Dot Triad (Arcade)');
    });
  });
});
