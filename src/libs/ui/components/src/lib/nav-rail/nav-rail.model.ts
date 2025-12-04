/**
 * Represents a navigation item in the nav rail.
 * Designed to be decoupled from application-specific routing logic.
 *
 * @typeParam T - Optional payload type. Defaults to `undefined` when no payload is needed.
 *
 * @example
 * ```typescript
 * // Without payload
 * const items: NavRailItem[] = [
 *   { name: 'Home', icon: 'home', route: '/home' }
 * ];
 *
 * // With typed payload
 * interface MyPayload { id: number; }
 * const items: NavRailItem<MyPayload>[] = [
 *   { name: 'Home', icon: 'home', route: '/home', payload: { id: 1 } }
 * ];
 * ```
 */
export interface NavRailItem<T = undefined> {
  /** Display label for the navigation item */
  name: string;

  /** Material icon name to display */
  icon: string;

  /** Route path identifier (parent component handles navigation) */
  route: string;

  /** Optional payload for additional data, typed by consumer */
  payload?: T;
}
