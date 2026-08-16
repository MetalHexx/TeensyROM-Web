import type { Meta, StoryObj } from '@storybook/angular';
import { StatusIconLabelComponent } from './status-icon-label.component';

const meta: Meta<StatusIconLabelComponent> = {
  title: 'Primitives/Status Icon Label',
  component: StatusIconLabelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "`IconLabelComponent` plus a pass/fail status glyph: a green check circle when `status` is `true`, a red cancel icon when `status` is `false`, and nothing extra when `status` is `undefined`. Reach for it whenever the label represents a condition that can succeed or fail — device connection state, storage availability, feature checks — rather than composing a separate status icon next to a plain `IconLabelComponent`. When there's no pass/fail semantics to convey, use `IconLabelComponent` directly instead.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<StatusIconLabelComponent>;

export const Default: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: undefined,
  },
};

export const StatusTrue: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: true,
  },
};

export const StatusFalse: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: false,
  },
};

export const StatusUndefined: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: undefined,
  },
};
