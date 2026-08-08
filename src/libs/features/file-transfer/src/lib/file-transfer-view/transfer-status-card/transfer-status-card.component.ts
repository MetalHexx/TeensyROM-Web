import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';

/**
 * Card shell for transfer progress and status. Its body is populated
 * once the transfer backend is wired up in a later task.
 */
@Component({
  selector: 'lib-transfer-status-card',
  imports: [ScalingCardComponent],
  templateUrl: './transfer-status-card.component.html',
  styleUrl: './transfer-status-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferStatusCardComponent {}
