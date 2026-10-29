import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { SettingsStore } from '@teensyrom-nx/application';
import {
  ContentOverlayContainerComponent,
  EmptyStateMessageComponent,
  ScalingCompactCardComponent,
  VideoCaptureSession,
  VideoControlsToolbarComponent,
  VideoDeviceSelectorComponent,
  VideoStreamComponent,
} from '@teensyrom-nx/ui/components';

/**
 * Live preview of a device's video capture, so the effect of a theme can be seen on the C64's own
 * screen. It uses the camera remembered for the device and restarts when the device changes.
 */
@Component({
  selector: 'lib-theme-preview',
  imports: [
    ScalingCompactCardComponent,
    ContentOverlayContainerComponent,
    VideoStreamComponent,
    VideoDeviceSelectorComponent,
    VideoControlsToolbarComponent,
    EmptyStateMessageComponent,
  ],
  templateUrl: './theme-preview.component.html',
  styleUrl: './theme-preview.component.scss',
  providers: [VideoCaptureSession],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemePreviewComponent {
  private readonly settingsStore = inject(SettingsStore);
  protected readonly session = inject(VideoCaptureSession);

  readonly deviceId = input.required<string>();

  protected readonly selectorOpen = signal(false);
  protected readonly showSelector = signal(false);

  constructor() {
    effect(() => {
      const id = this.deviceId();
      untracked(() => void this.session.start(() => this.settingsStore.videoDeviceIdForDevice(id)()));
    });
  }

  protected toggleSelector(): void {
    this.showSelector.update((show) => !show);
  }

  protected onCameraSelected(videoDeviceId: string): void {
    void this.session.select(videoDeviceId);
    void this.settingsStore.updateDeviceVideoDeviceId({
      deviceId: this.deviceId(),
      videoDeviceId,
    });
  }
}
