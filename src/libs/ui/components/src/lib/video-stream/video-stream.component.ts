import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  effect,
  DestroyRef,
  inject,
} from '@angular/core';

/**
 * A pure presentation component that displays a MediaStream in a video element.
 *
 * This component encapsulates video element lifecycle management (autoplay, muted, srcObject binding)
 * and provides a clean interface for displaying video streams without any store dependencies.
 *
 * The `stream` is normally produced upstream by a parent calling
 * `navigator.mediaDevices.getUserMedia()` against a device chosen via
 * `VideoDeviceSelectorComponent` — this component only ever consumes an already-acquired
 * `MediaStream`, it never requests device access itself. Commonly projected as the content
 * inside a `CrtEffectWrapperComponent` so CRT post-processing applies to the live picture.
 *
 * @example
 * ```html
 * <lib-video-stream
 *   [stream]="mediaStream"
 *   [objectFit]="'cover'"
 *   [showLoadingState]="true"
 *   (streamReady)="onVideoReady()"
 *   (streamError)="onVideoError($event)">
 * </lib-video-stream>
 * ```
 */
@Component({
  selector: 'lib-video-stream',
  standalone: true,
  imports: [],
  templateUrl: './video-stream.component.html',
  styleUrl: './video-stream.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoStreamComponent {
  private readonly destroyRef = inject(DestroyRef);

  // Inputs
  /**
   * The `MediaStream` to display. Default `null`. When `null`, the video element has no
   * `srcObject` and, if `showLoadingState` is `true`, the loading overlay renders instead.
   */
  readonly stream = input<MediaStream | null>(null);

  /**
   * CSS `object-fit` applied to the video element. Default `'contain'`.
   * - `'contain'`: fit inside the element, preserving aspect ratio (may letterbox/pillarbox).
   * - `'cover'`: fill the element, preserving aspect ratio (may crop edges).
   * - `'fill'`: stretch to fill the element exactly (may distort aspect ratio).
   */
  readonly objectFit = input<'contain' | 'cover' | 'fill'>('contain');

  /**
   * Whether to show a loading indicator while `stream` is `null`. Default `true`. Set
   * `false` when the parent already renders its own loading/empty state.
   */
  readonly showLoadingState = input<boolean>(true);

  // Outputs
  /** Emits when the video element fires its native `playing` event (stream has started rendering frames). */
  readonly streamReady = output<void>();

  /** Emits the native `error` event when the video element fails to play the stream. */
  readonly streamError = output<ErrorEvent>();

  // Internal state
  /** Reference to the native video element */
  readonly videoElementRef = viewChild<ElementRef<HTMLVideoElement>>('videoElement');

  /** Tracks if video is actively playing */
  readonly isPlaying = signal<boolean>(false);

  /** Shows loading state when no stream and loading is enabled */
  readonly showLoading = () => this.showLoadingState() && !this.stream() && !this.isPlaying();

  constructor() {
    // React to stream changes and bind to video element
    effect(() => {
      const stream = this.stream();
      const videoEl = this.videoElementRef()?.nativeElement;

      if (!videoEl) return;

      if (stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch((err) => {
          console.error('Video play error:', err);
        });
      } else {
        // Clear video when stream is null
        videoEl.srcObject = null;
        this.isPlaying.set(false);
      }
    });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      const videoEl = this.videoElementRef()?.nativeElement;
      if (videoEl) {
        videoEl.srcObject = null;
      }
    });
  }

  /** Handle video playing event */
  onVideoPlaying(): void {
    this.isPlaying.set(true);
    this.streamReady.emit();
  }

  /** Handle video error event */
  onVideoError(event: Event): void {
    this.isPlaying.set(false);
    this.streamError.emit(event as ErrorEvent);
  }
}
