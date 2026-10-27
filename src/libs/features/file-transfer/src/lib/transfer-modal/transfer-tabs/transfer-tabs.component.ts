import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import { TransferTab } from '@teensyrom-nx/application';

/** The DOM id of a device's tab, for the panel it controls to point back at. */
export function transferTabId(deviceId: string): string {
  return `transfer-tab-${deviceId}`;
}

/**
 * Tab row of the transfer details dialog, one tab per transfer in progress or just ended.
 * Presentational: it reports the picked device and leaves the switch to its host. The arrow keys
 * move between tabs and select as they go.
 */
@Component({
  selector: 'lib-transfer-tabs',
  templateUrl: './transfer-tabs.component.html',
  styleUrl: './transfer-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferTabsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  tabs = input.required<TransferTab[]>();
  selected = input<string | null>(null);
  /** Display names by device id; a device missing here shows its id. */
  deviceNames = input<Record<string, string>>({});
  panelId = input<string | null>(null);

  select = output<string>();

  readonly tabId = transferTabId;

  nameOf(deviceId: string): string {
    return this.deviceNames()[deviceId] || deviceId;
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    const target = this.targetIndex(event.key, index, count);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.select.emit(this.tabs()[target].deviceId);
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
  }

  private targetIndex(key: string, index: number, count: number): number | null {
    switch (key) {
      case 'ArrowRight':
        return (index + 1) % count;
      case 'ArrowLeft':
        return (index - 1 + count) % count;
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
      default:
        return null;
    }
  }
}
