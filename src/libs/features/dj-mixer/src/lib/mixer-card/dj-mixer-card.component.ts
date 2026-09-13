import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import {
  CrossfaderComponent,
  DeckStripComponent,
  ScalingCompactCardComponent,
  type DeckStripModel,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';
import { createDeckPlaceholders } from '../placeholders/deck-placeholders';

/**
 * The travel shared by every channel fader and by the crossfader: the card's own content width,
 * which is the view grid's definite `--mixer-col` track less this card's own padding. 148px at
 * desktop — the wireframe's fader length and crossfader track length, which are the same number.
 * Derived rather than measured because a container query would need inline-size containment, and
 * that would zero the card's intrinsic width.
 */
const FADER_LENGTH =
  'calc(var(--mixer-col) - 2 * var(--compact-card-padding, var(--spacing-card-padding-compact)))';

/**
 * `$bp-tablet` is 1280px in `_mixins.scss`; below it this card's own stylesheet switches to the
 * band form. A template can't read its own media query, so the one place that needs the answer in
 * TypeScript observes the same breakpoint. This and `manyGridAreas` are the only two breakpoint
 * values in this feature expressed outside a stylesheet.
 */
const BELOW_TABLET = '(max-width: 1279px)';

@Component({
  selector: 'lib-dj-mixer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'grid-area: mx', '[class.dj-mixer-card--band]': 'band()' },
  imports: [ScalingCompactCardComponent, DeckStripComponent, CrossfaderComponent],
  templateUrl: './dj-mixer-card.component.html',
  styleUrl: './dj-mixer-card.component.scss',
})
export class DjMixerCardComponent {
  readonly decks = input.required<readonly DeckRef[]>();
  readonly showCrossfader = input.required<boolean>();
  readonly band = input<boolean>(false); // true → the horizontal band form at every width (three or more decks)

  private readonly stripsByIndex = computed<ReadonlyMap<number, DeckStripModel>>(
    () => new Map(this.decks().map((deck) => [deck.index, createDeckPlaceholders(deck).strip]))
  );

  readonly firstLetter = computed(() => this.decks()[0]?.letter ?? '');
  readonly lastLetter = computed(() => this.decks()[this.decks().length - 1]?.letter ?? '');
  readonly crossfaderName = computed(
    () => `Crossfader, deck ${this.firstLetter()} to deck ${this.lastLetter()}`
  );

  private readonly belowTablet = toSignal(
    inject(BreakpointObserver)
      .observe(BELOW_TABLET)
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  /** True in the vertical form the definite `--mixer-col` track exists for. */
  readonly columnForm = computed(() => !this.band() && !this.belowTablet());

  /**
   * The pinned travel in the column form, `null` everywhere else — the band and stacked forms keep
   * a fluid crossfader and a floor-based channel fader instead.
   */
  readonly faderLength = computed<string | null>(() => (this.columnForm() ? FADER_LENGTH : null));

  stripFor(deck: DeckRef): DeckStripModel {
    const strip = this.stripsByIndex().get(deck.index);
    return strip ?? createDeckPlaceholders(deck).strip;
  }
}
