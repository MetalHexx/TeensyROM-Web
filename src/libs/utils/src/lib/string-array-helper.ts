/**
 * Converts a string array to a comma-separated string.
 * Useful for binding arrays to textarea elements.
 *
 * @param arr - Array of strings to join
 * @returns Comma-separated string
 *
 * @example
 * arrayToString(['foo', 'bar', 'baz']) // Returns: 'foo,bar,baz'
 * arrayToString([]) // Returns: ''
 */
export function arrayToString(arr: string[]): string {
  return arr.join(',');
}

/**
 * Converts a comma-separated string to a string array.
 * Trims whitespace from each element and filters out empty strings.
 * Useful for parsing textarea input back to arrays.
 *
 * @param str - Comma-separated string to parse
 * @returns Array of trimmed, non-empty strings
 *
 * @example
 * stringToArray('foo, bar, baz') // Returns: ['foo', 'bar', 'baz']
 * stringToArray('foo,,bar') // Returns: ['foo', 'bar']
 * stringToArray('') // Returns: []
 */
export function stringToArray(str: string): string[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
