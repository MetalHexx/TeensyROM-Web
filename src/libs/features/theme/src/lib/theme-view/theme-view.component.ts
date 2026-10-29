import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  untracked,
} from '@angular/core';
import { ColorThemeStore, SettingsStore } from '@teensyrom-nx/application';
import { DeviceColors } from '@teensyrom-nx/domain';
import { ThemeListComponent } from './theme-list/theme-list.component';
import { ThemeColorsCardComponent } from './theme-colors-card/theme-colors-card.component';
import { ThemeActionsComponent } from './theme-actions/theme-actions.component';
import { ThemePreviewComponent } from './theme-preview/theme-preview.component';
import { recordInfoText, themeSubtitle } from './theme-texts';

/** The Theme view: pick a color theme, edit its seven C64 menu colors, and save or delete it. */
@Component({
  selector: 'lib-theme-view',
  imports: [
    ThemeListComponent,
    ThemeColorsCardComponent,
    ThemeActionsComponent,
    ThemePreviewComponent,
  ],
  templateUrl: './theme-view.component.html',
  styleUrl: './theme-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeViewComponent implements OnInit {
  protected readonly store = inject(ColorThemeStore);
  private readonly settingsStore = inject(SettingsStore);

  protected readonly subtitle = computed(() =>
    themeSubtitle(this.store.selectedTheme(), this.store.isEdited())
  );
  protected readonly infoText = computed(() => recordInfoText(this.store.recordState()));

  /** The first target device with video enabled, or null when there is nothing to preview. */
  protected readonly previewDeviceId = computed(
    () =>
      this.store
        .targetDevices()
        .find((d) => this.settingsStore.enableVideoForDevice(d.deviceId)())?.deviceId ?? null
  );

  private readonly connectedDeviceIds = computed(() =>
    this.store
      .connectedDevices()
      .map((d) => d.deviceId)
      .join(',')
  );

  constructor() {
    effect(() => {
      this.connectedDeviceIds();
      untracked(() => void this.store.loadMissingRecords());
    });
  }

  ngOnInit(): void {
    void this.store.initialize();
  }

  protected onColorChange(change: { slot: keyof DeviceColors; colorIndex: number }): void {
    this.store.setSlotColor(change.slot, change.colorIndex);
  }
}
