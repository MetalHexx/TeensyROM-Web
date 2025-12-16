import { CrtSettings } from '../crt-effect-wrapper/crt-settings.interface';

/**
 * Numeric-only keys from CrtSettings (excludes phosphorPattern and bloomEnabled).
 * Used for slider configurations.
 */
export type NumericCrtSettingsKey = Exclude<
  keyof CrtSettings,
  'phosphorPattern' | 'bloomEnabled'
>;

/**
 * Slider configuration metadata for each CRT setting.
 * Defines the range, step, and display format for sliders.
 */
export interface SliderConfig {
  key: NumericCrtSettingsKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: 'decimal' | 'px' | 'percentage' | 'deg';
  decimalPlaces?: number;
}

/** Scanline slider configurations */
export const SCANLINE_SLIDERS: SliderConfig[] = [
  {
    key: 'scanlineIntensity',
    label: 'Scanline Intensity',
    min: 0,
    max: 1.0,
    step: 0.01,
    format: 'percentage',
    decimalPlaces: 0,
  },
  {
    key: 'scanlineSize',
    label: 'Scanline Size',
    min: 1.0,
    max: 6.0,
    step: 1,
    format: 'px',
    decimalPlaces: 0,
  },
];

/** Vignette slider configuration */
export const VIGNETTE_SLIDER: SliderConfig = {
  key: 'vignetteStrength',
  label: 'Vignette',
  min: 0,
  max: 2,
  step: 0.01,
  format: 'percentage',
  decimalPlaces: 0,
};

/** Curvature slider configuration */
export const CURVATURE_SLIDER: SliderConfig = {
  key: 'screenCurvature',
  label: 'Screen Curvature',
  min: 0,
  max: 115,
  step: 5,
  format: 'px',
};

/** Barrel distortion slider configuration */
export const DISTORTION_SLIDER: SliderConfig = {
  key: 'barrelDistortion',
  label: 'Barrel Distortion',
  min: 0,
  max: 0.5,
  step: 0.01,
  format: 'percentage',
  decimalPlaces: 0,
};

/** Color filter slider configurations */
export const COLOR_FILTER_SLIDERS: SliderConfig[] = [
  {
    key: 'contrast',
    label: 'Contrast',
    min: 0.8,
    max: 1.5,
    step: 0.01,
    format: 'percentage',
    decimalPlaces: 0,
  },
  {
    key: 'brightness',
    label: 'Brightness',
    min: 0.8,
    max: 2.0,
    step: 0.01,
    format: 'percentage',
    decimalPlaces: 0,
  },
  {
    key: 'saturation',
    label: 'Saturation',
    min: 0.8,
    max: 1.5,
    step: 0.01,
    format: 'percentage',
    decimalPlaces: 0,
  },
  {
    key: 'hue',
    label: 'Hue',
    min: -60,
    max: 60,
    step: 1,
    format: 'deg',
    decimalPlaces: 0,
  },
];

/** Phosphor intensity slider configuration */
export const PHOSPHOR_SLIDER: SliderConfig = {
  key: 'phosphorIntensity',
  label: 'Phosphor Intensity',
  min: 0,
  max: 1,
  step: 0.01,
  format: 'percentage',
  decimalPlaces: 0,
};

/** Phosphor pattern type options for dropdown selector */
export type PhosphorPatternOption = 'none' | 'aperture-grille' | 'shadow-mask' | 'dot-triad';

export interface PhosphorPatternConfig {
  value: PhosphorPatternOption;
  label: string;
}

export const PHOSPHOR_PATTERN_OPTIONS: PhosphorPatternConfig[] = [
  { value: 'none', label: 'None' },
  { value: 'aperture-grille', label: 'Aperture Grille (Trinitron)' },
  { value: 'shadow-mask', label: 'Shadow Mask (Traditional)' },
  { value: 'dot-triad', label: 'Dot Triad (Arcade)' },
];
