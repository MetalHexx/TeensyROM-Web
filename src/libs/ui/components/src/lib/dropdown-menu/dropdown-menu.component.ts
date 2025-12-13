import { Component, output, viewChild, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DropdownDialogComponent } from '../dropdown-dialog/dropdown-dialog.component';
import { CompactCardLayoutComponent } from '../compact-card-layout/compact-card-layout.component';

/**
 * Custom dropdown menu component using CDK Overlay for better control over rendering lifecycle.
 * Avoids the flicker issues present in Material's mat-menu by managing overlay lifecycle explicitly.
 */
@Component({
  selector: 'lib-dropdown-menu',
  standalone: true,
  imports: [CommonModule, DropdownDialogComponent, CompactCardLayoutComponent],
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.scss'
})
export class DropdownMenuComponent {
  private dialogRef = viewChild.required<DropdownDialogComponent>('dialogRef');

  isOpen = computed(() => this.dialogRef().isOpen());
  opened = output<void>();
  closed = output<void>();

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

  toggle(): void {
    if (this.dialogRef().isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.dialogRef().open();
  }

  close(): void {
    this.dialogRef().close();
  }
}
