import { Component, output, viewChild, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DropdownDialogComponent } from '../dropdown-dialog/dropdown-dialog.component';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';

/**
 * Custom dropdown menu using CDK Overlay for better control over the rendering lifecycle
 * than Angular Material's `mat-menu`, which flickers on open/close in this app's animated
 * layouts. Internally composes `DropdownDialogComponent` for overlay creation, positioning,
 * and backdrop management, then wraps the `[dropdown-content]` slot in a glassy
 * `CompactCardLayoutComponent` card (`cardClass="glassy-card"` — see the `style-guide`
 * skill for the token) so menu content gets consistent chrome for free.
 *
 * Reach for `lib-dropdown-menu` when the projected content is a list of selectable
 * actions or options — pair it with `DropdownMenuItemComponent` for each row. When the
 * projected content is a form or a confirmation prompt instead, use
 * `DropdownDialogComponent` directly: it provides the same CDK positioning without the
 * menu's card styling opinions.
 *
 * @example
 * ```html
 * <lib-dropdown-menu #menu>
 *   <lib-icon-button icon="more_vert" ariaLabel="Open menu" (buttonClick)="menu.toggle()">
 *   </lib-icon-button>
 *   <div dropdown-content>
 *     <lib-dropdown-menu-item [selected]="true" (itemClick)="onOptionOne()">
 *       Option One
 *     </lib-dropdown-menu-item>
 *     <lib-dropdown-menu-item (itemClick)="onOptionTwo()">Option Two</lib-dropdown-menu-item>
 *   </div>
 * </lib-dropdown-menu>
 * ```
 */
@Component({
  selector: 'lib-dropdown-menu',
  standalone: true,
  imports: [CommonModule, DropdownDialogComponent, CompactCardLayoutComponent],
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.scss'
})
export class DropdownMenuComponent {
  /** Reference to the internal `DropdownDialogComponent` this menu delegates positioning and lifecycle to. */
  private dialogRef = viewChild.required<DropdownDialogComponent>('dialogRef');

  /** Read-only signal reflecting the internal `DropdownDialogComponent`'s open/closed state. */
  isOpen = computed(() => this.dialogRef().isOpen());

  /** Emitted after the menu finishes opening (re-emits the internal dialog's `opened`). */
  opened = output<void>();

  /** Emitted after the menu finishes closing (re-emits the internal dialog's `closed`). */
  closed = output<void>();

  /** Subscribes to the internal dialog's `opened`/`closed` events and re-emits them as this menu's own outputs. */
  constructor() {
    // Connect dialog events to menu outputs
    effect(() => {
      const dialog = this.dialogRef();
      
      // Subscribe to dialog opened event and re-emit as menu event
      dialog.opened.subscribe(() => {
        this.opened.emit();
      });
      
      // Subscribe to dialog closed event and re-emit as menu event
      dialog.closed.subscribe(() => {
        this.closed.emit();
      });
    });
  }

  /** Opens the menu if closed, or closes it if open. */
  toggle(): void {
    if (this.dialogRef().isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Opens the menu's dropdown overlay. */
  open(): void {
    this.dialogRef().open();
  }

  /** Closes the menu's dropdown overlay. */
  close(): void {
    this.dialogRef().close();
  }
}
