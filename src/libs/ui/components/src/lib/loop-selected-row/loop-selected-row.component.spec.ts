import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopSelectedRowComponent, type LoopSelectedRowModel } from './loop-selected-row.component';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';

function boundary(tag: 'Start' | 'End', overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  const isStart = tag === 'Start';
  return {
    key: {
      label: isStart ? 'In' : 'Out',
      accessibleName: isStart ? 'Loop in' : 'Loop out',
      control: isStart ? 'loop-in' : 'loop-set-end',
      disabled: false,
    },
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [],
    nudgeAccessibleName: `Nudge ${tag}`,
    earlierAccessibleName: `Move ${tag} earlier`,
    laterAccessibleName: `Move ${tag} later`,
    ...overrides,
  };
}

const loop: LoopSelectedRowModel = {
  empty: false,
  name: 'Item 3',
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
    options: [
      { beats: 8, label: '8 BEATS', selected: false },
      { beats: 16, label: '16 BEATS', selected: true },
    ],
    halveAccessibleName: 'Halve Item 3',
    doubleAccessibleName: 'Double Item 3',
    pickAccessibleName: 'Loop length Item 3',
  },
  move: {
    stepText: '1 BEAT',
    options: [
      { beats: 1, label: '1 BEAT', selected: true },
      { beats: 4, label: '4 BEATS', selected: false },
    ],
    earlierAccessibleName: 'Move Item 3 earlier',
    laterAccessibleName: 'Move Item 3 later',
    pickAccessibleName: 'Move step',
  },
  triggerAccessibleName: 'Trigger Item 3',
  clearEndAccessibleName: 'Clear end of Item 3',
  deleteAccessibleName: 'Delete Item 3',
  playNowDisabled: false,
  playNowAccessibleName: 'Play now Item 3',
  sharesGlobal: true,
  globalDisabled: false,
  globalAccessibleName: 'GBL Item 3',
  wraps: false,
  wrapDisabled: false,
  wrapAccessibleName: 'WRAP Item 3',
  renameDisabled: false,
  renameLabel: 'Rename Item 3',
  nameMaxLength: 48,
};

const cue: Partial<LoopSelectedRowModel> = {
  kindLabel: 'CUE',
  clearEndDisabled: true,
  end: boundary('End', { empty: true }),
  length: { ...loop.length, text: 'NO END', options: [] },
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
  const range = (control: string): HTMLInputElement =>
    el().querySelector(`[data-control="${control}"] input[type="range"]`) as HTMLInputElement;
  const display = (): HTMLElement => el().querySelector('.display') as HTMLElement;

  it('emits each key press on its own output', () => {
    const emitted: string[] = [];
    const c = fixture.componentInstance;
    c.trigger.subscribe(() => emitted.push('trigger'));
    c.playNow.subscribe(() => emitted.push('playNow'));
    c.toggleGlobal.subscribe(() => emitted.push('toggleGlobal'));
    c.toggleWrap.subscribe(() => emitted.push('toggleWrap'));
    c.clearEnd.subscribe(() => emitted.push('clearEnd'));
    c.deleteMarker.subscribe(() => emitted.push('delete'));
    for (const control of [
      'loop-toggle',
      'loop-play-now',
      'loop-global',
      'loop-wrap',
      'loop-clear-end',
      'loop-delete',
    ]) {
      button(`[data-control="${control}"]`).click();
    }
    expect(emitted).toEqual([
      'trigger',
      'playNow',
      'toggleGlobal',
      'toggleWrap',
      'clearEnd',
      'delete',
    ]);
  });

  it('relays the In and Out keys, each from its own boundary', () => {
    const emitted: string[] = [];
    fixture.componentInstance.setIn.subscribe(() => emitted.push('setIn'));
    fixture.componentInstance.setOut.subscribe(() => emitted.push('setOut'));
    button('[data-control="loop-in"]').click();
    button('[data-control="loop-set-end"]').click();
    expect(emitted).toEqual(['setIn', 'setOut']);
    expect(el().querySelector('[data-control="loop-start"] [data-control="loop-in"]')).not.toBeNull();
    expect(el().querySelector('[data-control="loop-end"] [data-control="loop-set-end"]')).not.toBeNull();
  });

  it("keeps an enabled Out key on a cue's empty End row", () => {
    setModel(cue);
    expect(button('[data-control="loop-set-end"]').disabled).toBe(false);
    expect(range('loop-end').disabled).toBe(true);
  });

  it('relays the halve and double keys', () => {
    const emitted: string[] = [];
    fixture.componentInstance.halve.subscribe(() => emitted.push('halve'));
    fixture.componentInstance.double.subscribe(() => emitted.push('double'));
    named('Halve Item 3').click();
    named('Double Item 3').click();
    expect(emitted).toEqual(['halve', 'double']);
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

  it('makes Clear End icon-only', () => {
    const clear = button('[data-control="loop-clear-end"]');
    expect(clear.textContent?.trim()).toBe('close');
    expect(clear.querySelector('.text')).toBeNull();
  });

  it('disables play now, GBL and WRAP from the model', () => {
    setModel({ playNowDisabled: true, globalDisabled: true, wrapDisabled: true });
    expect(button('[data-control="loop-play-now"]').disabled).toBe(true);
    expect(button('[data-control="loop-global"]').disabled).toBe(true);
    expect(button('[data-control="loop-wrap"]').disabled).toBe(true);
  });

  it('tags nudges with the boundary they came from', () => {
    const inputs: unknown[] = [];
    const commits: unknown[] = [];
    fixture.componentInstance.nudgeInput.subscribe((v) => inputs.push(v));
    fixture.componentInstance.nudgeCommit.subscribe((v) => commits.push(v));
    range('loop-end').value = '8';
    range('loop-end').dispatchEvent(new Event('input'));
    range('loop-start').value = '-4';
    range('loop-start').dispatchEvent(new Event('change'));
    expect(inputs).toEqual([{ boundary: 'end', offsetFrames: 8 }]);
    expect(commits).toEqual([{ boundary: 'start', offsetFrames: -4 }]);
  });

  it('tags edge moves with the boundary and direction', () => {
    const moves: unknown[] = [];
    fixture.componentInstance.moveEdge.subscribe((v) => moves.push(v));
    button('[data-control="loop-start"] [data-part="move-earlier"]').click();
    button('[data-control="loop-end"] [data-part="move-later"]').click();
    expect(moves).toEqual([
      { boundary: 'start', direction: -1 },
      { boundary: 'end', direction: 1 },
    ]);
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
      expect(menuItems().map((item) => item.classList.contains('selected'))).toEqual([false, true]);
      menuItems().find((item) => item.textContent?.includes('8 BEATS'))?.click();
      expect(picked).toEqual([8]);
    });

    it('opens the Move step picker and emits the picked beats', () => {
      const picked: number[] = [];
      fixture.componentInstance.pickMoveStep.subscribe((beats) => picked.push(beats));
      openPicker('loop-move-step');
      menuItems().find((item) => item.textContent?.includes('4 BEATS'))?.click();
      expect(picked).toEqual([4]);
    });

    it('draws a readout with no options as plain text that keeps its control id', () => {
      setModel({
        length: { ...loop.length, text: '7.8s', options: [] },
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
        'Loop length Item 3, 16 BEATS'
      );
    });
  });

  it('feeds each drag offset to its own boundary', () => {
    fixture.componentRef.setInput('startDragOffset', 5);
    fixture.componentRef.setInput('endDragOffset', -9);
    fixture.detectChanges();
    const readout = (control: string): string =>
      el().querySelector(`[data-control="${control}"] .readout`)?.textContent?.trim() ?? '';
    expect(readout('loop-start')).toBe('+5 fr');
    expect(readout('loop-end')).toBe('−9 fr');
  });

  it('carries running, queued and not-ready in the display text', () => {
    expect(display().getAttribute('aria-label')).toBe('Item 3, loop, 02:39.4–02:47.5');
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
      const renames: string[] = [];
      fixture.componentInstance.rename.subscribe((name) => renames.push(name));
      expect(nameButton()?.getAttribute('aria-label')).toBe('Rename Item 3');

      commit('Chorus drop');

      expect(renames).toEqual(['Chorus drop']);
    });

    it('allows an empty name, which returns the marker to its place name', () => {
      const renames: string[] = [];
      fixture.componentInstance.rename.subscribe((name) => renames.push(name));

      commit('   ');

      expect(renames).toEqual(['']);
    });

    it('shows the name as plain text when renaming is disabled', () => {
      setModel({ renameDisabled: true });

      expect(nameButton()).toBeNull();
      expect(display().textContent).toContain('Item 3');
    });

    it('offers no editor with nothing selected', () => {
      setModel({ empty: true, name: '', kindLabel: '', spanText: '' });

      expect(el().querySelector('lib-inline-edit-title')).toBeNull();
    });
  });

  it('disables Clear End on a cue and the empty End boundary with it', () => {
    setModel(cue);
    expect(button('[data-control="loop-clear-end"]').disabled).toBe(true);
    expect(button('[data-control="loop-set-end"]').disabled).toBe(false);
    expect(range('loop-start').disabled).toBe(false);
  });

  it('blanks the display and disables every key and boundary but the Move row when nothing is selected', () => {
    setModel({
      empty: true,
      name: '',
      kindLabel: '',
      spanText: '',
      end: boundary('End', { empty: true }),
      length: { ...loop.length, text: '—', options: [] },
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
    for (const control of ['loop-in', 'loop-set-end']) {
      expect(button(`[data-control="${control}"]`).disabled).toBe(true);
    }
    expect(el().querySelector('[data-control="loop-length"]')).not.toBeNull();
    expect(button('[data-control="loop-global"]').hasAttribute('aria-pressed')).toBe(false);
    expect(button('[data-control="loop-wrap"]').hasAttribute('aria-pressed')).toBe(false);
  });
});
