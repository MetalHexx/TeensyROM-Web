import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ScrubBarState, ScrubPositionBarComponent } from './scrub-position-bar.component';

describe('ScrubPositionBarComponent', () => {
  let fixture: ComponentFixture<ScrubPositionBarComponent>;
  let component: ScrubPositionBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrubPositionBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScrubPositionBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('positionPercent', 0);
    fixture.componentRef.setInput('accessibleName', 'Position deck A');
    fixture.componentRef.setInput('barState', { kind: 'unknown' } satisfies ScrubBarState);
    fixture.detectChanges();
  });

  function setState(state: ScrubBarState): void {
    fixture.componentRef.setInput('barState', state);
    fixture.detectChanges();
  }

  function rangeInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  function regionWidth(modifier: string): number | null {
    const region = fixture.nativeElement.querySelector(`.scrub-region--${modifier}`) as HTMLElement | null;
    return region ? Number(region.style.width.replace('%', '')) : null;
  }

  function tick(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.scrub-tick');
  }

  describe('region derivations', () => {
    it('draws only the music region, full width, for a loop with introPercent 0', () => {
      setState({ kind: 'loop', introPercent: 0 });

      expect(fixture.nativeElement.querySelector('.scrub-region--intro')).toBeNull();
      expect(regionWidth('music')).toBe(100);
    });

    it('splits intro/music by introPercent for a loop with a non-zero intro', () => {
      setState({ kind: 'loop', introPercent: 30 });

      expect(regionWidth('intro')).toBe(30);
      expect(regionWidth('music')).toBe(70);
    });

    it('splits music/dead to 100 for an ended tune', () => {
      setState({ kind: 'ended', musicPercent: 65 });

      expect(regionWidth('music')).toBe(65);
      expect(regionWidth('dead')).toBe(35);
    });

    it('renders a single hatched region for unknown, with no other regions', () => {
      setState({ kind: 'unknown' });

      expect(fixture.nativeElement.querySelector('.scrub-region--unknown')).not.toBeNull();
      expect(regionWidth('music')).toBeNull();
      expect(regionWidth('intro')).toBeNull();
      expect(regionWidth('dead')).toBeNull();
    });

    it('renders a single pending region for analyzing, with no other regions', () => {
      setState({ kind: 'analyzing' });

      expect(fixture.nativeElement.querySelector('.scrub-region--pending')).not.toBeNull();
      expect(regionWidth('music')).toBeNull();
    });
  });

  describe('loop tick', () => {
    it('renders the tick only for the loop state', () => {
      setState({ kind: 'loop', introPercent: 20 });
      expect(tick()).not.toBeNull();

      setState({ kind: 'ended', musicPercent: 50 });
      expect(tick()).toBeNull();

      setState({ kind: 'unknown' });
      expect(tick()).toBeNull();

      setState({ kind: 'analyzing' });
      expect(tick()).toBeNull();
    });

    it('positions the tick at introPercent, including 0 for a loop-from-top', () => {
      setState({ kind: 'loop', introPercent: 0 });

      expect(Number(tick()?.style.left.replace('%', ''))).toBe(0);
    });
  });

  describe('range input', () => {
    it('emits scrubInput on every input tick, carrying the numeric value', () => {
      setState({ kind: 'unknown' });
      const emitted: number[] = [];
      component.scrubInput.subscribe((v) => emitted.push(v));

      const input = rangeInput();
      input.value = '42';
      input.dispatchEvent(new Event('input'));

      expect(emitted).toEqual([42]);
    });

    it('emits scrubCommit only on change, carrying the numeric value', () => {
      setState({ kind: 'unknown' });
      const inputEmitted: number[] = [];
      const commitEmitted: number[] = [];
      component.scrubInput.subscribe((v) => inputEmitted.push(v));
      component.scrubCommit.subscribe((v) => commitEmitted.push(v));

      const input = rangeInput();
      input.value = '73';
      input.dispatchEvent(new Event('change'));

      expect(commitEmitted).toEqual([73]);
      expect(inputEmitted).toEqual([]);
    });

    it('reflects positionPercent rather than any local drag state', () => {
      fixture.componentRef.setInput('positionPercent', 55);
      fixture.detectChanges();

      expect(rangeInput().value).toBe('55');
    });

    it('is disabled only while analyzing', () => {
      setState({ kind: 'analyzing' });
      expect(rangeInput().disabled).toBe(true);

      setState({ kind: 'unknown' });
      expect(rangeInput().disabled).toBe(false);

      setState({ kind: 'loop', introPercent: 10 });
      expect(rangeInput().disabled).toBe(false);

      setState({ kind: 'ended', musicPercent: 40 });
      expect(rangeInput().disabled).toBe(false);
    });

    it('names itself from the caller-supplied accessible name', () => {
      expect(rangeInput().getAttribute('aria-label')).toBe('Position deck A');
    });
  });
});
