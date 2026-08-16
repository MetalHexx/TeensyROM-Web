import type { Meta, StoryObj } from '@storybook/angular';
import { FadingContainerComponent } from './fading-container.component';

const meta: Meta<FadingContainerComponent> = {
  title: 'Layout/Fading Container',
  component: FadingContainerComponent,
  tags: ['autodocs'],
  argTypes: {
    animationTrigger: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<FadingContainerComponent>;

export const Default: Story = {
  args: {
    animationTrigger: true,
    animationDuration: 200,
    animationParent: undefined,
  },
  render: (args) => ({
    props: args,
    template: `<lib-fading-container [animationTrigger]="animationTrigger" [animationDuration]="animationDuration"><p>Toggle the animationTrigger control to play the enter/exit transition.</p></lib-fading-container>`,
  }),
};
