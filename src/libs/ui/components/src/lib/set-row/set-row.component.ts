import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** The drag payload type a row sets when its handle is dragged; its data is the row's id. */
export const SET_ROW_DRAG_TYPE = 'application/x-teensyrom-set-row';

/** What the row's detail line says. */
export type SetRowDetail =
  | { readonly kind: 'counts'; readonly text: string }
  | { readonly kind: 'fetching' }
  | { readonly kind: 'analyzing' }
  | { readonly kind: 'unavailable'; readonly text: string };

/** A deck marker on a row: which deck holds the tune, and what that deck is doing. */
export interface SetRowDeckMarker {
  readonly letter: 'A' | 'B';
  readonly light: 'playing' | 'paused' | 'off';
}

/** One tune in the set, caller-composed. */
export interface SetRowModel {
  readonly id: string;
  /** e.g. '03'. */
  readonly numberText: string;
  readonly title: string;
  readonly author: string;
  readonly detail: SetRowDetail;
  /** e.g. '03:58', or '—' when unknown. */
  readonly lengthText: string;
  readonly decks: readonly SetRowDeckMarker[];
  /** The knob's selection: draws the highlight and `aria-current`. */
  readonly selected: boolean;
  /** Still being fetched or analysed: no handle, no remove key, and it cannot be selected. */
  readonly pending: boolean;
  /** Names the row's select button with its place, tune, loops, length and decks in words. */
  readonly accessibleName: string;
  /** Names the drag handle, and says Alt and the arrow keys move the row. */
  readonly handleAccessibleName: string;
  readonly removeAccessibleName: string;
}

const DETAIL_WORDS = { fetching: 'Fetching', analyzing: 'Analyzing' } as const;

/**
 * One tune in the set card: a drag handle (also focusable, where Alt+ArrowUp and Alt+ArrowDown
 * move the row), its number, title and author, a detail line (loop and cue counts, or a progress
 * bar while it is fetched or analysed, or why it is unavailable), the A and B deck lights, its
 * length and a remove key. The selected row carries `aria-current` and the knob's highlight. A
 * pending row has no handle or remove key and cannot be selected. Purely presentational.
 *
 * @example
 * ```html
 * <lib-set-row
 *   [model]="row"
 *   (selectRow)="onSelect(row.id)"
 *   (remove)="onRemove(row.id)"
 *   (moveBy)="onMove(row.id, $event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-set-row',
  imports: [MatIconModule, SynthKeyComponent],
  templateUrl: './set-row.component.html',
  styleUrl: './set-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    '[attr.aria-current]': 'model().selected ? "true" : null',
    '[attr.data-selected]': 'model().selected ? "" : null',
    '[attr.data-pending]': 'model().pending ? "" : null',
    '[attr.data-dragging]': 'dragging() ? "" : null',
    '[attr.data-row-id]': 'model().id',
  },
})
export class SetRowComponent {
  /** The row's state. */
  readonly model = input.required<SetRowModel>();
  /** Emits when the row is pressed to select it. */
  readonly selectRow = output<void>();
  /** Emits when the remove key is pressed. */
  readonly remove = output<void>();
  /** Emits -1 or 1 when Alt+ArrowUp or Alt+ArrowDown is pressed on the handle. */
  readonly moveBy = output<-1 | 1>();

  protected readonly dragging = signal(false);
  protected readonly detailWords = DETAIL_WORDS;

  /** The detail line's text for the kinds that carry their own words. */
  protected readonly detailText = computed(() => {
    const detail = this.model().detail;
    return detail.kind === 'counts' || detail.kind === 'unavailable' ? detail.text : '';
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Starts a row drag: the payload carries only the row's id, under the card's own type. */
  protected onDragStart(event: DragEvent): void {
    const { dataTransfer } = event;
    if (!dataTransfer) return;
    dataTransfer.setData(SET_ROW_DRAG_TYPE, this.model().id);
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setDragImage?.(this.host.nativeElement, 16, 16);
    this.dragging.set(true);
  }

  protected onDragEnd(): void {
    this.dragging.set(false);
  }

  /** Alt+ArrowUp / Alt+ArrowDown move the row; other keys keep their meaning. */
  protected onHandleKeydown(event: KeyboardEvent): void {
    if (!event.altKey) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.moveBy.emit(event.key === 'ArrowUp' ? -1 : 1);
  }
}
