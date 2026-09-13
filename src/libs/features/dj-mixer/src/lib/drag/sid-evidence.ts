import { DjFileEntry } from '@teensyrom-nx/application';

/**
 * Parsed SID file header information.
 */
interface SidHeader {
  magic: string;
  version: number;
}

/**
 * Parses a SID file header from a buffer.
 *
 * Extracts the magic bytes (first four bytes as ASCII) and version (big-endian uint16 at offset 4).
 * Returns `null` if the magic is neither `PSID` nor `RSID`, or if the buffer is shorter than 6 bytes.
 *
 * @param bytes The buffer containing the SID file header.
 * @returns An object with `{ magic, version }` or `null` if the header is invalid.
 *
 * @example
 * ```ts
 * const header = parseSidHeader(songBuffer);
 * if (header) {
 *   console.log(`SID v${header.version}`);
 * }
 * ```
 */
export function parseSidHeader(bytes: ArrayBuffer): SidHeader | null {
  if (bytes.byteLength < 6) {
    return null;
  }

  const view = new DataView(bytes);
  const magicBytes = new Uint8Array(bytes, 0, 4);
  const magic = String.fromCharCode(...magicBytes);

  if (magic !== 'PSID' && magic !== 'RSID') {
    return null;
  }

  const version = view.getUint16(4, false); // big-endian

  return { magic, version };
}

/**
 * Computes the SHA-256 hash of a buffer as a hexadecimal string.
 *
 * Uses the Web Crypto API (`crypto.subtle.digest`) to compute the hash. This is an `async`
 * operation and the caller must await it.
 *
 * @param bytes The buffer to hash.
 * @returns A promise that resolves to the lowercase 64-character hex string of the SHA-256 hash.
 *
 * @example
 * ```ts
 * const hex = await sha256Hex(songBuffer);
 * console.log(`SHA-256 ${hex}`);
 * ```
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Formats evidence text about a DJ file entry for alert display.
 *
 * For `retrieved` entries, shows file name, byte length, SID header info, and SHA-256 hash.
 * For `failed` entries, shows file name and error message.
 * For `retrieving` or missing entries, returns a placeholder.
 *
 * This is an `async` function because it must compute the SHA-256 hash; the caller awaits it
 * before displaying the alert.
 *
 * @param entry The DJ file entry to format, or undefined.
 * @returns A promise that resolves to the formatted alert text (multiline string).
 *
 * @example
 * ```ts
 * const text = await formatSidEvidence(entry);
 * alert(text);
 * ```
 */
export async function formatSidEvidence(entry: DjFileEntry | undefined): Promise<string> {
  if (!entry) {
    return 'Retrieval did not complete';
  }

  if (entry.status === 'failed') {
    return `${entry.fileName}\nRetrieval failed: ${entry.error}`;
  }

  if (entry.status === 'retrieving' || !entry.bytes) {
    return 'Retrieval did not complete';
  }

  // status === 'retrieved' with valid bytes
  const header = parseSidHeader(entry.bytes);
  const headerLine = header ? `${header.magic} v${header.version}` : 'not a SID header';
  const hash = await sha256Hex(entry.bytes);

  return `${entry.fileName}\n${entry.byteLength} bytes\n${headerLine}\nSHA-256 ${hash}`;
}
