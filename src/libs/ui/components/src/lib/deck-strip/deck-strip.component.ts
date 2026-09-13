import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChannelFaderComponent } from '../channel-fader/channel-fader.component';
import { FilterModeSelectorComponent } from '../filter-mode-selector/filter-mode-selector.component';
import type {
  FilterModeSelectorModel,
  FilterModeValue,
} from '../filter-mode-selector/filter-mode-selector.component';
import { RotaryKnobComponent } from '../rotary-knob/rotary-knob.component';
import type { ControlSize } from '../shared/control-size';

/** One rotary knob's caller-composed state within a deck strip. Nested one level under
 *  `DeckStripModel`, mirroring the composition exactly: the strip is a filter selector, this
 *  array of knobs, then a fader. */
export interface DeckStripKnobModel {
  /** 'cutoff' | 'resonance' | 'pulseWidth' | 'key' in the caller that composes today's strip —
   *  opaque here, round-tripped verbatim into `knobChange`. */
  readonly id: string;
  /** e.g. 'Cutoff' — rendered under the dial. */
  readonly label: string;
  /** e.g. 'Cutoff deck A' — this knob's own accessible name. */
  readonly accessibleName: string;
  /** The dial's current position. */
  readonly value: number;
  /** Minimum of the dial's range. Defaults fall through to `RotaryKnobComponent`'s own when absent. */
  readonly min?: number;
  /** Maximum of the dial's range. Defaults fall through to `RotaryKnobComponent`'s own when absent. */
  readonly max?: number;
  /** Granularity of the dial's native range input. Defaults fall through to `RotaryKnobComponent`'s
   *  own when absent. */
  readonly step?: number;
  /** Rendered under the dial when present — Key's transposed-key or semitone readout, and nothing
   *  else among today's four knobs. `null`/absent hides it entirely. */
  readonly readout?: string | null;
}

/** The caller-composed state one whole deck strip renders: filter mode, its knobs in render
 *  order, and the channel fader beneath them. */
export interface DeckStripModel {
  /** The filter mode selector's own model, passed straight through. */
  readonly filter: FilterModeSelectorModel;
  /** Rendered in this array's order — today Cutoff, Resonance, Pulse Width, Key, but the strip
   *  itself hard-codes none of that; adding or reordering an entry here is all a caller does. */
  readonly knobs: readonly DeckStripKnobModel[];
  /** The channel fader's own state. */
  readonly fader: {
    readonly value: number;
    readonly accessibleName: string;
    readonly label: string;
  };
}

/**
 * One deck's whole control strip, top to bottom: filter mode, then every knob in `model().knobs`
 * order, then the channel fader. Purely presentational — composes `FilterModeSelectorComponent`,
 * one `RotaryKnobComponent` per knob and `ChannelFaderComponent`, and holds no state of its own;
 * the caller owns every value and every write.
 *
 * @example
 * ```html
 * <lib-deck-strip
 *   [model]="deckStripModel()"
 *   (knobChange)="onKnobChange($event)"
 *   (faderChange)="onFaderChange($event)"
 *   (filterModeSelect)="onFilterModeSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-deck-strip',
  templateUrl: './deck-strip.component.html',
  styleUrl: './deck-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The strip's own gap between its six controls is size-dependent, the same way its children's
  // dimensions are — so the size reaches this stylesheet the way it reaches theirs.
  host: { '[attr.data-size]': 'size()' },
  imports: [FilterModeSelectorComponent, RotaryKnobComponent, ChannelFaderComponent],
})
export class DeckStripComponent {
  /** The whole strip's state: filter, knobs and fader. */
  readonly model = input.required<DeckStripModel>();
  /** Forwarded to the filter selector, every knob and the fader. Defaults to `'large'`, today's
   *  only size, so every existing use renders pixel-identical. */
  readonly size = input<ControlSize>('large');
  /** Forwarded to the fader's own `length` — a fixed CSS length for its travel, pinning the
   *  wrapper's `flex: 1 1 0` growth and `7.5rem` floor off along with it. `null` (the default)
   *  keeps the strip's existing grow-with-floor behavior. */
  readonly faderLength = input<string | null>(null);
  /** Emits the moved knob's `id` alongside its new value. */
  readonly knobChange = output<{ id: string; value: number }>();
  /** Forwards the channel fader's `valueChange` unchanged. */
  readonly faderChange = output<number>();
  /** Forwards the filter mode selector's `modeSelect` unchanged, `null` included. */
  readonly filterModeSelect = output<FilterModeValue | null>();

  /** Re-packages one knob's `valueChange` with its own `id` for `knobChange`. */
  protected onKnobChange(id: string, value: number): void {
    this.knobChange.emit({ id, value });
  }

  /** Forwards the fader's `valueChange` straight through as `faderChange`. */
  protected onFaderChange(value: number): void {
    this.faderChange.emit(value);
  }

  /** Forwards the filter mode selector's `modeSelect` straight through as `filterModeSelect`. */
  protected onFilterModeSelect(mode: FilterModeValue | null): void {
    this.filterModeSelect.emit(mode);
  }
}
