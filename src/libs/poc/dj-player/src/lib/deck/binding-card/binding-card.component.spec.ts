import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { BindingCardComponent } from './binding-card.component';
import { DeckContext } from '../deck-context';
import { DeckMidiBinding } from '../../midi/deck-midi-binding';
import { MidiAccessService } from '../../midi/midi-access.service';
import type { MidiAccessState, MidiPortOption } from '../../midi/midi-access.service';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import type { EngineState } from '../../engine/dj-player-engine';

interface MockBinding {
  selectedPortId: WritableSignal<string | null>;
  lastError: WritableSignal<string | null>;
  selectPort: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
}

interface MockMidiAccess {
  accessState: WritableSignal<MidiAccessState>;
  ports: WritableSignal<readonly MidiPortOption[]>;
  lastError: WritableSignal<string | null>;
  requestAccess: ReturnType<typeof vi.fn>;
}

interface MockEngine {
  state: WritableSignal<EngineState>;
}

describe('BindingCardComponent', () => {
  let fixture: ComponentFixture<BindingCardComponent>;
  let binding: MockBinding;
  let midiAccess: MockMidiAccess;
  let engine: MockEngine;

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    binding = {
      selectedPortId: signal<string | null>(null),
      lastError: signal<string | null>(null),
      selectPort: vi.fn(),
      identify: vi.fn(),
      restore: vi.fn(),
    };
    midiAccess = {
      accessState: signal<MidiAccessState>('idle'),
      ports: signal<readonly MidiPortOption[]>([]),
      lastError: signal<string | null>(null),
      requestAccess: vi.fn().mockResolvedValue(undefined),
    };
    engine = { state: signal<EngineState>('stopped') };

    TestBed.configureTestingModule({
      imports: [BindingCardComponent],
      providers: [
        DeckContext,
        { provide: DeckMidiBinding, useValue: binding as unknown as DeckMidiBinding },
        { provide: MidiAccessService, useValue: midiAccess as unknown as MidiAccessService },
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
      ],
    });

    const context = TestBed.inject(DeckContext);
    context.adopt({ id: 'test', label: deckLabel });

    fixture = TestBed.createComponent(BindingCardComponent);
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    ) as HTMLButtonElement;
  }

  it('shows a single disabled "MIDI not enabled" option until access is granted', () => {
    build('A');

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.textContent).toContain('MIDI not enabled');
  });

  it('gates Identify on granted access, a selected port, and an idle engine', () => {
    build('A');
    expect(button('Identify').disabled).toBe(true);

    midiAccess.accessState.set('granted');
    midiAccess.ports.set([{ id: 'port-1', name: 'Cart A', manufacturer: 'Acme' }]);
    binding.selectedPortId.set('port-1');
    fixture.detectChanges();
    expect(button('Identify').disabled).toBe(false);

    engine.state.set('playing');
    fixture.detectChanges();
    expect(button('Identify').disabled).toBe(true);
  });

  it('enabling MIDI requests page-level access, then restores this deck\'s own binding', async () => {
    build('A');

    button('Enable MIDI').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(midiAccess.requestAccess).toHaveBeenCalled();
    expect(binding.restore).toHaveBeenCalled();
  });

  it('identifies through this deck\'s own binding, naming the port by its enumerated position', () => {
    build('A');
    midiAccess.accessState.set('granted');
    midiAccess.ports.set([{ id: 'port-1', name: 'Cart A', manufacturer: 'Acme' }]);
    binding.selectedPortId.set('port-1');
    fixture.detectChanges();

    button('Identify').click();

    expect(binding.identify).toHaveBeenCalledWith('ASID-DJ-0 PORT 1');
  });

  it('renders the no-ports-found message once access is granted with an empty port list', () => {
    build('A');
    midiAccess.accessState.set('granted');
    midiAccess.ports.set([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('no output ports were found');
  });

  it("renders this deck's own binding error as an alert", () => {
    build('A');
    binding.lastError.set('That port is already claimed. Pick a different one.');
    fixture.detectChanges();

    const alerts: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="alert"]')
    );
    expect(alerts.some((el) => el.textContent?.includes('already claimed'))).toBe(true);
  });

  it("suffix every control's accessible name with its own deck, distinct from the other deck", () => {
    build('A');
    const identifyA = button('Identify').getAttribute('aria-label');
    fixture.destroy();

    build('B');
    const identifyB = button('Identify').getAttribute('aria-label');

    expect(identifyA).toBe('Identify deck A');
    expect(identifyB).toBe('Identify deck B');
    expect(identifyA).not.toBe(identifyB);
  });
});
