import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ColorThemeStore, deviceLabel } from '@teensyrom-nx/application';
import { APPLY_TO_ALL_DEVICES, ColorThemeKind } from '@teensyrom-nx/domain';
import {
  ActionButtonComponent,
  ConfirmationDialogComponent,
  DropdownDialogComponent,
  IconLabelComponent,
  PresetNameDialogComponent,
  ScalingCompactCardComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
  TooltipConfig,
  TooltipDirective,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import {
  applyConfirmText,
  MAX_THEME_NAME_LENGTH,
  READ_ONLY_TEXT,
  validateThemeName,
} from '../theme-texts';

/** The Theme view's actions card: the Apply target chooser, Apply, Save, Save as and Delete. */
@Component({
  selector: 'lib-theme-actions',
  imports: [
    ScalingCompactCardComponent,
    ActionButtonComponent,
    DropdownDialogComponent,
    PresetNameDialogComponent,
    TooltipDirective,
    SegmentedControlComponent,
    IconLabelComponent,
  ],
  templateUrl: './theme-actions.component.html',
  styleUrl: './theme-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeActionsComponent {
  protected readonly store = inject(ColorThemeStore);
  private readonly dialog = inject(MatDialog);

  protected readonly maxNameLength = MAX_THEME_NAME_LENGTH;
  protected readonly validateName = validateThemeName;
  /** Whether the Save as dialog is open; its name dialog only exists while this is true. */
  protected readonly saveAsOpen = signal(false);

  protected readonly isShipped = computed(
    () => this.store.selectedTheme()?.kind === ColorThemeKind.Shipped
  );
  protected readonly saveAriaLabel = computed(() =>
    this.isShipped() ? `Save. ${READ_ONLY_TEXT}` : undefined
  );
  /** Set on the wrapper span, because a disabled button fires no hover events. */
  protected readonly saveTooltip = computed<TooltipConfig | undefined>(() =>
    this.isShipped() ? { body: READ_ONLY_TEXT, position: TooltipPosition.Top } : undefined
  );
  protected readonly suggestedName = computed(() => {
    const theme = this.store.selectedTheme();
    return theme ? `${theme.name} copy`.slice(0, MAX_THEME_NAME_LENGTH) : '';
  });
  protected readonly targetOptions = computed<SegmentedControlOption[]>(() => [
    { id: APPLY_TO_ALL_DEVICES, label: 'All connected devices' },
    ...this.store.connectedDevices().map((d) => ({ id: d.deviceId, label: deviceLabel(d) })),
  ]);
  protected readonly themeNames = computed(() => this.store.themes().map((t) => t.name));

  protected onApply(): void {
    const themeId = this.store.unchangedThemeId();
    const themeName = themeId ? (this.store.themes().find((t) => t.id === themeId)?.name ?? null) : null;
    const message = applyConfirmText(
      themeName,
      this.store.targetDevices().map(deviceLabel)
    );
    const confirmRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: true,
      panelClass: 'glassy-dialog',
      backdropClass: 'busy-dialog-backdrop',
    });

    confirmRef.componentRef?.setInput('title', 'Apply theme?');
    confirmRef.componentRef?.setInput('message', message);
    confirmRef.componentRef?.setInput('confirmLabel', 'Apply');
    confirmRef.componentRef?.setInput('confirmIcon', 'check');
    confirmRef.componentRef?.setInput('cancelLabel', 'Cancel');
    confirmRef.componentRef?.setInput('showLabels', true);
    confirmRef.componentRef?.setInput('confirmColor', 'primary');

    confirmRef.componentInstance.confirmed.subscribe(() => {
      confirmRef.close();
      void this.store.apply();
    });
    confirmRef.componentInstance.cancelled.subscribe(() => {
      confirmRef.close();
    });
  }

  protected onSave(): void {
    void this.store.saveSelected();
  }

  protected onSaveAs(name: string, dialog: DropdownDialogComponent): void {
    dialog.close();
    void this.store.saveAs(name);
  }

  protected onDelete(): void {
    const theme = this.store.selectedTheme();
    if (!theme) {
      return;
    }
    const confirmRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: true,
      panelClass: 'glassy-dialog',
      backdropClass: 'busy-dialog-backdrop',
    });

    confirmRef.componentRef?.setInput('title', 'Delete theme?');
    confirmRef.componentRef?.setInput(
      'message',
      `“${theme.name}” will be deleted. This cannot be undone.`
    );
    confirmRef.componentRef?.setInput('confirmLabel', 'Delete');
    confirmRef.componentRef?.setInput('confirmIcon', 'delete');
    confirmRef.componentRef?.setInput('cancelLabel', 'Cancel');
    confirmRef.componentRef?.setInput('showLabels', true);
    confirmRef.componentRef?.setInput('confirmColor', 'error');

    confirmRef.componentInstance.confirmed.subscribe(() => {
      confirmRef.close();
      void this.store.deleteSelected();
    });
    confirmRef.componentInstance.cancelled.subscribe(() => {
      confirmRef.close();
    });
  }
}
