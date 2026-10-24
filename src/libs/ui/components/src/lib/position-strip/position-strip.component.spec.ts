import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ScrubBarState } from '../scrub-position-bar/scrub-position-bar.component';
import { PositionStripComponent } from './position-strip.component';

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

  /** Counts the lit segments, optionally of one tone. */
  function lit(tone?: string): number {
    const toneSelector = tone === undefined ? '' : `[data-tone="${tone}"]`;
    return fixture.nativeElement.querySelectorAll(`.segment[data-lit]${toneSelector}`).length;
  }

  function segmentCount(): number {
    return fixture.nativeElement.querySelectorAll('.segment').length;
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

  describe('lit segments', () => {
    it('draws 60 segments by default and none lit at the start', () => {
      expect(segmentCount()).toBe(60);
      expect(lit()).toBe(0);
    });

    it('lights segments from the start up to the position', () => {
      set('positionPercent', 50);
      expect(lit()).toBe(30);

      set('positionPercent', 100);
      expect(lit()).toBe(60);
    });

    it('follows the segment count it is given', () => {
      set('segments', 20);
      set('positionPercent', 50);

      expect(segmentCount()).toBe(20);
      expect(lit()).toBe(10);
    });

    it('clamps a position outside 0–100 and ignores one that is not a number', () => {
      set('positionPercent', 140);
      expect(lit()).toBe(60);

      set('positionPercent', -5);
      expect(lit()).toBe(0);

      set('positionPercent', Number.NaN);
      expect(lit()).toBe(0);
    });
  });

  describe('colouring by state', () => {
    beforeEach(() => set('positionPercent', 100));

    it('splits a loop into intro segments before the intro point and music after it', () => {
      set('barState', { kind: 'loop', introPercent: 25 } satisfies ScrubBarState);

      expect(lit('intro')).toBe(15);
      expect(lit('music')).toBe(45);
    });

    it('is all music for a loop from the top', () => {
      set('barState', { kind: 'loop', introPercent: 0 } satisfies ScrubBarState);

      expect(lit('intro')).toBe(0);
      expect(lit('music')).toBe(60);
    });

    it('goes dim after the music of an ended tune', () => {
      set('barState', { kind: 'ended', musicPercent: 70 } satisfies ScrubBarState);

      expect(lit('music')).toBe(42);
      expect(lit('dim')).toBe(18);
    });

    it('is all music when the structure is unknown', () => {
      set('barState', { kind: 'unknown' } satisfies ScrubBarState);

      expect(lit('music')).toBe(60);
    });

    it('is all dim while analyzing', () => {
      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);

      expect(lit('dim')).toBe(60);
      expect(lit('music')).toBe(0);
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

  describe('playhead', () => {
    function playhead(): HTMLElement | null {
      return fixture.nativeElement.querySelector('.playhead');
    }

    it('sits at the position, and is not drawn while analyzing', () => {
      set('positionPercent', 64);
      expect(playhead()?.style.left).toBe('64%');

      set('barState', { kind: 'analyzing' } satisfies ScrubBarState);
      expect(playhead()).toBeNull();
    });
  });
});
