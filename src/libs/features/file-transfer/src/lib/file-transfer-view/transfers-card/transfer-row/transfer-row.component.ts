import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LiveTransfer } from '@teensyrom-nx/application';
import { IconButtonComponent, IconLabelComponent } from '@teensyrom-nx/ui/components';

const BYTES_PER_KB = 1024;

/**
 * One live transfer on the Transfers card: device, origin, percent bar and stats. Purely
 * presentational — the card resolves the names and the elapsed label.
 */
@Component({
  selector: 'lib-transfer-row',
  imports: [DecimalPipe, MatProgressBarModule, IconButtonComponent, IconLabelComponent],
  templateUrl: './transfer-row.component.html',
  styleUrl: './transfer-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferRowComponent {
  transfer = input.required<LiveTransfer>();
  deviceName = input.required<string>();
  originLabel = input.required<string>();
  /** True when the transfer comes from a watched folder rather than an upload. */
  watched = input(false);
  elapsedLabel = input.required<string>();

  showRequested = output<void>();

  readonly kilobytesPerSecond = computed(() => this.transfer().bytesPerSecond / BYTES_PER_KB);
  readonly barLabel = computed(() => `${this.deviceName()} ${this.transfer().devicePercent}% written`);
  readonly showLabel = computed(() => `Show transfer to ${this.deviceName()}`);
}
