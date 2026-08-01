import {
  effect,
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { AudioStore, DeviceStore, SettingsStore } from '@teensyrom-nx/application';
import { AudioStreamState, DeviceState } from '@teensyrom-nx/domain';
import { logInfo, LogType } from '@teensyrom-nx/utils';

@Injectable({ providedIn: 'root' })
export class AudioBootstrapService {
  private readonly audioStore = inject(AudioStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly injector = inject(Injector);

  init(): void {
    logInfo(LogType.Start, 'AudioBootstrap: Audio lifecycle initialized');

    runInInjectionContext(this.injector, () => {
      // Auto-start: when a connected device has audio enabled and stream is idle
      effect(() => {
        const devices = this.deviceStore.devices();
        const settings = this.settingsStore.settings();
        const streamState = this.audioStore.streamState();

        const connectedDevice = devices.find(
          (d) => d.deviceState === DeviceState.Connected
        );
        if (!connectedDevice || !settings?.knownDevices) return;

        const deviceSettings = settings.knownDevices.find(
          (d) => d.deviceId === connectedDevice.deviceId
        );
        if (!deviceSettings?.audioSettings?.enableAudioStream) return;

        if (
          streamState === AudioStreamState.Disconnected ||
          streamState === AudioStreamState.Error
        ) {
          untracked(() => {
            this.initializeAndStartAudioStream(connectedDevice.deviceId);
          });
        }
      });

      // Auto-stop: when no connected device has audio enabled and stream is active
      effect(() => {
        const settings = this.settingsStore.settings();
        const streamState = this.audioStore.streamState();
        const devices = this.deviceStore.devices();

        const anyEnabled = devices.some((d) => {
          if (d.deviceState !== DeviceState.Connected) return false;
          const ds = settings?.knownDevices?.find((k) => k.deviceId === d.deviceId);
          return ds?.audioSettings?.enableAudioStream === true;
        });

        if (
          !anyEnabled &&
          (streamState === AudioStreamState.Streaming ||
            streamState === AudioStreamState.Connecting)
        ) {
          untracked(() => {
            this.audioStore.stopStream();
          });
        }
      });
    });
  }

  private async initializeAndStartAudioStream(teensyDeviceId: string): Promise<void> {
    const settings = this.settingsStore.settings();
    if (!settings?.knownDevices) return;

    const deviceSettings = settings.knownDevices.find((d) => d.deviceId === teensyDeviceId);
    if (!deviceSettings?.audioSettings) return;

    const audioSettings = deviceSettings.audioSettings;

    if (this.audioStore.devices().length === 0) {
      await this.audioStore.loadDevices();
    }

    const savedDeviceIndex = audioSettings.audioDeviceIndex;
    if (savedDeviceIndex !== null && savedDeviceIndex >= 0) {
      const devices = this.audioStore.devices();
      const deviceExists = devices.some((d) => d.index === savedDeviceIndex);
      if (deviceExists) {
        this.audioStore.selectDevice(savedDeviceIndex);
      }
    }

    if (audioSettings.channels && audioSettings.channels.length > 0) {
      this.audioStore.loadChannelConfigs(audioSettings.channels);
    }

    await this.audioStore.startStream(teensyDeviceId);
  }
}
