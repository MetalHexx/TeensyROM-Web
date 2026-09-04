import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DeckDescriptor } from '../../deck/deck.config';
import type { SidFilterMode } from '../../asid/register-frame';
import { MixerService } from '../mixer.service';

interface FilterModeOption {
  readonly mode: SidFilterMode;
  readonly label: string;
  /** Composes into the accessible name — 'low-pass', not 'LP'. */
  readonly name: string;
}

const TOP_ROW: readonly FilterModeOption[] = [
  { mode: 'lowPass', label: 'LP', name: 'low-pass' },
  { mode: 'bandPass', label: 'BP', name: 'band-pass' },
  { mode: 'highPass', label: 'HP', name: 'high-pass' },
];

const OFF_OPTION: FilterModeOption = { mode: 'off', label: 'OFF', name: 'off' };

/**
 * Four adjacent single-tap options for one deck's forced filter mode: `LP · BP · HP` across a top
 * row, `OFF` spanning the row beneath. Nothing engaged means the tune's own mode passes through
 * untouched, and re-clicking the engaged option deselects it, returning to that same state — there
 * is no separate "hands off" fifth control, nothing engaged already is it.
 *
 * Always-visible buttons rather than a dropdown: this is a live-performance control on a strip where
 * everything else is direct manipulation, unlike the app's one settings dropdown (configured once,
 * not reached for mid-mix).
 */
@Component({
  selector: 'lib-filter-mode-selector',
  templateUrl: './filter-mode-selector.component.html',
  styleUrl: './filter-mode-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterModeSelectorComponent {
  private readonly mixer = inject(MixerService);

  readonly deck = input.required<DeckDescriptor>();

  protected readonly topRow = TOP_ROW;
  protected readonly offOption = OFF_OPTION;

  protected readonly mode = computed(() => this.mixer.filterMode(this.deck().id)());

  protected accessibleName(option: FilterModeOption): string {
    return `Filter mode ${option.name} deck ${this.deck().label}`;
  }

  protected isEngaged(option: FilterModeOption): boolean {
    return this.mode() === option.mode;
  }

  protected onSelect(option: FilterModeOption): void {
    this.mixer.setFilterMode(this.deck().id, this.isEngaged(option) ? null : option.mode);
  }
}
