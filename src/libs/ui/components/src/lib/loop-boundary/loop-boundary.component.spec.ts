import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopBoundaryComponent, type LoopBoundaryModel } from './loop-boundary.component';

const boundary: LoopBoundaryModel = {
  tag: 'Start',
  empty: false,
  disabled: false,
  offsetFrames: 0,
  rangeFrames: 50,
  tickPercents: [20, 70],
  previousDisabled: false,
  nextDisabled: false,
  nudgeAccessibleName: 'Nudge start',
  previousAccessibleName: 'Snap start to previous moment',
  nextAccessibleName: 'Snap start to next moment',
};

describe('LoopBoundaryComponent', () => {
  let fixture: ComponentFixture<LoopBoundaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoopBoundaryComponent] }).compileComponents();
    fixture = TestBed.createComponent(LoopBoundaryComponent);
    setModel({});
  });

  function setModel(overrides: Partial<LoopBoundaryModel>): void {
    fixture.componentRef.setInput('model', { ...boundary, ...overrides });
    fixture.detectChanges();
  }

  function set(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const range = (): HTMLInputElement => el().querySelector('input[type="range"]') as HTMLInputElement;
  const snap = (part: string): HTMLButtonElement =>
    el().querySelector(`[data-part="${part}"] button`) as HTMLButtonElement;
  const readout = (): string => el().querySelector('.readout')?.textContent?.trim() ?? '';

  function drag(type: 'input' | 'change', value: number): void {
    range().value = String(value);
    range().dispatchEvent(new Event(type));
  }

  it('formats the readout as zero, plus and minus (U+2212) frames', () => {
    expect(readout()).toBe('0 fr');
    setModel({ offsetFrames: 6 });
    expect(readout()).toBe('+6 fr');
    setModel({ offsetFrames: -7 });
    expect(readout()).toBe('−7 fr');
    expect(range().getAttribute('aria-valuetext')).toBe('−7 fr');
  });

  it('follows the drag offset while it is non-null, then the committed one', () => {
    setModel({ offsetFrames: 3 });
    set('dragOffsetFrames', -12);
    expect(readout()).toBe('−12 fr');
    expect(range().value).toBe('-12');
    set('dragOffsetFrames', null);
    expect(readout()).toBe('+3 fr');
  });

  it('spans the range and draws one tick per moment', () => {
    expect(range().min).toBe('-50');
    expect(range().max).toBe('50');
    expect(el().querySelectorAll('.tick')).toHaveLength(2);
  });

  it('emits nudgeInput while dragging and nudgeCommit on release', () => {
    const inputs: number[] = [];
    const commits: number[] = [];
    fixture.componentInstance.nudgeInput.subscribe((v) => inputs.push(v));
    fixture.componentInstance.nudgeCommit.subscribe((v) => commits.push(v));
    drag('input', 10);
    expect([inputs, commits]).toEqual([[10], []]);
    drag('change', 12);
    expect([inputs, commits]).toEqual([[10], [12]]);
  });

  it('emits the snap direction from each key', () => {
    const emitted: string[] = [];
    fixture.componentInstance.snapPrevious.subscribe(() => emitted.push('previous'));
    fixture.componentInstance.snapNext.subscribe(() => emitted.push('next'));
    snap('snap-next').click();
    snap('snap-previous').click();
    expect(emitted).toEqual(['next', 'previous']);
  });

  it('disables a single snap when the model says so', () => {
    setModel({ previousDisabled: true });
    expect(snap('snap-previous').disabled).toBe(true);
    expect(snap('snap-next').disabled).toBe(false);
  });

  it('draws an empty boundary with a dash readout and every control disabled', () => {
    setModel({ empty: true, offsetFrames: 9 });
    expect(readout()).toBe('—');
    expect(range().disabled).toBe(true);
    expect(snap('snap-previous').disabled).toBe(true);
    expect(snap('snap-next').disabled).toBe(true);
    expect(el().querySelector('.tick')).toBeNull();
    expect(el().querySelector('.bar')).toBeNull();
  });

  it('disables every control when disabled, and the strip alone for a zero range', () => {
    setModel({ disabled: true });
    expect(range().disabled).toBe(true);
    expect(snap('snap-next').disabled).toBe(true);
    setModel({ rangeFrames: 0 });
    expect(range().disabled).toBe(true);
    expect(snap('snap-next').disabled).toBe(false);
  });
});
