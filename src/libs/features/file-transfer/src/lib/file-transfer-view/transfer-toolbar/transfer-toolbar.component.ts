import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import {
  ScalingCompactCardComponent,
  SlidingContainerComponent,
  ProgressBarComponent,
  IconButtonComponent,
} from '@teensyrom-nx/ui/components';

/**
 * Toolbar shell for the transfer view, structurally mirroring the player toolbar: a card housing
 * an (unbound, in this iteration) progress bar and, in the actions slot, the
 * gear that opens and closes the transfer settings panel. The desktop and tablet layouts each
 * carry the gear; only one is visible at a time.
 */
@Component({
  selector: 'lib-transfer-toolbar',
  imports: [
    ScalingCompactCardComponent,
    SlidingContainerComponent,
    ProgressBarComponent,
    IconButtonComponent,
  ],
  templateUrl: './transfer-toolbar.component.html',
  styleUrl: './transfer-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferToolbarComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the transfer settings panel is open. */
  readonly settingsOpen = input(false);

  /** Emits when the gear is pressed. */
  readonly settingsToggle = output<void>();

  /** Moves keyboard focus to the gear in the layout that is showing. */
  focusSettingsButton(): void {
    const buttons = this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
      '[data-testid="transfer-settings-button"] button'
    );
    Array.from(buttons)
      .find((button) => button.getClientRects().length > 0)
      ?.focus();
  }
}
