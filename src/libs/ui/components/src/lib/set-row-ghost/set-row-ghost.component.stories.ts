import type { Meta, StoryObj } from '@storybook/angular';
import { SetRowGhostComponent } from './set-row-ghost.component';

const meta: Meta<SetRowGhostComponent> = {
  title: 'DJ/Set Row Ghost',
  component: SetRowGhostComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The drag image of a set row: a solid, row-shaped box showing the row’s number, title ' +
          'and, when it has one, author. The set card renders one off-screen while a row is ' +
          'dragged and hands it to the browser as the drag image, so its backing is opaque.',
      },
    },
  },
  argTypes: {
    row: { description: 'The row being dragged: its number, title and author.' },
  },
};

export default meta;
type Story = StoryObj<SetRowGhostComponent>;

export const WithAuthor: Story = {
  args: { row: { numberText: '03', title: 'Cybernoid II', author: 'Jeroen Tel' } },
};

export const WithoutAuthor: Story = {
  args: { row: { numberText: '07', title: 'Untitled', author: '' } },
};
