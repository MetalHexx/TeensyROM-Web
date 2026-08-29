/** '+3.2 cents' / '−3.2 cents' — signed to one decimal place. */
export function formatCents(cents: number): string {
  return `${cents >= 0 ? '+' : '−'}${Math.abs(cents).toFixed(1)} cents`;
}

/** 'm:ss', minutes floored and seconds zero-padded. Clamps negatives to 0 rather than printing a
 *  negative duration. */
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
