import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import { PositionStripComponent, type PositionMark } from './position-strip.component';

/** Stands in for the browser's observer, and lets a test say how wide the track is. */
class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this;
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** Reports the observed track as `width` CSS pixels wide. */
  resize(width: number): void {
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
}

describe('PositionStripComponent', () => {
  let fixture: ComponentFixture<PositionStripComponent>;
  let inputs: number[];
  let commits: number[];

  beforeEach(async () => {
    FakeResizeObserver.last = null;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    await TestBed.configureTestingModule({ imports: [PositionStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(PositionStripComponent);
    fixture.componentRef.setInput('barState', { kind: 'unknown' } satisfies ScrubBarState);
    fixture.componentRef.setInput('accessibleName', 'Position deck A');
    inputs = [];
    commits = [];
    fixture.componentInstance.scrubInput.subscribe((value) => inputs.push(value));
    fixture.componentInstance.scrubCommit.subscribe((value) => commits.push(value));
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function set(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  function range(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  function drag(to: number, event: 'input' | 'change'): void {
    range().value = String(to);
    range().dispatchEvent(new Event(event, { bubbles: true }));
  }

  /** Sets the position the way a painter does: straight on the component, outside change
   *  detection. */
  function live(percent: number): void {
    fixture.componentInstance.setLivePosition(percent);
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function track(): HTMLElement {
    return fixture.nativeElement.querySelector('.track');
  }

  function fills(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.fill'));
  }

  /** How long the lit bar is, and where the playhead sits: both read it from the track. */
  function position(): string {
    return track().style.getPropertyValue('--playhead-position');
  }

  /** How far the lit bar's first colour reaches, as a share of the whole track. */
  function fillSplit(): string {
    return track().style.getPropertyValue('--fill-split');
  }

  function loopMark(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.loop-mark');
  }

  describe('scrubbing', () => {
    it('maps input to scrubInput and never to a commit', () => {
      drag(37, 'input');

      expect(inputs).toEqual([37]);
      expect(commits).toEqual([]);
    });

    it('is continuous, and emits a fractional drag value as it is', () => {
      expect(range().getAttribute('step')).toBe('any');

      drag(42.5, 'input');
      drag(42.5, 'change');

      expect(inputs).toEqual([42.5]);
      expect(commits).toEqual([42.5]);
    });

    it('maps change to scrubCommit and never to a preview', () => {
      drag(80, 'change');

      expect(commits).toEqual([80]);
      expect(inputs).toEqual([]);
    });

    it('is a 0–100 range that starts at 0 and shows the position it is given', () => {
      expect(range().min).toBe('0');
      expect(range().max).toBe('100');
      expect(range().value).toBe('0');

      live(42);
      expect(range().value).toBe('42');
    });

    it('writes only a changed position, and keeps it through change detection', () => {
      live(42);
      range().value = '77';

      live(42);
      expect(range().value).toBe('77');

      live(43);
      set('marks', []);
      expect(range().value).toBe('43');
      expect(position()).toBe('43%');
    });

    it('is disabled while analyzing and enabled otherwise', () => {
      expect(range().disabled).toBe(false);

      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);
      expect(range().disabled).toBe(true);

      set('barState', { kind: 'loop', introPercent: 10 } satisfies ScrubBarState);
      expect(range().disabled).toBe(false);
    });

    it('names the slider and says its position as time when given a value text', () => {
      expect(range().getAttribute('aria-label')).toBe('Position deck A');
      expect(range().hasAttribute('aria-valuetext')).toBe(false);

      fixture.componentInstance.setLiveValueText('01:23.4 of 03:12');
      expect(range().getAttribute('aria-valuetext')).toBe('01:23.4 of 03:12');

      set('accessibleName', 'Position deck B');
      expect(range().getAttribute('aria-valuetext')).toBe('01:23.4 of 03:12');
    });
  });

  describe('lit bar', () => {
    it('is empty at the start', () => {
      expect(position()).toBe('0%');
    });

    it('is as long as the position, including a fractional one', () => {
      live(50);
      expect(position()).toBe('50%');

      live(42.5);
      expect(position()).toBe('42.5%');
    });

    it('is two tones taking their length from the track, never from a style of their own', () => {
      live(50);

      expect(fills()).toHaveLength(2);
      for (const tone of fills()) {
        expect(tone.getAttribute('style')).toBeNull();
      }
    });

    it('writes nothing on the host, so a new position restyles only the track', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);
      live(50);

      expect(host().getAttribute('style')).toBeNull();
    });

    it('clamps a position outside 0–100 and ignores one that is not a number', () => {
      live(140);
      expect(position()).toBe('100%');
      expect(range().value).toBe('100');

      live(-5);
      expect(position()).toBe('0%');

      live(60);
      live(Number.NaN);
      expect(position()).toBe('0%');
    });

    it('is not drawn while analyzing', () => {
      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);

      expect(fills()).toEqual([]);
    });
  });

  describe('pixel steps', () => {
    it('watches the track, and stops when the strip goes', () => {
      expect(FakeResizeObserver.last?.observed).toEqual([track()]);

      fixture.destroy();

      expect(FakeResizeObserver.last?.disconnected).toBe(true);
    });

    it('moves by whole pixels of the track once it is measured', () => {
      FakeResizeObserver.last?.resize(200);

      live(42.3);
      expect(position()).toBe('42.5%');
      expect(range().value).toBe('42.5');
    });

    it('writes nothing for a move inside the same pixel', () => {
      FakeResizeObserver.last?.resize(200);
      live(42.3);
      range().value = '77';

      live(42.6);

      expect(range().value).toBe('77');
      expect(position()).toBe('42.5%');
    });

    it('counts device pixels, not CSS pixels', () => {
      vi.stubGlobal('devicePixelRatio', 2);
      FakeResizeObserver.last?.resize(200);

      live(42.3);

      expect(position()).toBe('42.25%');
    });

    it('lands exactly on the end', () => {
      FakeResizeObserver.last?.resize(300);

      live(99.9);

      expect(position()).toBe('100%');
    });
  });

  describe('colouring by state', () => {
    beforeEach(() => live(100));

    it('changes colour at the intro point of a loop', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);

      expect(fillSplit()).toBe('25%');
    });

    it('changes colour at the end of the music of an ended tune', () => {
      set('barState', { kind: 'ended', musicPercent: 70 } satisfies ScrubBarState);

      expect(fillSplit()).toBe('70%');
    });

    it('measures the change against the whole track, not the lit bar', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);
      live(50);

      expect(fillSplit()).toBe('25%');
    });

    it('stays one colour while the position has not reached the change', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);
      live(0);
      expect(fillSplit()).toBe('0%');

      live(20);
      expect(fillSplit()).toBe('20%');
    });

    it('is one colour when the structure is unknown', () => {
      set('barState', { kind: 'unknown' } satisfies ScrubBarState);
      live(60);

      expect(fillSplit()).toBe('60%');
    });
  });

  describe('loop mark', () => {
    it('sits at the intro point for a loop, including 0 for a loop from the top', () => {
      set('barState', { kind: 'loop', introPercent: 30 } satisfies ScrubBarState);
      expect(loopMark()?.style.left).toBe('30%');

      set('barState', { kind: 'loop', introPercent: 0 } satisfies ScrubBarState);
      expect(loopMark()?.style.left).toBe('0%');
    });

    it.each<ScrubBarState>([
      { kind: 'ended', musicPercent: 70 },
      { kind: 'unknown' },
      { kind: 'analyzing' },
    ])('is absent for %j, where there is no loop point', (state) => {
      set('barState', state);

      expect(loopMark()).toBeNull();
    });
  });

  describe('marks', () => {
    const loop: PositionMark = {
      id: 'a',
      kind: 'loop',
      startPercent: 20,
      endPercent: 35,
      activity: 'idle',
      selected: false,
    };
    const cue: PositionMark = {
      id: 'b',
      kind: 'cue',
      startPercent: 60,
      endPercent: null,
      activity: 'idle',
      selected: false,
    };

    function lane(): HTMLElement | null {
      return fixture.nativeElement.querySelector('.lane');
    }

    function marks(): HTMLElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.lane .mark'));
    }

    it('keeps its old structure and reserves no lane while marks is null', () => {
      expect(lane()).toBeNull();
      expect(fixture.nativeElement.hasAttribute('data-marks')).toBe(false);
      expect(Array.from<Element>(fixture.nativeElement.children).map((el) => el.tagName)).toEqual([
        'INPUT',
        'DIV',
      ]);
    });

    it('reserves the lane for an empty list, with no marks in it', () => {
      set('marks', []);

      expect(lane()).not.toBeNull();
      expect(fixture.nativeElement.hasAttribute('data-marks')).toBe(true);
      expect(marks()).toEqual([]);
    });

    it('draws a loop as a bracket from start to end, and a cue as a tick at its start', () => {
      set('marks', [loop, cue]);

      const [bracket, tick] = marks();
      expect(bracket.dataset['kind']).toBe('loop');
      expect(bracket.style.left).toBe('20%');
      expect(bracket.style.width).toBe('15%');
      expect(tick.dataset['kind']).toBe('cue');
      expect(tick.style.left).toBe('60%');
      expect(tick.style.width).toBe('');
    });

    it('carries each mark’s activity and selection', () => {
      set('marks', [
        { ...loop, id: 'q', activity: 'queued' },
        { ...loop, id: 'r', activity: 'running', selected: true },
        { ...cue, selected: true },
      ]);

      const [queued, running, selectedCue] = marks();
      expect(queued.dataset['activity']).toBe('queued');
      expect(queued.hasAttribute('data-selected')).toBe(false);
      expect(running.dataset['activity']).toBe('running');
      expect(running.hasAttribute('data-selected')).toBe(true);
      expect(selectedCue.hasAttribute('data-selected')).toBe(true);
    });

    it('holds a mark outside 0–100 on the track and never draws a negative width', () => {
      set('marks', [
        { ...loop, startPercent: -10, endPercent: 140 },
        { ...loop, id: 'c', startPercent: 50, endPercent: 40 },
      ]);

      const [wide, reversed] = marks();
      expect(wide.style.left).toBe('0%');
      expect(wide.style.width).toBe('100%');
      expect(reversed.style.width).toBe('0%');
    });

    it('is hidden from assistive technology', () => {
      set('marks', [loop]);

      expect(lane()?.getAttribute('aria-hidden')).toBe('true');
    });

    it('still scrubs through the range with marks present', () => {
      set('marks', [loop]);

      drag(55, 'input');
      drag(55, 'change');

      expect(inputs).toEqual([55]);
      expect(commits).toEqual([55]);
      expect(range().disabled).toBe(false);
    });
  });

  describe('playhead', () => {
    function playhead(): HTMLElement | null {
      return fixture.nativeElement.querySelector('.playhead');
    }

    it('sits at a fractional position as it is, and is not drawn while analyzing', () => {
      live(64.25);
      expect(position()).toBe('64.25%');
      expect(playhead()?.getAttribute('style')).toBeNull();

      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);
      expect(playhead()).toBeNull();
    });

    it('comes back at the position it last had once analyzing ends', () => {
      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);
      live(30);

      set('barState', { kind: 'unknown' } satisfies ScrubBarState);

      expect(playhead()).not.toBeNull();
      expect(position()).toBe('30%');
    });

    it('carries data-held only while held', () => {
      expect(playhead()?.hasAttribute('data-held')).toBe(false);

      set('held', true);
      expect(playhead()?.hasAttribute('data-held')).toBe(true);

      set('held', false);
      expect(playhead()?.hasAttribute('data-held')).toBe(false);
    });
  });
});
