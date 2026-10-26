import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopTileComponent, type LoopTileModel } from './loop-tile.component';

const tile: LoopTileModel = {
  id: 'a',
  name: 'Item 3',
  kind: 'loop',
  lengthText: '7.8s',
  activity: 'idle',
  selected: false,
  ready: true,
  triggerAccessibleName: 'Trigger Item 3',
  selectAccessibleName: 'Select Item 3, loop, 7.8 seconds',
  ownSettings: false,
  playNowAccessibleName: 'Play now Item 3',
};

describe('LoopTileComponent', () => {
  let fixture: ComponentFixture<LoopTileComponent>;
  let triggers: number;
  let selects: number;
  let playNows: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoopTileComponent] }).compileComponents();
    fixture = TestBed.createComponent(LoopTileComponent);
    triggers = 0;
    selects = 0;
    playNows = 0;
    fixture.componentInstance.playNow.subscribe(() => playNows++);
    fixture.componentInstance.trigger.subscribe(() => triggers++);
    fixture.componentInstance.selectTile.subscribe(() => selects++);
    setModel({});
  });

  function setModel(overrides: Partial<LoopTileModel>): void {
    fixture.componentRef.setInput('model', { ...tile, ...overrides });
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const triggerButton = (): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>('lib-synth-key button') as HTMLButtonElement;
  const playNowButton = (): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>('lib-synth-key.play-now button') as HTMLButtonElement;
  const selectButton = (): HTMLButtonElement =>
    el().querySelector<HTMLButtonElement>('button.select') as HTMLButtonElement;
  const stateLight = (): string | null =>
    triggerButton().getAttribute('data-state-light');

  it('emits trigger from the key and selectTile from the select button, never both', () => {
    triggerButton().click();
    expect([triggers, selects]).toEqual([1, 0]);
    selectButton().click();
    expect([triggers, selects]).toEqual([1, 1]);
  });

  it('emits playNow from its own key, apart from trigger and selectTile', () => {
    playNowButton().click();
    expect([triggers, playNows, selects]).toEqual([0, 1, 0]);
    triggerButton().click();
    selectButton().click();
    expect([triggers, playNows, selects]).toEqual([1, 1, 1]);
  });

  it('names the three buttons from the model', () => {
    expect(playNowButton().getAttribute('aria-label')).toBe('Play now Item 3');
    expect(triggerButton().getAttribute('aria-label')).toBe('Trigger Item 3');
    expect(selectButton().getAttribute('aria-label')).toBe('Select Item 3, loop, 7.8 seconds');
  });

  it('marks only a selected tile with aria-current', () => {
    expect(selectButton().hasAttribute('aria-current')).toBe(false);
    setModel({ selected: true });
    expect(selectButton().getAttribute('aria-current')).toBe('true');
  });

  it('maps the activity onto the key light', () => {
    expect(stateLight()).toBe('off');
    setModel({ activity: 'queued' });
    expect(stateLight()).toBe('paused');
    setModel({ activity: 'running' });
    expect(stateLight()).toBe('playing');
  });

  it('draws progress and a playhead only for a running loop', () => {
    fixture.componentRef.setInput('progressPercent', 53);
    fixture.detectChanges();
    expect(el().querySelector('.fill')).toBeNull();
    setModel({ activity: 'running' });
    const fill = el().querySelector<HTMLElement>('.fill');
    expect(fill?.style.width).toBe('53%');
    expect(el().querySelector('.playhead')).not.toBeNull();
  });

  it('draws a single tick for a cue and no fill, even while running', () => {
    setModel({ kind: 'cue', lengthText: 'CUE', activity: 'running' });
    expect(el().querySelector('.cue-tick')).not.toBeNull();
    expect(el().querySelector('.fill')).toBeNull();
  });

  it('draws the own-settings dot only for a marker with its own settings, hidden from assistive tech', () => {
    expect(el().querySelector('.own')).toBeNull();
    setModel({ ownSettings: true });
    expect(el().querySelector('.own')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('flags a tile that is not ready', () => {
    expect(el().getAttribute('data-ready')).toBe('true');
    setModel({ ready: false });
    expect(el().getAttribute('data-ready')).toBe('false');
  });
});
