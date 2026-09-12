import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoopsCuesPanelComponent,
  type LoopsCuesPanelModel,
  type MarkerRowAction,
} from './loops-cues-panel.component';
import type { MarkerRowModel } from '../marker-row/marker-row.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';

function slotModel(number: number, side: 'start' | 'end'): MarkerSlotModel {
  return {
    frameLabel: side === 'start' ? 'frame 460' : 'frame 780',
    offsetLabel: '+0 fr',
    nudgeValue: 0,
    nudgeRange: 50,
    tickOffsets: [],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge marker ${number} ${side} deck A`,
    previousAccessibleName: `Snap marker ${number} ${side} to previous moment deck A`,
    nextAccessibleName: `Snap marker ${number} ${side} to next moment deck A`,
  };
}

function rowModel(number: number, overrides: Partial<MarkerRowModel> = {}): MarkerRowModel {
  return {
    number: String(number),
    state: 'idle',
    triggerDisabled: false,
    deleteDisabled: false,
    loopLengthLabel: null,
    start: slotModel(number, 'start'),
    end: slotModel(number, 'end'),
    triggerAccessibleName: `Trigger marker ${number} deck A`,
    setEndAccessibleName: `Set end for marker ${number} deck A`,
    revertAccessibleName: `Revert marker ${number} to cue deck A`,
    deleteAccessibleName: `Delete marker ${number} deck A`,
    ...overrides,
  };
}

function panelModel(rows: readonly MarkerRowModel[]): LoopsCuesPanelModel {
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    rows,
  };
}

describe('LoopsCuesPanelComponent', () => {
  let fixture: ComponentFixture<LoopsCuesPanelComponent>;
  let component: LoopsCuesPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoopsCuesPanelComponent] }).compileComponents();

    fixture = TestBed.createComponent(LoopsCuesPanelComponent);
    component = fixture.componentInstance;
  });

  function setModel(model: LoopsCuesPanelModel): void {
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  }

  function byLabel<T extends Element>(label: string): T {
    const element = fixture.nativeElement.querySelector(`[aria-label="${label}"]`);
    if (!element) throw new Error(`no element labelled ${label}`);
    return element as T;
  }

  function actions(): { index: number; action: MarkerRowAction; value?: number }[] {
    const emitted: { index: number; action: MarkerRowAction; value?: number }[] = [];
    component.rowAction.subscribe((event) => emitted.push(event));
    return emitted;
  }

  it('renders one marker row per model entry', () => {
    setModel(panelModel([rowModel(1), rowModel(2), rowModel(3)]));

    expect(fixture.nativeElement.querySelectorAll('lib-marker-row').length).toBe(3);

    setModel(panelModel([]));

    expect(fixture.nativeElement.querySelectorAll('lib-marker-row').length).toBe(0);
  });

  it('emits addMarker and stopLoop from the header controls', () => {
    setModel(panelModel([]));
    const added: void[] = [];
    const stopped: void[] = [];
    component.addMarker.subscribe(() => added.push(undefined));
    component.stopLoop.subscribe(() => stopped.push(undefined));

    byLabel<HTMLButtonElement>('Add marker deck A').click();
    byLabel<HTMLButtonElement>('Stop loop deck A').click();

    expect(added.length).toBe(1);
    expect(stopped.length).toBe(1);
  });

  it("re-emits a row's valueless outputs as rowAction, carrying that row's own index", () => {
    setModel(panelModel([rowModel(1), rowModel(2)]));
    const emitted = actions();

    byLabel<HTMLButtonElement>('Trigger marker 2 deck A').click();
    byLabel<HTMLButtonElement>('Set end for marker 2 deck A').click();
    byLabel<HTMLButtonElement>('Revert marker 1 to cue deck A').click();
    byLabel<HTMLButtonElement>('Delete marker 1 deck A').click();
    byLabel<HTMLButtonElement>('Snap marker 2 start to previous moment deck A').click();
    byLabel<HTMLButtonElement>('Snap marker 2 start to next moment deck A').click();
    byLabel<HTMLButtonElement>('Snap marker 1 end to previous moment deck A').click();
    byLabel<HTMLButtonElement>('Snap marker 1 end to next moment deck A').click();

    expect(emitted.map(({ index, action }) => ({ index, action }))).toEqual([
      { index: 1, action: 'trigger' },
      { index: 1, action: 'setEnd' },
      { index: 0, action: 'clearEnd' },
      { index: 0, action: 'delete' },
      { index: 1, action: 'startSnapPrevious' },
      { index: 1, action: 'startSnapNext' },
      { index: 0, action: 'endSnapPrevious' },
      { index: 0, action: 'endSnapNext' },
    ]);
  });

  it("re-emits a row's nudge drags and releases with the dragged frame offset", () => {
    setModel(panelModel([rowModel(1), rowModel(2)]));
    const emitted = actions();

    const startSlider = byLabel<HTMLInputElement>('Nudge marker 2 start deck A');
    startSlider.value = '7';
    startSlider.dispatchEvent(new Event('input'));
    startSlider.value = '12';
    startSlider.dispatchEvent(new Event('change'));

    const endSlider = byLabel<HTMLInputElement>('Nudge marker 1 end deck A');
    endSlider.value = '-4';
    endSlider.dispatchEvent(new Event('input'));
    endSlider.value = '-9';
    endSlider.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([
      { index: 1, action: 'startNudgeInput', value: 7 },
      { index: 1, action: 'startNudgeCommit', value: 12 },
      { index: 0, action: 'endNudgeInput', value: -4 },
      { index: 0, action: 'endNudgeCommit', value: -9 },
    ]);
  });

  it('forwards each index-aligned progress percent to its own row, defaulting a missing one to zero', () => {
    setModel(panelModel([rowModel(1), rowModel(2)]));
    fixture.componentRef.setInput('rowProgressPercents', [63]);
    fixture.detectChanges();

    const fills = fixture.nativeElement.querySelectorAll('.marker-progress-fill');
    expect((fills[0] as HTMLElement).style.width).toBe('63%');
    expect((fills[1] as HTMLElement).style.width).toBe('0%');
  });
});
