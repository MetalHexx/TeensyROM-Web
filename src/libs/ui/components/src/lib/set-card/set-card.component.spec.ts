import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SetCardComponent, type SetCardModel } from './set-card.component';
import { SET_ROW_DRAG_TYPE, type SetRowModel } from '../set-row/set-row.component';

const ROW_HEIGHT = 40;

function row(id: string, overrides: Partial<SetRowModel> = {}): SetRowModel {
  return {
    id,
    numberText: id.toUpperCase(),
    title: `Tune ${id}`,
    author: 'Author',
    detail: { kind: 'counts', text: 'No loops' },
    lengthText: '03:00',
    decks: [],
    selected: false,
    pending: false,
    accessibleName: `Row ${id}`,
    handleAccessibleName: `Move ${id}`,
    removeAccessibleName: `Remove ${id}`,
    ...overrides,
  };
}

function card(rows: SetRowModel[], overrides: Partial<SetCardModel> = {}): SetCardModel {
  return {
    header: {
      name: 'Friday warm-up',
      nameMaxLength: 64,
      countText: `${rows.length} SIDS`,
      save: 'saved',
      saveText: 'Saved',
      renameLabel: 'Rename set Friday warm-up',
      newAccessibleName: 'New set',
      deleteAccessibleName: 'Delete set Friday warm-up',
      deletePrompt: "Delete Friday warm-up? This can't be undone.",
      disabled: false,
    },
    plate: {
      positionText: '01/04',
      title: 'Tune r0',
      author: 'Author',
      previousDisabled: false,
      nextDisabled: false,
      loadDisabled: false,
      selectAccessibleName: 'Set selection, 1 of 4, Tune r0 by Author',
      previousAccessibleName: 'Select previous',
      nextAccessibleName: 'Select next',
      loadAAccessibleName: 'Load A',
      loadBAccessibleName: 'Load B',
    },
    rows,
    emptyText: 'Drag SIDs here from the file listing',
    accessibleName: `Set Friday warm-up, ${rows.length} SIDs`,
    announcement: null,
    ...overrides,
  };
}

const FOUR = (): SetRowModel[] => ['r0', 'r1', 'r2', 'r3'].map((id) => row(id));

describe('SetCardComponent', () => {
  let fixture: ComponentFixture<SetCardComponent>;
  let emitted: unknown[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SetCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(SetCardComponent);
    emitted = [];
    const c = fixture.componentInstance;
    const plain = (name: string) => () => emitted.push(name);
    const valued = (name: string) => (value: unknown) => emitted.push([name, value]);
    c.rename.subscribe(valued('rename'));
    c.newSet.subscribe(plain('newSet'));
    c.deleteSet.subscribe(plain('deleteSet'));
    c.selectPrevious.subscribe(plain('selectPrevious'));
    c.selectNext.subscribe(plain('selectNext'));
    c.loadA.subscribe(plain('loadA'));
    c.loadB.subscribe(plain('loadB'));
    c.rowSelect.subscribe(valued('rowSelect'));
    c.rowRemove.subscribe(valued('rowRemove'));
    c.rowMove.subscribe(valued('rowMove'));
    c.listingDrop.subscribe((drop) => emitted.push(['listingDrop', drop.index]));
    c.rowDragStart.subscribe(plain('rowDragStart'));
    c.rowDragEnd.subscribe(plain('rowDragEnd'));
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const list = (): HTMLElement => el().querySelector('.rows') as HTMLElement;
  const rowEls = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('lib-set-row'));

  /** jsdom has no layout: every row is a ROW_HEIGHT band, stacked from the list's top at 0. */
  function layOut(listHeight = 1000): void {
    const rect = (top: number, height: number): DOMRect =>
      ({ top, height, bottom: top + height, left: 0, right: 100, width: 100 }) as DOMRect;
    list().getBoundingClientRect = () => rect(0, listHeight);
    rowEls().forEach((element, index) => {
      element.getBoundingClientRect = () => rect(index * ROW_HEIGHT - scrollTop, ROW_HEIGHT);
    });
  }

  let scrollTop = 0;

  function render(model: SetCardModel, listingDragActive = false): void {
    scrollTop = 0;
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('listingDragActive', listingDragActive);
    fixture.detectChanges();
    layOut();
  }

  interface DragInit {
    types: string[];
    clientY: number;
    data?: Record<string, string>;
    relatedTarget?: EventTarget | null;
  }

  function drag(type: string, target: HTMLElement, init: DragInit): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const dataTransfer = {
      types: init.types,
      dropEffect: 'none',
      getData: (key: string) => init.data?.[key] ?? '',
    };
    Object.defineProperties(event, {
      dataTransfer: { value: dataTransfer },
      clientY: { value: init.clientY },
      relatedTarget: { value: init.relatedTarget ?? null },
    });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  const rowDrag = (id: string, clientY: number): DragInit => ({
    types: [SET_ROW_DRAG_TYPE],
    clientY,
    data: { [SET_ROW_DRAG_TYPE]: id },
  });
  const listingDrag = (clientY: number): DragInit => ({ types: ['Files'], clientY });
  const middleOf = (index: number): number => index * ROW_HEIGHT + ROW_HEIGHT / 2;

  describe('moving a row', () => {
    beforeEach(() => render(card(FOUR())));

    it('drops a row dragged down at its final position after its removal', () => {
      drag('drop', list(), rowDrag('r0', middleOf(2) + 5));

      expect(emitted).toEqual([['rowMove', { rowId: 'r0', toIndex: 2 }]]);
    });

    it('drops a row dragged up at the gap itself', () => {
      drag('drop', list(), rowDrag('r3', 5));

      expect(emitted).toEqual([['rowMove', { rowId: 'r3', toIndex: 0 }]]);
    });

    it('drops a row at the very end', () => {
      drag('drop', list(), rowDrag('r1', 4 * ROW_HEIGHT + 20));

      expect(emitted).toEqual([['rowMove', { rowId: 'r1', toIndex: 3 }]]);
    });

    it('emits nothing for a drop back where the row already is', () => {
      drag('drop', list(), rowDrag('r1', middleOf(1) + 5));

      expect(emitted).toEqual([]);
    });

    it('turns Alt+ArrowDown on a handle into a move one real position down', () => {
      const handle = rowEls()[1].querySelector('.handle') as HTMLElement;
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));

      expect(emitted).toEqual([['rowMove', { rowId: 'r1', toIndex: 2 }]]);
    });

    it('turns Alt+ArrowUp into a move up, and does not move past either end', () => {
      const handleOf = (index: number): HTMLElement => rowEls()[index].querySelector('.handle') as HTMLElement;
      const press = (target: HTMLElement, key: string): void => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true }));
      };
      press(handleOf(0), 'ArrowUp');
      press(handleOf(3), 'ArrowDown');
      press(handleOf(2), 'ArrowUp');

      expect(emitted).toEqual([['rowMove', { rowId: 'r2', toIndex: 1 }]]);
    });
  });

  describe('real indices with a pending entry', () => {
    const withPending = (): SetRowModel[] => [
      row('r0'),
      row('p', { pending: true, detail: { kind: 'fetching' } }),
      row('r1'),
      row('r2'),
    ];
    beforeEach(() => render(card(withPending()), true));

    it('does not count the pending entry in the listing drop gap', () => {
      drag('drop', list(), listingDrag(2 * ROW_HEIGHT + 30));

      expect(emitted).toEqual([['listingDrop', 2]]);
    });

    it('does not count it in a row move either', () => {
      drag('drop', list(), rowDrag('r1', 4 * ROW_HEIGHT));

      expect(emitted).toEqual([['rowMove', { rowId: 'r1', toIndex: 2 }]]);
    });

    it('moves a real row by real positions, stepping over the pending one', () => {
      const handle = rowEls()[2].querySelector('.handle') as HTMLElement;
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));

      expect(emitted).toEqual([['rowMove', { rowId: 'r1', toIndex: 0 }]]);
    });
  });

  describe('a SID dragged from the file listing', () => {
    it.each([
      ['above the first row', 5, 0],
      ['between rows', ROW_HEIGHT + 10, 1],
      ['below the last row', 4 * ROW_HEIGHT, 4],
    ])('drops %s at the matching gap', (_, clientY, index) => {
      render(card(FOUR()), true);
      drag('drop', list(), listingDrag(clientY));

      expect(emitted).toEqual([['listingDrop', index]]);
    });

    it('hands the drop its data transfer', () => {
      render(card(FOUR()), true);
      let received: DataTransfer | null = null;
      fixture.componentInstance.listingDrop.subscribe((drop) => (received = drop.dataTransfer));
      drag('drop', list(), listingDrag(5));

      expect(received).not.toBeNull();
    });

    it('is accepted only while listingDragActive', () => {
      render(card(FOUR()), false);
      const over = drag('dragover', list(), listingDrag(5));
      drag('drop', list(), listingDrag(5));

      expect(over.defaultPrevented).toBe(false);
      expect(el().querySelector('.insertion-line')).toBeNull();
      expect(emitted).toEqual([]);
    });

    it('accepts a drop into an empty set and shows the empty text as the target', () => {
      render(card([]), true);

      expect(list().textContent).toContain('Drag SIDs here from the file listing');
      drag('drop', list(), listingDrag(10));
      expect(emitted).toEqual([['listingDrop', 0]]);
    });
  });

  describe('the insertion line', () => {
    beforeEach(() => render(card(FOUR()), true));

    const line = (): HTMLElement | null => el().querySelector('.insertion-line');

    it('is drawn between the rows the pointer is between, and the drag is accepted', () => {
      const over = drag('dragover', list(), listingDrag(ROW_HEIGHT * 2));

      expect(over.defaultPrevented).toBe(true);
      expect(line()?.nextElementSibling).toBe(rowEls()[2]);
    });

    it('moves to the end below the last row', () => {
      drag('dragover', list(), listingDrag(4 * ROW_HEIGHT));

      expect(line()).not.toBeNull();
      expect(line()?.previousElementSibling).toBe(rowEls()[3]);
    });

    it('follows a row of the card\'s own being dragged, without listingDragActive', () => {
      render(card(FOUR()), false);
      const over = drag('dragover', list(), rowDrag('r0', 5));

      expect(over.defaultPrevented).toBe(true);
      expect(line()?.nextElementSibling).toBe(rowEls()[0]);
    });

    it('clears when the drag leaves the list, not when it moves between rows', () => {
      drag('dragover', list(), listingDrag(5));
      drag('dragleave', rowEls()[0], { ...listingDrag(5), relatedTarget: rowEls()[1] });
      expect(line()).not.toBeNull();

      drag('dragleave', list(), { ...listingDrag(5), relatedTarget: document.body });
      expect(line()).toBeNull();
    });

    it('clears when the drag ends', () => {
      drag('dragover', list(), listingDrag(5));
      drag('dragend', list(), listingDrag(5));

      expect(line()).toBeNull();
    });

    it('clears after the drop', () => {
      drag('dragover', list(), listingDrag(5));
      drag('drop', list(), listingDrag(5));

      expect(line()).toBeNull();
    });
  });

  describe('dragging a row by its handle', () => {
    const ghostEl = (): HTMLElement | null => el().querySelector('lib-set-row-ghost');

    function startDrag(rowIndex: number, setDragImage = vi.fn()): ReturnType<typeof vi.fn> {
      const event = new Event('dragstart', { bubbles: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { setData: vi.fn(), setDragImage, effectAllowed: 'uninitialized' },
      });
      rowEls()[rowIndex].querySelector('.handle')?.dispatchEvent(event);
      fixture.detectChanges();
      return setDragImage;
    }

    beforeEach(() => render(card(FOUR())));

    it('has no ghost until a row is dragged', () => {
      expect(ghostEl()).toBeNull();
    });

    it('shows the dragged row in the ghost, sets it as the drag image, then announces the start', () => {
      let imageSetFor: string | undefined;
      const setDragImage = vi.fn((image: Element) => {
        imageSetFor = `${image.tagName}|${image.textContent}|${emitted.length}`;
      });
      startDrag(2, setDragImage);

      const ghost = ghostEl() as HTMLElement;
      expect(ghost.textContent).toContain('R2');
      expect(ghost.textContent).toContain('Tune r2');
      expect(ghost.textContent).toContain('Author');
      expect(setDragImage).toHaveBeenCalledTimes(1);
      expect(setDragImage.mock.calls[0][0]).toBe(ghost);
      expect(imageSetFor).toContain('Tune r2');
      expect(imageSetFor?.endsWith('|0')).toBe(true);
      expect(emitted).toEqual(['rowDragStart']);
    });

    it('shows the row dragged next, not the one before', () => {
      startDrag(0);
      drag('dragend', list(), rowDrag('r0', 5));
      startDrag(3);

      expect(ghostEl()?.textContent).toContain('Tune r3');
      expect(ghostEl()?.textContent).not.toContain('Tune r0');
    });

    it('announces the end, clears the insertion line and removes the ghost', () => {
      startDrag(1);
      drag('dragover', list(), rowDrag('r1', 5));
      expect(el().querySelector('.insertion-line')).not.toBeNull();
      emitted.length = 0;

      drag('dragend', list(), rowDrag('r1', 5));

      expect(emitted).toEqual(['rowDragEnd']);
      expect(el().querySelector('.insertion-line')).toBeNull();
      expect(ghostEl()).toBeNull();
    });
  });

  describe('bringing the selected row into view', () => {
    function longSet(selected: string): SetRowModel[] {
      return Array.from({ length: 30 }, (_, i) => row(`r${i}`, { selected: `r${i}` === selected }));
    }

    function stubScroll(): { ancestor: HTMLElement } {
      let top = 0;
      Object.defineProperty(list(), 'scrollTop', {
        configurable: true,
        get: () => top,
        set: (value: number) => {
          top = value;
          scrollTop = value;
          layOut(200);
        },
      });
      const ancestor = document.createElement('div');
      document.body.appendChild(ancestor);
      ancestor.appendChild(el());
      return { ancestor };
    }

    it('scrolls the rows list by the least amount that shows a row below the fold', async () => {
      render(card(longSet('r0')));
      const { ancestor } = stubScroll();
      layOut(200);

      fixture.componentRef.setInput('model', card(longSet('r10')));
      fixture.detectChanges();
      await fixture.whenStable();

      // r10 spans 400–440 and the list shows 0–200: scroll by 440 − 200.
      expect(list().scrollTop).toBe(240);
      expect(ancestor.scrollTop).toBe(0);
    });

    it('scrolls back up to a row above the fold', async () => {
      render(card(longSet('r10')));
      stubScroll();
      list().scrollTop = 400;

      fixture.componentRef.setInput('model', card(longSet('r8')));
      fixture.detectChanges();
      await fixture.whenStable();

      // r8 spans 320–360 on a list showing 400–600: scroll up by 80.
      expect(list().scrollTop).toBe(320);
    });

    it('leaves the scroll alone when the row is already fully visible', async () => {
      render(card(longSet('r0')));
      stubScroll();
      layOut(200);

      fixture.componentRef.setInput('model', card(longSet('r2')));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(list().scrollTop).toBe(0);
    });
  });

  describe('forwarding', () => {
    beforeEach(() => render(card(FOUR())));

    const key = (selector: string): HTMLButtonElement =>
      el().querySelector(`${selector} button`) as HTMLButtonElement;

    it('forwards the plate keys', () => {
      key('[data-part="up"]').click();
      key('[data-part="down"]').click();
      key('[data-control="set-load-a"]').click();
      key('[data-control="set-load-b"]').click();

      expect(emitted).toEqual(['selectPrevious', 'selectNext', 'loadA', 'loadB']);
    });

    it('forwards the header: new, and delete only after the confirm', () => {
      key('[data-part="new"]').click();
      key('[data-part="delete"]').click();
      fixture.detectChanges();
      expect(emitted).toEqual(['newSet']);

      key('[data-part="confirm-delete"]').click();
      expect(emitted).toEqual(['newSet', 'deleteSet']);
    });

    it("forwards a row's select and remove with its id", () => {
      (rowEls()[2].querySelector('.select') as HTMLElement).click();
      (rowEls()[1].querySelector('[data-part="remove"] button') as HTMLElement).click();

      expect(emitted).toEqual([
        ['rowSelect', 'r2'],
        ['rowRemove', 'r1'],
      ]);
    });
  });

  describe('accessibility', () => {
    it('names the card, lists the rows and marks the selected one current', () => {
      render(card([row('r0'), row('r1', { selected: true })]));

      expect(el().querySelector('section')?.getAttribute('aria-label')).toBe('Set Friday warm-up, 2 SIDs');
      expect(el().querySelectorAll('[role="list"] > [role="listitem"]')).toHaveLength(2);
      expect(rowEls().map((e) => e.getAttribute('aria-current'))).toEqual([null, 'true']);
    });

    it('announces in a polite live region, again when only the sequence changes', () => {
      const region = (): HTMLElement => el().querySelector('[aria-live="polite"].announcer') as HTMLElement;
      render(card(FOUR(), { announcement: { seq: 1, text: 'Moved Tune r0 to position 3' } }));
      const first = region().querySelector('span');
      expect(region().textContent?.trim()).toBe('Moved Tune r0 to position 3');

      render(card(FOUR(), { announcement: { seq: 2, text: 'Moved Tune r0 to position 3' } }));
      const second = region().querySelector('span');

      expect(second?.textContent).toBe(first?.textContent);
      expect(second).not.toBe(first);
    });

    it('is silent without an announcement', () => {
      render(card(FOUR()));

      expect(el().querySelector('.announcer')?.textContent?.trim()).toBe('');
    });
  });
});
