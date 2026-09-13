import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BindingCardComponent,
  type BindingCardModel,
  type BindingPortModel,
} from './binding-card.component';

function port(id: string, label: string): BindingPortModel {
  return { id, label };
}

function model(overrides: Partial<BindingCardModel> = {}): BindingCardModel {
  return {
    accessibleName: 'MIDI binding deck A',
    heading: 'Deck A',
    ports: [],
    selectedPortId: null,
    portsEnabled: false,
    enableDisabled: false,
    identifyDisabled: false,
    selectAccessibleName: 'Output port deck A',
    enableAccessibleName: 'Enable MIDI deck A',
    identifyAccessibleName: 'Identify deck A',
    errors: [],
    ...overrides,
  };
}

describe('BindingCardComponent', () => {
  let fixture: ComponentFixture<BindingCardComponent>;
  let component: BindingCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BindingCardComponent] }).compileComponents();

    fixture = TestBed.createComponent(BindingCardComponent);
    component = fixture.componentInstance;
  });

  function setModel(next: BindingCardModel): void {
    fixture.componentRef.setInput('model', next);
    fixture.detectChanges();
  }

  function select(): HTMLSelectElement {
    return fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    ) as HTMLButtonElement;
  }

  it('renders the heading verbatim from the model', () => {
    setModel(model({ heading: 'Deck B' }));

    expect(
      (
        fixture.nativeElement.querySelector('.binding-deck-label') as HTMLElement
      ).textContent?.trim()
    ).toBe('Deck B');
  });

  it('renders the disabled "MIDI not enabled" option and disables the select when ports are not enabled', () => {
    setModel(model({ portsEnabled: false }));

    expect(select().disabled).toBe(true);
    expect(select().textContent).toContain('MIDI not enabled');
  });

  it('renders the placeholder and every port option when ports are enabled', () => {
    setModel(
      model({
        portsEnabled: true,
        ports: [port('port-1', 'Cart A (Acme)'), port('port-2', 'Cart B (Acme)')],
        selectedPortId: 'port-2',
      })
    );

    const options = Array.from(select().querySelectorAll('option'));
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      '— select a port —',
      'Cart A (Acme)',
      'Cart B (Acme)',
    ]);
    expect(select().disabled).toBe(false);
  });

  it('disables the select when ports are enabled but the port list is empty', () => {
    setModel(model({ portsEnabled: true, ports: [] }));

    expect(select().disabled).toBe(true);
  });

  it('emits the chosen port id on portSelect, including the empty placeholder value', () => {
    setModel(
      model({
        portsEnabled: true,
        ports: [port('port-1', 'Cart A (Acme)')],
      })
    );
    const emitted: string[] = [];
    component.portSelect.subscribe((value) => emitted.push(value));

    const options = select().querySelectorAll('option');
    (options[1] as HTMLOptionElement).selected = true;
    select().dispatchEvent(new Event('change'));
    (options[0] as HTMLOptionElement).selected = true;
    select().dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['port-1', '']);
  });

  it('fires enableMidi and identify, and respects their own disabled flags', () => {
    setModel(model({ enableDisabled: true, identifyDisabled: true }));
    expect(button('Enable MIDI').disabled).toBe(true);
    expect(button('Identify').disabled).toBe(true);

    setModel(model({ enableDisabled: false, identifyDisabled: false }));
    const enabled: void[] = [];
    const identified: void[] = [];
    component.enableMidi.subscribe(() => enabled.push(undefined));
    component.identify.subscribe(() => identified.push(undefined));

    button('Enable MIDI').click();
    button('Identify').click();

    expect(enabled.length).toBe(1);
    expect(identified.length).toBe(1);
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

  it('defaults data-layout to stacked and reflects the layout input', () => {
    setModel(model());
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('data-layout')).toBe('stacked');

    fixture.componentRef.setInput('layout', 'inline');
    fixture.detectChanges();

    expect(host.getAttribute('data-layout')).toBe('inline');
  });
});
