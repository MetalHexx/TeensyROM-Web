import { Component, ChangeDetectionStrategy, inject, input, computed, viewChild } from '@angular/core';
import { DropdownDialogComponent, IconButtonComponent } from '@teensyrom-nx/ui/components';
import { AudioStore } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-volume-popup',
  imports: [DropdownDialogComponent, IconButtonComponent],
  templateUrl: './volume-popup.component.html',
  styleUrl: './volume-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VolumePopupComponent {
  private readonly audioStore = inject(AudioStore);
  private readonly dropdown = viewChild(DropdownDialogComponent);

  disabled = input<boolean>(false);

  readonly currentVolume = computed(() => this.audioStore.masterVolume());

  readonly volumeIcon = computed<string>(() => {
    if (this.audioStore.isMuted()) return 'volume_off';
    const vol = this.audioStore.masterVolume();
    if (vol === 0) return 'volume_mute';
    if (vol < 0.5) return 'volume_down';
    return 'volume_up';
  });

  readonly isMuted = computed(() => this.audioStore.isMuted());

  readonly muteAriaLabel = computed<string>(() =>
    this.audioStore.isMuted() ? 'Unmute audio' : 'Mute audio'
  );

  onToggleMute(): void {
    this.audioStore.toggleMute();
  }

  onVolumeChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.audioStore.setMasterVolume(value);
  }

  onTriggerClick(): void {
    const dd = this.dropdown();
    if (!dd) return;

    if (dd.isOpen()) {
      dd.close();
    } else {
      dd.open();
    }
  }
}
