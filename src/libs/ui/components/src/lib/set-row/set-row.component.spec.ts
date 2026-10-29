import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SET_ROW_DRAG_TYPE, SetRowComponent, type SetRowModel } from './set-row.component';

const row: SetRowModel = {
  id: 'r3',
  numberText: '03',
  title: 'Cybernoid II',
  author: 'Jeroen Tel',
  detail: { kind: 'counts', text: '2 loops · 1 cue' },
  lengthText: '03:58',
  decks: [{ letter: 'A', light: 'playing' }],
  selected: false,
  pending: false,
  accessibleName: 'Row 3 of 8, Cybernoid II by Jeroen Tel, 2 loops, 03:58, on deck A, playing',
  handleAccessibleName: 'Move Cybernoid II, Alt and arrow keys move it',
  removeAccessibleName: 'Remove Cybernoid II from the set',
};

describe('SetRowComponent', () => {
  let fixture: ComponentFixture<SetRowComponent>;
  let emitted: unknown[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SetRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(SetRowComponent);
    emitted = [];
    const c = fixture.componentInstance;
    c.selectRow.subscribe(() => emitted.push('select'));
    c.remove.subscribe(() => emitted.push('remove'));
    c.moveBy.subscribe((delta) => emitted.push(['moveBy', delta]));
    setModel({});
  });

  function setModel(overrides: Partial<SetRowModel>): void {
    fixture.componentRef.setInput('model', { ...row, ...overrides });
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const handle = (): HTMLElement => el().querySelector('.handle') as HTMLElement;
  const select = (): HTMLButtonElement => el().querySelector('.select') as HTMLButtonElement;

  function keydown(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  it('selects on press and removes from the remove key', () => {
    select().click();
    (el().querySelector('[data-part="remove"] button') as HTMLButtonElement).click();

    expect(emitted).toEqual(['select', 'remove']);
  });

  it('moves by one with Alt+ArrowUp and Alt+ArrowDown on the handle', () => {
    const up = keydown(handle(), { key: 'ArrowUp', altKey: true });
    keydown(handle(), { key: 'ArrowDown', altKey: true });

    expect(emitted).toEqual([
      ['moveBy', -1],
      ['moveBy', 1],
    ]);
    expect(up.defaultPrevented).toBe(true);
  });

  it('leaves the arrows alone without Alt', () => {
    const event = keydown(handle(), { key: 'ArrowDown' });

    expect(emitted).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  describe('dragging the handle', () => {
    function startDrag(): { dataTransfer: Record<string, unknown>; data: Map<string, string> } {
      const data = new Map<string, string>();
      const dataTransfer = {
        effectAllowed: 'uninitialized',
        setData: (type: string, value: string) => data.set(type, value),
        setDragImage: vi.fn(),
      };
      const dragstart = new Event('dragstart', { bubbles: true });
      Object.defineProperty(dragstart, 'dataTransfer', { value: dataTransfer });
      handle().dispatchEvent(dragstart);
      fixture.detectChanges();
      return { dataTransfer, data };
    }

    it('puts its id on the drag under the set row type, allowing copy and move', () => {
      const { dataTransfer, data } = startDrag();

      expect(data.get(SET_ROW_DRAG_TYPE)).toBe('r3');
      expect(dataTransfer['effectAllowed']).toBe('copyMove');
    });

    it('dims the row until the drag ends', () => {
      startDrag();
      expect(el().hasAttribute('data-dragging')).toBe(true);

      handle().dispatchEvent(new Event('dragend', { bubbles: true }));
      fixture.detectChanges();
      expect(el().hasAttribute('data-dragging')).toBe(false);
    });

    it('announces the drag start with the event and leaves the drag image to the host', () => {
      const started: DragEvent[] = [];
      fixture.componentInstance.dragStarted.subscribe((event) => started.push(event));
      const { dataTransfer } = startDrag();

      expect(started).toHaveLength(1);
      expect(started[0].type).toBe('dragstart');
      expect(dataTransfer['setDragImage']).not.toHaveBeenCalled();
    });
  });

  it('names the controls and marks the selected row current', () => {
    expect(select().getAttribute('aria-label')).toBe(row.accessibleName);
    expect(handle().getAttribute('aria-label')).toBe(row.handleAccessibleName);
    expect(el().querySelector('[data-part="remove"] button')?.getAttribute('aria-label')).toBe(
      row.removeAccessibleName
    );
    expect(el().hasAttribute('aria-current')).toBe(false);

    setModel({ selected: true });
    expect(el().getAttribute('aria-current')).toBe('true');
  });

  it('lights the decks that hold the tune', () => {
    setModel({
      decks: [
        { letter: 'A', light: 'playing' },
        { letter: 'B', light: 'paused' },
      ],
    });
    const lights = Array.from(el().querySelectorAll('.deck')).map((deck) => [
      deck.textContent?.trim(),
      deck.getAttribute('data-light'),
    ]);

    expect(lights).toEqual([
      ['A', 'playing'],
      ['B', 'paused'],
    ]);
  });

  describe('detail', () => {
    const detail = (): HTMLElement => el().querySelector('.detail') as HTMLElement;

    it('shows counts and unavailable text as given', () => {
      expect(detail().textContent?.trim()).toBe('2 loops · 1 cue');

      setModel({ detail: { kind: 'unavailable', text: 'Not on this device' } });
      expect(detail().textContent?.trim()).toBe('Not on this device');
      expect(detail().getAttribute('data-kind')).toBe('unavailable');
    });

    it.each([
      ['fetching', 'Fetching'],
      ['analyzing', 'Analyzing'],
    ] as const)('shows %s with an indeterminate bar', (kind, word) => {
      setModel({ detail: { kind } });

      expect(detail().textContent).toContain(word);
      expect(detail().querySelector('.bar')).not.toBeNull();
    });
  });

  describe('pending', () => {
    beforeEach(() => setModel({ pending: true, detail: { kind: 'fetching' } }));

    it('has no handle and no remove key', () => {
      expect(handle()).toBeNull();
      expect(el().querySelector('[data-part="remove"]')).toBeNull();
    });

    it('cannot be selected', () => {
      select().click();

      expect(select().disabled).toBe(true);
      expect(emitted).toEqual([]);
    });
  });
});
