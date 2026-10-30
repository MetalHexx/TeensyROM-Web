import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { WaveVoice, WaveWindowState } from './model/wave-view';
import { VoiceWaveRenderer, type WaveWindowHandle } from './voice-wave-renderer';

/**
 * A 44px dark-glass window that draws one SID voice's waveform in a neon trace. It is purely
 * presentational: it hands its canvas to the shared `VoiceWaveRenderer`, which draws it off the main
 * thread from the feed its `bank` receives, so the component holds no audio or deck state.
 *
 * `bank` is an opaque id tying the window to a fed bank of three voices; `voice` (0, 1 or 2) picks
 * the voice and with it the trace colour (`--synth-wave-1`, `--synth-wave-2`, `--synth-wave-3`). By
 * default the window follows its bank's state (playing, held or flat); `state` poses it apart from
 * the bank. Until the renderer draws, or if it cannot, the window shows empty glass.
 *
 * The window is decorative: hidden from assistive technology and never focusable.
 *
 * @example
 * ```html
 * <lib-voice-wave bank="deck-a" [voice]="0" />
 * <lib-voice-wave bank="deck-a" [voice]="1" state="held" />
 * ```
 */
@Component({
  selector: 'lib-voice-wave',
  templateUrl: './voice-wave.component.html',
  styleUrl: './voice-wave.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class VoiceWaveComponent {
  /** The shared renderer that draws this window's canvas. */
  private readonly renderer = inject(VoiceWaveRenderer);
  /** Runs the release when the component is destroyed. */
  private readonly destroyRef = inject(DestroyRef);
  /** The canvas handed to the renderer. */
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('wave');
  /** What the renderer gave back for this window; `null` until it registers. */
  private readonly handle = signal<WaveWindowHandle | null>(null);

  /** Opaque id of the fed bank this window shows; windows with the same id share one feed. */
  readonly bank = input.required<string>();

  /** Which of the bank's three voices this window shows (0, 1 or 2); it selects the trace colour. */
  readonly voice = input.required<WaveVoice>();

  /**
   * Poses the window apart from its bank: `playing`, `held` on its last picture, or a `flat` line.
   * Default `null` follows the bank's own state.
   */
  readonly state = input<WaveWindowState | null>(null);

  /** Registers the canvas once it exists, keeps the pose override current, and releases on destroy. */
  constructor() {
    afterNextRender(() => {
      this.handle.set(this.renderer.register(this.canvas().nativeElement, this.bank(), this.voice()));
    });

    effect(() => {
      this.handle()?.setOverride(this.state());
    });

    this.destroyRef.onDestroy(() => this.handle()?.release());
  }
}
