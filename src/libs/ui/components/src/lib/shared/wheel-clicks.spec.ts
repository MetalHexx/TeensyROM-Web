import { describe, it, expect, beforeEach } from 'vitest';
import { WheelClicks } from './wheel-clicks';

function wheel(deltaY: number, deltaMode = 0, timeStamp = 0): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY, deltaMode });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

describe('WheelClicks', () => {
  let clicks: WheelClicks;

  beforeEach(() => {
    clicks = new WheelClicks();
  });

  it('counts one click per 100 px, upward positive', () => {
    expect(clicks.read(wheel(-100, 0, 10))).toBe(1);
    expect(clicks.read(wheel(100, 0, 20))).toBe(-1);
  });

  it('accumulates small pixel deltas until they make a click', () => {
    expect([-40, -40, -40, -100].map((d, i) => clicks.read(wheel(d, 0, i)))).toEqual([0, 0, 1, 1]);
  });

  it('drops a partial click after a pause or a change of direction', () => {
    clicks.read(wheel(-60, 0, 1000));
    expect(clicks.read(wheel(-60, 0, 1500))).toBe(0);

    clicks.read(wheel(-80, 0, 2000));
    clicks.read(wheel(10, 0, 2010));
    expect(clicks.read(wheel(-40, 0, 2020))).toBe(0);
  });

  it('returns several clicks for a large delta and keeps the remainder', () => {
    expect(clicks.read(wheel(-250, 0, 1))).toBe(2);
    expect(clicks.read(wheel(-50, 0, 2))).toBe(1);
  });

  it('counts 3 lines, or one page, as a click', () => {
    expect(clicks.read(wheel(-1, 1, 1))).toBe(0);
    expect(clicks.read(wheel(-2, 1, 2))).toBe(1);
    expect(clicks.read(wheel(1, 2, 3))).toBe(-1);
  });

  it('forgets a partial click on reset', () => {
    clicks.read(wheel(-60, 0, 1));
    clicks.reset();
    expect(clicks.read(wheel(-60, 0, 2))).toBe(0);
  });
});
