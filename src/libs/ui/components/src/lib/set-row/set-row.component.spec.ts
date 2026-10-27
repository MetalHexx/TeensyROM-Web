import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('puts its id on the drag under the set row type', () => {
    const data = new Map<string, string>();
    const dragstart = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragstart, 'dataTransfer', {
      value: { setData: (type: string, value: string) => data.set(type, value) },
    });
    handle().dispatchEvent(dragstart);

    expect(data.get(SET_ROW_DRAG_TYPE)).toBe('r3');
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
