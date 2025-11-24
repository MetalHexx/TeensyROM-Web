import { Component, Inject, ChangeDetectionStrategy, signal, viewChild, ElementRef, afterNextRender } from '@angular/core';
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
export class VideoDialogComponent {
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
  screenCurvature = signal<number>(40);
  contrast = signal<number>(1.10);
  brightness = signal<number>(1.50);
  saturation = signal<number>(1.30);

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
    });
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
