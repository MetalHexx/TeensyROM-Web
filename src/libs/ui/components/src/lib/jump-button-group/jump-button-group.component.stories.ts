import type { Meta, StoryObj } from '@storybook/angular';
import { JumpButtonGroupComponent, JumpButtonModel } from './jump-button-group.component';

const meta: Meta<JumpButtonGroupComponent> = {
  title: 'DJ/Jump Button Group',
  component: JumpButtonGroupComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A column of buttons driven entirely by data, not welded to any one caller's semantics. " +
          'Renders one button per model entry, top to bottom, and reports which one was pressed by ' +
          "that entry's own id.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<JumpButtonGroupComponent>;

const buttons: readonly JumpButtonModel[] = [
  { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A' },
  { id: 'home', label: 'Home', accessibleName: 'Speed home deck A' },
  { id: 'down', label: '−50%', accessibleName: 'Speed down 50% deck A' },
];

export const Default: Story = {
  args: { buttons },
};
