import type { Meta, StoryObj } from '@storybook/angular';
import { StorageItemActionsComponent } from './storage-item-actions.component';
import { StorageItemComponent } from './storage-item.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

const meta: Meta<StorageItemActionsComponent> = {
  title: 'Navigation & Data/Storage Item Actions',
  component: StorageItemActionsComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<StorageItemActionsComponent>;

/**
 * `lib-storage-item-actions` only projects content, so it is rendered nested inside
 * `lib-storage-item` (per its own JSDoc @example) with representative action buttons
 * projected in, rather than as a bare args-only story.
 */
export const WithActionButtons: Story = {
  args: {
    label: '1.5 KB',
    storageType: 'SD',
  },
  render: (args) => ({
    props: args,
    moduleMetadata: {
      imports: [StorageItemComponent, IconButtonComponent],
    },
    template: `
      <lib-storage-item icon="music_note" label="Song.sid">
        <lib-storage-item-actions [label]="label" [storageType]="storageType">
          <lib-icon-button icon="edit" ariaLabel="Rename"></lib-icon-button>
          <lib-icon-button icon="delete" ariaLabel="Delete"></lib-icon-button>
        </lib-storage-item-actions>
      </lib-storage-item>
    `,
  }),
};
