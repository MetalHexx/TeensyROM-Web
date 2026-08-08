import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TransferStatusCardComponent } from './transfer-status-card/transfer-status-card.component';
import { DestinationCardComponent } from './destination-card/destination-card.component';

/**
 * Top-level view for the File Transfer feature. Renders the top row of
 * status/destination cards and the browsing row shell (tree and listing
 * regions), which a later task fills with real content.
 */
@Component({
  selector: 'lib-file-transfer-view',
  imports: [DestinationCardComponent, TransferStatusCardComponent],
  templateUrl: './file-transfer-view.component.html',
  styleUrl: './file-transfer-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileTransferViewComponent {}
