import type { Meta, StoryObj } from '@storybook/angular';
import { SetCardComponent, type SetCardModel } from './set-card.component';
import { SET_ROW_DRAG_TYPE, type SetRowModel } from '../set-row/set-row.component';

const meta: Meta<SetCardComponent> = {
  title: 'DJ/Set Card',
  component: SetCardComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The set as a card: a header (the name renamed in place, a Saved lamp, the count, Delete ' +
          'with an inline confirm, New), the control plate (Select up and down around a readout of ' +
          'the selected row, Load A and Load B) and the rows. The rows list scrolls inside the ' +
          'card and brings the selected row into view by its own scroll; the card assumes nothing ' +
          'about its height, so one card serves the bottom band and the peek. Rows are reordered ' +
          'by dragging a handle or with Alt+Arrow on it; a SID dragged from the file listing drops ' +
          'in the same way, with an insertion line between rows. Every index it emits counts real ' +
          'rows only: pending entries (still being fetched or analysed) are drawn where they sit ' +
          'but never counted.',
      },
    },
  },
  argTypes: {
    model: { description: 'Everything the card draws: header, plate, rows, texts and announcement.' },
    listingDragActive: {
      description: 'True while a SID is dragged from the file listing; the rows then accept a drop.',
    },
    rename: { description: 'The set was renamed in place; carries the new name.' },
    newSet: { description: 'The New key was pressed.' },
    deleteSet: { description: 'The confirm’s Delete key was pressed.' },
    selectPrevious: { description: 'The Select up key was pressed.' },
    selectNext: { description: 'The Select down key was pressed.' },
    loadA: { description: 'Load A was pressed.' },
    loadB: { description: 'Load B was pressed.' },
    rowSelect: { description: 'A row was pressed; carries its id.' },
    rowRemove: { description: 'A row’s remove key was pressed; carries its id.' },
    rowMove: { description: 'A row moved; carries its id and final index among real rows.' },
    listingDrop: { description: 'A SID from the listing dropped; carries the gap among real rows.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 520px; height: 420px">
        <lib-set-card [model]="model" [listingDragActive]="listingDragActive" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SetCardComponent>;

function row(index: number, title: string, author: string, overrides: Partial<SetRowModel> = {}): SetRowModel {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `row-${index}`,
    numberText: number,
    title,
    author,
    detail: { kind: 'counts', text: 'No loops' },
    lengthText: '03:12',
    decks: [],
    selected: false,
    pending: false,
    accessibleName: `Row ${index + 1}, ${title} by ${author}`,
    handleAccessibleName: `Move ${title}, Alt and arrow keys move it`,
    removeAccessibleName: `Remove ${title} from the set`,
    ...overrides,
  };
}

const TUNES: readonly (readonly [string, string])[] = [
  ['Commando', 'Rob Hubbard'],
  ['Cybernoid II', 'Jeroen Tel'],
  ['Last Ninja 2 - The Wilderness', 'Ben Daglish'],
  ['Wizball - Title Music', 'Martin Galway'],
  ['Monty on the Run', 'Rob Hubbard'],
  ['Delta', 'Rob Hubbard'],
  ['Sanxion', 'Rob Hubbard'],
  ['Thing on a Spring', 'Rob Hubbard'],
];

function modelFor(rows: SetRowModel[], overrides: Partial<SetCardModel> = {}): SetCardModel {
  const selectedIndex = rows.findIndex((r) => r.selected);
  const selected = selectedIndex < 0 ? null : rows[selectedIndex];
  return {
    header: {
      name: 'Friday warm-up',
      nameMaxLength: 64,
      countText: `${rows.length} SIDS`,
      save: 'saved',
      saveText: 'Saved',
      renameLabel: 'Rename set Friday warm-up',
      newAccessibleName: 'New set',
      deleteAccessibleName: 'Delete set Friday warm-up',
      deletePrompt: "Delete Friday warm-up? This can't be undone.",
      disabled: false,
    },
    plate: {
      positionText: selected ? `${selected.numberText}/${String(rows.length).padStart(2, '0')}` : '— / —',
      title: selected?.title ?? null,
      author: selected?.author ?? null,
      previousDisabled: selectedIndex <= 0,
      nextDisabled: selectedIndex < 0 || selectedIndex >= rows.length - 1,
      loadDisabled: selected === null || selected.pending,
      selectAccessibleName: selected
        ? `Set selection, ${selectedIndex + 1} of ${rows.length}, ${selected.title} by ${selected.author}`
        : 'Set selection, nothing selected',
      previousAccessibleName: 'Select the previous row',
      nextAccessibleName: 'Select the next row',
      loadAAccessibleName: 'Load the selected row on deck A',
      loadBAccessibleName: 'Load the selected row on deck B',
    },
    rows,
    emptyText: 'Drag SIDs here from the file listing',
    accessibleName: `Set Friday warm-up, ${rows.length} SIDs`,
    announcement: null,
    ...overrides,
  };
}

const fullRows = (selected = 1): SetRowModel[] =>
  TUNES.map(([title, author], index) =>
    row(index, title, author, {
      selected: index === selected,
      detail: { kind: 'counts', text: index % 3 === 0 ? 'No loops' : `${index} loops · ${index % 2} cues` },
      decks:
        index === 1
          ? [
              { letter: 'A', light: 'playing' },
              { letter: 'B', light: 'paused' },
            ]
          : [],
    })
  );

/** A new set: the empty text is the drop target. */
export const Empty: Story = {
  args: { model: modelFor([], { header: { ...modelFor([]).header, name: 'New set' } }), listingDragActive: false },
};

/** SIDs dropped from the listing and still being fetched or analysed: no handle, no remove key. */
export const Building: Story = {
  args: {
    model: modelFor([
      row(0, 'Commando', 'Rob Hubbard', { detail: { kind: 'counts', text: '2 loops · 1 cue' } }),
      row(1, 'Cybernoid II', 'Jeroen Tel', { pending: true, detail: { kind: 'fetching' }, lengthText: '—' }),
      row(2, 'Delta', 'Rob Hubbard', { pending: true, detail: { kind: 'analyzing' }, lengthText: '—' }),
      row(3, 'Missing tune', 'Unknown', {
        detail: { kind: 'unavailable', text: 'Not on this device' },
        lengthText: '—',
      }),
    ]),
    listingDragActive: false,
  },
};

/** A full set scrolling inside the card, row 2 selected and on both decks at once. */
export const FullSet: Story = {
  args: { model: modelFor(fullRows()), listingDragActive: false },
};

/** The Saved lamp pulses while saving (steady under reduced motion) and turns red when it fails. */
export const SavingAndFailed: Story = {
  args: {
    model: modelFor(fullRows(), {
      header: { ...modelFor([]).header, save: 'saving', saveText: 'Saving', countText: '8 SIDS' },
    }),
    listingDragActive: false,
  },
  render: (args) => ({
    props: { ...args, failed: modelFor(fullRows(), { header: { ...modelFor([]).header, save: 'failed', saveText: 'Not saved' } }) },
    template: `
      <div style="display: flex; gap: 1rem">
        <div style="width: 420px; height: 300px">
          <lib-set-card [model]="model" />
        </div>
        <div style="width: 420px; height: 300px">
          <lib-set-card [model]="failed" />
        </div>
      </div>
    `,
  }),
};

/** Delete opens the inline confirm with focus on Cancel; Escape cancels. */
export const DeleteConfirm: Story = {
  args: { model: modelFor(fullRows()), listingDragActive: false },
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('[data-part="delete"] button')?.click();
  },
};

/**
 * Reordering with no mapping behind it: drag a handle (or press Alt+Arrow on it) and the rows
 * follow. The insertion line is held open here as if a row were being dragged over the list.
 */
export const Reorder: Story = {
  args: { model: modelFor(fullRows(2)), listingDragActive: true },
  render: (args) => ({
    props: {
      ...args,
      onMove({ rowId, toIndex }: { rowId: string; toIndex: number }) {
        const rows = [...(this['model'] as SetCardModel).rows];
        const from = rows.findIndex((r) => r.id === rowId);
        const [moved] = rows.splice(from, 1);
        rows.splice(toIndex, 0, moved);
        this['model'] = modelFor(
          rows.map((r, i) => ({ ...r, numberText: String(i + 1).padStart(2, '0') }))
        );
      },
    },
    template: `
      <div style="width: 520px; height: 420px">
        <lib-set-card [model]="model" [listingDragActive]="listingDragActive" (rowMove)="onMove($event)" />
      </div>
    `,
  }),
  play: ({ canvasElement }) => {
    const rows = canvasElement.querySelector<HTMLElement>('.rows');
    if (!rows) return;
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    const { top, height } = rows.getBoundingClientRect();
    Object.defineProperties(event, {
      dataTransfer: { value: { types: [SET_ROW_DRAG_TYPE], dropEffect: 'move' } },
      clientY: { value: top + height / 2 },
    });
    rows.dispatchEvent(event);
  },
};

/** Not enough room for the whole set: the header and plate stay put and the rows scroll. */
export const Peek: Story = {
  args: { model: modelFor(fullRows(6)), listingDragActive: false },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 420px; height: 316px">
        <lib-set-card [model]="model" [listingDragActive]="listingDragActive" />
      </div>
    `,
  }),
};
