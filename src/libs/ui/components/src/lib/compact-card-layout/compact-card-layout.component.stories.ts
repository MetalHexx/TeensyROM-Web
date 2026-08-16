import type { Meta, StoryObj } from '@storybook/angular';
import { CompactCardLayoutComponent } from './compact-card-layout.component';

const meta: Meta<CompactCardLayoutComponent> = {
  title: 'Layout/Compact Card Layout',
  component: CompactCardLayoutComponent,
  tags: ['autodocs'],
  argTypes: {
    glassyIntensity: {
      control: 'select',
      options: ['subtle', 'light', 'medium', 'strong', 'dark', 'default'],
    },
  },
};

export default meta;
type Story = StoryObj<CompactCardLayoutComponent>;

export const Default: Story = {
  args: {
    enableOverflow: true,
    cardClass: '',
    glassy: true,
    glassyIntensity: 'dark',
  },
  render: (args) => ({
    props: args,
    template: `<lib-compact-card-layout [enableOverflow]="enableOverflow" [cardClass]="cardClass" [glassy]="glassy" [glassyIntensity]="glassyIntensity"><p>Compact card content projected into the default slot.</p></lib-compact-card-layout>`,
  }),
};
