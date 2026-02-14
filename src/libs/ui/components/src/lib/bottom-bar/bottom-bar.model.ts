/**
 * Represents a navigation item in the bottom bar.
 * Mirrors NavRailItem for API compatibility at the phone breakpoint.
 */
export interface BottomBarItem {
  /** Display label for the navigation item */
  name: string;

  /** Material icon name to display */
  icon: string;

  /** Route path identifier (parent component handles navigation) */
  route: string;
}
