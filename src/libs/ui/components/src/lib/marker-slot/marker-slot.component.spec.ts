import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkerSlotComponent, MarkerSlotModel } from './marker-slot.component';

function testModel(overrides: Partial<MarkerSlotModel> = {}): MarkerSlotModel {
  return {
    frameLabel: 'frame 460',
    offsetLabel: '+0 fr',
    nudgeValue: 0,
    nudgeRange: 50,
    tickOffsets: [],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: 'Nudge marker 1 start deck A',
    previousAccessibleName: 'Snap marker 1 start to previous moment deck A',
    nextAccessibleName: 'Snap marker 1 start to next moment deck A',
    ...overrides,
  };
}

describe('MarkerSlotComponent', () => {
  let fixture: ComponentFixture<MarkerSlotComponent>;
  let component: MarkerSlotComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MarkerSlotComponent] }).compileComponents();

    fixture = TestBed.createComponent(MarkerSlotComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tag', 'Start');
  });

  function setModel(model: MarkerSlotModel | null): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }

  function rangeInput(): HTMLInputElement | null {
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  function ticks(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.marker-tick'));
  }

  describe('tick placement', () => {
    it('places offset 0 at 50%', () => {
      setModel(testModel({ nudgeRange: 50, tickOffsets: [0] }));

      expect(Number(ticks()[0].style.left.replace('%', ''))).toBe(50);
    });

    it('places the negative extreme at 0% and the positive extreme at 100%', () => {
      setModel(testModel({ nudgeRange: 50, tickOffsets: [-50, 50] }));

      const [negative, positive] = ticks();
      expect(Number(negative.style.left.replace('%', ''))).toBe(0);
      expect(Number(positive.style.left.replace('%', ''))).toBe(100);
    });

    it('collapses every tick to 50% when nudgeRange is 0', () => {
      setModel(testModel({ nudgeRange: 0, tickOffsets: [0] }));

      expect(Number(ticks()[0].style.left.replace('%', ''))).toBe(50);
    });
  });

  describe('nudge slider', () => {
    beforeEach(() => setModel(testModel()));

    it('emits nudgeInput on input, carrying the numeric value', () => {
      const emitted: number[] = [];
      component.nudgeInput.subscribe((v) => emitted.push(v));

      const input = rangeInput() as HTMLInputElement;
      input.value = '12';
      input.dispatchEvent(new Event('input'));

      expect(emitted).toEqual([12]);
    });

    it('emits nudgeCommit only on change, carrying the numeric value', () => {
      const inputEmitted: number[] = [];
      const commitEmitted: number[] = [];
      component.nudgeInput.subscribe((v) => inputEmitted.push(v));
      component.nudgeCommit.subscribe((v) => commitEmitted.push(v));

      const input = rangeInput() as HTMLInputElement;
      input.value = '-7';
      input.dispatchEvent(new Event('change'));

      expect(commitEmitted).toEqual([-7]);
      expect(inputEmitted).toEqual([]);
    });
  });

  describe('empty variant', () => {
    beforeEach(() => setModel(null));

    it('renders no range input', () => {
      expect(rangeInput()).toBeNull();
    });

    it('renders the empty caption and em-dash offset', () => {
      expect(fixture.nativeElement.querySelector('.marker-frame--empty').textContent.trim()).toBe(
        'empty'
      );
      expect(fixture.nativeElement.querySelector('.marker-offset--empty').textContent.trim()).toBe(
        '—'
      );
    });

    it('disables both snap buttons and emits nothing when clicked', () => {
      const previousEmitted: void[] = [];
      const nextEmitted: void[] = [];
      component.snapPrevious.subscribe(() => previousEmitted.push(undefined));
      component.snapNext.subscribe(() => nextEmitted.push(undefined));

      const buttons = fixture.nativeElement.querySelectorAll(
        'button.marker-snap'
      ) as NodeListOf<HTMLButtonElement>;
      expect(buttons.length).toBe(2);
      buttons.forEach((button) => {
        expect(button.disabled).toBe(true);
        button.click();
      });

      expect(previousEmitted).toEqual([]);
      expect(nextEmitted).toEqual([]);
    });

    it('still renders the tag outside the empty model', () => {
      expect(fixture.nativeElement.querySelector('.marker-sub-tag').textContent.trim()).toBe(
        'Start'
      );
    });
  });
});
