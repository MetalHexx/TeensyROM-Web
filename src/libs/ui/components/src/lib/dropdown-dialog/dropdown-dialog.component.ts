import { Component, output, signal, TemplateRef, viewChild, ElementRef, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { trigger, transition, style, animate } from '@angular/animations';

/**
 * Pure positioning container for dialogs and overlays using CDK overlay.
 * Handles overlay lifecycle, positioning, and backdrop management through content projection.
 * Projects any content without styling opinions - visual design is the responsibility of projected components.
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

  isOpen = signal<boolean>(false);
  opened = output<void>();
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

    const positionStrategy = overlay
      .position()
      .flexibleConnectedTo(triggerEl)
      .withPositions([
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 8
        },
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
          offsetY: 8
        },
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -8
        },
        {
          originX: 'end',
          originY: 'top',
          overlayX: 'end',
          overlayY: 'bottom',
          offsetY: -8
        }
      ]);

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
          .withPositions([
            {
              originX: 'start',
              originY: 'bottom',
              overlayX: 'start',
              overlayY: 'top',
              offsetY: 8
            },
            {
              originX: 'end',
              originY: 'bottom',
              overlayX: 'end',
              overlayY: 'top',
              offsetY: 8
            },
            {
              originX: 'start',
              originY: 'top',
              overlayX: 'start',
              overlayY: 'bottom',
              offsetY: -8
            },
            {
              originX: 'end',
              originY: 'top',
              overlayX: 'end',
              overlayY: 'bottom',
              offsetY: -8
            }
          ])
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
          
          console.log('Moving overlay pane to fullscreen element');
          fullscreenElement.appendChild(overlayPane);
          
          // Reapply position relative to fullscreen container
          overlayPane.style.position = 'absolute';
          overlayPane.style.left = `${rect.left - fullscreenRect.left}px`;
          overlayPane.style.top = `${rect.top - fullscreenRect.top}px`;
          overlayPane.style.right = 'auto';
          overlayPane.style.bottom = 'auto';
        }
        if (backdrop && !fullscreenElement.contains(backdrop)) {
          console.log('Moving backdrop to fullscreen element');
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
          console.log('Moving overlay pane back to container');
          // Reset inline styles when moving back
          overlayPane.style.position = '';
          overlayPane.style.left = '';
          overlayPane.style.top = '';
          overlayPane.style.right = '';
          overlayPane.style.bottom = '';
          overlayContainer.appendChild(overlayPane);
        }
        if (backdrop && backdrop.parentElement !== overlayContainer) {
          console.log('Moving backdrop back to container');
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
