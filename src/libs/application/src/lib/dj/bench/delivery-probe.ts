/** Sends a probe keeps — about 80 s of a 2× tune's 100 Hz stream. */
const RING_SIZE = 8192;

/** Lag bucket upper edges, in ms; the last bucket is everything beyond the final edge. */
const LAG_EDGES_MS = [2, 5, 10, 15, 20, 30] as const;

/** Spacing bucket edges as a fraction of the frame interval. */
const COLLAPSED_BELOW = 0.25;
const BUNCHED_BELOW = 0.75;
const STRETCHED_ABOVE = 1.25;

export interface DeliveryProbeSummary {
  readonly frames: number;
  readonly intervalMs: number;
  /** How long after its due time each frame was handed to the port. */
  readonly lagMs: { readonly p50: number; readonly p90: number; readonly p99: number; readonly max: number };
  /** Percentage of frames per lag bucket, keyed by upper edge (`>30` for the rest). */
  readonly lagPct: Readonly<Record<string, number>>;
  /** Percentage of frames handed over at or past their timestamp — sent at once, not scheduled. */
  readonly missedWindowPct: number;
  /** How far apart consecutive frames were asked to land, against the frame interval. */
  readonly spacing: {
    readonly collapsedPct: number;
    readonly bunchedPct: number;
    readonly onGridPct: number;
    readonly stretchedPct: number;
    readonly minMs: number;
  };
}

/**
 * Bench instrumentation for one deck's frame delivery, built in dev builds only. `DeckRuntime`'s
 * port façade hands it every timestamped send, and it records two things per frame: how late the
 * frame reached the port against the time it fell due, and how far apart it was asked to land from
 * the frame before. A timestamp already in the past goes out at once, so a frame lands at the later
 * of its timestamp and the moment it was sent.
 *
 * `record` allocates nothing — two fixed rings and a counter — because it runs on the path whose
 * jitter it measures. `summarize` allocates freely; it runs on demand from the console.
 */
export class DeliveryProbe {
  private readonly lagMs = new Float32Array(RING_SIZE);
  private readonly spacingMs = new Float32Array(RING_SIZE);
  private sends = 0;
  private lastLandsAtMs = Number.NaN;
  private scheduleAheadMs = 0;

  /** The sink's effective schedule-ahead, which turns a send's timestamp back into its due time. */
  setScheduleAhead(ms: number): void {
    this.scheduleAheadMs = ms;
  }

  record(timestampMs: number): void {
    const nowMs = performance.now();
    const landsAtMs = timestampMs > nowMs ? timestampMs : nowMs;
    const index = this.sends % RING_SIZE;
    this.lagMs[index] = nowMs - (timestampMs - this.scheduleAheadMs);
    // NaN for the first send after a reset; `summarize` skips it.
    this.spacingMs[index] = landsAtMs - this.lastLandsAtMs;
    this.lastLandsAtMs = landsAtMs;
    this.sends++;
  }

  reset(): void {
    this.sends = 0;
    this.lastLandsAtMs = Number.NaN;
  }

  summarize(intervalMs: number): DeliveryProbeSummary {
    const count = Math.min(this.sends, RING_SIZE);
    const lags = Array.from(this.lagMs.subarray(0, count)).sort((a, b) => a - b);
    const spacings = Array.from(this.spacingMs.subarray(0, count)).filter(Number.isFinite);

    const lagPct: Record<string, number> = {};
    let below = 0;
    for (const edge of LAG_EDGES_MS) {
      const within = lags.filter((lag) => lag <= edge).length;
      lagPct[`≤${edge}`] = pct(within - below, count);
      below = within;
    }
    lagPct[`>${LAG_EDGES_MS[LAG_EDGES_MS.length - 1]}`] = pct(count - below, count);

    let collapsed = 0;
    let bunched = 0;
    let stretched = 0;
    for (const spacing of spacings) {
      const ratio = spacing / intervalMs;
      if (ratio < COLLAPSED_BELOW) collapsed++;
      else if (ratio < BUNCHED_BELOW) bunched++;
      else if (ratio > STRETCHED_ABOVE) stretched++;
    }

    return {
      frames: count,
      intervalMs: round(intervalMs),
      lagMs: {
        p50: round(quantile(lags, 0.5)),
        p90: round(quantile(lags, 0.9)),
        p99: round(quantile(lags, 0.99)),
        max: round(lags[lags.length - 1] ?? 0),
      },
      lagPct,
      missedWindowPct: pct(lags.filter((lag) => lag >= this.scheduleAheadMs).length, count),
      spacing: {
        collapsedPct: pct(collapsed, spacings.length),
        bunchedPct: pct(bunched, spacings.length),
        onGridPct: pct(spacings.length - collapsed - bunched - stretched, spacings.length),
        stretchedPct: pct(stretched, spacings.length),
        minMs: round(spacings.length === 0 ? 0 : Math.min(...spacings)),
      },
    };
  }
}

function quantile(sorted: readonly number[], q: number): number {
  return sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
