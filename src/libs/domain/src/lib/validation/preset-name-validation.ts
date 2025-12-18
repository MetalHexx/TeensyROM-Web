import { CRT_PRESET_KEYS } from '../models';

/**
 * Result of preset name validation.
 */
export interface ValidationResult {
  /** Whether the preset name is valid */
  valid: boolean;
  /** Error message if validation failed (only present when valid === false) */
  error?: string;
}

/**
 * Validates a preset name:
 * - Not empty (1-50 characters)
 * - Only letters, numbers, spaces, hyphens, periods, underscores
 * - Not a reserved built-in preset
 * - Unique among custom presets
 *
 * @param name - User-entered preset name (without 'custom-' prefix)
 * @param existingCustomNames - Existing custom preset names to check for duplicates
 */
export function validatePresetName(
  name: string,
  existingCustomNames: string[]
): ValidationResult {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return { valid: false, error: 'Preset name cannot be empty' };
  }

  if (trimmedName.length > 50) {
    return { valid: false, error: 'Preset name must be between 1 and 50 characters' };
  }

  const validCharacterRegex = /^[\w\s.-]+$/;
  if (!validCharacterRegex.test(trimmedName)) {
    return {
      valid: false,
      error: 'Preset name can only contain letters, numbers, spaces, hyphens, periods, and underscores',
    };
  }

  const reservedNames = Object.values(CRT_PRESET_KEYS).map(key => 
    key.replace(/^default-/, '')
  );
  
  const lowerCaseName = trimmedName.toLowerCase();
  if (reservedNames.some(reserved => reserved.toLowerCase() === lowerCaseName)) {
    return { valid: false, error: 'This name is reserved for a built-in preset' };
  }

  if (existingCustomNames.some(existing => existing.toLowerCase() === lowerCaseName)) {
    return { valid: false, error: 'A preset with this name already exists' };
  }

  return { valid: true };
}
