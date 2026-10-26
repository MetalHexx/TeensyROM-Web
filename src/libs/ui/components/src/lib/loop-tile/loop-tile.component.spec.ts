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
};

describe('LoopTileComponent', () => {
  let fixture: ComponentFixture<LoopTileComponent>;
  let triggers: number;
  let selects: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoopTileComponent] }).compileComponents();
    fixture = TestBed.createComponent(LoopTileComponent);
    triggers = 0;
    selects = 0;
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

  it('names the two buttons from the model', () => {
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

  it('flags a tile that is not ready', () => {
    expect(el().getAttribute('data-ready')).toBe('true');
    setModel({ ready: false });
    expect(el().getAttribute('data-ready')).toBe('false');
  });
});
