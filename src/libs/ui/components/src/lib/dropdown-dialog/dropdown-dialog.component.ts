import { Component, input, output, signal, TemplateRef, viewChild, ElementRef, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { trigger, transition, style, animate } from '@angular/animations';

/**
 * Pure positioning container for dialogs and overlays, built on CDK `Overlay`. Handles
 * overlay creation, `flexibleConnectedTo` positioning against a projected trigger,
 * transparent-backdrop dismissal, and fullscreen-mode re-parenting. Projects any content
 * through the `[dialog-content]` slot without imposing card, border, or shadow styling —
 * that is the projected content's responsibility.
 *
 * This is the lower-level building block `DropdownMenuComponent` composes internally to
 * get its positioning; reach for `lib-dropdown-dialog` directly when the projected
 * content is a form or confirmation prompt (e.g. `PresetNameDialogComponent` or
 * `ConfirmationDialogComponent`) rather than a list of `DropdownMenuItemComponent` rows,
 * since those don't need the menu's glassy card wrapper. Opening and closing is always
 * imperative — there is no input to drive it declaratively — via the `#templateRef` and
 * its `.open()` / `.close()` methods.
 *
 * @example
 * ```html
 * <lib-dropdown-dialog #dialog>
 *   <button (click)="dialog.open()">Save preset</button>
 *   <div dialog-content>
 *     <lib-preset-name-dialog
 *       (confirmed)="onSave($event); dialog.close()"
 *       (cancelled)="dialog.close()"
 *     ></lib-preset-name-dialog>
 *   </div>
 * </lib-dropdown-dialog>
 * ```
 */
@Component({
  selector: 'lib-dropdown-dialog',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  templateUrl: './dropdown-dialog.component.html',
  styleUrl: './dropdown-dialog.component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('150ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('100ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ]
})
export class DropdownDialogComponent {
  private overlay = signal<Overlay | null>(null);
  private overlayRef = signal<OverlayRef | null>(null);
  private dialogTemplate = viewChild<TemplateRef<unknown>>('dialogTemplate');
  private trigger = viewChild<ElementRef>('trigger');

  /**
   * Positioning mode (default: `false`). When `false`, the overlay tries below-start,
   * below-end, above-start, then above-end relative to the trigger — the usual dropdown
   * layout. When `true`, it centers on the trigger's horizontal midpoint, preferring
   * above then below, which suits centered popovers rather than left-aligned menus.
   */
  centered = input<boolean>(false);

  /** Signal reflecting whether the overlay is currently attached and visible. */
  isOpen = signal<boolean>(false);

  /** Emitted after `open()` successfully attaches the overlay. */
  opened = output<void>();

  /** Emitted after `close()` disposes the overlay. */
  closed = output<void>();

  constructor(overlay: Overlay, private viewContainerRef: ViewContainerRef) {
    this.overlay.set(overlay);
  }

  open(): void {
    if (this.isOpen()) return;

    const triggerEl = this.trigger();
    const template = this.dialogTemplate();
    const overlay = this.overlay();

    if (!triggerEl || !template || !overlay) return;

    const centeredPositions = [
      { originX: 'center' as const, originY: 'top' as const, overlayX: 'center' as const, overlayY: 'bottom' as const, offsetY: -8 },
      { originX: 'center' as const, originY: 'bottom' as const, overlayX: 'center' as const, overlayY: 'top' as const, offsetY: 8 },
    ];
    const startEndPositions = [
      { originX: 'start' as const, originY: 'bottom' as const, overlayX: 'start' as const, overlayY: 'top' as const, offsetY: 8 },
      { originX: 'end' as const, originY: 'bottom' as const, overlayX: 'end' as const, overlayY: 'top' as const, offsetY: 8 },
      { originX: 'start' as const, originY: 'top' as const, overlayX: 'start' as const, overlayY: 'bottom' as const, offsetY: -8 },
      { originX: 'end' as const, originY: 'top' as const, overlayX: 'end' as const, overlayY: 'bottom' as const, offsetY: -8 },
    ];
    const positions = this.centered() ? centeredPositions : startEndPositions;

    const positionStrategy = overlay
      .position()
      .flexibleConnectedTo(triggerEl)
      .withPositions(positions);

    const fullscreenElement = document.fullscreenElement as HTMLElement | null;
    
    const overlayRef = overlay.create({
      positionStrategy,
      scrollStrategy: overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      // If in fullscreen, attach overlay to the fullscreen element instead of body
      ...(fullscreenElement && { 
        positionStrategy: overlay
          .position()
          .flexibleConnectedTo(triggerEl)
          .withPositions(positions)
          .withViewportMargin(0)
          .withPush(false)
      })
    });

    const portal = new TemplatePortal(template, this.viewContainerRef);
    overlayRef.attach(portal);
    
    // Move individual overlay elements to fullscreen element if needed
    if (fullscreenElement) {
      setTimeout(() => {
        const overlayPane = overlayRef.overlayElement;
        const backdrop = overlayRef.backdropElement;
        
        if (overlayPane && !fullscreenElement.contains(overlayPane)) {
          // Capture the position CDK calculated before moving
          const rect = overlayPane.getBoundingClientRect();
          const fullscreenRect = fullscreenElement.getBoundingClientRect();
          
          fullscreenElement.appendChild(overlayPane);
          
          // Reapply position relative to fullscreen container
          overlayPane.style.position = 'absolute';
          overlayPane.style.left = `${rect.left - fullscreenRect.left}px`;
          overlayPane.style.top = `${rect.top - fullscreenRect.top}px`;
          overlayPane.style.right = 'auto';
          overlayPane.style.bottom = 'auto';
        }
        if (backdrop && !fullscreenElement.contains(backdrop)) {
          fullscreenElement.appendChild(backdrop);
        }
      }, 0);
    }

    overlayRef.backdropClick().subscribe(() => this.close());

    this.overlayRef.set(overlayRef);
    this.isOpen.set(true);
    this.opened.emit();
  }

  close(): void {
    const overlayRef = this.overlayRef();
    
    // Move overlay elements back to body before closing
    if (overlayRef) {
      const overlayPane = overlayRef.overlayElement;
      const backdrop = overlayRef.backdropElement;
      const overlayContainer = document.querySelector('.cdk-overlay-container') as HTMLElement;
      
      if (overlayContainer) {
        if (overlayPane && overlayPane.parentElement !== overlayContainer) {
          // Reset inline styles when moving back
          overlayPane.style.position = '';
          overlayPane.style.left = '';
          overlayPane.style.top = '';
          overlayPane.style.right = '';
          overlayPane.style.bottom = '';
          overlayContainer.appendChild(overlayPane);
        }
        if (backdrop && backdrop.parentElement !== overlayContainer) {
          overlayContainer.appendChild(backdrop);
        }
      }
      
      overlayRef.dispose();
      this.overlayRef.set(null);
    }
    this.isOpen.set(false);
    this.closed.emit();
  }
}
