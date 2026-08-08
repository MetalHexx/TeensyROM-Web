import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Empty bordered placeholder for the eventual file drop target.
 * Registers no drag/drop handlers and is not focusable — the device
 * selector and drop behavior arrive in a later task.
 */
@Component({
  selector: 'lib-dropzone-placeholder',
  templateUrl: './dropzone-placeholder.component.html',
  styleUrl: './dropzone-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropzonePlaceholderComponent {}
