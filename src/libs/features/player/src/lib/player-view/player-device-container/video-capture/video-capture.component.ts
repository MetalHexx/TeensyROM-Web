import { Component, computed, signal, viewChild, ElementRef, OnDestroy, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { ScalingCompactCardComponent, IconButtonComponent } from '@teensyrom-nx/ui/components';
import { VideoDialogComponent } from './video-dialog/video-dialog.component';
import { SettingsStore } from '@teensyrom-nx/application';

interface VideoDevice {
  deviceId: string;
  label: string;
}

@Component({
  selector: 'lib-video-capture',
  imports: [CommonModule, ScalingCompactCardComponent, IconButtonComponent, MatSelectModule, MatFormFieldModule],
  templateUrl: './video-capture.component.html',
  styleUrl: './video-capture.component.scss',
})
export class VideoCaptureComponent implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly settingsStore = inject(SettingsStore);
  
  deviceId = input.required<string>();

  // Signals for reactive state
  private videoDevices = signal<VideoDevice[]>([]);
  private selectedDeviceId = signal<string | null>(null);
  private currentStream = signal<MediaStream | null>(null);
  private permissionDenied = signal<boolean>(false);

  // ViewChild for video element
  private videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');

  // Computed signals
  devices = computed(() => this.videoDevices());
  hasDevices = computed(() => this.videoDevices().length > 0);
  isPermissionDenied = computed(() => this.permissionDenied());
  hasStream = computed(() => this.currentStream() !== null);
  selectedDevice = computed(() => this.selectedDeviceId());

  constructor() {
    // Initialize device enumeration on component creation
    this.enumerateVideoDevices();
  }

  /**
   * Enumerate available video input devices
   * POC: Requests permission first to get device labels (browser security requirement)
   */
  private async enumerateVideoDevices(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error('MediaDevices API not available');
        return;
      }

      // CRITICAL: Request permission first to unlock device labels
      // Without this, enumerateDevices returns empty labels for privacy
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // Now enumerate with full labels
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));

      console.log('🎥 Video devices found:', videoInputs);

      // Stop the permission stream (we'll get the right device next)
      permissionStream.getTracks().forEach((track) => track.stop());

      this.videoDevices.set(videoInputs);

      // Select initial device based on stored preference or fallback to first
      this.selectInitialDevice(videoInputs);
    } catch (error) {
      console.error('Failed to enumerate video devices:', error);
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionDenied.set(true);
      }
    }
  }

  /**
   * Select initial video device based on stored preference.
   * Falls back to first available device if stored device not found or not available.
   */
  private selectInitialDevice(videoInputs: VideoDevice[]): void {
    if (videoInputs.length === 0) {
      console.log('🎥 No video devices available');
      return;
    }

    const teensyDeviceId = this.deviceId();
    const storedVideoDeviceId = this.settingsStore.videoDeviceIdForDevice(teensyDeviceId)();
    
    console.log('🎥 Looking for stored video device:', storedVideoDeviceId);

    // Check if stored device exists in available devices
    const storedDeviceExists = storedVideoDeviceId && 
      videoInputs.some(d => d.deviceId === storedVideoDeviceId);

    if (storedDeviceExists) {
      console.log('🎥 Using stored video device:', storedVideoDeviceId);
      this.selectedDeviceId.set(storedVideoDeviceId);
      setTimeout(() => this.switchToDevice(storedVideoDeviceId), 100);
    } else {
      // Fallback to first device
      const firstDevice = videoInputs[0];
      console.log('🎥 Stored device not found, falling back to first device:', firstDevice.deviceId);
      this.selectedDeviceId.set(firstDevice.deviceId);
      setTimeout(() => this.switchToDevice(firstDevice.deviceId), 100);
    }
  }

  /**
   * Switch to a different video device
   * POC: Stops current stream and starts new one
   */
  private async switchToDevice(deviceId: string): Promise<void> {
    try {
      console.log('🎥 Switching to device:', deviceId);
      
      // Stop current stream if exists
      const currentStream = this.currentStream();
      if (currentStream) {
        console.log('🎥 Stopping current stream...');
        currentStream.getTracks().forEach((track) => track.stop());
      }

      // Request new stream with selected device
      console.log('🎥 Requesting stream from device:', deviceId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      console.log('🎥 Stream acquired:', videoTrack?.label);
      console.log('🎥 Video track settings:', videoTrack?.getSettings());
      console.log('🎥 Video track enabled:', videoTrack?.enabled);
      console.log('🎥 Video track ready state:', videoTrack?.readyState);
      
      this.currentStream.set(stream);

      // Attach stream to video element
      const videoEl = this.videoElement()?.nativeElement;
      if (videoEl) {
        console.log('🎥 Video element found, attaching stream...');
        videoEl.srcObject = stream;
        console.log('🎥 Stream attached to video element');
        console.log('🎥 Video element dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
        
        // Wait for metadata and play
        videoEl.onloadedmetadata = () => {
          console.log('🎥 Metadata loaded, dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
        };
        
        // Force play (some browsers need this)
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log('🎥 Video playing successfully'))
            .catch(err => console.error('🎥 Play error:', err));
        }
      } else {
        console.error('🎥 Video element not found!');
      }
    } catch (error) {
      console.error('🎥 Failed to switch video device:', error);
      console.error('🎥 Error details:', JSON.stringify(error, null, 2));
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionDenied.set(true);
      }
    }
  }

  /**
   * Handle device selection from dropdown
   */
  onDeviceSelected(videoDeviceId: string): void {
    console.log('🎥 User selected device:', videoDeviceId);
    this.selectedDeviceId.set(videoDeviceId);
    this.switchToDevice(videoDeviceId);
    
    // Persist the selection immediately
    const teensyDeviceId = this.deviceId();
    console.log('🎥 Persisting video device selection for TeensyROM device:', teensyDeviceId);
    this.settingsStore.updateDeviceVideoDeviceId({
      deviceId: teensyDeviceId,
      videoDeviceId,
    });
  }

  /**
   * Open video in fullscreen dialog
   */
  openVideoDialog(): void {
    const stream = this.currentStream();
    if (!stream) return;

    const deviceLabel = this.devices().find(d => d.deviceId === this.selectedDeviceId())?.label || 'Video Capture';

    const dialogRef = this.dialog.open(VideoDialogComponent, {
      data: { stream, deviceLabel, deviceId: this.deviceId() },
      width: '85vw',
      height: '85vh',
      maxWidth: '1200px',
      maxHeight: '900px',
      panelClass: 'video-dialog-fullscreen',
    });

    // Reattach stream to main video element when dialog closes
    dialogRef.afterClosed().subscribe(() => {
      const videoEl = this.videoElement()?.nativeElement;
      if (videoEl && stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch(err => console.error('🎥 Reattach play error:', err));
        console.log('🎥 Stream reattached to main video element');
      }
    });
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    const stream = this.currentStream();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
}
