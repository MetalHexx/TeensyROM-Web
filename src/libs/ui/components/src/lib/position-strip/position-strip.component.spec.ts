import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import { PositionStripComponent, type PositionMark } from './position-strip.component';

describe('PositionStripComponent', () => {
  let fixture: ComponentFixture<PositionStripComponent>;
  let inputs: number[];
  let commits: number[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PositionStripComponent] }).compileComponents();
    fixture = TestBed.createComponent(PositionStripComponent);
    fixture.componentRef.setInput('barState', { kind: 'unknown' } satisfies ScrubBarState);
    fixture.componentRef.setInput('positionPercent', 0);
    fixture.componentRef.setInput('accessibleName', 'Position deck A');
    inputs = [];
    commits = [];
    fixture.componentInstance.scrubInput.subscribe((value) => inputs.push(value));
    fixture.componentInstance.scrubCommit.subscribe((value) => commits.push(value));
    fixture.detectChanges();
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

  function fill(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.fill');
  }

  function fillSplit(): string {
    return fill()?.style.getPropertyValue('--fill-split') ?? '';
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

    it('is a 0–100 range that shows the position it is given', () => {
      set('positionPercent', 42);

      expect(range().min).toBe('0');
      expect(range().max).toBe('100');
      expect(range().value).toBe('42');
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

      set('valueText', '01:23.4 of 03:12');
      expect(range().getAttribute('aria-valuetext')).toBe('01:23.4 of 03:12');
    });
  });

  describe('lit bar', () => {
    it('is empty at the start', () => {
      expect(fill()?.style.width).toBe('0%');
    });

    it('is as long as the position, including a fractional one', () => {
      set('positionPercent', 50);
      expect(fill()?.style.width).toBe('50%');

      set('positionPercent', 42.5);
      expect(fill()?.style.width).toBe('42.5%');
    });

    it('clamps a position outside 0–100 and ignores one that is not a number', () => {
      set('positionPercent', 140);
      expect(fill()?.style.width).toBe('100%');

      set('positionPercent', -5);
      expect(fill()?.style.width).toBe('0%');

      set('positionPercent', Number.NaN);
      expect(fill()?.style.width).toBe('0%');
    });

    it('is not drawn while analyzing', () => {
      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);

      expect(fill()).toBeNull();
    });
  });

  describe('colouring by state', () => {
    beforeEach(() => set('positionPercent', 100));

    it('changes colour at the intro point of a loop', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);

      expect(fillSplit()).toBe('25%');
    });

    it('changes colour at the end of the music of an ended tune', () => {
      set('barState', { kind: 'ended', musicPercent: 70 } satisfies ScrubBarState);

      expect(fillSplit()).toBe('70%');
    });

    it('measures the change against the lit bar, not the whole strip', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);
      set('positionPercent', 50);

      expect(fillSplit()).toBe('50%');
    });

    it('stays one colour while the position has not reached the change', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);
      set('positionPercent', 0);
      expect(fillSplit()).toBe('100%');

      set('positionPercent', 20);
      expect(fillSplit()).toBe('100%');
    });

    it('is one colour when the structure is unknown', () => {
      set('barState', { kind: 'unknown' } satisfies ScrubBarState);

      expect(fillSplit()).toBe('100%');
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
      set('positionPercent', 64.25);
      expect(playhead()?.style.left).toBe('64.25%');

      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);
      expect(playhead()).toBeNull();
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
