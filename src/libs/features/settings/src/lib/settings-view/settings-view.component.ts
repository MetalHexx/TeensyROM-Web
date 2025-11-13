import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsStore } from '@teensyrom-nx/application';

@Component({
  selector: 'lib-settings-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-view.component.html',
  styleUrl: './settings-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsViewComponent {
  private readonly settingsStore = inject(SettingsStore);

  readonly settings = this.settingsStore.getSettings();
  readonly isLoading = this.settingsStore.isLoading;
  readonly error = this.settingsStore.error;

  readonly formattedJson = computed(() => {
    const settings = this.settings();
    return settings ? JSON.stringify(settings, null, 2) : null;
  });
}
