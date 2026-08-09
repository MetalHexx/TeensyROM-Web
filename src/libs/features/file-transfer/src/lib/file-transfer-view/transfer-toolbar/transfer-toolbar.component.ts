import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ScalingCompactCardComponent,
  SlidingContainerComponent,
  ProgressBarComponent,
} from '@teensyrom-nx/ui/components';
import { DeviceSelectorComponent } from './device-selector/device-selector.component';

/**
 * Toolbar shell for the transfer view, structurally mirroring the player toolbar: a card housing
 * an (unbound, in this iteration) progress bar and the device selector. The actions slot ships
 * empty — it is the designated home for future transfer-view controls.
 */
@Component({
  selector: 'lib-transfer-toolbar',
  imports: [
    ScalingCompactCardComponent,
    SlidingContainerComponent,
    ProgressBarComponent,
    DeviceSelectorComponent,
  ],
  templateUrl: './transfer-toolbar.component.html',
  styleUrl: './transfer-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferToolbarComponent {}
