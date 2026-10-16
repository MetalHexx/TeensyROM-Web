import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChildren,
} from '@angular/core';
import type { ControlSize } from '../shared/control-size';

/** One option of a `SegmentedControlComponent`. */
export interface SegmentedControlOption {
  /** The option's unique identifier, emitted by `optionSelect` when it is chosen. */
  readonly id: string;
  /** The option's visible label. */
  readonly label: string;
  /** Takes the option out of the tab order and out of arrow-key navigation, and makes it
   *  unselectable. Absent means enabled. */
  readonly disabled?: boolean;
}

/**
 * A group of mutually exclusive options, all visible at once — a radio group drawn as a row of
 * adjacent cells, in the same look as `FilterModeSelectorComponent`'s buttons. The selected cell is
 * filled and bold, so the state never rests on colour alone.
 *
 * Reach for it when a small set of exclusive choices should stay visible and one tap away. Unlike
 * the filter mode selector it always has a selection model of its own shape: the caller owns
 * `selectedId` and updates it from `optionSelect`.
 *
 * Keyboard: the selected option (else the first enabled one) is the group's single tab stop. The
 * arrow keys move focus and select, skipping disabled options and wrapping at the ends; Home and
 * End jump to the first and last enabled option.
 *
 * @example
 * ```html
 * <lib-segmented-control
 *   accessibleName="Style"
 *   [options]="styleOptions"
 *   [selectedId]="styleId()"
 *   (optionSelect)="onStyleSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-segmented-control',
  templateUrl: './segmented-control.component.html',
  styleUrl: './segmented-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-size]': 'size()',
  },
})
export class SegmentedControlComponent {
  /** The options, rendered left to right in this order. */
  readonly options = input.required<readonly SegmentedControlOption[]>();
  /** The `id` of the selected option, or `null` when none is selected. */
  readonly selectedId = input<string | null>(null);
  /** Accessible name for the whole group, e.g. 'Style'. */
  readonly accessibleName = input.required<string>();
  /** The cells' rendered size, stepping their height and font across the shared `ControlSize`
   *  scale. Defaults to `'medium'`. */
  readonly size = input<ControlSize>('medium');
  /** Emits the `id` of the option the user chose, by click or by arrow, Home or End key. Does not
   *  emit for the option that is already selected. */
  readonly optionSelect = output<string>();

  /** The one option in the tab order: the selected one when it is enabled, else the first enabled
   *  option, else none. */
  protected readonly tabStopId = computed(() => {
    const options = this.options();
    const selected = options.find((option) => option.id === this.selectedId());
    if (selected && !selected.disabled) {
      return selected.id;
    }
    return options.find((option) => !option.disabled)?.id ?? null;
  });

  /** The rendered option buttons, in option order, so a key press can move focus to one. */
  private readonly segments = viewChildren<ElementRef<HTMLButtonElement>>('segment');

  /** Moves focus and selection by arrow, Home or End from the option at `index`. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const target = this.targetIndex(event.key, index);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.segments()[target]?.nativeElement.focus();
    this.select(this.options()[target]);
  }

  /** Emits `option`'s id unless it is already the selected one. */
  protected select(option: SegmentedControlOption): void {
    if (option.id !== this.selectedId()) {
      this.optionSelect.emit(option.id);
    }
  }

  /** The index of the enabled option `key` leads to from `index`, or `null` when `key` is not a
   *  navigation key or no enabled option exists. */
  private targetIndex(key: string, index: number): number | null {
    const enabled = this.options().flatMap((option, position) =>
      option.disabled ? [] : [position]
    );
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return this.stepToEnabled(enabled, index, 1);
      case 'ArrowLeft':
      case 'ArrowUp':
        return this.stepToEnabled(enabled, index, -1);
      case 'Home':
        return enabled[0] ?? null;
      case 'End':
        return enabled[enabled.length - 1] ?? null;
      default:
        return null;
    }
  }

  /** The enabled index one step from `index` in `direction`, wrapping at the ends; `null` when no
   *  other option is enabled. */
  private stepToEnabled(
    enabled: readonly number[],
    index: number,
    direction: 1 | -1
  ): number | null {
    const others = enabled.filter((position) => position !== index);
    if (others.length === 0) {
      return null;
    }
    if (direction === 1) {
      return others.find((position) => position > index) ?? others[0];
    }
    const before = others.filter((position) => position < index);
    return before.length > 0 ? before[before.length - 1] : others[others.length - 1];
  }
}
