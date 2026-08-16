import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

/**
 * Event emitted when the displayed image changes.
 */
export interface ImageChangeEvent {
  /** URL of the new current image */
  currentImage: string;
  /** Index of the current image in the array */
  currentIndex: number;
  /** Total number of images */
  totalImages: number;
}

/**
 * Image carousel that automatically cycles through one or more images with
 * a 1-second cross-fade, falling back to `placeholderUrl` when `images` is
 * empty. `size` selects both the rendered dimensions and the rendering mode:
 * `'thumbnail'`/`'small'` use a simple, single-layer `object-fit: cover`
 * presentation, while `'medium'`/`'large'` add a dual-layer blurred
 * background behind an `object-fit: contain` foreground for an artistic,
 * letterbox-free presentation. `width`/`height` override the size preset's
 * dimensions when a non-standard aspect ratio is needed (e.g. C64 320x200).
 *
 * Reach for `lib-cycle-image` whenever the source data may hold zero, one,
 * or many images — it handles the empty and single-image cases gracefully
 * and adds cycling for free when there is more than one. Reach for
 * `lib-thumbnail-image` instead only when you know in advance there is
 * exactly one static image and want the smaller, simpler component.
 *
 * @example
 * ```html
 * <lib-cycle-image
 *   [images]="fileItem.images.map(img => img.url)"
 *   size="thumbnail"
 *   (imageChange)="onImageChange($event)"
 * ></lib-cycle-image>
 * ```
 */
@Component({
  selector: 'lib-cycle-image',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cycle-image.component.html',
  styleUrl: './cycle-image.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':increment, :decrement', [
        style({ opacity: 0 }),
        animate('1s ease-out', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class CycleImageComponent {
  // Inputs
  /** Image URLs to cycle through. When empty, `placeholderUrl` is shown instead and no cycling occurs. */
  images = input.required<string[]>();
  /** Milliseconds between automatic transitions when more than one image is present. Defaults to `8000`. */
  intervalMs = input<number>(8000);
  /** Fallback image URL shown when `images` is empty. Defaults to `'/placeholder.jpg'`. */
  placeholderUrl = input<string>('/placeholder.jpg');
  /**
   * Size preset controlling both rendered dimensions and rendering mode. Defaults to `'large'`.
   * - `'thumbnail'` — 48x48px, simple mode (no blur), for player toolbars and compact lists
   * - `'small'` — 80x80px, simple mode (no blur), for card thumbnails and small galleries
   * - `'medium'` — 160x160px, complex mode (blurred background), for album art and featured content
   * - `'large'` — fills its container, complex mode (blurred background), for full detail views
   */
  size = input<'thumbnail' | 'small' | 'medium' | 'large'>('large');
  /** Custom width override (e.g., '76.8px'). Takes precedence over size preset. */
  width = input<string | undefined>(undefined);
  /** Custom height override (e.g., '48px'). Takes precedence over size preset. */
  height = input<string | undefined>(undefined);

  // Outputs
  /**
   * Emitted when the displayed image changes (on cycle or when images input changes).
   * Useful for parent components that need to react to image changes (e.g., CRT effects).
   */
  imageChange = output<ImageChangeEvent>();

  // Signals for state management
  currentIndex = signal(0);
  previousIndex = signal<number | null>(null);
  showPrevious = signal(false);
  animationKey = signal(0);

  // Computed signals - use placeholder if no images
  private effectiveImages = computed(() => {
    const imgs = this.images();
    return imgs.length > 0 ? imgs : [this.placeholderUrl()];
  });

  currentImage = computed(() => this.effectiveImages()[this.currentIndex()] || null);
  previousImage = computed(() => {
    const idx = this.previousIndex();
    return idx !== null ? this.effectiveImages()[idx] || null : null;
  });
  hasMultipleImages = computed(() => this.effectiveImages().length > 1);
  
  /**
   * Determines if cycling should be active.
   * Only cycle when there are multiple images to display.
   */
  private shouldCycle = computed(() => this.images().length > 1);

  // Simple mode disables blur/background effects for small sizes
  isSimpleMode = computed(() => {
    const sz = this.size();
    return sz === 'thumbnail' || sz === 'small';
  });
  
  // Custom dimensions override size presets
  customStyles = computed(() => {
    const w = this.width();
    const h = this.height();
    const styles: { [key: string]: string } = {};
    if (w) styles['width'] = w;
    if (h) styles['height'] = h;
    return Object.keys(styles).length > 0 ? styles : null;
  });

  // Dependency injection
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Reset when images change and trigger animation
    effect(() => {
      this.images(); // Trigger on images change
      this.currentIndex.set(0);
      this.previousIndex.set(null);
      this.showPrevious.set(false);
      this.animationKey.update((v) => v + 1);
      
      // Emit image change event
      this.emitImageChange();
    });

    // Start carousel when there are multiple images
    effect((onCleanup) => {
      if (!this.shouldCycle()) {
        return;
      }

      const subscription = interval(this.intervalMs())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          // Double-check before cycling
          if (this.shouldCycle()) {
            this.cycleToNext();
          }
        });

      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  /**
   * Emit image change event with current state.
   */
  private emitImageChange(): void {
    const current = this.currentImage();
    if (current) {
      this.imageChange.emit({
        currentImage: current,
        currentIndex: this.currentIndex(),
        totalImages: this.effectiveImages().length,
      });
    }
  }

  private cycleToNext(): void {
    // Guard: Don't cycle if only one image
    if (!this.shouldCycle()) {
      return;
    }
    
    // Move current to previous
    this.previousIndex.set(this.currentIndex());
    this.showPrevious.set(true);

    // Update to next image
    const nextIndex = (this.currentIndex() + 1) % this.effectiveImages().length;
    this.currentIndex.set(nextIndex);
    this.animationKey.update((v) => v + 1);

    // Emit image change event
    this.emitImageChange();

    // After animation duration, hide previous
    setTimeout(() => {
      this.showPrevious.set(false);
    }, 1000); // CSS animation duration
  }
}
