import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import type { BindingCardModel, BindingPortModel } from '../binding-card/binding-card.component';
import { BindingPlateComponent } from './binding-plate.component';

function port(id: string, label: string, takenBy?: string): BindingPortModel {
  return { id, label, takenBy };
}

function model(overrides: Partial<BindingCardModel> = {}): BindingCardModel {
  return {
    accessibleName: 'MIDI binding deck A',
    heading: 'Deck A',
    ports: [],
    selectedPortId: null,
    portsEnabled: false,
    portPlaceholder: '— MIDI not enabled —',
    enableVisible: true,
    enableDisabled: false,
    identifyDisabled: false,
    selectAccessibleName: 'Cartridge deck A',
    enableAccessibleName: 'Enable MIDI deck A',
    identifyAccessibleName: 'Identify deck A',
    errors: [],
    ...overrides,
  };
}

describe('BindingPlateComponent', () => {
  let fixture: ComponentFixture<BindingPlateComponent>;
  let component: BindingPlateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BindingPlateComponent] }).compileComponents();

    fixture = TestBed.createComponent(BindingPlateComponent);
    component = fixture.componentInstance;
  });

  function setModel(next: BindingCardModel): void {
    fixture.componentRef.setInput('model', next);
    fixture.detectChanges();
  }

  function select(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  }

  function byName(name: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  }

  it('renders exactly one select, named from the model', () => {
    setModel(model());

    expect(fixture.nativeElement.querySelectorAll('select').length).toBe(1);
    expect(select().getAttribute('aria-label')).toBe('Cartridge deck A');
  });

  it('renders the disabled placeholder and disables the select when ports are not enabled', () => {
    setModel(model({ portsEnabled: false }));

    expect(select().disabled).toBe(true);
    expect(select().textContent).toContain('MIDI not enabled');
  });

  it('renders the placeholder and every port option when ports are enabled', () => {
    setModel(
      model({
        portsEnabled: true,
        portPlaceholder: '— select a cartridge —',
        ports: [port('port-1', 'Cart A (Acme)'), port('port-2', 'Cart B (Acme)')],
        selectedPortId: 'port-2',
      })
    );

    const options = Array.from(select().querySelectorAll('option'));
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      '— select a cartridge —',
      'Cart A (Acme)',
      'Cart B (Acme)',
    ]);
    expect(select().disabled).toBe(false);
  });

  it('disables the select when ports are enabled but the port list is empty', () => {
    setModel(model({ portsEnabled: true, ports: [] }));

    expect(select().disabled).toBe(true);
  });

  it('renders a taken port option disabled, with the taking deck named in its own text', () => {
    setModel(
      model({
        portsEnabled: true,
        ports: [port('port-1', 'Cart A (Acme)'), port('port-2', 'Cart B (Acme)', 'B')],
      })
    );

    const option = select().querySelector('option[value="port-2"]') as HTMLOptionElement;
    expect(option.textContent?.trim()).toBe('Cart B (Acme) — taken by Deck B —');
    expect(option.disabled).toBe(true);
  });

  it('draws the select as absent only while the selected option is flagged absent', () => {
    const ports = [
      port('port-1', 'Cart A (Acme)'),
      { ...port('port-2', 'Cart B · absent'), absent: true },
    ];

    setModel(model({ portsEnabled: true, ports, selectedPortId: 'port-2' }));
    expect(select().classList.contains('absent')).toBe(true);

    setModel(model({ portsEnabled: true, ports, selectedPortId: 'port-1' }));
    expect(select().classList.contains('absent')).toBe(false);

    setModel(model({ portsEnabled: true, ports, selectedPortId: null }));
    expect(select().classList.contains('absent')).toBe(false);
  });

  it('emits the chosen port id on portSelect, including the empty placeholder value', () => {
    setModel(model({ portsEnabled: true, ports: [port('port-1', 'Cart A (Acme)')] }));
    const emitted: string[] = [];
    component.portSelect.subscribe((value) => emitted.push(value));

    const options = select().querySelectorAll('option');
    (options[1] as HTMLOptionElement).selected = true;
    select().dispatchEvent(new Event('change'));
    (options[0] as HTMLOptionElement).selected = true;
    select().dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['port-1', '']);
  });

  it('emits enableMidi and identify when their keys are pressed', () => {
    setModel(model());
    const enabled: void[] = [];
    const identified: void[] = [];
    component.enableMidi.subscribe(() => enabled.push(undefined));
    component.identify.subscribe(() => identified.push(undefined));

    byName('Enable MIDI deck A').click();
    byName('Identify deck A').click();

    expect(enabled.length).toBe(1);
    expect(identified.length).toBe(1);
  });

  it('disables the Enable MIDI and Identify keys by their own flags', () => {
    setModel(model({ enableDisabled: true, identifyDisabled: true }));
    expect(byName('Enable MIDI deck A').disabled).toBe(true);
    expect(byName('Identify deck A').disabled).toBe(true);

    setModel(model({ enableDisabled: false, identifyDisabled: false }));
    expect(byName('Enable MIDI deck A').disabled).toBe(false);
    expect(byName('Identify deck A').disabled).toBe(false);
  });

  it('shows the Enable MIDI key only while enableVisible is true', () => {
    setModel(model({ enableVisible: true }));
    expect(byName('Enable MIDI deck A')).toBeTruthy();

    setModel(model({ enableVisible: false }));
    expect(byName('Enable MIDI deck A')).toBeFalsy();
  });

  it('renders one role="alert" per error entry, in order', () => {
    setModel(model({ errors: ['first error', 'second error'] }));

    const alerts = Array.from(fixture.nativeElement.querySelectorAll('[role="alert"]'));
    expect(alerts.map((alert) => (alert as HTMLElement).textContent?.trim())).toEqual([
      'first error',
      'second error',
    ]);
  });

  it('renders no alerts when errors is empty', () => {
    setModel(model({ errors: [] }));

    expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBe(0);
  });
});
