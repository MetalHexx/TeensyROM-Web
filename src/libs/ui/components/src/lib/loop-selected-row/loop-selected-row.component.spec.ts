import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopSelectedRowComponent, type LoopSelectedRowModel } from './loop-selected-row.component';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';

function boundary(tag: string, overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  return {
    tag,
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge ${tag}`,
    previousAccessibleName: `Snap ${tag} previous`,
    nextAccessibleName: `Snap ${tag} next`,
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
  setEndDisabled: false,
  clearEndDisabled: false,
  deleteDisabled: false,
  start: boundary('Start'),
  end: boundary('End'),
  triggerAccessibleName: 'Trigger Item 3',
  setEndAccessibleName: 'Set end of Item 3',
  clearEndAccessibleName: 'Clear end of Item 3',
  deleteAccessibleName: 'Delete Item 3',
  playNowDisabled: false,
  playNowAccessibleName: 'Play now Item 3',
  sharesGlobal: true,
  globalDisabled: false,
  globalAccessibleName: 'GBL Item 3',
};

const cue: Partial<LoopSelectedRowModel> = {
  kindLabel: 'CUE',
  clearEndDisabled: true,
  end: boundary('End', { empty: true }),
};

describe('LoopSelectedRowComponent', () => {
  let fixture: ComponentFixture<LoopSelectedRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoopSelectedRowComponent] }).compileComponents();
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
  const range = (control: string): HTMLInputElement =>
    el().querySelector(`[data-control="${control}"] input[type="range"]`) as HTMLInputElement;
  const display = (): HTMLElement => el().querySelector('.display') as HTMLElement;

  it('emits each key press on its own output', () => {
    const emitted: string[] = [];
    const c = fixture.componentInstance;
    c.trigger.subscribe(() => emitted.push('trigger'));
    c.playNow.subscribe(() => emitted.push('playNow'));
    c.toggleGlobal.subscribe(() => emitted.push('toggleGlobal'));
    c.clearEnd.subscribe(() => emitted.push('clearEnd'));
    c.deleteMarker.subscribe(() => emitted.push('delete'));
    for (const control of [
      'loop-toggle',
      'loop-play-now',
      'loop-global',
      'loop-clear-end',
      'loop-delete',
    ]) {
      button(`[data-control="${control}"]`).click();
    }
    expect(emitted).toEqual(['trigger', 'playNow', 'toggleGlobal', 'clearEnd', 'delete']);
  });

  it('shows the End boundary on a loop and no Set End key anywhere', () => {
    expect(el().querySelector('[data-control="loop-set-end"]')).toBeNull();
    expect(range('loop-end')).not.toBeNull();
    expect(el().querySelector('[data-control="loop-end"] [data-part="snap-next"]')).not.toBeNull();
  });

  it("puts Set End in a cue's End slot, in place of the snap keys, and emits setEnd from it", () => {
    setModel(cue);
    const emitted: string[] = [];
    fixture.componentInstance.setEnd.subscribe(() => emitted.push('setEnd'));
    button('[data-control="loop-end"] [data-control="loop-set-end"]').click();
    expect(emitted).toEqual(['setEnd']);
    expect(el().querySelector('[data-control="loop-end"] [data-part^="snap-"]')).toBeNull();
    expect(el().querySelector('[data-control="loop-end"] input')).toBeNull();
  });

  it("disables a cue's Set End key from the model", () => {
    setModel({ ...cue, setEndDisabled: true });
    expect(button('[data-control="loop-set-end"]').disabled).toBe(true);
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

  it('makes Clear End icon-only', () => {
    const clear = button('[data-control="loop-clear-end"]');
    expect(clear.textContent?.trim()).toBe('close');
    expect(clear.querySelector('.text')).toBeNull();
  });

  it('disables play now and GBL from the model', () => {
    setModel({ playNowDisabled: true, globalDisabled: true });
    expect(button('[data-control="loop-play-now"]').disabled).toBe(true);
    expect(button('[data-control="loop-global"]').disabled).toBe(true);
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

  it('tags snaps with the boundary and direction', () => {
    const snaps: unknown[] = [];
    fixture.componentInstance.snap.subscribe((v) => snaps.push(v));
    button('[data-control="loop-start"] [data-part="snap-previous"]').click();
    button('[data-control="loop-end"] [data-part="snap-next"]').click();
    expect(snaps).toEqual([
      { boundary: 'start', direction: 'previous' },
      { boundary: 'end', direction: 'next' },
    ]);
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

  it('disables Clear End on a cue and the empty End boundary with it', () => {
    setModel(cue);
    expect(button('[data-control="loop-clear-end"]').disabled).toBe(true);
    expect(button('[data-control="loop-set-end"]').disabled).toBe(false);
    expect(range('loop-start').disabled).toBe(false);
  });

  it('blanks the display and disables every key and boundary when nothing is selected', () => {
    setModel({ empty: true, name: '', kindLabel: '', spanText: '', end: boundary('End', { empty: true }) });
    expect(display().getAttribute('aria-label')).toBe('nothing selected');
    expect(display().textContent?.trim()).toBe('');
    const controls = Array.from(el().querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'));
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((control) => control.disabled)).toBe(true);
    expect(el().querySelector('[data-control="loop-set-end"]')).toBeNull();
    expect(button('[data-control="loop-global"]').hasAttribute('aria-pressed')).toBe(false);
  });
});
