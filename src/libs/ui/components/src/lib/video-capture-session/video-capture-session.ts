import { Injectable, OnDestroy, Signal, computed, signal } from '@angular/core';
import { VideoDevice } from '../video-device-selector/video-device-selector.component';

/** Opens a camera by exact device id, without audio. */
export function openVideoStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
    audio: false,
  });
}

/** Stops every track of a stream; a missing stream is a no-op. */
export function stopVideoStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Camera handling shared by video views: permission, device listing,
 * remembered-camera selection and stream lifecycle. Provide it per component;
 * it stops its stream when that component is destroyed.
 */
@Injectable()
export class VideoCaptureSession implements OnDestroy {
  private readonly devicesSignal = signal<VideoDevice[]>([]);
  private readonly selectedDeviceIdSignal = signal<string | null>(null);
  private readonly streamSignal = signal<MediaStream | null>(null);
  private readonly permissionDeniedSignal = signal<boolean>(false);
  private readonly hasEnumeratedSignal = signal<boolean>(false);
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  readonly devices: Signal<VideoDevice[]> = this.devicesSignal.asReadonly();
  readonly selectedDeviceId: Signal<string | null> = this.selectedDeviceIdSignal.asReadonly();
  readonly stream: Signal<MediaStream | null> = this.streamSignal.asReadonly();
  readonly permissionDenied: Signal<boolean> = this.permissionDeniedSignal.asReadonly();
  readonly hasDevices: Signal<boolean> = computed(() => this.devicesSignal().length > 0);
  /** True once a start() finished listing, whether or not any camera was found. */
  readonly hasEnumerated: Signal<boolean> = this.hasEnumeratedSignal.asReadonly();

  /**
   * Stops any stream it holds, asks permission, lists video inputs, picks the
   * preferred camera if present else the first, and opens it after 100 ms.
   * `preferredDeviceId` is read after enumeration, so it may read inputs that are
   * not yet available at construction.
   */
  async start(preferredDeviceId: () => string): Promise<void> {
    this.stop();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('MediaDevices API not available');
        return;
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs: VideoDevice[] = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));

      stopVideoStream(permissionStream);

      if (this.destroyed) return;

      this.devicesSignal.set(videoInputs);
      this.hasEnumeratedSignal.set(true);

      if (videoInputs.length === 0) return;

      const preferred = preferredDeviceId();
      const target =
        preferred && videoInputs.some((d) => d.deviceId === preferred)
          ? preferred
          : videoInputs[0].deviceId;

      this.selectedDeviceIdSignal.set(target);
      this.openTimer = setTimeout(() => {
        this.openTimer = null;
        void this.open(target);
      }, 100);
    } catch (error) {
      console.error('Failed to enumerate video devices:', error);
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionDeniedSignal.set(true);
      }
    }
  }

  /** Selects a camera immediately, then replaces the current stream with one opened on it. */
  async select(deviceId: string): Promise<void> {
    this.selectedDeviceIdSignal.set(deviceId);
    await this.open(deviceId);
  }

  /** Stops the held stream and cancels a pending open. */
  stop(): void {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    stopVideoStream(this.streamSignal());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stop();
  }

  private async open(deviceId: string): Promise<void> {
    try {
      stopVideoStream(this.streamSignal());

      const stream = await openVideoStream(deviceId);
      if (this.destroyed) {
        stopVideoStream(stream);
        return;
      }
      this.streamSignal.set(stream);
    } catch (error) {
      console.error('🎥 Failed to switch video device:', error);
      console.error('🎥 Error details:', JSON.stringify(error, null, 2));
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionDeniedSignal.set(true);
      }
    }
  }
}
