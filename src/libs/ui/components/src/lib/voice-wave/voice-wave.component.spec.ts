import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaveVoice, WaveWindowState } from './model/wave-view';
import { VoiceWaveRenderer, type WaveWindowHandle } from './voice-wave-renderer';
import { VoiceWaveComponent } from './voice-wave.component';

describe('VoiceWaveComponent', () => {
  let fixture: ComponentFixture<VoiceWaveComponent>;
  let handle: { setOverride: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let register: ReturnType<typeof vi.fn>;

  const host = () => fixture.nativeElement as HTMLElement;

  function create(bank = 'deck-a', voice: WaveVoice = 1): void {
    fixture = TestBed.createComponent(VoiceWaveComponent);
    fixture.componentRef.setInput('bank', bank);
    fixture.componentRef.setInput('voice', voice);
    // The first pass registers the canvas; the second runs the effect that reads the new handle.
    fixture.detectChanges();
    fixture.detectChanges();
  }

  beforeEach(() => {
    handle = { setOverride: vi.fn(), release: vi.fn() };
    register = vi.fn((): WaveWindowHandle => handle);
    TestBed.configureTestingModule({
      imports: [VoiceWaveComponent],
      providers: [{ provide: VoiceWaveRenderer, useValue: { register } }],
    });
  });

  it('registers its canvas with the renderer for its bank and voice', () => {
    create('deck-b', 2);

    expect(register).toHaveBeenCalledTimes(1);
    const [canvas, bank, voice] = register.mock.calls[0];
    expect(canvas).toBe(host().querySelector('canvas'));
    expect([bank, voice]).toEqual(['deck-b', 2]);
  });

  it('is hidden from assistive technology and takes no focus', () => {
    create();

    expect(host().getAttribute('aria-hidden')).toBe('true');
    expect(host().hasAttribute('tabindex')).toBe(false);
    expect(host().querySelector('[tabindex], button, a, input')).toBeNull();
  });

  it('passes a state override to its handle and clears it on null', () => {
    create();
    expect(handle.setOverride).toHaveBeenLastCalledWith(null);

    fixture.componentRef.setInput('state', 'held' satisfies WaveWindowState);
    fixture.detectChanges();
    expect(handle.setOverride).toHaveBeenLastCalledWith('held');

    fixture.componentRef.setInput('state', null);
    fixture.detectChanges();
    expect(handle.setOverride).toHaveBeenLastCalledWith(null);
  });

  it('releases its window on destroy', () => {
    create();
    expect(handle.release).not.toHaveBeenCalled();

    fixture.destroy();

    expect(handle.release).toHaveBeenCalledTimes(1);
  });
});
