export const DEVICE_NAME_MAX_LENGTH = 24;

export interface DeviceNameValidation {
  valid: boolean;
  /** The trimmed name, returned whether or not it is valid. */
  name: string;
  reason?: 'empty' | 'too-long' | 'control-character';
}

/**
 * Validates a device name the same way the API does: trims, then requires 1..24 UTF-16 units
 * (`string.length`) and no control characters. Duplicate names are allowed.
 */
export function validateDeviceName(raw: string): DeviceNameValidation {
  const name = raw.trim();

  if (name.length === 0) {
    return { valid: false, name, reason: 'empty' };
  }

  if (name.length > DEVICE_NAME_MAX_LENGTH) {
    return { valid: false, name, reason: 'too-long' };
  }

  if (/\p{Cc}/u.test(name)) {
    return { valid: false, name, reason: 'control-character' };
  }

  return { valid: true, name };
}
