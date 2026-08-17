import { Component, afterNextRender, input, viewChild } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { DropdownDialogComponent } from './dropdown-dialog.component';

/**
 * `lib-dropdown-dialog` renders its `dialog-content` through a CDK `TemplatePortal` that
 * only attaches once `.open()` is called imperatively against the internal `#trigger`
 * element — there is no input to drive it open declaratively. This host calls `.open()`
 * after first render so the story shows the dialog content immediately, without a click
 * or a play function (per R6 and the Non-Goals around interaction testing).
 */
@Component({
  selector: 'lib-dropdown-dialog-story-host',
  standalone: true,
  imports: [DropdownDialogComponent],
  template: `
    <lib-dropdown-dialog #dialog [centered]="centered()">
      <button class="trigger-button" type="button">Open menu</button>
      <div
        dialog-content
        style="padding: 16px; min-width: 220px; background: #1f1f1f; color: #fff; border-radius: 8px;"
      >
        Dropdown dialog content
      </div>
    </lib-dropdown-dialog>
  `,
})
class DropdownDialogStoryHostComponent {
  readonly centered = input<boolean>(false);
  private readonly dialogRef = viewChild.required<DropdownDialogComponent>('dialog');

  constructor() {
    afterNextRender(() => this.dialogRef().open());
  }
}

const meta: Meta<DropdownDialogComponent> = {
  title: 'Overlay & Interaction/Dropdown Dialog',
  component: DropdownDialogComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`lib-dropdown-dialog` is the pure-positioning CDK overlay container that ' +
          '`DropdownMenuComponent` composes internally for its positioning, backdrop, and ' +
          'fullscreen handling — but `DropdownMenuComponent` also wraps its content in a ' +
          'glassy card and expects `DropdownMenuItemComponent` rows. Reach for ' +
          '`lib-dropdown-dialog` directly instead when the projected `[dialog-content]` is a ' +
          'form or confirmation prompt (e.g. `PresetNameDialogComponent` or ' +
          '`ConfirmationDialogComponent`) that already brings its own styling and does not ' +
          'want the menu\'s card chrome. `centered` switches the CDK position-fallback chain ' +
          'from the usual start/end dropdown layout to a horizontally-centered popover, ' +
          'useful for prompts that should hang directly under a single trigger rather than ' +
          'align to one edge.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DropdownDialogComponent>;

export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      imports: [DropdownDialogStoryHostComponent],
    },
    template: `<lib-dropdown-dialog-story-host></lib-dropdown-dialog-story-host>`,
  }),
};

export const Centered: Story = {
  render: () => ({
    moduleMetadata: {
      imports: [DropdownDialogStoryHostComponent],
    },
    template: `<lib-dropdown-dialog-story-host [centered]="true"></lib-dropdown-dialog-story-host>`,
  }),
};
