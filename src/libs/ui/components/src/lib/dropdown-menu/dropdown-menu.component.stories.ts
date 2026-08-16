import type { Meta, StoryObj } from '@storybook/angular';
import { DropdownMenuComponent } from './dropdown-menu.component';
import { DropdownMenuItemComponent } from './dropdown-menu-item.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

const meta: Meta<DropdownMenuComponent> = {
  title: 'Overlay & Interaction/Dropdown Menu',
  component: DropdownMenuComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`lib-dropdown-menu` is the CDK-overlay-backed replacement for Angular Material\'s ' +
          '`mat-menu`, chosen to avoid `mat-menu`\'s open/close flicker in this app\'s animated ' +
          'layouts. It internally composes `DropdownDialogComponent` — which owns overlay ' +
          'creation, positioning against the projected trigger, and backdrop dismissal — and ' +
          'wraps the `[dropdown-content]` slot in a glassy `CompactCardLayoutComponent` card, ' +
          'giving menu content consistent chrome without any styling input. Reach for this ' +
          'component when the projected content is a list of selectable rows, and pair each ' +
          'row with `DropdownMenuItemComponent` for consistent selection/hover states and ' +
          'automatic dropdown-close-on-click. When the projected content is a form or a ' +
          'confirmation prompt instead of a list, use `DropdownDialogComponent` directly — it ' +
          'gives the same positioning without the menu\'s card styling opinions.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DropdownMenuComponent>;

/**
 * `lib-dropdown-menu` has no inputs of its own: it positions and animates a
 * `dropdown-content` panel against a projected trigger (per its real-world usage in
 * `directory-breadcrumb` and `player-toolbar-actions`). Click the trigger to open the menu.
 */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      imports: [DropdownMenuItemComponent, IconButtonComponent],
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
          <lib-dropdown-menu-item>Option Three</lib-dropdown-menu-item>
        </div>
      </lib-dropdown-menu>
    `,
  }),
};
