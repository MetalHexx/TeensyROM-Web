import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { SetControlPlateComponent, type SetControlPlateModel } from '../set-control-plate/set-control-plate.component';
import { SetHeaderComponent, type SetHeaderModel } from '../set-header/set-header.component';
import { SetRowGhostComponent, type SetRowGhostRow } from '../set-row-ghost/set-row-ghost.component';
import { SET_ROW_DRAG_TYPE, SetRowComponent, type SetRowModel } from '../set-row/set-row.component';

/** Everything the set card draws, caller-composed. */
export interface SetCardModel {
  readonly header: SetHeaderModel;
  readonly plate: SetControlPlateModel;
  readonly rows: readonly SetRowModel[];
  /** Shown as the drop target when the set has no rows, e.g. 'Drag SIDs here from the file listing'. */
  readonly emptyText: string;
  /** The card's own aria-label, e.g. 'Set Friday warm-up, 8 SIDs'. */
  readonly accessibleName: string;
  /** A message for the polite live region. A new `seq` re-announces even identical text. */
  readonly announcement: { readonly seq: number; readonly text: string } | null;
}

/** A row dropped at a new place; `toIndex` is its final position among real rows. */
export interface SetRowMove {
  readonly rowId: string;
  readonly toIndex: number;
}

/** A file-listing drop; `index` is the insertion gap among real rows. */
export interface SetListingDrop {
  readonly index: number;
  readonly dataTransfer: DataTransfer;
}

/** A row as drawn: its model, and its position among real rows (`null` while pending). */
interface DrawnRow {
  readonly row: SetRowModel;
  readonly realIndex: number | null;
}

type DragKind = 'row' | 'listing';

/**
 * The set as a card: the header, the control plate and the scrolling list of rows. The rows list
 * owns its scroll, so the header and plate stay put, and it brings the selected row into view by
 * adjusting its own `scrollTop` — never `scrollIntoView`, which would also scroll every ancestor.
 * The card assumes nothing about where it sits: no fixed height and no fixed positioning, so the
 * same card serves the bottom band and the peek.
 *
 * Rows are reordered by dragging their handle, or Alt+Arrow on it. A SID dragged from the file
 * listing (while `listingDragActive`) drops into the set the same way: an insertion line follows
 * the pointer between rows. Every index the card emits counts real rows only; pending entries are
 * drawn where they sit but never counted.
 *
 * @example
 * ```html
 * <lib-set-card
 *   [model]="card()"
 *   [listingDragActive]="listingDrag()"
 *   (rowSelect)="onSelect($event)"
 *   (rowMove)="onMove($event)"
 *   (listingDrop)="onDrop($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-set-card',
  imports: [SetHeaderComponent, SetControlPlateComponent, SetRowComponent, SetRowGhostComponent],
  templateUrl: './set-card.component.html',
  styleUrl: './set-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetCardComponent {
  /** The card's state. */
  readonly model = input.required<SetCardModel>();
  /** True while a SID is being dragged from the file listing; the rows list then accepts a drop. */
  readonly listingDragActive = input<boolean>(false);
  /** Emits the new name when the set is renamed. */
  readonly rename = output<string>();
  /** Emits when the New key is pressed. */
  readonly newSet = output<void>();
  /** Emits when the delete confirm's Delete key is pressed. */
  readonly deleteSet = output<void>();
  /** Emits when the Select up key is pressed. */
  readonly selectPrevious = output<void>();
  /** Emits when the Select down key is pressed. */
  readonly selectNext = output<void>();
  /** Emits when Load A is pressed. */
  readonly loadA = output<void>();
  /** Emits when Load B is pressed. */
  readonly loadB = output<void>();
  /** Emits a row's id when it is pressed to select it. */
  readonly rowSelect = output<string>();
  /** Emits a row's id when its remove key is pressed. */
  readonly rowRemove = output<string>();
  /** Emits when a row is moved by drag or Alt+Arrow, with its final index among real rows. */
  readonly rowMove = output<SetRowMove>();
  /** Emits when a SID from the file listing is dropped, with the insertion gap among real rows. */
  readonly listingDrop = output<SetListingDrop>();
  /** Emits when a row's drag starts, once the drag image is set. */
  readonly rowDragStart = output<void>();
  /** Emits when a row's drag ends, wherever it ends. */
  readonly rowDragEnd = output<void>();

  /** The gap, among real rows, where the insertion line is drawn; `null` when no drag is over the list. */
  protected readonly insertionGap = signal<number | null>(null);

  /** The row the off-screen ghost shows; set only while a row is being dragged. */
  protected readonly ghostRow = signal<SetRowGhostRow | null>(null);

  private readonly rowsList = viewChild.required<ElementRef<HTMLElement>>('rowsList');
  /** The off-screen ghost's element, snapshotted synchronously by the browser on `dragstart`. */
  private readonly ghostEl = viewChild<ElementRef<HTMLElement>, ElementRef<HTMLElement>>('ghost', { read: ElementRef });
  private readonly injector = inject(Injector);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  /** Rows with their place among real rows, so pending entries are drawn but never counted. */
  protected readonly drawnRows = computed<readonly DrawnRow[]>(() => {
    let realIndex = 0;
    return this.model().rows.map((row) => ({ row, realIndex: row.pending ? null : realIndex++ }));
  });

  protected readonly realRowCount = computed(
    () => this.drawnRows().filter(({ realIndex }) => realIndex !== null).length
  );

  /** The live region's content: one entry, tracked by `seq` so a new message re-announces. */
  protected readonly announcements = computed(() => {
    const announcement = this.model().announcement;
    return announcement === null ? [] : [announcement];
  });

  private readonly selectedId = computed(
    () => this.model().rows.find((row) => row.selected)?.id ?? null
  );

  constructor() {
    effect(() => {
      const id = this.selectedId();
      if (id === null) return;
      untracked(() => afterNextRender(() => this.revealRow(id), { injector: this.injector }));
    });
  }

  /** Turns a handle's Alt+Arrow into a move of one real position, ignoring the list's ends. */
  protected onMoveBy(rowId: string, delta: -1 | 1): void {
    const index = this.realIndexOf(rowId);
    if (index === null) return;
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= this.realRowCount()) return;
    this.rowMove.emit({ rowId, toIndex });
  }

  /** Sets the dragged row's ghost as the drag image, then announces the drag. */
  protected onRowDragStart(event: DragEvent, row: SetRowModel): void {
    // The ghost must show this row before the browser snapshots it, which happens synchronously
    // when this handler returns — zoneless-coalesced change detection would be too late.
    this.ghostRow.set({ numberText: row.numberText, title: row.title, author: row.author });
    this.changeDetectorRef.detectChanges();
    const ghost = this.ghostEl()?.nativeElement;
    if (ghost) event.dataTransfer?.setDragImage(ghost, 16, ghost.offsetHeight / 2);
    this.rowDragStart.emit();
  }

  protected onDragOver(event: DragEvent): void {
    if (this.dragKind(event) === null) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.dragKind(event) === 'row' ? 'move' : 'copy';
    }
    this.insertionGap.set(this.gapAt(event.clientY));
  }

  /** Clears the line when the drag leaves the list, not when it passes between its children. */
  protected onDragLeave(event: DragEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.rowsList().nativeElement.contains(next)) return;
    this.insertionGap.set(null);
  }

  protected onDragEnd(): void {
    this.insertionGap.set(null);
    this.ghostRow.set(null);
    this.rowDragEnd.emit();
  }

  protected onDrop(event: DragEvent): void {
    const kind = this.dragKind(event);
    if (kind === null || !event.dataTransfer) return;
    event.preventDefault();
    this.insertionGap.set(null);
    const gap = this.gapAt(event.clientY);

    if (kind === 'listing') {
      this.listingDrop.emit({ index: gap, dataTransfer: event.dataTransfer });
      return;
    }
    const rowId = event.dataTransfer.getData(SET_ROW_DRAG_TYPE);
    const from = this.realIndexOf(rowId);
    if (from === null) return;
    const toIndex = gap > from ? gap - 1 : gap;
    if (toIndex !== from) {
      this.rowMove.emit({ rowId, toIndex });
    }
  }

  /** A card's own row wins over a listing drag; anything else is not for the list. */
  private dragKind(event: DragEvent): DragKind | null {
    const types = Array.from(event.dataTransfer?.types ?? []);
    if (types.includes(SET_ROW_DRAG_TYPE)) return 'row';
    return this.listingDragActive() ? 'listing' : null;
  }

  private realIndexOf(rowId: string): number | null {
    return this.drawnRows().find(({ row }) => row.id === rowId)?.realIndex ?? null;
  }

  /** The insertion gap among real rows for a pointer height: how many real rows' midpoints lie above it. */
  private gapAt(clientY: number): number {
    const rows = this.rowsList().nativeElement.querySelectorAll<HTMLElement>(
      'lib-set-row:not([data-pending])'
    );
    let gap = 0;
    for (const row of Array.from(rows)) {
      const { top, height } = row.getBoundingClientRect();
      if (clientY > top + height / 2) gap++;
    }
    return gap;
  }

  /** The least scroll of the rows list that shows the whole row. */
  private revealRow(id: string): void {
    const list = this.rowsList().nativeElement;
    const row = Array.from(list.querySelectorAll<HTMLElement>('lib-set-row')).find(
      (element) => element.getAttribute('data-row-id') === id
    );
    if (!row) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < listRect.top) {
      list.scrollTop -= listRect.top - rowRect.top;
    } else if (rowRect.bottom > listRect.bottom) {
      list.scrollTop += rowRect.bottom - listRect.bottom;
    }
  }
}
