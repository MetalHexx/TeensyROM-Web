import { INSID3_OUT_BASE64 } from './insid3-out.sid';
import { STILL_TIME_BASE64 } from './still-time.sid';

/** A bundled tune's identity plus its base64-encoded raw bytes. */
export interface BundledTune {
  readonly id: string;
  readonly label: string;
  readonly base64: string;
}

/**
 * The two tunes whose artists cleared them for redistribution — TeensyROM firmware 0.7.2's
 * "Featured SIDs" thanks @DivertigO and @Avrilcadabra by name for permission to share these.
 * Every other HVSC tune stays off-disk; the file picker is how a listening session reaches them.
 */
export const BUNDLED_TUNES: readonly BundledTune[] = [
  { id: 'insid3-out', label: 'InSID3 Out — Divertigo', base64: INSID3_OUT_BASE64 },
  { id: 'still-time', label: 'Still Time — Avrilcadabra', base64: STILL_TIME_BASE64 },
];

/** Decodes a bundled tune's base64 payload back into raw bytes. */
export function decodeBundledTune(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
