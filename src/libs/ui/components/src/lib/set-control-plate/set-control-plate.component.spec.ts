import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SetControlPlateComponent, type SetControlPlateModel } from './set-control-plate.component';

const plate: SetControlPlateModel = {
  positionText: '03/08',
  title: 'Cybernoid II',
  author: 'Jeroen Tel',
  previousDisabled: false,
  nextDisabled: false,
  loadDisabled: false,
  selectAccessibleName: 'Set selection, 3 of 8, Cybernoid II by Jeroen Tel',
  previousAccessibleName: 'Select the previous row',
  nextAccessibleName: 'Select the next row',
  loadAAccessibleName: 'Load the selected row on deck A',
  loadBAccessibleName: 'Load the selected row on deck B',
};

describe('SetControlPlateComponent', () => {
  let fixture: ComponentFixture<SetControlPlateComponent>;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SetControlPlateComponent] }).compileComponents();
    fixture = TestBed.createComponent(SetControlPlateComponent);
    emitted = [];
    const c = fixture.componentInstance;
    c.selectPrevious.subscribe(() => emitted.push('previous'));
    c.selectNext.subscribe(() => emitted.push('next'));
    c.loadA.subscribe(() => emitted.push('loadA'));
    c.loadB.subscribe(() => emitted.push('loadB'));
    setModel({});
  });

  function setModel(overrides: Partial<SetControlPlateModel>): void {
    fixture.componentRef.setInput('model', { ...plate, ...overrides });
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const key = (selector: string): HTMLButtonElement =>
    el().querySelector(`${selector} button`) as HTMLButtonElement;

  it('emits each key on its own output', () => {
    key('[data-control="set-select"] [data-part="up"]').click();
    key('[data-control="set-select"] [data-part="down"]').click();
    key('[data-control="set-load-a"]').click();
    key('[data-control="set-load-b"]').click();

    expect(emitted).toEqual(['previous', 'next', 'loadA', 'loadB']);
  });

  it('labels the Load keys and names every key from the model', () => {
    expect(key('[data-control="set-load-a"]').textContent).toContain('Load A');
    expect(key('[data-control="set-load-b"]').textContent).toContain('Load B');
    expect(key('[data-control="set-load-a"]').getAttribute('aria-label')).toBe(
      'Load the selected row on deck A'
    );
    expect(key('[data-part="up"]').getAttribute('aria-label')).toBe('Select the previous row');
  });

  it('reads the selection out, and names the readout in words', () => {
    const readout = el().querySelector('.readout') as HTMLElement;

    expect(readout.getAttribute('aria-label')).toBe(plate.selectAccessibleName);
    expect(readout.textContent).toContain('SEL');
    expect(readout.textContent).toContain('03/08');
    expect(readout.textContent).toContain('Cybernoid II · Jeroen Tel');
  });

  it('shows the dashes with nothing selected', () => {
    setModel({ positionText: '— / —', title: null, author: null });

    expect(el().querySelector('.readout')?.textContent).toContain('— / —');
    expect(el().querySelector('.tune')?.textContent?.trim()).toBe('');
  });

  it('disables only what the model disables', () => {
    setModel({ previousDisabled: true, loadDisabled: true });
    key('[data-part="up"]').click();
    key('[data-control="set-load-a"]').click();
    key('[data-control="set-load-b"]').click();
    key('[data-part="down"]').click();

    expect(emitted).toEqual(['next']);
  });
});
