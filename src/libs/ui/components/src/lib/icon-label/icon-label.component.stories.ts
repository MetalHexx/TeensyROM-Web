import type { Meta, StoryObj } from '@storybook/angular';
import { IconLabelComponent } from './icon-label.component';

const meta: Meta<IconLabelComponent> = {
  title: 'Primitives/Icon Label',
  component: IconLabelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The library's standard icon + text pairing. Choosing a `size` preset scales the icon, primary text, secondary text, font weight, and gap spacing together, so the pairing keeps its visual proportions no matter where it's used — directory trees, file tables, device settings headers, navigation menus. Add `secondaryLabel` for a second line of detail (e.g. a status word or metadata) that scales down proportionally to the primary label. `IconLabelComponent` is purely presentational; wrap it in `ActionLinkComponent` or `ExternalLinkComponent` when the row needs to be clickable, or use `StatusIconLabelComponent` when it needs a success/error status glyph alongside the icon.",
      },
    },
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['normal', 'primary', 'highlight', 'success', 'error', 'dimmed', 'directory'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large', 'extra-large'],
    },
  },
};

export default meta;
type Story = StoryObj<IconLabelComponent>;

export const Default: Story = {
  args: {
    icon: 'folder',
    label: 'Documents',
    color: 'normal',
    size: 'medium',
    truncate: true,
    shrink: false,
    secondaryLabel: '',
    secondaryLabelClass: '',
    labelClass: '',
  },
};

/** With `shrink`, the label fills the room it is given (here 240px) and ellipsises only when the container constrains it. */
export const ShrinkToFill: Story = {
  args: {
    ...Default.args,
    label: 'A very long label that would stop near twenty characters without shrink',
    shrink: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 240px">
        <lib-icon-label
          [icon]="icon"
          [label]="label"
          [color]="color"
          [size]="size"
          [truncate]="truncate"
          [shrink]="shrink"
        />
      </div>
    `,
  }),
};
