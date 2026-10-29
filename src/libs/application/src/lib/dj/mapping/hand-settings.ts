/** The hand's two settings in seconds; the server validates the same ranges. Reach rides the
 *  style's `amount`; grip its `grip`. */
export const HAND_REACH_SECONDS = { min: 0.02, max: 2, home: 0.13 } as const;
export const HAND_GRIP_SECONDS = { min: 0.05, max: 3, home: 0.25 } as const;
