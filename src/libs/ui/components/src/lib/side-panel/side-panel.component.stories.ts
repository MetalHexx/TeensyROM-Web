import { componentWrapperDecorator, moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { BindingRowComponent } from '../binding-row/binding-row.component';
import { ControllerRowComponent } from '../controller-row/controller-row.component';
import { SidePanelComponent } from './side-panel.component';

const meta: Meta<SidePanelComponent> = {
  title: 'Layout/Side Panel',
  component: SidePanelComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({ imports: [BindingRowComponent, ControllerRowComponent] }),
    componentWrapperDecorator(
      (story) =>
        `<div style="width: 360px; height: 480px; padding: 16px; background: #231e22; color: #e9e0e4;">${story}</div>`
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "A full-height side panel on the nav rail's glassy card surface: a header — the " +
          'heading, an optional row of header actions and a close button — over a body that ' +
          'scrolls on its own. Purely a frame; it knows nothing of what the body holds. The host ' +
          'fills the height its container gives it, so place it in a sized flex or grid area. ' +
          'Announces as a `complementary` landmark named by `heading`. Project header actions ' +
          'with `sidePanelActions`; everything else is the body.',
      },
    },
  },
  argTypes: {
    heading: {
      description: "The panel's title, rendered as an `h2` and used as the landmark's name.",
    },
    closeAccessibleName: {
      description: "Accessible name for the close button. Defaults to 'Close panel'.",
    },
    animationDuration: {
      description:
        "Duration in milliseconds of the card's own slide-and-fade entry. Defaults to 400; pass 0 for reduced motion.",
    },
    closePanel: { description: 'Emits when the close button is pressed.' },
  },
};

export default meta;
type Story = StoryObj<SidePanelComponent>;

const bindingRow = (name: string, source: string) => ({
  name,
  sourceText: source,
  styleText: 'Absolute',
  expanded: false,
  styleOptions: [{ id: 'absolute', label: 'Absolute' }],
  selectedStyleId: 'absolute',
  amount: null,
  statusText: null,
  editAccessibleName: `Edit ${name} binding`,
  deleteAccessibleName: `Delete ${name} binding`,
});

export const Default: Story = {
  args: { heading: 'Bindings', closeAccessibleName: 'Close panel' },
  render: (args) => ({
    props: args,
    template: `
      <lib-side-panel [heading]="heading" [closeAccessibleName]="closeAccessibleName">
        <p style="margin: 0; color: rgba(255, 255, 255, 0.6);">Panel content goes here.</p>
      </lib-side-panel>
    `,
  }),
};

/** Header actions sit between the title and the close button. */
export const WithHeaderActions: Story = {
  args: Default.args,
  render: (args) => ({
    props: args,
    template: `
      <lib-side-panel [heading]="heading" [closeAccessibleName]="closeAccessibleName">
        <label sidePanelActions style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.875rem;">
          <input type="checkbox" /> Mapping mode
        </label>
        <p style="margin: 0; color: rgba(255, 255, 255, 0.6);">Panel content goes here.</p>
      </lib-side-panel>
    `,
  }),
};

/** A body taller than the panel scrolls on its own; the header stays put. */
export const ScrollingBody: Story = {
  args: Default.args,
  render: (args) => ({
    props: {
      ...args,
      rows: Array.from({ length: 16 }, (_, index) =>
        bindingRow(`Control ${index + 1}`, `Launch Control XL · ch 1 · CC ${index + 1}`)
      ),
      controller: {
        name: 'Launch Control XL',
        statusText: 'Listening',
        listening: true,
        toggleAccessibleName: 'Listen to Launch Control XL',
        portChoice: null,
      },
    },
    template: `
      <lib-side-panel [heading]="heading" [closeAccessibleName]="closeAccessibleName">
        @for (row of rows; track row.name) {
          <lib-binding-row [model]="row" />
        }
        <lib-controller-row [model]="controller" />
      </lib-side-panel>
    `,
  }),
};
