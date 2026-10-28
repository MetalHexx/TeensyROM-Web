import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  DeckService,
  DjSets,
  DjStore,
  SET_NAME_MAX_LENGTH,
  type SetCardSummary,
  type SetRowSummary,
} from '@teensyrom-nx/application';
import {
  SetCardComponent,
  type SetCardModel,
  type SetListingDrop,
  type SetRowDetail,
  type SetRowModel,
  type SetRowMove,
  type SetSaveState,
} from '@teensyrom-nx/ui/components/dj';
import { readDjFileDragData } from '../drag/dj-file-drag';

const SAVE_TEXT: Record<SetSaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  failed: 'Not saved',
};

const EMPTY_TEXT = 'Drag SIDs here from the file listing';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The loop and cue counts as the row's detail line: 'No loops' when it has neither. */
function countsText(loops: number, cues: number): string {
  const parts = [
    ...(loops > 0 ? [plural(loops, 'loop', 'loops')] : []),
    ...(cues > 0 ? [plural(cues, 'cue', 'cues')] : []),
  ];
  return parts.length === 0 ? 'No loops' : parts.join(' · ');
}

function detailOf(row: SetRowSummary): SetRowDetail {
  switch (row.prep?.phase) {
    case 'fetching':
      return { kind: 'fetching' };
    case 'analyzing':
      return { kind: 'analyzing' };
    case 'unavailable':
      return { kind: 'unavailable', text: row.prep.reason };
    default:
      return { kind: 'counts', text: countsText(row.loops, row.cues) };
  }
}

/** The detail line in the words a screen reader should hear. */
function detailWords(detail: SetRowDetail): string {
  switch (detail.kind) {
    case 'fetching':
      return 'fetching';
    case 'analyzing':
      return 'analyzing';
    case 'unavailable':
      return `unavailable, ${detail.text}`;
    case 'counts':
      return detail.text.split(' · ').join(', ');
  }
}

function byAuthor(title: string, author: string | null): string {
  return author === null || author === '' ? title : `${title} by ${author}`;
}

function rowModel(row: SetRowSummary, rowCount: number): SetRowModel {
  const detail = detailOf(row);
  return {
    id: row.id,
    numberText: String(row.number).padStart(2, '0'),
    title: row.title,
    author: row.author,
    detail,
    lengthText: row.lengthText,
    decks: row.decks.map(({ slot, state }) => ({ letter: slot, light: state })),
    selected: row.selected,
    pending: row.pending,
    accessibleName: [
      `Row ${row.number} of ${rowCount}`,
      byAuthor(row.title, row.author),
      detailWords(detail),
      ...(row.lengthText === '—' ? [] : [row.lengthText]),
      ...row.decks.map(
        ({ slot, state }) => `on deck ${slot}${state === 'off' ? '' : `, ${state}`}`
      ),
    ].join(', '),
    handleAccessibleName: `Move ${row.title}, Alt and arrow keys move it`,
    removeAccessibleName: `Remove ${row.title} from the set`,
  };
}

function loadName(title: string | null, letter: 'A' | 'B'): string {
  return title === null
    ? `Load the selected row on deck ${letter}`
    : `Load ${title} on deck ${letter}`;
}

function cardModel(summary: SetCardSummary): SetCardModel {
  const { name, rowCount, realRowCount, selectedRowIndex, selectedIndex, selectedTitle } = summary;
  return {
    header: {
      name,
      nameMaxLength: SET_NAME_MAX_LENGTH,
      countText: `${rowCount} SIDS`,
      save: summary.save,
      saveText: SAVE_TEXT[summary.save],
      renameLabel: `Rename set ${name}`,
      newAccessibleName: 'New set',
      deleteAccessibleName: `Delete set ${name}`,
      deletePrompt: `Delete ${name}? This can't be undone.`,
      disabled: !summary.ready,
    },
    plate: {
      positionText: summary.positionText,
      title: selectedTitle,
      author: summary.selectedAuthor,
      previousDisabled: realRowCount === 0 || selectedRowIndex === 0,
      nextDisabled: realRowCount === 0 || selectedRowIndex === realRowCount - 1,
      loadDisabled: selectedRowIndex === null,
      selectAccessibleName:
        selectedIndex === null || selectedTitle === null
          ? 'Set selection, nothing selected'
          : `Set selection, ${selectedIndex + 1} of ${rowCount}, ${byAuthor(
              selectedTitle,
              summary.selectedAuthor
            )}`,
      previousAccessibleName: 'Select the previous row',
      nextAccessibleName: 'Select the next row',
      loadAAccessibleName: loadName(selectedTitle, 'A'),
      loadBAccessibleName: loadName(selectedTitle, 'B'),
    },
    rows: summary.rows.map((row) => rowModel(row, rowCount)),
    emptyText: EMPTY_TEXT,
    accessibleName: `Set ${name}, ${plural(rowCount, 'SID', 'SIDs')}`,
    announcement: summary.announcement,
  };
}

/**
 * The current set as a card in the DJ view: maps the set summary onto `lib-set-card`'s model and
 * routes every output to the sets service or the deck service. A SID dragged from the listing
 * drops into the set only while `listingDragActive` is set by the view.
 */
@Component({
  selector: 'lib-dj-set-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetCardComponent],
  templateUrl: './dj-set-card.component.html',
  styleUrl: './dj-set-card.component.scss',
})
export class DjSetCardComponent {
  private readonly djSets = inject(DjSets);
  private readonly deckService = inject(DeckService);
  private readonly summary = inject(DjStore).setCardSummary();

  /** Whether a SID drag from the file listing is in flight. */
  readonly listingDragActive = input<boolean>(false);

  readonly model = computed<SetCardModel>(() => cardModel(this.summary()));

  onRename(name: string): void {
    this.djSets.renameCurrent(name);
  }

  onNewSet(): void {
    this.djSets.newSet();
  }

  onDeleteSet(): void {
    void this.djSets.deleteCurrent();
  }

  onSelectPrevious(): void {
    this.djSets.moveSelection(-1);
  }

  onSelectNext(): void {
    this.djSets.moveSelection(1);
  }

  onLoadA(): void {
    void this.deckService.loadSelected('A');
  }

  onLoadB(): void {
    void this.deckService.loadSelected('B');
  }

  onRowSelect(id: string): void {
    this.djSets.selectRow(id);
  }

  onRowRemove(id: string): void {
    this.djSets.removeRow(id);
  }

  onRowMove({ rowId, toIndex }: SetRowMove): void {
    this.djSets.moveRow(rowId, toIndex);
  }

  /** A drop that is not a DJ listing drag is ignored. */
  onListingDrop({ index, dataTransfer }: SetListingDrop): void {
    const payload = readDjFileDragData(dataTransfer);
    if (payload) {
      void this.djSets.addFromListing(payload, index);
    }
  }
}
