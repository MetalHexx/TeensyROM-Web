import { Component, input, computed, inject, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Device } from '@teensyrom-nx/domain';
import { MatCardModule } from '@angular/material/card';
import { FileOtherComponent } from './file-other/file-other.component';
import { FileImageComponent } from './file-image/file-image.component';
import { PlayerToolbarComponent } from './player-toolbar/player-toolbar.component';
import { StorageContainerComponent } from './storage-container/storage-container.component';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-player-device-container',
  imports: [
    CommonModule,
    MatCardModule,
    FileImageComponent,
    FileOtherComponent,
    PlayerToolbarComponent,
    StorageContainerComponent,
  ],
  templateUrl: './player-device-container.component.html',
  styleUrl: './player-device-container.component.scss',
})
export class PlayerDeviceContainerComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);

  device = input<Device>();

  readonly deviceId = computed(() => this.device()?.deviceId ?? '');

  constructor() {
    // Initialize player state when device container mounts
    // This ensures default filter from settings is applied for:
    // 1. Devices already connected at startup
    // 2. Devices that connect after app startup
    // Uses ensurePlayerState guard internally - won't overwrite existing state
    // Note: untracked() prevents initialization from triggering reactive loops
    // when handleDeepLinking updates store signals
    effect(() => {
      const deviceId = this.deviceId();
      if (deviceId) {
        untracked(() => {
          this.playerContext.initializePlayer(deviceId);
        });
      }
    });
  }

  readonly currentFile = computed(() => {
    const deviceId = this.deviceId();
    if (!deviceId) return null;
    return this.playerContext.getCurrentFile(deviceId)();
  });

  readonly isPlayerLoaded = computed(() => this.currentFile() !== null);

  readonly fileDescription = computed(() => {
    const currentFile = this.currentFile();
    return currentFile?.file?.description ?? '';
  });
}
