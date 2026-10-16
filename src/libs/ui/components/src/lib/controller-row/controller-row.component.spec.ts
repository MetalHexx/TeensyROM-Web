import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { ControllerRowComponent, ControllerRowModel } from './controller-row.component';

function modelWith(overrides: Partial<ControllerRowModel> = {}): ControllerRowModel {
  return {
    name: 'Launch Control XL',
    statusText: 'Listening',
    listening: true,
    toggleAccessibleName: 'Listen to Launch Control XL',
    portChoice: null,
    ...overrides,
  };
}

describe('ControllerRowComponent', () => {
  let fixture: ComponentFixture<ControllerRowComponent>;
  let component: ControllerRowComponent;
  let listening: boolean[];
  let ports: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ControllerRowComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(ControllerRowComponent);
    component = fixture.componentInstance;
    listening = [];
    ports = [];
    component.listeningChange.subscribe((value) => listening.push(value));
    component.portSelect.subscribe((id) => ports.push(id));

    setModel();
  });

  function setModel(overrides: Partial<ControllerRowModel> = {}): void {
    fixture.componentRef.setInput('model', modelWith(overrides));
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function toggle(): HTMLButtonElement {
    return root().querySelector('button[role="switch"]') as HTMLButtonElement;
  }

  function portSelect(): HTMLSelectElement | null {
    return root().querySelector('select');
  }

  function choosePort(id: string): void {
    const select = portSelect();
    if (!select) throw new Error('no port select');
    select.value = id;
    select.dispatchEvent(new Event('change'));
  }

  it('shows the name and the status as text', () => {
    expect(root().textContent).toContain('Launch Control XL');
    expect(root().textContent).toContain('Listening');
  });

  it('renders the listening state as a named switch', () => {
    expect(toggle().getAttribute('aria-label')).toBe('Listen to Launch Control XL');
    expect(toggle().getAttribute('aria-checked')).toBe('true');

    setModel({ listening: false, statusText: 'Off' });

    expect(toggle().getAttribute('aria-checked')).toBe('false');
  });

  it('emits listeningChange with the new position when the switch is flipped', () => {
    toggle().click();
    setModel({ listening: false });
    toggle().click();

    expect(listening).toEqual([false, true]);
  });

  describe('port choice', () => {
    const portChoice = {
      accessibleName: 'Port for Launch Control XL',
      options: [
        { id: 'in-1', label: 'Launch Control XL' },
        { id: 'in-2', label: 'MIDIIN2 (Launch Control XL)' },
      ],
    };

    it('shows no port select without a port choice', () => {
      expect(portSelect()).toBeNull();
    });

    it('shows a named select of the options when there is a port choice', () => {
      setModel({ statusText: 'Choose its port', portChoice });

      const options = Array.from(portSelect()?.querySelectorAll('option') ?? []);

      expect(portSelect()?.getAttribute('aria-label')).toBe('Port for Launch Control XL');
      expect(options.slice(1).map((option) => option.textContent?.trim())).toEqual([
        'Launch Control XL',
        'MIDIIN2 (Launch Control XL)',
      ]);
    });

    it('emits portSelect with the chosen port id', () => {
      setModel({ statusText: 'Choose its port', portChoice });

      choosePort('in-2');

      expect(ports).toEqual(['in-2']);
    });

    it('emits nothing for the placeholder option', () => {
      setModel({ statusText: 'Choose its port', portChoice });

      choosePort('');

      expect(ports).toEqual([]);
    });
  });
});
