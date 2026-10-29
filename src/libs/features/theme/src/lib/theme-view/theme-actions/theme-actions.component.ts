import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ColorThemeStore } from '@teensyrom-nx/application';
import { ColorThemeKind } from '@teensyrom-nx/domain';
import {
  ActionButtonComponent,
  ConfirmationDialogComponent,
  DropdownDialogComponent,
  PresetNameDialogComponent,
  ScalingCompactCardComponent,
  TooltipConfig,
  TooltipDirective,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { MAX_THEME_NAME_LENGTH, READ_ONLY_TEXT, validateThemeName } from '../theme-texts';

/** The editing buttons of the Theme view: Save, Save as and Delete. */
@Component({
  selector: 'lib-theme-actions',
  imports: [
    ScalingCompactCardComponent,
    ActionButtonComponent,
    DropdownDialogComponent,
    PresetNameDialogComponent,
    TooltipDirective,
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
  protected readonly themeNames = computed(() => this.store.themes().map((t) => t.name));

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
