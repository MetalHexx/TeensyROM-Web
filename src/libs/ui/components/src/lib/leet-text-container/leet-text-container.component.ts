import {
  Component,
  input,
  output,
  signal,
  Self,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AnimationParentMode } from '../shared/animation.types';
import { PARENT_ANIMATION_COMPLETE } from '../shared/animation-tokens';

/**
 * Animates projected text with a continuous "leet speak" character-cycling effect — a demoscene-
 * style wave that substitutes individual characters (`a` → `@`/`4`, `e` → `3`, `o` → `0`, etc.) as
 * it sweeps forward then backward through the text — plus optional `/ - \ |` spinner glyphs before
 * and/or after the text.
 *
 * This is the raw animation primitive: it has no fade-in/fade-out lifecycle of its own. Reach for
 * `LoadingTextComponent` instead when you need a complete show/hide loading indicator; use
 * `LeetTextContainerComponent` directly when you want the cycling text always visible, or need to
 * drive your own visibility/animation-chaining logic via `animationTrigger` and `animationParent`.
 *
 * @example
 * ```html
 * <lib-leet-text-container [showFrontSpinner]="true" [animationTrigger]="isVisible()">
 *   Loading...
 * </lib-leet-text-container>
 * ```
 */
@Component({
  selector: 'lib-leet-text-container',
  imports: [CommonModule],
  templateUrl: './leet-text-container.component.html',
  styleUrl: './leet-text-container.component.scss',
  host: {
    '[class.animating]': 'isAnimating()',
  },
  providers: [
    {
      provide: PARENT_ANIMATION_COMPLETE,
      useFactory: (self: LeetTextContainerComponent) => {
        return self.animationCompleteSignal.asReadonly();
      },
      deps: [[new Self(), LeetTextContainerComponent]],
    },
  ],
})
export class LeetTextContainerComponent implements AfterViewInit, OnDestroy {
  /**
   * Animation trigger - controls fade in/out and leet animation
   * - true: Fade in and run leet animation
   * - false: Fade out
   * - undefined: Render immediately without animation
   */
  animationTrigger = input<boolean | undefined>(undefined);

  /**
   * Duration of the leet cycling animation in milliseconds (default: 1000ms)
   */
  animationDuration = input<number>(1000);

  /**
   * Controls whether this component waits for parent animations
   * - undefined (default): No waiting - component animates immediately
   * - 'auto': Opt-in to wait for nearest animation parent in DI tree
   * - AnimationParent: Wait for specific component
   */
  animationParent = input<AnimationParentMode>(undefined);

  /**
   * Show spinner before the text (default: false)
   */
  showFrontSpinner = input<boolean>(false);

  /**
   * Show spinner after the text (default: false)
   */
  showBackSpinner = input<boolean>(false);

  /**
   * Emitted when both fade and leet animations complete
   */
  animationComplete = output<void>();

  /** Whether this container's animation has completed; provided to nested containers via `PARENT_ANIMATION_COMPLETE`. */
  animationCompleteSignal = signal(false);

  /** Whether the leet character-cycling animation is currently running. */
  protected isAnimating = signal(false);

  /** The text currently rendered, possibly with leet-substituted characters mid-animation. */
  protected displayText = signal('');

  /** The current `/ - \ |` spinner glyph. */
  protected spinnerChar = signal('');

  /** Substitution options per lowercase character, e.g. `a` → `@`/`4`/`a`. The last option in each list is always the original character. */
  private leetMap: Record<string, string[]> = {
    a: ['@', '4', 'a'],
    e: ['3', 'e'],
    i: ['1', '!', 'i'],
    o: ['0', 'o'],
    s: ['5', '$', 's'],
    t: ['7', '+', 't'],
    l: ['1', '|', 'l'],
    g: ['9', '6', 'g'],
    b: ['8', 'b'],
  };

  /** Glyphs cycled through for the front/back spinner. */
  private spinnerChars = ['/', '-', '\\', '|'];
  /** Index into `spinnerChars` for the currently displayed spinner glyph. */
  private spinnerIndex = 0;
  /** Interval id driving the spinner glyph cycling; `null` when not running. */
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  /** Interval id driving `startLeetAnimation`'s fade cycle; `null` when not running. */
  private leetAnimationInterval: ReturnType<typeof setInterval> | null = null;
  /** Interval id driving the continuous back-and-forth leet cycling; `null` when not running. */
  private cycleInterval: ReturnType<typeof setInterval> | null = null;

  /** Text projected via `ng-content`, extracted from the DOM after view init. */
  private textContent = signal<string>('');

  /** Starts the spinner glyph cycling immediately on creation. */
  constructor(private elementRef: ElementRef) {
    // Start spinner animation
    this.startSpinner();
  }

  /** Extracts the projected text content and starts the continuous leet-cycling animation. */
  ngAfterViewInit(): void {
    // Extract text content from ng-content (find the hidden div)
    const hiddenDiv = this.elementRef.nativeElement.querySelector('div[style*="display: none"]');
    const content = hiddenDiv?.textContent?.trim() || '';
    this.textContent.set(content);

    // Start continuous cycling animation
    if (content) {
      this.startContinuousCycling(content);
    }
  }

  /** Continuously sweeps a single leet substitution forward then backward through the translatable characters of `text`, updating `displayText` every 200ms. */
  private startContinuousCycling(text: string): void {
    // Build list of indices that have leet mappings
    const translatableIndices: number[] = [];
    text.split('').forEach((char, index) => {
      const lowerChar = char.toLowerCase();
      if (this.leetMap[lowerChar]) {
        translatableIndices.push(index);
      }
    });

    if (translatableIndices.length === 0) {
      // No translatable characters, just show original text
      this.displayText.set(text);
      return;
    }

    // Cycle through leet characters continuously, back and forth
    let currentPosition = 0; // Position in translatableIndices array
    let direction = 1; // 1 = forward, -1 = backward

    const cycleInterval = setInterval(() => {
      const charIndex = translatableIndices[currentPosition];

      const result = text
        .split('')
        .map((char, index) => {
          const lowerChar = char.toLowerCase();

          // Check if this character has leet mappings
          if (this.leetMap[lowerChar]) {
            const options = this.leetMap[lowerChar];

            // If this is the current cycling position, show leet character
            if (index === charIndex) {
              const leetChar = options[Math.floor(Math.random() * (options.length - 1))];
              return char === char.toUpperCase() ? leetChar.toUpperCase() : leetChar;
            }
          }

          return char;
        })
        .join('');

      this.displayText.set(result);

      // Move to next translatable character position
      currentPosition += direction;

      // Reverse direction at boundaries
      if (currentPosition >= translatableIndices.length - 1) {
        direction = -1; // Start going backward
      } else if (currentPosition <= 0) {
        direction = 1; // Start going forward
      }
    }, 200); // Cycle every 200ms

    // Store interval for cleanup
    this.cycleInterval = cycleInterval;
  }

  /** Clears the spinner, leet-fade, and continuous-cycling intervals so none keep firing after teardown. */
  ngOnDestroy(): void {
    // Clean up spinner interval
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
    }
    // Clean up leet animation interval
    if (this.leetAnimationInterval) {
      clearInterval(this.leetAnimationInterval);
    }
    // Clean up cycle interval
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
    }
  }

  /** Starts cycling `spinnerChar` through `spinnerChars` every 100ms. */
  private startSpinner(): void {
    // Update spinner character every 100ms
    this.spinnerInterval = setInterval(() => {
      this.spinnerChar.set(this.spinnerChars[this.spinnerIndex]);
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerChars.length;
    }, 100);
  }

  /** Runs a fade between fully-leet and normal text over `animationDuration()`, reversing direction each cycle, and sets `isAnimating` while it runs. */
  private startLeetAnimation(finalText: string): void {
    this.isAnimating.set(true);
    const duration = this.animationDuration();
    const steps = 30; // Number of animation frames per direction
    const interval = duration / steps;
    let currentStep = 0;
    let direction = -1; // Start going from leet to normal (-1), then reverse to normal to leet (1)

    const animationInterval = setInterval(() => {
      currentStep++;

      // Calculate progress (0 to 1)
      const cycleProgress = (currentStep % steps) / steps;

      // Determine leet amount based on direction
      let leetAmount: number;
      if (direction === -1) {
        // Going from leet (1) to normal (0)
        leetAmount = 1 - cycleProgress;
      } else {
        // Going from normal (0) to leet (1)
        leetAmount = cycleProgress;
      }

      // Generate text with current leet amount
      const animatedText = this.generateLeetText(finalText, leetAmount);
      this.displayText.set(animatedText);

      // Reverse direction when we complete a cycle
      if (currentStep % steps === 0 && currentStep > 0) {
        direction *= -1; // Flip direction
      }
    }, interval);

    // Store interval for cleanup
    this.leetAnimationInterval = animationInterval;
  }

  /** Substitutes each translatable character of `text` with a random leet option with probability `leetAmount` (0 = original text, 1 = maximally substituted). */
  private generateLeetText(text: string, leetAmount: number): string {
    return text
      .split('')
      .map((char) => {
        const lowerChar = char.toLowerCase();

        // Check if this character has a leet mapping
        if (this.leetMap[lowerChar]) {
          const options = this.leetMap[lowerChar];

          // Calculate if we should use leet for this character based on leetAmount
          // Use deterministic pattern based on character position for consistency
          const shouldLeet = Math.random() < leetAmount;

          if (shouldLeet) {
            // Pick a random leet character (excluding the last option which is the original)
            const leetChar = options[Math.floor(Math.random() * (options.length - 1))];
            return char === char.toUpperCase() ? leetChar.toUpperCase() : leetChar;
          }
        }

        return char;
      })
      .join('');
  }
}
