import type { Meta, StoryObj } from '@storybook/angular';
import { DragChipComponent } from './drag-chip.component';

const meta: Meta<DragChipComponent> = {
  title: 'DJ/Drag Chip',
  component: DragChipComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact glassy pill presenter for drag-preview imagery. Displays an icon and label in a ' +
          'horizontally-stacked, visually lightweight container with a dark glassy effect. Used as ' +
          'the visual payload of a native drag operation — the image the user sees following the ' +
          'cursor while dragging. The chip is static for the duration of the drag operation.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DragChipComponent>;

export const Default: Story = {
  args: {
    icon: 'music_note',
    label: 'song.sid',
  },
};

export const LongTitle: Story = {
  args: {
    icon: 'music_note',
    label: 'this-is-a-very-long-song-title-that-might-overflow.sid',
  },
};
