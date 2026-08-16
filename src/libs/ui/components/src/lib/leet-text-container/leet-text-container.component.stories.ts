import type { Meta, StoryObj } from '@storybook/angular';
import { LeetTextContainerComponent } from './leet-text-container.component';

const meta: Meta<LeetTextContainerComponent> = {
  title: 'Primitives/Leet Text Container',
  component: LeetTextContainerComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<LeetTextContainerComponent>;

export const Default: Story = {
  args: {
    animationTrigger: true,
    animationDuration: 1000,
    animationParent: undefined,
    showFrontSpinner: false,
    showBackSpinner: false,
  },
  render: (args) => ({
    props: args,
    template: `<lib-leet-text-container [animationTrigger]="animationTrigger" [animationDuration]="animationDuration" [animationParent]="animationParent" [showFrontSpinner]="showFrontSpinner" [showBackSpinner]="showBackSpinner">Loading Data</lib-leet-text-container>`,
  }),
};
