import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';
import type { LoopSelectedRowModel } from '../loop-selected-row/loop-selected-row.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';
import { LoopsCuesPlateComponent, type LoopsCuesPlateModel } from './loops-cues-plate.component';

function boundary(tag: string, overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  const lower = tag.toLowerCase();
  return {
    tag,
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge ${lower} deck A`,
    previousAccessibleName: `Snap ${lower} to previous moment deck A`,
    nextAccessibleName: `Snap ${lower} to next moment deck A`,
    ...overrides,
  };
}

function selectedRow(overrides: Partial<LoopSelectedRowModel> = {}): LoopSelectedRowModel {
  return {
    empty: false,
    name: 'Item 1',
    kindLabel: 'LOOP',
    spanText: '02:39.4–02:47.5',
    activity: 'idle',
    ready: true,
    triggerDisabled: false,
    setEndDisabled: false,
    clearEndDisabled: false,
    deleteDisabled: false,
    start: boundary('Start'),
    end: boundary('End'),
    triggerAccessibleName: 'Trigger selected deck A',
    setEndAccessibleName: 'Set end deck A',
    clearEndAccessibleName: 'Clear end deck A',
    deleteAccessibleName: 'Delete selected deck A',
    playNowDisabled: false,
    playNowAccessibleName: 'Play now selected deck A',
    sharesGlobal: true,
    globalDisabled: false,
    globalAccessibleName: 'GBL selected deck A',
    ...overrides,
  };
}

function emptyRow(): LoopSelectedRowModel {
  return selectedRow({
    empty: true,
    name: '',
    kindLabel: '',
    spanText: '',
    end: boundary('End', { empty: true }),
  });
}

function tile(number: number, overrides: Partial<LoopTileModel> = {}): LoopTileModel {
  return {
    id: `item-${number}`,
    name: `Item ${number}`,
    kind: 'loop',
    lengthText: '7.8s',
    activity: 'idle',
    selected: false,
    ready: true,
    triggerAccessibleName: `Trigger Item ${number}`,
    selectAccessibleName: `Select Item ${number}, loop`,
    ownSettings: false,
    playNowAccessibleName: `Play now Item ${number}`,
    ...overrides,
  };
}

function model(overrides: Partial<LoopsCuesPlateModel> = {}): LoopsCuesPlateModel {
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    addDisabled: false,
    stopDisabled: false,
    gridAccessibleName: 'Loops and cues, deck A',
    emptyText: null,
    selected: selectedRow(),
    tiles: [tile(1, { selected: true }), tile(2)],
    ...overrides,
  };
}

describe('LoopsCuesPlateComponent', () => {
  let fixture: ComponentFixture<LoopsCuesPlateComponent>;
  let emitted: unknown[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoopsCuesPlateComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LoopsCuesPlateComponent);
    const component = fixture.componentInstance;
    emitted = [];
    const plain = (name: string) => () => emitted.push(name);
    const valued = (name: string) => (value: unknown) => emitted.push([name, value]);
    component.addMarker.subscribe(plain('add'));
    component.stopLoop.subscribe(plain('stop'));
    component.toggleSelected.subscribe(plain('toggle'));
    component.playNowSelected.subscribe(plain('playNowSelected'));
    component.toggleGlobal.subscribe(plain('toggleGlobal'));
    component.setEnd.subscribe(plain('setEnd'));
    component.clearEnd.subscribe(plain('clearEnd'));
    component.deleteSelected.subscribe(plain('delete'));
    component.triggerTile.subscribe(valued('triggerTile'));
    component.playNowTile.subscribe(valued('playNowTile'));
    component.selectTile.subscribe(valued('selectTile'));
    component.nudgeCommit.subscribe(valued('nudgeCommit'));
    component.snap.subscribe(valued('snap'));
  });

  function setModel(next: LoopsCuesPlateModel): void {
    fixture.componentRef.setInput('model', next);
    fixture.detectChanges();
  }

  function byName(name: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  }

  function control(id: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-control="${id}"]`);
  }

  it('anchors the Add and Stop keys and the tile grid with ids of their own', () => {
    setModel(model());

    expect(control('loop-add')?.contains(byName('Add marker deck A'))).toBe(true);
    expect(control('loop-stop')?.contains(byName('Stop loop deck A'))).toBe(true);
    expect(control('loop-select')?.tagName.toLowerCase()).toBe('lib-loop-tile-grid');
    expect(control('stop')).toBeNull();
  });

  describe('outputs', () => {
    beforeEach(() => setModel(model()));

    it('emits addMarker and stopLoop from the header keys', () => {
      byName('Add marker deck A').click();
      byName('Stop loop deck A').click();

      expect(emitted).toEqual(['add', 'stop']);
    });

    it('re-emits each selected-row key as its own output', () => {
      byName('Trigger selected deck A').click();
      byName('Play now selected deck A').click();
      byName('GBL selected deck A').click();
      byName('Clear end deck A').click();
      byName('Delete selected deck A').click();

      expect(emitted).toEqual(['toggle', 'playNowSelected', 'toggleGlobal', 'clearEnd', 'delete']);
    });

    it("re-emits Set End from a cue's End slot", () => {
      setModel(model({ selected: selectedRow({ kindLabel: 'CUE', end: boundary('End', { empty: true }) }) }));
      byName('Set end deck A').click();

      expect(emitted).toEqual(['setEnd']);
    });

    it('re-emits a boundary snap tagged with the boundary and direction', () => {
      byName('Snap start to next moment deck A').click();
      byName('Snap end to previous moment deck A').click();

      expect(emitted).toEqual([
        ['snap', { boundary: 'start', direction: 'next' }],
        ['snap', { boundary: 'end', direction: 'previous' }],
      ]);
    });

    it('re-emits a committed nudge tagged with the boundary', () => {
      const range = byName('Nudge end deck A') as unknown as HTMLInputElement;
      range.value = '12';
      range.dispatchEvent(new Event('change', { bubbles: true }));

      expect(emitted).toEqual([['nudgeCommit', { boundary: 'end', offsetFrames: 12 }]]);
    });

    it('emits the tile id for a tile trigger, play now and select', () => {
      byName('Trigger Item 2').click();
      byName('Play now Item 2').click();
      byName('Select Item 2, loop').click();

      expect(emitted).toEqual([
        ['triggerTile', 'item-2'],
        ['playNowTile', 'item-2'],
        ['selectTile', 'item-2'],
      ]);
    });
  });

  describe('states', () => {
    it('disables Add and Stop from the model', () => {
      setModel(model({ addDisabled: true, stopDisabled: true }));

      expect(byName('Add marker deck A').disabled).toBe(true);
      expect(byName('Stop loop deck A').disabled).toBe(true);
    });

    it('shows the empty text, no tiles and a blank selected row when there is no tune', () => {
      setModel(
        model({
          emptyText: 'Load a tune to add loops',
          tiles: [],
          selected: emptyRow(),
          addDisabled: true,
        })
      );

      expect(fixture.nativeElement.textContent).toContain('Load a tune to add loops');
      expect(fixture.nativeElement.querySelectorAll('lib-loop-tile').length).toBe(0);
      expect(fixture.nativeElement.querySelector('lib-loop-selected-row[data-empty]')).toBeTruthy();
    });

    it('shows the empty text for a tune with no markers while Add stays available', () => {
      setModel(model({ emptyText: 'No loops or cues yet', tiles: [], selected: emptyRow() }));

      expect(fixture.nativeElement.textContent).toContain('No loops or cues yet');
      expect(byName('Add marker deck A').disabled).toBe(false);
    });

    it('renders one tile per model tile, in order', () => {
      setModel(model({ tiles: [tile(1), tile(2), tile(3)] }));

      const names = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('lib-loop-tile .name')
      ).map((el) => el.textContent?.trim());
      expect(names).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });
  });
});
