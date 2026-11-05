/** Where the user is told to look for the https address when the engine could not report its port. */
export const SECURE_ADDRESS_FALLBACK = 'the secure address that trom ui lists';

/**
 * True when the browser reports the page is not a secure context (plain http from another
 * computer), where it hides Web MIDI and camera access. `localhost` over http is still secure, and
 * an environment that does not report the flag is treated as secure.
 */
export function isInsecureContext(): boolean {
  return globalThis.isSecureContext === false;
}

/**
 * The instruction for reaching this page over https: the page's own host with the engine's secure
 * port, or the `trom ui` secure address when the port is unknown.
 */
export function openOverHttpsAdvice(
  securePort: number | null,
  hostname: string = globalThis.location?.hostname ?? ''
): string {
  const where = securePort === null || !hostname ? SECURE_ADDRESS_FALLBACK : `https://${hostname}:${securePort}`;
  return `Open this page over https at ${where}.`;
}
