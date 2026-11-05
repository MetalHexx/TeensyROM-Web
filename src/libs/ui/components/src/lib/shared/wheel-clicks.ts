/** A pause this long between wheel events ends the gesture; a partial click does not outlast it. */
const WHEEL_IDLE_MS = 250;

/**
 * Turns a stream of wheel events into whole clicks: 100 px, 3 lines or one page each, upward
 * positive. A remainder too small for a click is carried within one gesture and dropped after a
 * pause or a change of direction. One instance per wheel-listening element.
 *
 * @example
 * ```ts
 * private readonly wheelClicks = new WheelClicks();
 * onWheel(event: WheelEvent): void {
 *   const clicks = this.wheelClicks.read(event);
 *   if (clicks !== 0) this.wheelTurn.emit({ clicks, timeStampMs: event.timeStamp });
 * }
 * ```
 */
export class WheelClicks {
  private remainder = 0;
  private lastMs: number | null = null;

  /** Takes one wheel event and returns the whole clicks it completes; 0 while a click is partial. */
  read(event: WheelEvent): number {
    const idle = this.lastMs === null || event.timeStamp - this.lastMs > WHEEL_IDLE_MS;
    const reversed = this.remainder !== 0 && Math.sign(-event.deltaY) !== Math.sign(this.remainder);
    if (idle || reversed) {
      this.remainder = 0;
    }
    this.lastMs = event.timeStamp;
    const perClick = event.deltaMode === 1 ? 3 : event.deltaMode === 2 ? 1 : 100;
    this.remainder += -event.deltaY / perClick;
    const clicks = Math.trunc(this.remainder);
    this.remainder -= clicks;
    return clicks;
  }

  /** Forgets any partial click, e.g. when the listener is disabled. */
  reset(): void {
    this.remainder = 0;
    this.lastMs = null;
  }
}
