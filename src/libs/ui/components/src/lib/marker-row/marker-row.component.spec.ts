import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkerRowComponent, MarkerRowModel } from './marker-row.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';

function slotModel(side: 'start' | 'end', overrides: Partial<MarkerSlotModel> = {}): MarkerSlotModel {
  return {
    frameLabel: side === 'start' ? 'frame 460' : 'frame 780',
    offsetLabel: '+0 fr',
    nudgeValue: 0,
    nudgeRange: 50,
    tickOffsets: [],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge marker 1 ${side} deck A`,
    previousAccessibleName: `Snap marker 1 ${side} to previous moment deck A`,
    nextAccessibleName: `Snap marker 1 ${side} to next moment deck A`,
    ...overrides,
  };
}

function testModel(overrides: Partial<MarkerRowModel> = {}): MarkerRowModel {
  return {
    number: '1',
    state: 'idle',
    triggerDisabled: false,
    deleteDisabled: false,
    loopLengthLabel: 'Loop Length: 320 fr',
    start: slotModel('start'),
    end: slotModel('end'),
    triggerAccessibleName: 'Trigger marker 1 deck A',
    setEndAccessibleName: 'Set end for marker 1 deck A',
    revertAccessibleName: 'Revert marker 1 to cue deck A',
    deleteAccessibleName: 'Delete marker 1 deck A',
    ...overrides,
  };
}

describe('MarkerRowComponent', () => {
  let fixture: ComponentFixture<MarkerRowComponent>;
  let component: MarkerRowComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MarkerRowComponent] }).compileComponents();

    fixture = TestBed.createComponent(MarkerRowComponent);
    component = fixture.componentInstance;
  });

  function setModel(model: MarkerRowModel): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }

  function byLabel<T extends Element>(label: string): T {
    const element = fixture.nativeElement.querySelector(`[aria-label="${label}"]`);
    if (!element) throw new Error(`no element labelled ${label}`);
    return element as T;
  }

  describe('header controls', () => {
    beforeEach(() => setModel(testModel()));

    it('emits trigger on the Trigger button', () => {
      const emitted: void[] = [];
      component.trigger.subscribe(() => emitted.push(undefined));

      byLabel<HTMLButtonElement>('Trigger marker 1 deck A').click();

      expect(emitted.length).toBe(1);
    });

    it('emits setEnd on the Set End button', () => {
      const emitted: void[] = [];
      component.setEnd.subscribe(() => emitted.push(undefined));

      byLabel<HTMLButtonElement>('Set end for marker 1 deck A').click();

      expect(emitted.length).toBe(1);
    });

    it('emits clearEnd on the Revert button when an end is present', () => {
      const emitted: void[] = [];
      component.clearEnd.subscribe(() => emitted.push(undefined));

      byLabel<HTMLButtonElement>('Revert marker 1 to cue deck A').click();

      expect(emitted.length).toBe(1);
    });

    it('emits delete on the Delete button', () => {
      const emitted: void[] = [];
      component.delete.subscribe(() => emitted.push(undefined));

      byLabel<HTMLButtonElement>('Delete marker 1 deck A').click();

      expect(emitted.length).toBe(1);
    });

    it('shows the loop length caption when loopLengthLabel is set', () => {
      expect(fixture.nativeElement.querySelector('.marker-loop-length').textContent.trim()).toBe(
        'Loop Length: 320 fr'
      );
    });

    it('hides the loop length caption when loopLengthLabel is null', () => {
      setModel(testModel({ loopLengthLabel: null }));

      expect(fixture.nativeElement.querySelector('.marker-loop-length')).toBeNull();
    });
  });

  describe('data-marker-state', () => {
    it('tracks state on the host element', () => {
      setModel(testModel({ state: 'active' }));
      expect(fixture.nativeElement.getAttribute('data-marker-state')).toBe('active');

      setModel(testModel({ state: 'queued' }));
      expect(fixture.nativeElement.getAttribute('data-marker-state')).toBe('queued');

      setModel(testModel({ state: 'idle' }));
      expect(fixture.nativeElement.getAttribute('data-marker-state')).toBe('idle');
    });
  });

  describe('start slot outputs', () => {
    beforeEach(() => setModel(testModel()));

    it('emits startNudgeInput and startNudgeCommit from the start nudge slider', () => {
      const inputEmitted: number[] = [];
      const commitEmitted: number[] = [];
      component.startNudgeInput.subscribe((v) => inputEmitted.push(v));
      component.startNudgeCommit.subscribe((v) => commitEmitted.push(v));

      const slider = byLabel<HTMLInputElement>('Nudge marker 1 start deck A');
      slider.value = '5';
      slider.dispatchEvent(new Event('input'));
      slider.value = '9';
      slider.dispatchEvent(new Event('change'));

      expect(inputEmitted).toEqual([5]);
      expect(commitEmitted).toEqual([9]);
    });

    it('emits startSnapPrevious and startSnapNext from the start snap buttons', () => {
      const previousEmitted: void[] = [];
      const nextEmitted: void[] = [];
      component.startSnapPrevious.subscribe(() => previousEmitted.push(undefined));
      component.startSnapNext.subscribe(() => nextEmitted.push(undefined));

      byLabel<HTMLButtonElement>('Snap marker 1 start to previous moment deck A').click();
      byLabel<HTMLButtonElement>('Snap marker 1 start to next moment deck A').click();

      expect(previousEmitted.length).toBe(1);
      expect(nextEmitted.length).toBe(1);
    });
  });

  describe('end slot outputs', () => {
    beforeEach(() => setModel(testModel()));

    it('emits endNudgeInput and endNudgeCommit from the end nudge slider', () => {
      const inputEmitted: number[] = [];
      const commitEmitted: number[] = [];
      component.endNudgeInput.subscribe((v) => inputEmitted.push(v));
      component.endNudgeCommit.subscribe((v) => commitEmitted.push(v));

      const slider = byLabel<HTMLInputElement>('Nudge marker 1 end deck A');
      slider.value = '-3';
      slider.dispatchEvent(new Event('input'));
      slider.value = '-8';
      slider.dispatchEvent(new Event('change'));

      expect(inputEmitted).toEqual([-3]);
      expect(commitEmitted).toEqual([-8]);
    });

    it('emits endSnapPrevious and endSnapNext from the end snap buttons', () => {
      const previousEmitted: void[] = [];
      const nextEmitted: void[] = [];
      component.endSnapPrevious.subscribe(() => previousEmitted.push(undefined));
      component.endSnapNext.subscribe(() => nextEmitted.push(undefined));

      byLabel<HTMLButtonElement>('Snap marker 1 end to previous moment deck A').click();
      byLabel<HTMLButtonElement>('Snap marker 1 end to next moment deck A').click();

      expect(previousEmitted.length).toBe(1);
      expect(nextEmitted.length).toBe(1);
    });
  });

  describe('empty end', () => {
    beforeEach(() => setModel(testModel({ end: null })));

    it("renders the end slot's empty variant", () => {
      expect(fixture.nativeElement.querySelector('.marker-frame--empty')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('lib-marker-slot').length).toBe(2);
    });

    it('renders a disabled, aria-hidden, tabindex="-1" Revert placeholder instead of the real one', () => {
      const revert = fixture.nativeElement.querySelector(
        '.marker-end-revert'
      ) as HTMLButtonElement;

      expect(revert.classList.contains('marker-end-revert--empty')).toBe(true);
      expect(revert.disabled).toBe(true);
      expect(revert.getAttribute('aria-hidden')).toBe('true');
      expect(revert.getAttribute('tabindex')).toBe('-1');
    });

    it('emits nothing on the placeholder Revert', () => {
      const emitted: void[] = [];
      component.clearEnd.subscribe(() => emitted.push(undefined));

      fixture.nativeElement.querySelector('.marker-end-revert').click();

      expect(emitted).toEqual([]);
    });
  });

  describe('progress fill', () => {
    it("tracks progressPercent independently of model", () => {
      setModel(testModel());
      fixture.componentRef.setInput('progressPercent', 37);
      fixture.detectChanges();

      const fill = fixture.nativeElement.querySelector('.marker-progress-fill') as HTMLElement;
      expect(fill.style.width).toBe('37%');

      fixture.componentRef.setInput('progressPercent', 82);
      fixture.detectChanges();
      expect(fill.style.width).toBe('82%');
    });
  });
});
