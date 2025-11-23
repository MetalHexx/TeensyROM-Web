import { Component, Inject, ChangeDetectionStrategy, signal, viewChild, ElementRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';
import { PlayerToolbarComponent } from '../../player-toolbar/player-toolbar.component';

export interface VideoDialogData {
  stream: MediaStream;
  deviceLabel: string;
  deviceId: string;
}

@Component({
  selector: 'lib-video-dialog',
  standalone: true,
  imports: [CommonModule, IconButtonComponent, PlayerToolbarComponent],
  templateUrl: './video-dialog.component.html',
  styleUrl: './video-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoDialogComponent {
  private videoElement = viewChild<ElementRef<HTMLVideoElement>>('dialogVideoElement');
  private containerElement = viewChild<ElementRef<HTMLDivElement>>('videoContainer');
  isFullscreen = signal<boolean>(false);

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
}
