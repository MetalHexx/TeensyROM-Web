import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoopBoundaryComponent, type LoopBoundaryModel } from './loop-boundary.component';

const boundary: LoopBoundaryModel = {
  key: { label: 'In', accessibleName: 'Loop in', control: 'loop-in', disabled: false },
  empty: false,
  disabled: false,
  offsetFrames: 0,
  rangeFrames: 50,
  tickPercents: [20, 70],
  nudgeAccessibleName: 'Nudge start',
  earlierAccessibleName: 'Move start earlier',
  laterAccessibleName: 'Move start later',
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
  const part = (name: string): HTMLButtonElement =>
    el().querySelector(`[data-part="${name}"] button`) as HTMLButtonElement;
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

  it('spans the range and draws one tick per beat', () => {
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

  describe('the key', () => {
    const keyHost = (): HTMLElement => el().querySelector('[data-part="key"]') as HTMLElement;

    it('shows the label and carries the control id for the learn overlay', () => {
      expect(keyHost().textContent).toContain('In');
      expect(keyHost().getAttribute('data-control')).toBe('loop-in');
      setModel({
        key: { label: 'Out', accessibleName: 'Loop out', control: 'loop-set-end', disabled: false },
      });
      expect(keyHost().textContent).toContain('Out');
      expect(keyHost().getAttribute('data-control')).toBe('loop-set-end');
    });

    it('emits keyPress, and not when its own flag disables it', () => {
      const presses: number[] = [];
      fixture.componentInstance.keyPress.subscribe(() => presses.push(1));
      part('key').click();
      expect(presses).toHaveLength(1);
      setModel({ key: { ...boundary.key, disabled: true } });
      expect(part('key').disabled).toBe(true);
    });

    it('stays enabled on a cue-style empty boundary beside an inert strip', () => {
      setModel({
        empty: true,
        key: { label: 'Out', accessibleName: 'Loop out', control: 'loop-set-end', disabled: false },
      });
      expect(part('key').disabled).toBe(false);
      expect(range().disabled).toBe(true);
      expect(readout()).toBe('—');
    });
  });

  it('emits the edge move from each arrow', () => {
    const emitted: string[] = [];
    fixture.componentInstance.moveEarlier.subscribe(() => emitted.push('earlier'));
    fixture.componentInstance.moveLater.subscribe(() => emitted.push('later'));
    part('move-later').click();
    part('move-earlier').click();
    expect(emitted).toEqual(['later', 'earlier']);
  });

  it('draws an empty boundary with a dash readout and the strip and arrows disabled', () => {
    setModel({ empty: true, offsetFrames: 9 });
    expect(readout()).toBe('—');
    expect(range().disabled).toBe(true);
    expect(part('move-earlier').disabled).toBe(true);
    expect(part('move-later').disabled).toBe(true);
    expect(el().querySelector('.tick')).toBeNull();
    expect(el().querySelector('.bar')).toBeNull();
  });

  it('disables the strip and arrows when disabled, and the strip alone for a zero range', () => {
    setModel({ disabled: true });
    expect(range().disabled).toBe(true);
    expect(part('move-later').disabled).toBe(true);
    setModel({ rangeFrames: 0 });
    expect(range().disabled).toBe(true);
    expect(part('move-later').disabled).toBe(false);
  });
});
