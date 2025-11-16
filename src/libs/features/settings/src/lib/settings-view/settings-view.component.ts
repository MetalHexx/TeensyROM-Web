import { ChangeDetectionStrategy, Component, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { LoadingTextComponent, ScalingCompactCardComponent, ActionButtonComponent, IconLabelComponent } from '@teensyrom-nx/ui/components';
import { ConnectionSettingsSectionComponent } from './connection-settings-section/connection-settings-section.component';
import { PlayerSettingsSectionComponent } from './player-settings-section/player-settings-section.component';
import { FileTransferSettingsSectionComponent } from './file-transfer-settings-section/file-transfer-settings-section.component';
import { SearchSettingsSectionComponent } from './search-settings-section/search-settings-section.component';
import { AppSettingsSectionComponent } from './app-settings-section/app-settings-section.component';
import { SettingsFormService } from './settings-form.service';

@Component({
  selector: 'lib-settings-view',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatTabsModule,
    LoadingTextComponent,
    ScalingCompactCardComponent,
    ActionButtonComponent,
    IconLabelComponent,
    ConnectionSettingsSectionComponent,
    PlayerSettingsSectionComponent,
    FileTransferSettingsSectionComponent,
    SearchSettingsSectionComponent,
    AppSettingsSectionComponent,
  ],
  providers: [SettingsFormService],
  templateUrl: './settings-view.component.html',
  styleUrl: './settings-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsViewComponent {
  private readonly formService = inject(SettingsFormService);

  // Expose service state to template
  readonly settings = this.formService.settings;
  readonly isLoading = this.formService.isLoading;
  readonly error = this.formService.error;
  readonly isSaving = this.formService.isSaving;
  readonly showSaving = this.formService.showSaving;
  readonly settingsForm = this.formService.settingsForm;
  readonly autoSaveEnabled = this.formService.autoSaveEnabled;
  readonly canSave = this.formService.canSave;
  readonly canUndo = this.formService.canUndo;
  readonly canRedo = this.formService.canRedo;
  readonly isNavigatingHistory = this.formService.isNavigatingHistory;
  readonly historyPositionDisplay = this.formService.historyPositionDisplay;

  readonly formattedJson = computed(() => {
    const settings = this.settings();
    return settings ? JSON.stringify(settings, null, 2) : null;
  });

  /**
   * Handles Ctrl+Z keyboard shortcut for undo
   */
  @HostListener('window:keydown.control.z', ['$event'])
  onUndoShortcut(event: Event): void {
    if (this.canUndo()) {
      event.preventDefault();
      this.undo();
    }
  }

  /**
   * Handles Ctrl+Y keyboard shortcut for redo
   */
  @HostListener('window:keydown.control.y', ['$event'])
  onRedoShortcut(event: Event): void {
    if (this.canRedo()) {
      event.preventDefault();
      this.redo();
    }
  }

  /**
   * Helper methods to get typed FormGroups for each settings section
   * Delegates to form service
   */
  getConnectionSettings(): FormGroup {
    return this.formService.getConnectionSettings();
  }

  getPlayerSettings(): FormGroup {
    return this.formService.getPlayerSettings();
  }

  getFileTransferSettings(): FormGroup {
    return this.formService.getFileTransferSettings();
  }

  getSearchSettings(): FormGroup {
    return this.formService.getSearchSettings();
  }

  getAppSettings(): FormGroup {
    return this.formService.getAppSettings();
  }

  /**
   * Saves current form values to backend
   * Delegates to form service
   */
  async saveSettings(): Promise<void> {
    await this.formService.saveSettings();
  }

  /**
   * Undo to previous settings state
   * Delegates to form service
   */
  undo(): void {
    this.formService.undo();
  }

  /**
   * Redo to next settings state
   * Delegates to form service
   */
  redo(): void {
    this.formService.redo();
  }
}
