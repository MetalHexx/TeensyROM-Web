import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ControlSize } from '../shared/control-size';

/** Structural twin of the engine's own filter-mode union — declared locally so this library never
 *  imports an engine type. */
export type FilterModeValue = 'lowPass' | 'bandPass' | 'highPass' | 'off';

/** The caller-composed state this component renders and the names it announces. */
export interface FilterModeSelectorModel {
  /** The currently forced filter mode, or `null` when the tune's own filter mode passes through
   *  untouched — there is no separate "hands off" option, this is that state. */
  readonly engaged: FilterModeValue | null;
  /** Accessible name for the whole button group, e.g. 'Filter mode deck A'. */
  readonly groupAccessibleName: string;
  /** Per-button aria-labels, caller-composed, e.g. { lowPass: 'Filter mode low-pass deck A', … } */
  readonly optionAccessibleNames: Readonly<Record<FilterModeValue, string>>;
}

/** One selectable filter-mode button: its engine-facing value and its on-screen label. */
interface FilterModeOption {
  readonly mode: FilterModeValue;
  readonly label: string;
}

const TOP_ROW: readonly FilterModeOption[] = [
  { mode: 'lowPass', label: 'LP' },
  { mode: 'bandPass', label: 'BP' },
  { mode: 'highPass', label: 'HP' },
];

const OFF_OPTION: FilterModeOption = { mode: 'off', label: 'OFF' };

/**
 * Four adjacent single-tap options for one deck's forced filter mode: `LP · BP · HP` across a top
 * row, `OFF` spanning the row beneath. Nothing engaged means the tune's own mode passes through
 * untouched, and re-clicking the engaged option deselects it, returning to that same state — there
 * is no separate "hands off" fifth control, nothing engaged already is it.
 *
 * Always-visible buttons rather than a dropdown: this is a live-performance control on a strip where
 * everything else is direct manipulation, unlike a settings dropdown configured once and not reached
 * for mid-mix.
 *
 * @example
 * ```html
 * <lib-filter-mode-selector
 *   [model]="filterModeModel()"
 *   (modeSelect)="onFilterModeSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-filter-mode-selector',
  templateUrl: './filter-mode-selector.component.html',
  styleUrl: './filter-mode-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-size]': 'size()',
  },
})
export class FilterModeSelectorComponent {
  /** The engaged mode and the caller-composed accessible names to render it with. */
  readonly model = input.required<FilterModeSelectorModel>();
  /** The option buttons' rendered size — reflected as `data-size` on the host, which the
   *  stylesheet reads to step each option's own height and font size. Defaults to `'large'`,
   *  today's only size, so every existing use renders pixel-identical. */
  readonly size = input<ControlSize>('large');
  /** Emits the newly engaged mode, or `null` when the engaged option was clicked again. */
  readonly modeSelect = output<FilterModeValue | null>();

  /** `LP · BP · HP`, rendered across the top row in this order. */
  protected readonly topRow = TOP_ROW;
  /** `OFF`, rendered spanning the row beneath the top row. */
  protected readonly offOption = OFF_OPTION;

  /** The caller-composed aria-label for the given option, read off `model().optionAccessibleNames`. */
  protected accessibleNameFor(option: FilterModeOption): string {
    return this.model().optionAccessibleNames[option.mode];
  }

  /** Whether `option` is the model's currently engaged mode. */
  protected isEngaged(option: FilterModeOption): boolean {
    return this.model().engaged === option.mode;
  }

  /** Emits `option.mode`, or `null` if `option` was already engaged (deselect). */
  protected onSelect(option: FilterModeOption): void {
    this.modeSelect.emit(this.isEngaged(option) ? null : option.mode);
  }
}
