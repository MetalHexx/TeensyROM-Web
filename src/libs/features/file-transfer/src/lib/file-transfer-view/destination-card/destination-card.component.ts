import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { DropzonePlaceholderComponent } from './dropzone-placeholder/dropzone-placeholder.component';

/**
 * Card shell for the transfer destination. The device selector and status
 * indicator that sit above the dropzone arrive in a later task.
 */
@Component({
  selector: 'lib-destination-card',
  imports: [ScalingCardComponent, DropzonePlaceholderComponent],
  templateUrl: './destination-card.component.html',
  styleUrl: './destination-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinationCardComponent {}
