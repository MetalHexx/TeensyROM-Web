/** The server rejects a longer set name, in UTF-16 units. */
export const SET_NAME_MAX_LENGTH = 64;
/** The server rejects a longer marker name, in UTF-16 units. */
export const MARKER_NAME_MAX_LENGTH = 48;
/** The server's limits, mirrored so a document never fails validation forever behind a `failed`
 *  lamp. */
export const MAX_SETS = 1000;
export const MAX_ROWS_PER_SET = 1000;
export const MAX_MARKERS_PER_SUBTUNE = 128;

/** Control characters as the server counts them (.NET's `char.IsControl`): it rejects a name
 *  holding one, so a pasted tab would otherwise fail every later save of that set for good. */
function isControlCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** A name as the server accepts it: control characters removed, then trimmed and capped to
 *  `maxLength` UTF-16 units, without leaving half a surrogate pair at the cut. Both rename paths
 *  use it. */
export function sanitizeName(name: string, maxLength: number): string {
  const printable = Array.from(name)
    .filter((character) => !isControlCode(character.charCodeAt(0)))
    .join('')
    .trim();
  const capped = printable.slice(0, maxLength);
  const last = capped.charCodeAt(capped.length - 1);
  return (isHighSurrogate(last) && capped.length < printable.length ? capped.slice(0, -1) : capped).trim();
}
