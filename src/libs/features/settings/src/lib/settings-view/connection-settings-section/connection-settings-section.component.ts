import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';

/**
 * Presentational component for connection settings section.
 * Displays connection type radio buttons (Serial/Tcp) and auto-connect toggle.
 *
 * @example
 * ```html
 * <lib-connection-settings-section
 *   [formGroup]="settingsForm().get('connectionSettings')"
 * ></lib-connection-settings-section>
 * ```
 */
@Component({
  selector: 'lib-connection-settings-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    ScalingCardComponent,
  ],
  templateUrl: './connection-settings-section.component.html',
  styleUrl: './connection-settings-section.component.scss',
})
export class ConnectionSettingsSectionComponent {
  /**
   * FormGroup containing connection settings controls:
   * - connectionType: FormControl<ConnectionType> (Serial | Tcp)
   * - autoConnectEnabled: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();
}
