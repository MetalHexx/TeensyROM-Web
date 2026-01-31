import { ChangeDetectionStrategy, Component, inject, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { EmptyStateMessageComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingTextComponent, ScalingCompactCardComponent, ActionButtonComponent } from '@teensyrom-nx/ui/components';
import { DeviceSettingsSectionComponent } from './device-settings-section/device-settings-section.component';
import { PlayerSettingsSectionComponent } from './player-settings-section/player-settings-section.component';
import { FileTransferSettingsSectionComponent } from './file-transfer-settings-section/file-transfer-settings-section.component';
import { SearchSettingsSectionComponent } from './search-settings-section/search-settings-section.component';
import { SettingsFormService } from './settings-form.service';
import { DeviceStore } from '@teensyrom-nx/application';

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
    LoadingTextComponent,
    EmptyStateMessageComponent,
    ScalingCompactCardComponent,
    ActionButtonComponent,
    DeviceSettingsSectionComponent,
    PlayerSettingsSectionComponent,
    FileTransferSettingsSectionComponent,
    SearchSettingsSectionComponent,
  ],
  providers: [SettingsFormService],
  templateUrl: './settings-view.component.html',
  styleUrl: './settings-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsViewComponent {
  private readonly formService = inject(SettingsFormService);
  private readonly deviceStore = inject(DeviceStore);

  // Active section state
  readonly activeSection = signal<'player' | 'devices' | 'fileTransfer' | 'search'>('player');

  // Device map for child components
  readonly deviceMap = computed(() => {
    const devices = this.deviceStore.devices();
    return new Map(devices.map(d => [d.deviceId, d]));
  });

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

  // Tooltip configurations
  readonly playerNavigateTooltip: TooltipConfig = {
    body: 'Navigate to player settings',
    position: TooltipPosition.Top
  };

  readonly devicesNavigateTooltip: TooltipConfig = {
    body: 'Navigate to device settings',
    position: TooltipPosition.Top
  };

  readonly fileTransferNavigateTooltip: TooltipConfig = {
    body: 'Navigate to file transfer settings',
    position: TooltipPosition.Top
  };

  readonly searchNavigateTooltip: TooltipConfig = {
    body: 'Navigate to search settings',
    position: TooltipPosition.Top
  };

  readonly saveTooltip: TooltipConfig = {
    body: 'Save all changes',
    position: TooltipPosition.Top
  };

  readonly undoTooltip: TooltipConfig = {
    body: 'Undo the last saved change',
    position: TooltipPosition.Top
  };

  readonly redoTooltip: TooltipConfig = {
    body: 'Redo the last undone change',
    position: TooltipPosition.Top
  };

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
   * Sets the active settings section
   */
  setActiveSection(section: 'player' | 'devices' | 'fileTransfer' | 'search'): void {
    this.activeSection.set(section);
  }

  /**
   * Helper methods to get typed FormGroups for each settings section
   * Delegates to form service
   */
  getKnownDevices(): FormArray {
    return this.formService.getKnownDevices();
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
