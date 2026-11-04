import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIVE_LOOP_HOLD_MS,
  LiveLoopRowComponent,
  type LiveLoopRowModel,
} from './live-loop-row.component';

const row: LiveLoopRowModel = {
  running: false,
  disabled: false,
  liveLoopAccessibleName: 'Live loop deck A',
  size: {
    text: '4 BEATS',
    options: [
      { beats: 2, label: '2 BEATS', selected: false },
      { beats: 4, label: '4 BEATS', selected: true },
    ],
    halveAccessibleName: 'Halve live loop deck A',
    doubleAccessibleName: 'Double live loop deck A',
    pickAccessibleName: 'Live loop size deck A',
  },
  canHalve: true,
  canDouble: true,
  slip: false,
  slipAccessibleName: 'Slip deck A',
};

// jsdom has no `PointerEvent` constructor; the hold directive reads only the event's target.
const pointer = (type: 'pointerdown' | 'pointerup'): Event =>
  new MouseEvent(type, { bubbles: true, button: 0 });

describe('LiveLoopRowComponent', () => {
  let fixture: ComponentFixture<LiveLoopRowComponent>;
  let el: HTMLElement;
  let emitted: unknown[];

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [LiveLoopRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(LiveLoopRowComponent);
    el = fixture.nativeElement;
    emitted = [];
    const component = fixture.componentInstance;
    component.toggleLiveLoop.subscribe(() => emitted.push('toggle'));
    component.endLiveLoop.subscribe(() => emitted.push('end'));
    component.halve.subscribe(() => emitted.push('halve'));
    component.double.subscribe(() => emitted.push('double'));
    component.pickSize.subscribe((beats) => emitted.push(['pick', beats]));
    component.sizeWheel.subscribe((turn) => emitted.push(['wheel', turn.clicks]));
    component.toggleSlip.subscribe(() => emitted.push('slip'));
    set(row);
  });

  afterEach(() => vi.useRealTimers());

  function set(model: LiveLoopRowModel): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }
  const byName = (name: string): HTMLButtonElement =>
    el.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  const control = (id: string): HTMLElement | null => el.querySelector(`[data-control="${id}"]`);
  const liveKey = (): HTMLButtonElement => byName('Live loop deck A');

  it('puts the Live loop key, the size control and the SLIP key in that order, with their control ids', () => {
    const order = Array.from(el.querySelectorAll('.row > *')).map(
      (child) => child.getAttribute('data-control') ?? child.tagName.toLowerCase()
    );
    expect(order).toEqual(['live-loop', 'lib-loop-size-control', 'slip']);

    for (const id of ['live-loop-size', 'live-loop-halve', 'live-loop-double']) {
      expect(control(id)).not.toBeNull();
    }
  });

  it('draws the size through the shared size control with the wheel on', () => {
    expect(el.querySelector('lib-loop-size-control .tag')?.textContent).toBe('Size');
    expect(control('live-loop-size')?.textContent).toContain('4 BEATS');

    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    control('live-loop-size')?.dispatchEvent(wheel);

    expect(emitted).toEqual([['wheel', 1]]);
    expect(wheel.defaultPrevented).toBe(true);
  });

  describe('the Live loop key', () => {
    it('pushes on pointer down, before release', () => {
      liveKey().dispatchEvent(pointer('pointerdown'));

      expect(emitted).toEqual(['toggle']);
    });

    it('leaves the loop running after a quick click', () => {
      liveKey().dispatchEvent(pointer('pointerdown'));
      vi.advanceTimersByTime(LIVE_LOOP_HOLD_MS - 1);
      liveKey().dispatchEvent(pointer('pointerup'));
      liveKey().click();

      expect(emitted).toEqual(['toggle']);
    });

    it('ends the loop it started on release after a hold', () => {
      liveKey().dispatchEvent(pointer('pointerdown'));
      vi.advanceTimersByTime(LIVE_LOOP_HOLD_MS);
      liveKey().dispatchEvent(pointer('pointerup'));

      expect(emitted).toEqual(['toggle', 'end']);
    });

    it('does not end on release when the press only toggled a running loop off', () => {
      set({ ...row, running: true });

      liveKey().dispatchEvent(pointer('pointerdown'));
      vi.advanceTimersByTime(LIVE_LOOP_HOLD_MS * 2);
      liveKey().dispatchEvent(pointer('pointerup'));

      expect(emitted).toEqual(['toggle']);
    });

    it('presses and holds from the keyboard, Enter and Space alike', () => {
      for (const key of ['Enter', ' ']) {
        emitted.length = 0;
        liveKey().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        vi.advanceTimersByTime(LIVE_LOOP_HOLD_MS);
        liveKey().dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        expect(emitted).toEqual(['toggle', 'end']);

        emitted.length = 0;
        liveKey().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        liveKey().dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        expect(emitted).toEqual(['toggle']);
      }
    });

    it('lights its state light while running', () => {
      expect(liveKey().getAttribute('data-state-light')).toBe('off');

      set({ ...row, running: true });

      expect(liveKey().getAttribute('data-state-light')).toBe('playing');
    });

    it('marks the tray as running while the loop runs', () => {
      expect(el.hasAttribute('data-running')).toBe(false);

      set({ ...row, running: true });

      expect(el.hasAttribute('data-running')).toBe(true);

      set(row);

      expect(el.hasAttribute('data-running')).toBe(false);
    });

    it('does nothing while the row is disabled', () => {
      set({ ...row, disabled: true });

      expect(liveKey().disabled).toBe(true);
      liveKey().dispatchEvent(pointer('pointerdown'));
      expect(emitted).toEqual([]);
    });
  });

  describe('the size control', () => {
    it('relays ½ and 2×', () => {
      byName('Halve live loop deck A').click();
      byName('Double live loop deck A').click();

      expect(emitted).toEqual(['halve', 'double']);
    });

    it('disables ½ and 2× alone at the ends of the ladder', () => {
      set({ ...row, canHalve: false });
      expect(byName('Halve live loop deck A').disabled).toBe(true);
      expect(byName('Double live loop deck A').disabled).toBe(false);

      set({ ...row, canDouble: false });
      expect(byName('Halve live loop deck A').disabled).toBe(false);
      expect(byName('Double live loop deck A').disabled).toBe(true);
    });

    it('relays a picked size in beats', () => {
      byName('Live loop size deck A, 4 BEATS').click();
      fixture.detectChanges();
      const item = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item')
      ).find((candidate) => candidate.textContent?.includes('2 BEATS'));
      item?.click();

      expect(emitted).toEqual([['pick', 2]]);
    });
  });

  describe('the SLIP key', () => {
    it('latches: pressed state follows the model and a press relays', () => {
      expect(byName('Slip deck A').getAttribute('aria-pressed')).toBe('false');

      byName('Slip deck A').click();
      set({ ...row, slip: true });

      expect(emitted).toEqual(['slip']);
      expect(byName('Slip deck A').getAttribute('aria-pressed')).toBe('true');
    });

    it('draws a ringed lamp when on and an empty ring when off', () => {
      const lamp = (): string | undefined =>
        byName('Slip deck A').querySelector('.icon')?.textContent?.trim();
      expect(lamp()).toBe('radio_button_unchecked');

      set({ ...row, slip: true });

      expect(lamp()).toBe('radio_button_checked');
    });
  });

  it('disables every control with the row', () => {
    set({ ...row, disabled: true });

    for (const button of Array.from(el.querySelectorAll('button'))) {
      expect(button.disabled).toBe(true);
    }
  });
});
