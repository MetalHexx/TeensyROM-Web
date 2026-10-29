import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { ColorThemeStore } from '@teensyrom-nx/application';
import { DeviceColors } from '@teensyrom-nx/domain';
import { ThemeListComponent } from './theme-list/theme-list.component';
import { ThemeColorsCardComponent } from './theme-colors-card/theme-colors-card.component';
import { ThemeActionsComponent } from './theme-actions/theme-actions.component';
import { recordInfoText, themeSubtitle } from './theme-texts';

/** The Theme view: pick a color theme, edit its seven C64 menu colors, and save or delete it. */
@Component({
  selector: 'lib-theme-view',
  imports: [ThemeListComponent, ThemeColorsCardComponent, ThemeActionsComponent],
  templateUrl: './theme-view.component.html',
  styleUrl: './theme-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeViewComponent implements OnInit {
  protected readonly store = inject(ColorThemeStore);

  protected readonly subtitle = computed(() =>
    themeSubtitle(this.store.selectedTheme(), this.store.isEdited())
  );
  protected readonly infoText = computed(() => recordInfoText(this.store.recordState()));

  ngOnInit(): void {
    void this.store.initialize();
  }

  protected onColorChange(change: { slot: keyof DeviceColors; colorIndex: number }): void {
    this.store.setSlotColor(change.slot, change.colorIndex);
  }
}
