import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { LoopsCuesPanelModel } from '../loops-cues-panel/loops-cues-panel.component';
import type { MarkerRowModel } from '../marker-row/marker-row.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';
import { LoopsCuesPlateComponent } from './loops-cues-plate.component';

function slot(number: number, side: 'start' | 'end'): MarkerSlotModel {
  return {
    frameLabel: 'frame 460',
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

function row(number: number): MarkerRowModel {
  return {
    number: String(number),
    state: 'idle',
    triggerDisabled: false,
    deleteDisabled: false,
    loopLengthLabel: null,
    start: slot(number, 'start'),
    end: null,
    triggerAccessibleName: `Trigger marker ${number} deck A`,
    setEndAccessibleName: `Set end for marker ${number} deck A`,
    revertAccessibleName: `Revert marker ${number} to cue deck A`,
    deleteAccessibleName: `Delete marker ${number} deck A`,
  };
}

function model(rows: readonly MarkerRowModel[] = []): LoopsCuesPanelModel {
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    rows,
  };
}

describe('LoopsCuesPlateComponent', () => {
  let fixture: ComponentFixture<LoopsCuesPlateComponent>;
  let component: LoopsCuesPlateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoopsCuesPlateComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LoopsCuesPlateComponent);
    component = fixture.componentInstance;
  });

  function setModel(next: LoopsCuesPanelModel): void {
    fixture.componentRef.setInput('model', next);
    fixture.detectChanges();
  }

  function byName(name: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  }

  it('emits addMarker when the Add key is pressed', () => {
    setModel(model());
    const emitted: void[] = [];
    component.addMarker.subscribe(() => emitted.push(undefined));

    byName('Add marker deck A').click();

    expect(emitted.length).toBe(1);
  });

  it('emits stopLoop when the Stop key is pressed', () => {
    setModel(model());
    const emitted: void[] = [];
    component.stopLoop.subscribe(() => emitted.push(undefined));

    byName('Stop loop deck A').click();

    expect(emitted.length).toBe(1);
  });

  it('renders no marker rows when the model has none', () => {
    setModel(model([]));

    expect(fixture.nativeElement.querySelectorAll('lib-marker-row').length).toBe(0);
  });

  it('renders one marker row per model row, in order', () => {
    setModel(model([row(1), row(2)]));

    expect(fixture.nativeElement.querySelectorAll('lib-marker-row').length).toBe(2);
    expect(byName('Trigger marker 2 deck A')).toBeTruthy();
  });

  it('re-emits a row action carrying the row index it came from', () => {
    setModel(model([row(1), row(2)]));
    const emitted: unknown[] = [];
    component.rowAction.subscribe((event) => emitted.push(event));

    byName('Trigger marker 2 deck A').click();
    byName('Delete marker 1 deck A').click();

    expect(emitted).toEqual([
      { index: 1, action: 'trigger', value: undefined },
      { index: 0, action: 'delete', value: undefined },
    ]);
  });
});
