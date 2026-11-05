import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoopSelectedRowComponent,
  type LoopLengthModel,
  type LoopSelectedRowModel,
} from './loop-selected-row.component';

const loopSteps = {
  disabled: false,
  downAccessibleName: 'Shorten Loop 3 by a beat',
  upAccessibleName: 'Lengthen Loop 3 by a beat',
};

const loopLength: LoopLengthModel = {
  text: '16 BEATS',
  options: [
    { beats: 8, label: '8 BEATS', selected: false },
    { beats: 16, label: '16 BEATS', selected: true },
  ],
  halveAccessibleName: 'Halve Loop 3',
  doubleAccessibleName: 'Double Loop 3',
  pickAccessibleName: 'Loop length Loop 3',
  steps: loopSteps,
};

const loop: LoopSelectedRowModel = {
  id: 'm3',
  empty: false,
  name: 'Loop 3',
  kindLabel: 'LOOP',
  spanText: '02:39.4–02:47.5',
  activity: 'idle',
  ready: true,
  triggerDisabled: false,
  deleteDisabled: false,
  length: { ...loopLength, noEnd: { label: 'NO END', selected: false } },
  move: {
    stepText: '1 BEAT',
    options: [
      { beats: 1, label: '1 BEAT', selected: true },
      { beats: 4, label: '4 BEATS', selected: false },
    ],
    earlierAccessibleName: 'Move Loop 3 earlier',
    laterAccessibleName: 'Move Loop 3 later',
    pickAccessibleName: 'Move step',
  },
  triggerAccessibleName: 'Trigger Loop 3',
  deleteAccessibleName: 'Delete Loop 3',
  playNowDisabled: false,
  playNowAccessibleName: 'Play now Loop 3',
  sharesGlobal: true,
  globalDisabled: false,
  globalAccessibleName: 'GBL Loop 3',
  wraps: false,
  wrapDisabled: false,
  wrapAccessibleName: 'WRAP Loop 3',
  renameDisabled: false,
  renameLabel: 'Rename Loop 3',
  nameMaxLength: 48,
};

// jsdom has no `PointerEvent` constructor — a `MouseEvent` carries the `button` the key reads.
function pointerDown(button: number): Event {
  return new MouseEvent('pointerdown', { bubbles: true, button });
}

const cue: Partial<LoopSelectedRowModel> = {
  kindLabel: 'CUE',
  length: {
    ...loopLength,
    text: 'NO END',
    options: [],
    steps: { ...loopSteps, disabled: true },
    noEnd: { label: 'NO END', selected: true },
  },
};

describe('LoopSelectedRowComponent', () => {
  let fixture: ComponentFixture<LoopSelectedRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoopSelectedRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(LoopSelectedRowComponent);
    setModel({});
  });

  function setModel(overrides: Partial<LoopSelectedRowModel>): void {
    fixture.componentRef.setInput('model', { ...loop, ...overrides });
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const button = (selector: string): HTMLButtonElement =>
    el().querySelector(`${selector} button`) as HTMLButtonElement;
  const named = (label: string): HTMLButtonElement =>
    el().querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const display = (): HTMLElement => el().querySelector('.display') as HTMLElement;

  it('emits each key press on its own output', () => {
    const emitted: string[] = [];
    const c = fixture.componentInstance;
    c.trigger.subscribe(() => emitted.push('trigger'));
    c.playNow.subscribe(() => emitted.push('playNow'));
    c.toggleGlobal.subscribe(() => emitted.push('toggleGlobal'));
    c.toggleWrap.subscribe(() => emitted.push('toggleWrap'));
    c.deleteMarker.subscribe(() => emitted.push('delete'));
    for (const control of [
      'loop-toggle',
      'loop-play-now',
      'loop-global',
      'loop-wrap',
      'loop-delete',
    ]) {
      button(`[data-control="${control}"]`).click();
    }
    expect(emitted).toEqual([
      'trigger',
      'playNow',
      'toggleGlobal',
      'toggleWrap',
      'delete',
    ]);
  });

  describe('the play and play-now keys press on pointer down', () => {
    const cases = [
      ['trigger', 'loop-toggle'],
      ['playNow', 'loop-play-now'],
    ] as const;

    for (const [output, control] of cases) {
      it(`emits ${output} once on a primary pointer down, and not again for the click after it`, () => {
        let emitted = 0;
        fixture.componentInstance[output].subscribe(() => emitted++);

        button(`[data-control="${control}"]`).dispatchEvent(pointerDown(0));
        expect(emitted).toBe(1);

        button(`[data-control="${control}"]`).dispatchEvent(
          new MouseEvent('click', { bubbles: true, detail: 1 })
        );
        expect(emitted).toBe(1);
      });

      it(`never emits ${output} on a secondary-button pointer down or while disabled`, () => {
        let emitted = 0;
        fixture.componentInstance[output].subscribe(() => emitted++);

        button(`[data-control="${control}"]`).dispatchEvent(pointerDown(2));
        expect(emitted).toBe(0);

        setModel({ triggerDisabled: true, playNowDisabled: true });
        button(`[data-control="${control}"]`).dispatchEvent(pointerDown(0));
        expect(emitted).toBe(0);
      });
    }
  });

  it('relays the halve and double keys', () => {
    const emitted: string[] = [];
    fixture.componentInstance.halve.subscribe(() => emitted.push('halve'));
    fixture.componentInstance.double.subscribe(() => emitted.push('double'));
    named('Halve Loop 3').click();
    named('Double Loop 3').click();
    expect(emitted).toEqual(['halve', 'double']);
  });

  it('relays the one-beat keys as -1 and 1, each with its own control id', () => {
    const emitted: number[] = [];
    fixture.componentInstance.stepLength.subscribe((direction) => emitted.push(direction));

    button('[data-control="loop-length-down"]').click();
    button('[data-control="loop-length-up"]').click();

    expect(emitted).toEqual([-1, 1]);
  });

  it('relays the Length picker\'s No End item on clearEnd, marked selected on a cue', () => {
    const emitted: string[] = [];
    fixture.componentInstance.clearEnd.subscribe(() => emitted.push('clearEnd'));
    setModel(cue);
    expect(button('[data-control="loop-length-down"]').disabled).toBe(true);
    expect(button('[data-control="loop-length-up"]').disabled).toBe(true);

    (el().querySelector('button[data-control="loop-length"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item')
    );
    expect(items.map((item) => item.textContent?.replace(/^\s*check\s*/, '').trim())).toEqual([
      'NO END',
    ]);
    expect(items[0].classList.contains('selected')).toBe(true);
    items[0].click();

    expect(emitted).toEqual(['clearEnd']);
  });

  it('follows sharesGlobal in the GBL switch and the display text', () => {
    const gbl = (): HTMLButtonElement => button('[data-control="loop-global"]');
    expect(gbl().getAttribute('aria-pressed')).toBe('true');
    expect(gbl().hasAttribute('data-lit')).toBe(true);
    const litLamp = gbl().querySelector('.icon')?.textContent?.trim();
    expect(display().getAttribute('aria-label')).not.toContain('own settings');
    setModel({ sharesGlobal: false });
    expect(gbl().getAttribute('aria-pressed')).toBe('false');
    expect(gbl().hasAttribute('data-lit')).toBe(false);
    const unlitLamp = gbl().querySelector('.icon')?.textContent?.trim();
    expect(litLamp).toBeTruthy();
    expect(unlitLamp).toBeTruthy();
    expect(unlitLamp).not.toBe(litLamp);
    expect(display().getAttribute('aria-label')).toContain('own settings');
  });

  it('follows wraps in the WRAP key and the display text', () => {
    const wrap = (): HTMLButtonElement => button('[data-control="loop-wrap"]');
    expect(wrap().textContent).toContain('WRAP');
    expect(wrap().getAttribute('aria-pressed')).toBe('false');
    expect(wrap().hasAttribute('data-lit')).toBe(false);
    const unlitLamp = wrap().querySelector('.icon')?.textContent?.trim();
    expect(display().getAttribute('aria-label')).not.toContain('wraps');
    setModel({ wraps: true });
    expect(wrap().getAttribute('aria-pressed')).toBe('true');
    expect(wrap().hasAttribute('data-lit')).toBe(true);
    const litLamp = wrap().querySelector('.icon')?.textContent?.trim();
    expect(litLamp).toBeTruthy();
    expect(litLamp).not.toBe(unlitLamp);
    expect(display().getAttribute('aria-label')).toContain('wraps');
  });

  it('disables play now, GBL and WRAP from the model', () => {
    setModel({ playNowDisabled: true, globalDisabled: true, wrapDisabled: true });
    expect(button('[data-control="loop-play-now"]').disabled).toBe(true);
    expect(button('[data-control="loop-global"]').disabled).toBe(true);
    expect(button('[data-control="loop-wrap"]').disabled).toBe(true);
  });

  describe('the Length and Move rows', () => {
    const picker = (control: string): HTMLButtonElement =>
      el().querySelector(`button[data-control="${control}"]`) as HTMLButtonElement;
    const openPicker = (control: string): void => {
      picker(control).click();
      fixture.detectChanges();
    };
    const menuItems = (): HTMLButtonElement[] =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .dropdown-menu-item'));

    it('draws the Length row through the shared size control, with the wheel off and the control id on the readout', () => {
      const control = el().querySelector('lib-loop-size-control') as HTMLElement;
      expect(control).not.toBeNull();
      expect(control.querySelector('.tag')?.textContent).toBe('Length');
      expect(control.querySelector('[data-control="loop-length"]')).not.toBeNull();

      const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
      picker('loop-length').dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(false);
    });

    it('relays Move earlier and later', () => {
      const emitted: string[] = [];
      fixture.componentInstance.moveEarlier.subscribe(() => emitted.push('earlier'));
      fixture.componentInstance.moveLater.subscribe(() => emitted.push('later'));
      button('[data-control="loop-move-earlier"]').click();
      button('[data-control="loop-move-later"]').click();
      expect(emitted).toEqual(['earlier', 'later']);
    });

    it('opens the Length picker and emits the picked beats', () => {
      const picked: number[] = [];
      fixture.componentInstance.pickLength.subscribe((beats) => picked.push(beats));
      expect(picker('loop-length').textContent).toContain('16 BEATS');
      openPicker('loop-length');
      expect(menuItems().map((item) => item.classList.contains('selected'))).toEqual([
        false,
        false,
        true,
      ]);
      menuItems().find((item) => item.textContent?.includes('8 BEATS'))?.click();
      expect(picked).toEqual([8]);
    });

    it('opens the Move step picker and emits the picked beats', () => {
      const picked: (number | 'frame')[] = [];
      fixture.componentInstance.pickMoveStep.subscribe((beats) => picked.push(beats));
      openPicker('loop-move-step');
      menuItems().find((item) => item.textContent?.includes('4 BEATS'))?.click();
      expect(picked).toEqual([4]);
    });

    it('draws a readout with no options as plain text that keeps its control id', () => {
      setModel({
        length: { ...loopLength, text: '7.8s', options: [] },
        move: { ...loop.move, options: [] },
      });
      for (const [control, text] of [
        ['loop-length', '7.8s'],
        ['loop-move-step', '1 BEAT'],
      ]) {
        const readout = el().querySelector(`[data-control="${control}"]`) as HTMLElement;
        expect(readout.tagName).not.toBe('BUTTON');
        expect(readout.textContent?.trim()).toBe(text);
      }
    });

    it('names each picker with its readout so the visible text is in the name', () => {
      expect(picker('loop-length').getAttribute('aria-label')).toBe(
        'Loop length Loop 3, 16 BEATS'
      );
    });
  });

  it('carries running, queued and not-ready in the display text', () => {
    expect(display().getAttribute('aria-label')).toBe('Loop 3, loop, 02:39.4–02:47.5');
    setModel({ activity: 'running' });
    expect(display().getAttribute('aria-label')).toContain('running');
    setModel({ activity: 'queued' });
    expect(display().getAttribute('aria-label')).toContain('queued');
    setModel({ activity: 'idle', ready: false });
    expect(display().getAttribute('aria-label')).toContain('not ready');
  });

  describe('renaming', () => {
    const nameButton = (): HTMLButtonElement | null =>
      el().querySelector('.display lib-inline-edit-title button');
    const field = (): HTMLInputElement => el().querySelector('.display input[type="text"]') as HTMLInputElement;

    function commit(value: string): void {
      nameButton()?.click();
      fixture.detectChanges();
      field().value = value;
      field().dispatchEvent(new Event('input'));
      field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }

    it('emits the typed name, named for the field by the model', () => {
      const renames: { id: string; name: string }[] = [];
      fixture.componentInstance.rename.subscribe((rename) => renames.push(rename));
      expect(nameButton()?.getAttribute('aria-label')).toBe('Rename Loop 3');

      commit('Chorus drop');

      expect(renames).toEqual([{ id: 'm3', name: 'Chorus drop' }]);
    });

    it('allows an empty name, which returns the marker to its place name', () => {
      const renames: { id: string; name: string }[] = [];
      fixture.componentInstance.rename.subscribe((rename) => renames.push(rename));

      commit('   ');

      expect(renames).toEqual([{ id: 'm3', name: '' }]);
    });

    describe('while open', () => {
      const renaming = (): boolean => display().hasAttribute('data-renaming');

      function open(): void {
        nameButton()?.click();
        fixture.detectChanges();
      }

      it('marks the display while the editor is open and clears after a commit', () => {
        expect(renaming()).toBe(false);
        open();
        expect(renaming()).toBe(true);

        field().value = 'Chorus drop';
        field().dispatchEvent(new Event('input'));
        field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        fixture.detectChanges();

        expect(renaming()).toBe(false);
      });

      it('clears after a cancel', () => {
        open();
        field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();

        expect(renaming()).toBe(false);
      });

      it('stays marked while the selection changes under the open editor', () => {
        open();
        setModel({ id: 'm4', name: 'Loop 4' });

        expect(renaming()).toBe(true);
      });

      it('clears when the row empties', () => {
        open();
        setModel({ id: null, empty: true, name: '', kindLabel: '', spanText: '' });

        expect(renaming()).toBe(false);
      });

      it('commits to the marker the edit was opened on, even after the model moved on', () => {
        const renames: { id: string; name: string }[] = [];
        fixture.componentInstance.rename.subscribe((rename) => renames.push(rename));
        open();
        setModel({ id: 'm4', name: 'Loop 4' });

        field().value = 'Chorus drop';
        field().dispatchEvent(new Event('input'));
        field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(renames).toEqual([{ id: 'm3', name: 'Chorus drop' }]);
      });

      it('commits an emptied name to the marker the edit was opened on', () => {
        const renames: { id: string; name: string }[] = [];
        fixture.componentInstance.rename.subscribe((rename) => renames.push(rename));
        open();
        setModel({ id: 'm4', name: 'Loop 4' });

        field().value = '';
        field().dispatchEvent(new Event('input'));
        field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(renames).toEqual([{ id: 'm3', name: '' }]);
      });

      it('commits a draft that matches the name of the marker the selection moved to', () => {
        const renames: { id: string; name: string }[] = [];
        fixture.componentInstance.rename.subscribe((rename) => renames.push(rename));
        open();
        setModel({ id: 'm4', name: 'Loop 4' });

        field().value = 'Loop 4';
        field().dispatchEvent(new Event('input'));
        field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(renames).toEqual([{ id: 'm3', name: 'Loop 4' }]);
      });

      it('emits nothing for an untouched draft when the selection moved under the open editor', () => {
        const renames: { id: string; name: string }[] = [];
        fixture.componentInstance.rename.subscribe((rename) => renames.push(rename));
        open();
        setModel({ id: 'm4', name: 'Loop 4' });

        field().dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        expect(renames).toEqual([]);
        expect(renaming()).toBe(false);
      });
    });

    it('shows the name as plain text when renaming is disabled', () => {
      setModel({ renameDisabled: true });

      expect(nameButton()).toBeNull();
      expect(display().textContent).toContain('Loop 3');
    });

    it('offers no editor with nothing selected', () => {
      setModel({ empty: true, name: '', kindLabel: '', spanText: '' });

      expect(el().querySelector('lib-inline-edit-title')).toBeNull();
    });
  });

  it('blanks the display and disables every key but the Move row when nothing is selected', () => {
    setModel({
      empty: true,
      name: '',
      kindLabel: '',
      spanText: '',
      length: { ...loopLength, text: '—', options: [], steps: { ...loopSteps, disabled: true } },
    });
    expect(display().getAttribute('aria-label')).toBe('nothing selected');
    expect(display().textContent?.trim()).toBe('');
    const live = Array.from(
      el().querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')
    ).filter((control) => !control.disabled);
    expect(live.map((control) => control.closest('[data-control]')?.getAttribute('data-control'))).toEqual([
      'loop-move-earlier',
      'loop-move-step',
      'loop-move-later',
    ]);
    for (const control of ['loop-length-down', 'loop-length-up']) {
      expect(button(`[data-control="${control}"]`).disabled).toBe(true);
    }
    expect(el().querySelector('[data-control="loop-length"]')).not.toBeNull();
    expect(button('[data-control="loop-global"]').hasAttribute('aria-pressed')).toBe(false);
    expect(button('[data-control="loop-wrap"]').hasAttribute('aria-pressed')).toBe(false);
  });
});
