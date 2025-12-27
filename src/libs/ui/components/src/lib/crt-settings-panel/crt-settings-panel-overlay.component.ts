import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  ElementRef,
  inject,
  viewChild,
  DestroyRef,
  ComponentRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal, PortalModule } from '@angular/cdk/portal';
import { CrtSettingsPanelComponent } from './crt-settings-panel.component';
import { CrtSettings, CrtSettingsConfig } from '../crt-effect-wrapper/crt-settings.interface';
import { AnyPresetName, CrtPresetName } from '../crt-effect-wrapper/crt-settings.defaults';

/**
 * CRT Settings Panel Overlay Component
 * 
 * Wraps CrtSettingsPanelComponent with CDK Overlay to render it outside the component tree,
 * preventing container overflow issues while maintaining visual positioning.
 * 
 * This component creates a transparent anchor element and uses CDK's ConnectedOverlay
 * to position the panel at the anchor's location (typically top-left corner).
 * 
 * **Animation Behavior**: This component is designed to work with ContentOverlayContainerComponent's
 * CSS-based show/hide animations. The overlay is always attached, but visibility is controlled by
 * the parent container's CSS classes (.overlays-visible). Conditional rendering (@if directive) in
 * parent templates controls when the overlay is created/destroyed based on user intent.
 * 
 * Benefits over direct component usage:
 * - No container overflow clipping issues
 * - Proper z-index stacking at root level
 * - Maintains visual position relative to parent
 * - Panel can exceed parent bounds without being cut off
 * - Inherits smooth animations from content-overlay-container CSS
 * 
 * @example
 * ```html
 * @if (showPanel()) {
 *   <lib-crt-settings-panel-overlay
 *     topLeftCorner
 *     [settings]="crtSettings()"
 *     [config]="crtConfig"
 *     [maxHeight]="350"
 *     (settingsChange)="onSettingsChange($event)">
 *   </lib-crt-settings-panel-overlay>
 * }
 * ```
 */
@Component({
  selector: 'lib-crt-settings-panel-overlay',
  standalone: true,
  imports: [CommonModule, OverlayModule, PortalModule],
  template: `
    <!-- Invisible anchor element for overlay positioning -->
    <div #anchor class="overlay-anchor"></div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      pointer-events: none;
    }
    
    .overlay-anchor {
      width: 1px;
      height: 1px;
      pointer-events: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrtSettingsPanelOverlayComponent {
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);
  
  // ─────────────────────────────────────────────────────────────────────────
  // Inputs (pass-through to CrtSettingsPanelComponent)
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly settings = input.required<CrtSettings>();
  readonly config = input.required<CrtSettingsConfig>();
  readonly maxHeight = input<number | undefined>(undefined);
  readonly cardClass = input<string>('');
  readonly currentPresetLabel = input<string>();
  readonly excludePresets = input<CrtPresetName[]>([]);
  readonly validatePresetNameFn = input.required<(name: string, existingNames: string[]) => { error: string | null }>();
  readonly debugMode = input<boolean>(false);
  
  // ─────────────────────────────────────────────────────────────────────────
  // Outputs (pass-through from CrtSettingsPanelComponent)
  // ─────────────────────────────────────────────────────────────────────────
  
  readonly settingsChange = output<CrtSettings>();
  readonly presetSelected = output<AnyPresetName>();
  readonly closed = output<void>();
  readonly debugModeChange = output<boolean>();
  
  // ─────────────────────────────────────────────────────────────────────────
  // Overlay Management
  // ─────────────────────────────────────────────────────────────────────────
  
  private readonly anchor = viewChild<ElementRef>('anchor');
  private overlayRef: OverlayRef | null = null;
  private panelComponentInstance: CrtSettingsPanelComponent | null = null;
  private panelComponentRef: ComponentRef<CrtSettingsPanelComponent> | null = null;
  
  constructor() {
    // Create overlay when anchor is available (on init)
    effect(() => {
      const anchorEl = this.anchor();
      
      if (anchorEl && !this.overlayRef) {
        this.createOverlay(anchorEl.nativeElement);
      }
    });
    
    // Update panel inputs when they change
    effect(() => {
      if (this.panelComponentRef) {
        // Use setInput to update dynamically attached component
        // This properly triggers change detection in the portal component
        this.panelComponentRef.setInput('settings', this.settings());
        this.panelComponentRef.setInput('config', this.config());
        this.panelComponentRef.setInput('maxHeight', this.maxHeight());
        this.panelComponentRef.setInput('cardClass', this.cardClass());
        this.panelComponentRef.setInput('currentPresetLabel', this.currentPresetLabel());
        this.panelComponentRef.setInput('excludePresets', this.excludePresets());
        this.panelComponentRef.setInput('validatePresetNameFn', this.validatePresetNameFn());
        this.panelComponentRef.setInput('debugMode', this.debugMode());
      }
    });
    
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.disposeOverlay();
    });
  }
  
  /**
   * Create the CDK overlay positioned at the anchor element
   */
  private createOverlay(anchorElement: HTMLElement): void {
    // Position the overlay at the anchor (top-left corner behavior)
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(anchorElement)
      .withPositions(this.getOverlayPositions())
      .withFlexibleDimensions(false)
      .withPush(false);
    
    // Create overlay config with unique ID to prevent cross-component issues
    const uniqueId = `crt-panel-${Math.random().toString(36).substr(2, 9)}`;
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
      panelClass: ['crt-settings-panel-overlay', 'cdk-overlay-pane', uniqueId],
    });
    
    // Create component portal
    const portal = new ComponentPortal(CrtSettingsPanelComponent);
    const componentRef = this.overlayRef.attach(portal);
    this.panelComponentRef = componentRef;
    this.panelComponentInstance = componentRef.instance;
    
    // Wire up inputs
    componentRef.setInput('settings', this.settings());
    componentRef.setInput('config', this.config());
    componentRef.setInput('maxHeight', this.maxHeight());
    componentRef.setInput('cardClass', this.cardClass());
    componentRef.setInput('validatePresetNameFn', this.validatePresetNameFn());
    componentRef.setInput('debugMode', this.debugMode());
    
    // Wire up outputs
    componentRef.instance.settingsChange.subscribe((settings) => {
      this.settingsChange.emit(settings);
    });
    
    componentRef.instance.presetSelected.subscribe((preset) => {
      this.presetSelected.emit(preset);
    });
    
    componentRef.instance.closed.subscribe(() => {
      this.closed.emit();
    });

    componentRef.instance.debugModeChange.subscribe((enabled: boolean) => {
      this.debugModeChange.emit(enabled);
    });
  }
  
  /**
   * Completely dispose the overlay
   */
  private disposeOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
      this.panelComponentRef = null;
      this.panelComponentInstance = null;
    }
  }
  
  /**
   * Define overlay positioning relative to anchor element.
   * Mimics top-left corner positioning from content-overlay-container.
   */
  private getOverlayPositions(): ConnectedPosition[] {
    return [
      {
        originX: 'start',
        originY: 'top',
        overlayX: 'start',
        overlayY: 'top',
        offsetX: 0,
        offsetY: 0,
      },
    ];
  }
}
