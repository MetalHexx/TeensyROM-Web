import { CRT_PRESET_KEYS } from '@teensyrom-nx/domain';

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
 * Validates a user-entered preset name according to the following rules:
 * 1. Not empty (after trimming whitespace)
 * 2. Between 1 and 50 characters long
 * 3. Contains only alphanumeric characters, spaces, and hyphens
 * 4. Not a reserved built-in preset name (case-insensitive)
 * 5. Unique among existing custom preset names (case-insensitive)
 *
 * Note: This validates the user-entered name WITHOUT the 'custom-' prefix.
 * The storage service will add the prefix after validation passes.
 *
 * @param name - The user-entered preset name to validate (without 'custom-' prefix)
 * @param existingCustomNames - Array of existing custom preset names (without 'custom-' prefix)
 * @returns ValidationResult with valid flag and optional error message
 *
 * @example
 * ```typescript
 * // Valid name
 * validatePresetName('My Preset', [])
 * // => { valid: true }
 *
 * // Name too long
 * validatePresetName('A'.repeat(51), [])
 * // => { valid: false, error: "Preset name must be between 1 and 50 characters" }
 *
 * // Reserved name
 * validatePresetName('fullscreen-webgl', [])
 * // => { valid: false, error: "This name is reserved for a built-in preset" }
 *
 * // Duplicate name
 * validatePresetName('my preset', ['My Preset'])
 * // => { valid: false, error: "A preset with this name already exists" }
 * ```
 */
export function validatePresetName(
  name: string,
  existingCustomNames: string[]
): ValidationResult {
  const trimmedName = name.trim();

  // Rule 1: Empty/whitespace-only check
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Preset name cannot be empty' };
  }

  // Rule 2: Length validation (1-50 characters)
  if (trimmedName.length < 1 || trimmedName.length > 50) {
    return { valid: false, error: 'Preset name must be between 1 and 50 characters' };
  }

  // Rule 3: Character validation (alphanumeric, spaces, hyphens only)
  const validCharacterRegex = /^[a-zA-Z0-9\s-]+$/;
  if (!validCharacterRegex.test(trimmedName)) {
    return {
      valid: false,
      error: 'Preset name can only contain letters, numbers, spaces, and hyphens',
    };
  }

  // Rule 4: Reserved name check (case-insensitive)
  // Extract base names from CRT_PRESET_KEYS (strip 'default-' prefix)
  const reservedNames = Object.values(CRT_PRESET_KEYS).map(key => 
    key.replace(/^default-/, '')
  );
  
  const lowerCaseName = trimmedName.toLowerCase();
  const isReserved = reservedNames.some(reserved => 
    reserved.toLowerCase() === lowerCaseName
  );
  
  if (isReserved) {
    return { valid: false, error: 'This name is reserved for a built-in preset' };
  }

  // Rule 5: Uniqueness check (case-insensitive)
  const isDuplicate = existingCustomNames.some(existing => 
    existing.toLowerCase() === lowerCaseName
  );
  
  if (isDuplicate) {
    return { valid: false, error: 'A preset with this name already exists' };
  }

  return { valid: true };
}
