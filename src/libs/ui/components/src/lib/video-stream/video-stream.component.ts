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
  /** The MediaStream to display in the video element */
  readonly stream = input<MediaStream | null>(null);

  /** CSS object-fit property for the video element */
  readonly objectFit = input<'contain' | 'cover' | 'fill'>('contain');

  /** Whether to show loading indicator when stream is null */
  readonly showLoadingState = input<boolean>(true);

  // Outputs
  /** Emits when video element starts playing */
  readonly streamReady = output<void>();

  /** Emits when video element encounters an error */
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
