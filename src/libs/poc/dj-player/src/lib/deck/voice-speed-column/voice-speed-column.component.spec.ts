import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { VoiceSpeedColumnComponent } from './voice-speed-column.component';
import { DeckContext } from '../deck-context';
import { DjPlayerEngine } from '../../engine/dj-player-engine';

interface MockEngine {
  mutedVoices: WritableSignal<readonly boolean[]>;
  effectiveMutes: WritableSignal<readonly boolean[]>;
  speedMultiplier: WritableSignal<number>;
  setVoiceMuted: ReturnType<typeof vi.fn>;
  setVoiceHeld: ReturnType<typeof vi.fn>;
  clearVoiceMutes: ReturnType<typeof vi.fn>;
  setSpeed: ReturnType<typeof vi.fn>;
  jumpSpeedUp: ReturnType<typeof vi.fn>;
  jumpSpeedDown: ReturnType<typeof vi.fn>;
  homeSpeed: ReturnType<typeof vi.fn>;
}

function makeEngine(): MockEngine {
  return {
    mutedVoices: signal<readonly boolean[]>([false, false, false]),
    effectiveMutes: signal<readonly boolean[]>([false, false, false]),
    speedMultiplier: signal<number>(1),
    setVoiceMuted: vi.fn(),
    setVoiceHeld: vi.fn(),
    clearVoiceMutes: vi.fn(),
    setSpeed: vi.fn(),
    jumpSpeedUp: vi.fn(),
    jumpSpeedDown: vi.fn(),
    homeSpeed: vi.fn(),
  };
}

describe('VoiceSpeedColumnComponent', () => {
  let fixture: ComponentFixture<VoiceSpeedColumnComponent>;
  let engine: MockEngine;

  function build(deckLabel: string): void {
    // Lets a single test build two decks in sequence (to compare their accessible names) without
    // TestBed refusing a second `configureTestingModule` call against an already-instantiated module.
    TestBed.resetTestingModule();
    engine = makeEngine();

    TestBed.configureTestingModule({
      imports: [VoiceSpeedColumnComponent],
      providers: [
        DeckContext,
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
      ],
    });

    const context = TestBed.inject(DeckContext);
    context.adopt({ id: 'test', label: deckLabel });

    fixture = TestBed.createComponent(VoiceSpeedColumnComponent);
    fixture.detectChanges();
  }

  function holdButton(voice: number): HTMLButtonElement {
    return fixture.nativeElement.querySelectorAll('.voice-hold')[voice] as HTMLButtonElement;
  }

  it("reads 'Kill' for an audible voice and 'Punch In' once that voice is muted", () => {
    build('A');

    expect(holdButton(0).textContent?.trim()).toBe('Kill');

    engine.mutedVoices.set([true, false, false]);
    fixture.detectChanges();

    expect(holdButton(0).textContent?.trim()).toBe('Punch In');
  });

  it("orders the speed buttons +50% / Home / −50% top to bottom", () => {
    build('A');

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.speed-jump-buttons button')
    ).map((button) => button.textContent?.trim());

    expect(labels).toEqual(['+50%', 'Home', '−50%']);
  });

  it("suffix voice and speed control names with their own deck, distinct from the other deck", () => {
    build('A');
    const aKill = holdButton(0).getAttribute('aria-label');
    fixture.destroy();

    build('B');
    const bKill = holdButton(0).getAttribute('aria-label');

    expect(aKill).toBe('Kill voice 1 deck A');
    expect(bKill).toBe('Kill voice 1 deck B');
    expect(aKill).not.toBe(bKill);
  });
});
