import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { StorageType } from '@teensyrom-nx/domain';
import {
  DeckService,
  DjSets,
  DjStore,
  SET_NAME_MAX_LENGTH,
  type SetCardSummary,
  type SetRowSummary,
} from '@teensyrom-nx/application';
import { SetCardComponent } from '@teensyrom-nx/ui/components/dj';
import { DjSetCardComponent } from './dj-set-card.component';
import { DJ_FILE_DRAG_TYPE, type DjFileDragPayload } from '../drag/dj-file-drag';

function rowSummary(overrides: Partial<SetRowSummary> = {}): SetRowSummary {
  return {
    id: 'r1',
    number: 1,
    title: 'Commando',
    author: 'Rob Hubbard',
    loops: 0,
    cues: 0,
    lengthText: '03:12',
    decks: [],
    selected: false,
    prep: null,
    pending: false,
    ...overrides,
  };
}

function summary(rows: SetRowSummary[], overrides: Partial<SetCardSummary> = {}): SetCardSummary {
  const real = rows.filter((row) => !row.pending);
  const selectedIndex = rows.findIndex((row) => row.selected);
  const selectedRowIndex = real.findIndex((row) => row.selected);
  const selected = selectedIndex < 0 ? null : rows[selectedIndex];
  return {
    ready: true,
    name: 'Friday',
    placeholder: 'Set 1',
    rowCount: rows.length,
    save: 'saved',
    rows,
    selectedIndex: selectedIndex < 0 ? null : selectedIndex,
    positionText: selected
      ? `${String(selectedIndex + 1).padStart(2, '0')}/${String(rows.length).padStart(2, '0')}`
      : '— / —',
    realRowCount: real.length,
    selectedRowIndex: selectedRowIndex < 0 ? null : selectedRowIndex,
    selectedTitle: selected?.title ?? null,
    selectedAuthor: selected?.author ?? null,
    announcement: null,
    ...overrides,
  };
}

function render(initial: SetCardSummary, listingDragActive = false) {
  const card = signal(initial);
  const djSets = {
    renameCurrent: vi.fn(),
    newSet: vi.fn(),
    deleteCurrent: vi.fn().mockResolvedValue(undefined),
    moveSelection: vi.fn(),
    selectRow: vi.fn(),
    removeRow: vi.fn(),
    moveRow: vi.fn(),
    addFromListing: vi.fn().mockResolvedValue(undefined),
  };
  const deckService = { loadSelected: vi.fn().mockResolvedValue(undefined) };

  TestBed.configureTestingModule({
    imports: [DjSetCardComponent],
    providers: [
      { provide: DjStore, useValue: { setCardSummary: () => card } },
      { provide: DjSets, useValue: djSets },
      { provide: DeckService, useValue: deckService },
    ],
  });

  const fixture: ComponentFixture<DjSetCardComponent> = TestBed.createComponent(DjSetCardComponent);
  fixture.componentRef.setInput('listingDragActive', listingDragActive);
  fixture.detectChanges();
  const setCard = fixture.debugElement.query(By.directive(SetCardComponent))
    .componentInstance as SetCardComponent;

  return { fixture, component: fixture.componentInstance, card, djSets, deckService, setCard };
}

function dropTransfer(payload: DjFileDragPayload | null): DataTransfer {
  return {
    types: payload ? [DJ_FILE_DRAG_TYPE] : [],
    getData: (type: string) =>
      payload && type === DJ_FILE_DRAG_TYPE ? JSON.stringify(payload) : '',
  } as unknown as DataTransfer;
}

const PAYLOAD: DjFileDragPayload = {
  deviceId: 'dev',
  storageType: StorageType.Sd,
  path: '/a.sid',
  fileName: 'a.sid',
  title: 'A',
  author: 'Someone',
  playLength: '3:00',
  subtuneLengths: ['3:00'],
};

describe('DjSetCardComponent', () => {
  describe('the header', () => {
    it('counts pending entries and names its controls with the set', () => {
      const { component } = render(
        summary([
          rowSummary(),
          rowSummary({ id: 'p', number: 2, pending: true, prep: { phase: 'fetching' } }),
        ])
      );
      const { header, accessibleName } = component.model();

      expect(header).toMatchObject({
        name: 'Friday',
        nameMaxLength: SET_NAME_MAX_LENGTH,
        countText: '2 SIDS',
        saveText: 'Saved',
        renameLabel: 'Rename set Friday',
        deleteAccessibleName: 'Delete set Friday',
        deletePrompt: "Delete Friday? This can't be undone.",
        disabled: false,
      });
      expect(accessibleName).toBe('Set Friday, 2 SIDs');
    });

    it('follows the save status and disables itself until the sets are ready', () => {
      const { component, card } = render(summary([], { save: 'failed', ready: false }));

      expect(component.model().header).toMatchObject({
        save: 'failed',
        saveText: 'Not saved',
        disabled: true,
      });

      card.set(summary([], { save: 'saving' }));
      expect(component.model().header.saveText).toBe('Saving…');
    });
  });

  describe('the plate', () => {
    const three = (selected: number | null) =>
      summary(
        [1, 2, 3].map((n) =>
          rowSummary({ id: `r${n}`, number: n, title: `Tune ${n}`, selected: selected === n - 1 })
        )
      );

    it('disables Select up on the first row, Select down on the last, and both Loads with no selection', () => {
      const { component, card } = render(three(0));
      const flags = () => {
        const { previousDisabled, nextDisabled, loadDisabled } = component.model().plate;
        return [previousDisabled, nextDisabled, loadDisabled];
      };

      expect(flags()).toEqual([true, false, false]);

      card.set(three(1));
      expect(flags()).toEqual([false, false, false]);

      card.set(three(2));
      expect(flags()).toEqual([false, true, false]);

      card.set(three(null));
      expect(flags()).toEqual([false, false, true]);
    });

    it('disables both Select keys with no rows', () => {
      const { component } = render(summary([]));

      expect(component.model().plate).toMatchObject({
        previousDisabled: true,
        nextDisabled: true,
        loadDisabled: true,
        selectAccessibleName: 'Set selection, nothing selected',
      });
    });

    it('counts real rows only, so a pending entry at an end never leaves a key enabled that does nothing', () => {
      const { component } = render(
        summary([
          rowSummary({ id: 'r1', number: 1, selected: true }),
          rowSummary({ id: 'p', number: 2, pending: true, prep: { phase: 'fetching' } }),
        ])
      );

      expect(component.model().plate.nextDisabled).toBe(true);
    });

    it('names the selected row in the readout and the Load keys', () => {
      const { component } = render(three(1));
      const { plate } = component.model();

      expect(plate).toMatchObject({
        positionText: '02/03',
        title: 'Tune 2',
        selectAccessibleName: 'Set selection, 2 of 3, Tune 2 by Rob Hubbard',
        loadAAccessibleName: 'Load Tune 2 on deck A',
        loadBAccessibleName: 'Load Tune 2 on deck B',
      });
    });
  });

  describe('the rows', () => {
    const detailReader = () => {
      const { component, card } = render(summary([]));
      return (row: Partial<SetRowSummary>) => {
        card.set(summary([rowSummary(row)]));
        return component.model().rows[0].detail;
      };
    };

    it('writes the counts text in each of its forms', () => {
      const detailOf = detailReader();
      expect(detailOf({ loops: 4, cues: 2 })).toEqual({ kind: 'counts', text: '4 loops · 2 cues' });
      expect(detailOf({ loops: 2 })).toEqual({ kind: 'counts', text: '2 loops' });
      expect(detailOf({ loops: 1 })).toEqual({ kind: 'counts', text: '1 loop' });
      expect(detailOf({ cues: 1 })).toEqual({ kind: 'counts', text: '1 cue' });
      expect(detailOf({})).toEqual({ kind: 'counts', text: 'No loops' });
    });

    it('shows the prep phase in place of the counts', () => {
      const detailOf = detailReader();
      expect(detailOf({ loops: 3, prep: { phase: 'analyzing' } })).toEqual({ kind: 'analyzing' });
      expect(detailOf({ prep: { phase: 'fetching' }, pending: true })).toEqual({
        kind: 'fetching',
      });
      expect(detailOf({ prep: { phase: 'unavailable', reason: 'Not on the device' } })).toEqual({
        kind: 'unavailable',
        text: 'Not on the device',
      });
    });

    it('numbers rows with two digits, lights the holding decks and composes the names', () => {
      const { component } = render(
        summary([
          rowSummary({
            number: 3,
            loops: 4,
            cues: 2,
            selected: true,
            decks: [
              { slot: 'A', state: 'playing' },
              { slot: 'B', state: 'off' },
            ],
          }),
        ])
      );
      const [row] = component.model().rows;

      expect(row.numberText).toBe('03');
      expect(row.decks).toEqual([
        { letter: 'A', light: 'playing' },
        { letter: 'B', light: 'off' },
      ]);
      expect(row.selected).toBe(true);
      expect(row.accessibleName).toBe(
        'Row 3 of 1, Commando by Rob Hubbard, 4 loops, 2 cues, 03:12, on deck A, playing, on deck B'
      );
      expect(row.handleAccessibleName).toBe('Move Commando, Alt and arrow keys move it');
      expect(row.removeAccessibleName).toBe('Remove Commando from the set');
    });
  });

  describe('the handlers', () => {
    it('routes the header and the plate to the sets service and the deck service', () => {
      const { setCard, djSets, deckService } = render(summary([rowSummary({ selected: true })]));

      setCard.rename.emit('Saturday');
      setCard.newSet.emit();
      setCard.deleteSet.emit();
      setCard.selectPrevious.emit();
      setCard.selectNext.emit();
      setCard.loadA.emit();
      setCard.loadB.emit();

      expect(djSets.renameCurrent).toHaveBeenCalledWith('Saturday');
      expect(djSets.newSet).toHaveBeenCalledTimes(1);
      expect(djSets.deleteCurrent).toHaveBeenCalledTimes(1);
      expect(djSets.moveSelection.mock.calls).toEqual([[-1], [1]]);
      expect(deckService.loadSelected.mock.calls).toEqual([['A'], ['B']]);
    });

    it('routes the rows to select, remove and move', () => {
      const { setCard, djSets } = render(summary([rowSummary()]));

      setCard.rowSelect.emit('r1');
      setCard.rowRemove.emit('r1');
      setCard.rowMove.emit({ rowId: 'r1', toIndex: 2 });

      expect(djSets.selectRow).toHaveBeenCalledWith('r1');
      expect(djSets.removeRow).toHaveBeenCalledWith('r1');
      expect(djSets.moveRow).toHaveBeenCalledWith('r1', 2);
    });
  });

  describe('the listing drop', () => {
    it('adds the dropped SID at the gap it landed in', () => {
      const { setCard, djSets } = render(summary([rowSummary()]), true);

      setCard.listingDrop.emit({ index: 1, dataTransfer: dropTransfer(PAYLOAD) });

      expect(djSets.addFromListing).toHaveBeenCalledWith(PAYLOAD, 1);
    });

    it('ignores a drop that is not a DJ listing drag', () => {
      const { setCard, djSets } = render(summary([rowSummary()]), true);

      setCard.listingDrop.emit({ index: 0, dataTransfer: dropTransfer(null) });

      expect(djSets.addFromListing).not.toHaveBeenCalled();
    });

    it('allows the drop on dragover only while the listing drag is active', () => {
      const dragOver = (active: boolean) => {
        const { fixture } = render(summary([rowSummary()]), active);
        const list: HTMLElement = fixture.nativeElement.querySelector('.rows');
        const event = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(event, 'dataTransfer', {
          value: { types: [DJ_FILE_DRAG_TYPE], dropEffect: 'none' },
        });
        list.dispatchEvent(event);
        TestBed.resetTestingModule();
        return event.defaultPrevented;
      };

      expect(dragOver(true)).toBe(true);
      expect(dragOver(false)).toBe(false);
    });
  });
});
