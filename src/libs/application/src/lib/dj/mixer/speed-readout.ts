/** A speed multiplier as DJ gear shows it: signed percent off 1×, two decimals, e.g. `+1.25%`.
 *  Uses the true minus sign (U+2212); a value that rounds to zero reads `0.00%` with no sign. */
export function formatSpeedPercent(multiplier: number): string {
  const percent = Math.round((multiplier - 1) * 10000) / 100;
  if (percent === 0) {
    return '0.00%';
  }
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent).toFixed(2)}%`;
}
