import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import type { LiveLoopRowModel } from '../live-loop-row/live-loop-row.component';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';
import type { LoopSelectedRowModel } from '../loop-selected-row/loop-selected-row.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';
import { LoopsCuesPlateComponent, type LoopsCuesPlateModel } from './loops-cues-plate.component';

function boundary(tag: 'Start' | 'End', overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  const lower = tag.toLowerCase();
  const isStart = tag === 'Start';
  return {
    key: {
      label: isStart ? 'In' : 'Out',
      accessibleName: isStart ? 'Loop in deck A' : 'Loop out deck A',
      control: isStart ? 'loop-in' : 'loop-set-end',
      disabled: false,
    },
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [],
    nudgeAccessibleName: `Nudge ${lower} deck A`,
    earlierAccessibleName: `Move ${lower} earlier deck A`,
    laterAccessibleName: `Move ${lower} later deck A`,
    ...overrides,
  };
}

function selectedRow(overrides: Partial<LoopSelectedRowModel> = {}): LoopSelectedRowModel {
  return {
    id: 'item-1',
    empty: false,
    name: 'Loop 1',
    kindLabel: 'LOOP',
    spanText: '02:39.4–02:47.5',
    activity: 'idle',
    ready: true,
    triggerDisabled: false,
    clearEndDisabled: false,
    deleteDisabled: false,
    start: boundary('Start'),
    end: boundary('End'),
    length: {
      text: '16 BEATS',
      options: [{ beats: 16, label: '16 BEATS', selected: true }],
      halveAccessibleName: 'Halve deck A',
      doubleAccessibleName: 'Double deck A',
      pickAccessibleName: 'Loop length deck A',
    },
    move: {
      stepText: '1 BEAT',
      options: [
        { beats: 1, label: '1 BEAT', selected: true },
        { beats: 4, label: '4 BEATS', selected: false },
      ],
      earlierAccessibleName: 'Move earlier deck A',
      laterAccessibleName: 'Move later deck A',
      pickAccessibleName: 'Move step deck A',
    },
    triggerAccessibleName: 'Trigger selected deck A',
    clearEndAccessibleName: 'Clear end deck A',
    deleteAccessibleName: 'Delete selected deck A',
    playNowDisabled: false,
    playNowAccessibleName: 'Play now selected deck A',
    sharesGlobal: true,
    globalDisabled: false,
    globalAccessibleName: 'GBL selected deck A',
    wraps: false,
    wrapDisabled: false,
    wrapAccessibleName: 'WRAP selected deck A',
    renameDisabled: false,
    renameLabel: 'Rename selected deck A',
    nameMaxLength: 48,
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
    name: `Loop ${number}`,
    kind: 'loop',
    lengthText: '7.8s',
    activity: 'idle',
    selected: false,
    ready: true,
    triggerAccessibleName: `Trigger Loop ${number}`,
    selectAccessibleName: `Select Loop ${number}, loop`,
    ownSettings: false,
    playNowAccessibleName: `Play now Loop ${number}`,
    ...overrides,
  };
}

function liveRow(overrides: Partial<LiveLoopRowModel> = {}): LiveLoopRowModel {
  return {
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
    ...overrides,
  };
}

function model(overrides: Partial<LoopsCuesPlateModel> = {}): LoopsCuesPlateModel {
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    duplicateAccessibleName: 'Duplicate deck A',
    addDisabled: false,
    duplicateDisabled: false,
    stopDisabled: false,
    gridAccessibleName: 'Loops and cues, deck A',
    emptyText: null,
    live: liveRow(),
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
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(LoopsCuesPlateComponent);
    const component = fixture.componentInstance;
    emitted = [];
    const plain = (name: string) => () => emitted.push(name);
    const valued = (name: string) => (value: unknown) => emitted.push([name, value]);
    component.addMarker.subscribe(plain('add'));
    component.duplicateMarker.subscribe(plain('duplicate'));
    component.stopLoop.subscribe(plain('stop'));
    component.toggleLiveLoop.subscribe(plain('toggleLiveLoop'));
    component.endLiveLoop.subscribe(plain('endLiveLoop'));
    component.halveLiveLoop.subscribe(plain('halveLiveLoop'));
    component.doubleLiveLoop.subscribe(plain('doubleLiveLoop'));
    component.pickLiveLoopSize.subscribe(valued('pickLiveLoopSize'));
    component.liveLoopSizeWheel.subscribe(valued('liveLoopSizeWheel'));
    component.toggleSlip.subscribe(plain('toggleSlip'));
    component.toggleSelected.subscribe(plain('toggle'));
    component.playNowSelected.subscribe(plain('playNowSelected'));
    component.toggleGlobal.subscribe(plain('toggleGlobal'));
    component.toggleWrap.subscribe(plain('toggleWrap'));
    component.setIn.subscribe(plain('setIn'));
    component.setOut.subscribe(plain('setOut'));
    component.halve.subscribe(plain('halve'));
    component.double.subscribe(plain('double'));
    component.pickLength.subscribe(valued('pickLength'));
    component.moveEarlier.subscribe(plain('moveEarlier'));
    component.moveLater.subscribe(plain('moveLater'));
    component.pickMoveStep.subscribe(valued('pickMoveStep'));
    component.clearEnd.subscribe(plain('clearEnd'));
    component.deleteSelected.subscribe(plain('delete'));
    component.triggerTile.subscribe(valued('triggerTile'));
    component.playNowTile.subscribe(valued('playNowTile'));
    component.selectTile.subscribe(valued('selectTile'));
    component.nudgeCommit.subscribe(valued('nudgeCommit'));
    component.moveEdge.subscribe(valued('moveEdge'));
    component.rename.subscribe(valued('rename'));
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

    it('emits duplicateMarker from the Duplicate key, found by its control id', () => {
      expect(control('loop-duplicate')?.contains(byName('Duplicate deck A'))).toBe(true);

      byName('Duplicate deck A').click();

      expect(emitted).toEqual(['duplicate']);
    });

    it('re-emits the live loop row as its own outputs, above the selected row', () => {
      const row = fixture.nativeElement.querySelector('lib-live-loop-row') as HTMLElement;
      const selected = fixture.nativeElement.querySelector('lib-loop-selected-row') as HTMLElement;
      expect(row.compareDocumentPosition(selected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      byName('Live loop deck A').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      byName('Halve live loop deck A').click();
      byName('Double live loop deck A').click();
      byName('Slip deck A').click();
      control('live-loop-size')?.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
      );

      expect(emitted).toEqual([
        'toggleLiveLoop',
        'halveLiveLoop',
        'doubleLiveLoop',
        'toggleSlip',
        ['liveLoopSizeWheel', expect.objectContaining({ clicks: 1 })],
      ]);
    });

    it('re-emits a picked live loop size in beats', () => {
      control('live-loop-size')?.click();
      fixture.detectChanges();
      const item = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item')
      ).find((candidate) => candidate.textContent?.includes('2 BEATS'));
      item?.click();

      expect(emitted).toEqual([['pickLiveLoopSize', 2]]);
    });

    it('re-emits each selected-row key as its own output', () => {
      byName('Trigger selected deck A').click();
      byName('Play now selected deck A').click();
      byName('GBL selected deck A').click();
      byName('WRAP selected deck A').click();
      byName('Clear end deck A').click();
      byName('Delete selected deck A').click();

      expect(emitted).toEqual([
        'toggle',
        'playNowSelected',
        'toggleGlobal',
        'toggleWrap',
        'clearEnd',
        'delete',
      ]);
    });

    it('re-emits the In, Out, Length and Move keys as their own outputs', () => {
      byName('Loop in deck A').click();
      byName('Loop out deck A').click();
      byName('Halve deck A').click();
      byName('Double deck A').click();
      byName('Move earlier deck A').click();
      byName('Move later deck A').click();

      expect(emitted).toEqual(['setIn', 'setOut', 'halve', 'double', 'moveEarlier', 'moveLater']);
    });

    it('re-emits a picked length and a picked Move step in beats', () => {
      for (const [id, label] of [
        ['loop-length', '16 BEATS'],
        ['loop-move-step', '4 BEATS'],
      ]) {
        control(id)?.click();
        fixture.detectChanges();
        const item = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item')
        ).find((candidate) => candidate.textContent?.includes(label));
        item?.click();
        fixture.detectChanges();
      }

      expect(emitted).toEqual([
        ['pickLength', 16],
        ['pickMoveStep', 4],
      ]);
    });

    it('re-emits a rename from the selected row', () => {
      const name = (fixture.nativeElement as HTMLElement).querySelector('lib-loop-selected-row lib-inline-edit-title button') as HTMLButtonElement;
      name.click();
      fixture.detectChanges();
      const field = (fixture.nativeElement as HTMLElement).querySelector('lib-loop-selected-row input[type="text"]') as HTMLInputElement;
      field.value = 'Chorus';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(emitted).toEqual([['rename', { id: 'item-1', name: 'Chorus' }]]);
    });

    it('re-emits an edge move tagged with the boundary and direction', () => {
      byName('Move start later deck A').click();
      byName('Move end earlier deck A').click();

      expect(emitted).toEqual([
        ['moveEdge', { boundary: 'start', direction: 1 }],
        ['moveEdge', { boundary: 'end', direction: -1 }],
      ]);
    });

    it('re-emits a committed nudge tagged with the boundary', () => {
      const range = byName('Nudge end deck A') as unknown as HTMLInputElement;
      range.value = '12';
      range.dispatchEvent(new Event('change', { bubbles: true }));

      expect(emitted).toEqual([['nudgeCommit', { boundary: 'end', offsetFrames: 12 }]]);
    });

    it('emits the tile id for a tile trigger, play now and select', () => {
      byName('Trigger Loop 2').click();
      byName('Play now Loop 2').click();
      byName('Select Loop 2, loop').click();

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

    it('disables Duplicate from the model', () => {
      setModel(model({ duplicateDisabled: true }));

      expect(byName('Duplicate deck A').disabled).toBe(true);
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
      expect(names).toEqual(['Loop 1', 'Loop 2', 'Loop 3']);
    });
  });

  it("hands a live progress to the grid, for the running tile's timeline", () => {
    setModel(model({ tiles: [tile(1), tile(2, { activity: 'running' })] }));

    fixture.componentInstance.setLiveProgress(42);

    const grid = fixture.nativeElement.querySelector('lib-loop-tile-grid') as HTMLElement;
    const timelines = Array.from<HTMLElement>(grid.querySelectorAll('.timeline'));
    expect(timelines.map((t) => t.style.getPropertyValue('--loop-tile-progress'))).toEqual([
      '',
      '42%',
    ]);
    expect(grid.querySelectorAll('.fill')).toHaveLength(1);
  });
});
