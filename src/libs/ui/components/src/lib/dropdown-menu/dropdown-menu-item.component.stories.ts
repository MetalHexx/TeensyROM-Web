import type { Meta, StoryObj } from '@storybook/angular';
import { DropdownMenuItemComponent } from './dropdown-menu-item.component';
import { DropdownMenuComponent } from './dropdown-menu.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

const meta: Meta<DropdownMenuItemComponent> = {
  title: 'Overlay & Interaction/Dropdown Menu Item',
  component: DropdownMenuItemComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`lib-dropdown-menu-item` is a single row meant to live inside a ' +
          '`DropdownMenuComponent`\'s `[dropdown-content]` slot — it injects its parent ' +
          '`DropdownMenuComponent` (optionally, so it still renders standalone in this story) ' +
          'and auto-closes it on click unless `autoClose` is `false`. It is easily confused ' +
          'with `MenuItemComponent` (`lib-menu-item`): that component renders standalone ' +
          'navigation/action rows from a `MenuItem` config object and has no relationship to ' +
          '`DropdownMenuComponent`, whereas this component only makes sense projected inside ' +
          '`lib-dropdown-menu` and takes its label via content projection. Use ' +
          '`[selected]="true"` to show the leading check icon for the current choice, and the ' +
          '`[actions]` content-projection slot for row-level buttons (e.g. edit/delete) that ' +
          'should not trigger `itemClick` or close the dropdown.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DropdownMenuItemComponent>;

/**
 * Rendered inside a real `lib-dropdown-menu` so `autoClose`'s dropdown-closing behavior is
 * observable: click the trigger to open the menu, then click an item.
 */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      imports: [DropdownMenuComponent, DropdownMenuItemComponent, IconButtonComponent],
    },
    template: `
      <lib-dropdown-menu #menu>
        <lib-icon-button
          icon="more_vert"
          ariaLabel="Open menu"
          (buttonClick)="menu.toggle()"
        ></lib-icon-button>
        <div dropdown-content>
          <lib-dropdown-menu-item [selected]="true">Option One</lib-dropdown-menu-item>
          <lib-dropdown-menu-item>Option Two</lib-dropdown-menu-item>
          <lib-dropdown-menu-item [autoClose]="false">Stays Open</lib-dropdown-menu-item>
        </div>
      </lib-dropdown-menu>
    `,
  }),
};

/**
 * Content projected into the `[actions]` slot (edit/delete icon buttons here) stops click
 * propagation, so activating an action never fires `itemClick` or closes the dropdown.
 */
export const WithActions: Story = {
  render: () => ({
    moduleMetadata: {
      imports: [DropdownMenuComponent, DropdownMenuItemComponent, IconButtonComponent],
    },
    template: `
      <lib-dropdown-menu #menu>
        <lib-icon-button
          icon="more_vert"
          ariaLabel="Open menu"
          (buttonClick)="menu.toggle()"
        ></lib-icon-button>
        <div dropdown-content>
          <lib-dropdown-menu-item>
            My Preset
            <div actions>
              <lib-icon-button icon="edit" ariaLabel="Edit"></lib-icon-button>
              <lib-icon-button icon="delete" ariaLabel="Delete"></lib-icon-button>
            </div>
          </lib-dropdown-menu-item>
        </div>
      </lib-dropdown-menu>
    `,
  }),
};
