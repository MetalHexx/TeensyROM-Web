import {
  Component,
  input,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
  afterNextRender,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Available marquee effect types
 */
export type MarqueeEffect =
  | 'none' // Basic scroll only
  | 'wave' // Sine wave vertical motion
  | 'rainbow' // Color spectrum cycling
  | 'glitch' // Random displacement
  | 'bounce' // Elastic squash/stretch
  | 'copper' // Copper bar sweep
  | 'spiral' // 3D rotation twist
  | 'random'; // Randomly select an effect (excluding 'none' and 'random')

/**
 * A CSS-animated horizontal scrolling marquee for text that doesn't fit its container, with seven
 * optional demoscene-style character effects (wave, rainbow, glitch, bounce, copper, spiral) layered
 * on top of the scroll itself. Duration is derived from content width and `speed`, so longer text
 * scrolls for longer rather than faster.
 *
 * Reach for `ScrollingMarqueeComponent` for long, dynamic single-line text that must live in a
 * fixed-width space — file descriptions, notification banners, status bars — where truncation would
 * lose information the user needs. For static labels that can simply be truncated, use
 * `IconLabelComponent`'s `truncate` input instead; a marquee is for content the user is expected to
 * read in full, not a substitute for ellipsis.
 *
 * @example
 * ```html
 * <lib-scrolling-marquee [text]="fileDescription()" effect="wave"></lib-scrolling-marquee>
 * ```
 */
@Component({
  selector: 'lib-scrolling-marquee',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scrolling-marquee.component.html',
  styleUrl: './scrolling-marquee.component.scss',
})
export class ScrollingMarqueeComponent {
  /** Text content to scroll — defaults to `''`. When empty, the component renders without animating. */
  text = input<string>('');

  /** Scroll speed in pixels per second; animation duration is `content width / speed`, so longer text takes proportionally longer — defaults to `50`. */
  speed = input<number>(50);

  /** Scroll direction — defaults to `'left'` (text moves right to left). */
  direction = input<'left' | 'right'>('left');

  /** Pauses the scroll animation while the pointer hovers over the marquee, so the user can read a stopped frame — defaults to `true`. */
  pauseOnHover = input<boolean>(true);

  /**
   * Character-level visual effect layered on top of the scroll — defaults to `'none'`.
   * - `'none'` — scroll only, no per-character effect
   * - `'wave'` — characters undulate in a sine wave
   * - `'rainbow'` — full color spectrum cycles through the text
   * - `'glitch'` — CRT-style random character displacement
   * - `'bounce'` — elastic squash/stretch per character
   * - `'copper'` — Amiga-style copper bar sweep with glow
   * - `'spiral'` — 3D rotation twist per character
   * - `'random'` — picks one of the effects above (excluding `'none'`) and re-picks when `text` changes
   */
  effect = input<MarqueeEffect>('none');

  // View children references
  /** Reference to the fixed-width container the content scrolls within. */
  containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');
  /** Reference to the scrolling content element, measured to compute the animation duration. */
  contentRef = viewChild.required<ElementRef<HTMLDivElement>>('content');

  // Internal state
  /** Whether the marquee is currently scrolling (`true` whenever `text()` is non-empty). */
  shouldScroll = signal<boolean>(false);
  /** Computed scroll animation duration in seconds, from content width and `speed()`. */
  scrollDuration = signal<number>(10); // Default duration in seconds

  /**
   * Array of individual characters for effect rendering
   * Adds extra spacing between sentences for readability
   */
  protected characters = computed(() => {
    const currentEffect = this.effectClass();
    // Only split into characters if an effect is active
    if (currentEffect === 'none-effect') {
      return [];
    }
    // Add A LOT of extra spaces after periods for better sentence separation
    const textWithExtraSpacing = this.text().replace(/\./g, '.          ');
    return textWithExtraSpacing.split('');
  });

  /**
   * Actual effect to use (resolves 'random' to a specific effect)
   */
  private selectedEffect = signal<Exclude<MarqueeEffect, 'random'>>('none');

  /** Resolves `'random'` effects and (re)measures overflow/duration on creation and whenever `text` changes. */
  constructor(private injector: Injector) {
    // Select random effect if 'random' is chosen, re-select when text changes
    effect(
      () => {
        const effectInput = this.effect();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const currentText = this.text(); // Track text changes to trigger new random selection

        if (effectInput === 'random') {
          const effects: Exclude<MarqueeEffect, 'none' | 'random'>[] = [
            'wave',
            'rainbow',
            'glitch',
            'bounce',
            'copper',
            'spiral',
          ];
          const randomEffect = effects[Math.floor(Math.random() * effects.length)];
          this.selectedEffect.set(randomEffect);
        } else {
          this.selectedEffect.set(effectInput);
        }
      },
      { injector: this.injector }
    );
    // Check overflow after render
    afterNextRender(
      () => {
        this.checkOverflow();
        this.calculateDuration();
      },
      { injector: this.injector }
    );

    // Re-check when text changes
    effect(
      () => {
        this.text(); // Track text changes
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          this.checkOverflow();
          this.calculateDuration();
        }, 0);
      },
      { injector: this.injector }
    );
  }

  /**
   * Check if content overflows container and scrolling is needed
   */
  private checkOverflow(): void {
    const container = this.containerRef()?.nativeElement;
    const content = this.contentRef()?.nativeElement;

    if (!container || !content) {
      return;
    }

    // Always scroll if we have text (classic marquee behavior)
    const hasText = this.text().length > 0;
    this.shouldScroll.set(hasText);
  }

  /**
   * Calculate animation duration based on content width and speed
   */
  private calculateDuration(): void {
    const content = this.contentRef()?.nativeElement;

    if (!content) {
      return;
    }

    const widthPx = content.scrollWidth;
    const speedPxPerSec = this.speed();

    // Calculate duration: distance / speed
    const durationSec = widthPx / speedPxPerSec;
    this.scrollDuration.set(durationSec);
  }

  /**
   * Get the CSS class for scroll direction
   */
  protected directionClass = computed(() => {
    return this.direction() === 'left' ? 'scroll-left' : 'scroll-right';
  });

  /**
   * Get the CSS class for pause on hover
   */
  protected pauseClass = computed(() => {
    return this.pauseOnHover() ? 'pause-on-hover' : '';
  });

  /**
   * Get the CSS class for the effect
   */
  protected effectClass = computed(() => {
    const effect = this.selectedEffect();
    switch (effect) {
      case 'wave':
        return 'wave-effect';
      case 'rainbow':
        return 'rainbow-effect';
      case 'glitch':
        return 'glitch-effect';
      case 'bounce':
        return 'bounce-effect';
      case 'copper':
        return 'copper-effect';
      case 'spiral':
        return 'spiral-effect';
      default:
        return 'none-effect';
    }
  });
}
