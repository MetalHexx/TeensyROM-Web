import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-file-time',
  imports: [CommonModule],
  templateUrl: './file-time.component.html',
  styleUrl: './file-time.component.scss',
})
export class FileTimeComponent {
  currentTime = input<number>(0);
  totalTime = input<number>(0);
  show = input<boolean>(false);
  displayMode = input<'current' | 'total' | 'both'>('both');

  formattedCurrentTime = computed(() => this.formatTime(this.currentTime()));
  formattedTotalTime = computed(() => this.formatTime(this.totalTime()));

  formattedTime = computed(
    () => `${this.formattedCurrentTime()} / ${this.formattedTotalTime()}`
  );

  private formatTime(milliseconds: number): string {
    if (milliseconds < 0) return '0:00';

    const totalSeconds = Math.floor(milliseconds / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
