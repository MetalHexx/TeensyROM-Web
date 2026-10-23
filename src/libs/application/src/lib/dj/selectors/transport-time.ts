const MICROSECONDS_PER_TENTH = 100_000;
const TENTHS_PER_SECOND = 10;
const SECONDS_PER_MINUTE = 60;

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function usableInterval(intervalUs: number | null): intervalUs is number {
  return intervalUs !== null && Number.isFinite(intervalUs) && intervalUs > 0;
}

/** 'mm:ss.t' for `frames` play calls at `intervalUs` each; '00:00.0' when the interval is null.
 *  Tenths are truncated, never rounded up, so the display cannot run ahead of the playhead; minutes
 *  are not capped. */
export function formatElapsed(frames: number, intervalUs: number | null): string {
  if (!usableInterval(intervalUs) || !Number.isFinite(frames) || frames <= 0) {
    return '00:00.0';
  }
  const totalTenths = Math.floor((frames * intervalUs) / MICROSECONDS_PER_TENTH);
  const tenths = totalTenths % TENTHS_PER_SECOND;
  return `${clock(Math.floor(totalTenths / TENTHS_PER_SECOND))}.${tenths}`;
}

/** 'mm:ss' for `frames` play calls, or '--:--' when either is null. Seconds are truncated; minutes
 *  are not capped. */
export function formatTotal(frames: number | null, intervalUs: number | null): string {
  if (frames === null || !usableInterval(intervalUs) || !Number.isFinite(frames)) {
    return '--:--';
  }
  return clock(Math.floor((Math.max(frames, 0) * intervalUs) / (MICROSECONDS_PER_TENTH * TENTHS_PER_SECOND)));
}
