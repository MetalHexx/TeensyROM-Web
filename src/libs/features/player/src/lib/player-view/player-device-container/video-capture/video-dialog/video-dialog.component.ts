import { Component, Inject, ChangeDetectionStrategy, signal, viewChild, ElementRef, afterNextRender, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { IconButtonComponent, CompactCardLayoutComponent } from '@teensyrom-nx/ui/components';
import { PlayerToolbarComponent } from '../../player-toolbar/player-toolbar.component';
import { FilterToolbarComponent } from '../../storage-container/filter-toolbar/filter-toolbar.component';

export interface VideoDialogData {
  stream: MediaStream;
  deviceLabel: string;
  deviceId: string;
}

@Component({
  selector: 'lib-video-dialog',
  standalone: true,
  imports: [CommonModule, IconButtonComponent, PlayerToolbarComponent, FilterToolbarComponent, MatSliderModule, FormsModule, CompactCardLayoutComponent],
  templateUrl: './video-dialog.component.html',
  styleUrl: './video-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoDialogComponent implements OnDestroy {
  private videoElement = viewChild<ElementRef<HTMLVideoElement>>('dialogVideoElement');
  private containerElement = viewChild<ElementRef<HTMLDivElement>>('videoContainer');
  isFullscreen = signal<boolean>(false);
  isCrtEnabled = signal<boolean>(true);
  showCrtControls = signal<boolean>(false);
  
  // CRT effect parameters
  scanlineIntensity = signal<number>(0.50);
  scanlineThickness = signal<number>(3);
  scanlineSpacing = signal<number>(2);
  vignetteStrength = signal<number>(1.30);
  screenCurvature = signal<number>(100);
  contrast = signal<number>(1.10);
  brightness = signal<number>(1.50);
  saturation = signal<number>(1.30);

  // Aspect ratio detection for fullscreen mode
  videoVisibleLeft = signal<number>(0);
  videoVisibleWidth = signal<number>(0);
  private fullscreenChangeHandler: (() => void) | null = null;

  constructor(
    public dialogRef: MatDialogRef<VideoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VideoDialogData
  ) {
    // Attach stream after view init
    afterNextRender(() => {
      const videoEl = this.videoElement()?.nativeElement;
      if (videoEl && this.data.stream) {
        videoEl.srcObject = this.data.stream;
        videoEl.play().catch(err => console.error('Dialog video play error:', err));
      }

      // Set up fullscreen change listener
      this.setupFullscreenListener();
    });
  }

  ngOnDestroy(): void {
    if (this.fullscreenChangeHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);
    }
  }

  private setupFullscreenListener(): void {
    this.fullscreenChangeHandler = () => {
      const isFullscreen = !!document.fullscreenElement;
      this.isFullscreen.set(isFullscreen);
      
      if (isFullscreen) {
        // Delay calculation to ensure layout is complete
        setTimeout(() => this.calculateVisibleVideoArea(), 100);
      } else {
        // Reset to defaults when exiting fullscreen
        this.videoVisibleLeft.set(0);
        this.videoVisibleWidth.set(0);
      }
    };

    document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
  }

  private calculateVisibleVideoArea(): void {
    const videoEl = this.videoElement()?.nativeElement;
    const containerEl = this.containerElement()?.nativeElement;
    
    if (!videoEl || !containerEl) return;

    // Get video's intrinsic dimensions
    const videoAspectRatio = videoEl.videoWidth / videoEl.videoHeight;
    
    // Get container dimensions (fullscreen = screen dimensions)
    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    // Calculate visible video dimensions using object-fit: contain logic
    let visibleWidth: number;
    let visibleLeft: number;

    if (videoAspectRatio > containerAspectRatio) {
      // Video is wider - letterboxed top/bottom
      visibleWidth = containerWidth;
      visibleLeft = 0;
    } else {
      // Video is narrower - pillarboxed left/right
      visibleWidth = containerHeight * videoAspectRatio;
      visibleLeft = (containerWidth - visibleWidth) / 2;
    }

    this.videoVisibleLeft.set(visibleLeft);
    this.videoVisibleWidth.set(visibleWidth);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  toggleFullscreen(): void {
    const containerEl = this.containerElement()?.nativeElement;
    if (!containerEl) return;

    if (!this.isFullscreen()) {
      // Enter fullscreen
      if (containerEl.requestFullscreen) {
        containerEl.requestFullscreen();
      }
      this.isFullscreen.set(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      this.isFullscreen.set(false);
    }
  }

  toggleCrtEffect(): void {
    this.isCrtEnabled.update(enabled => !enabled);
  }

  toggleCrtControls(): void {
    this.showCrtControls.update(show => !show);
  }
}
