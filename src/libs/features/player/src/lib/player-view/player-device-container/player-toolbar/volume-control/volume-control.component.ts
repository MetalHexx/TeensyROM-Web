import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';
import { AudioStore } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-volume-control',
  imports: [IconButtonComponent],
  templateUrl: './volume-control.component.html',
  styleUrl: './volume-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VolumeControlComponent {
  private readonly audioStore = inject(AudioStore);

  compact = input<boolean>(false);
  disabled = input<boolean>(false);

  currentVolume = computed(() => this.audioStore.masterVolume());

  volumeIcon = computed<string>(() => {
    if (this.audioStore.isMuted()) return 'volume_off';
    const vol = this.audioStore.masterVolume();
    if (vol === 0) return 'volume_mute';
    if (vol < 0.5) return 'volume_down';
    return 'volume_up';
  });

  readonly isMuted = computed(() => this.audioStore.isMuted());

  muteAriaLabel = computed<string>(() =>
    this.audioStore.isMuted() ? 'Unmute audio' : 'Mute audio'
  );

  onToggleMute(): void {
    this.audioStore.toggleMute();
  }

  onVolumeChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.audioStore.setMasterVolume(value);
  }
}
