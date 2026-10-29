import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ColorTheme, DEVICE_COLOR_SLOTS } from '@teensyrom-nx/domain';
import {
  C64ColorSwatchComponent,
  ScalingCardComponent,
  SelectableRowComponent,
  StyledIconComponent,
  TooltipDirective,
  TooltipPosition,
  c64Color,
} from '@teensyrom-nx/ui/components';
import { READ_ONLY_TEXT } from '../theme-texts';

/** The shipped and custom color themes as a selectable list, each row with a strip of its seven colors. */
@Component({
  selector: 'lib-theme-list',
  imports: [
    ScalingCardComponent,
    SelectableRowComponent,
    C64ColorSwatchComponent,
    StyledIconComponent,
    TooltipDirective,
  ],
  templateUrl: './theme-list.component.html',
  styleUrl: './theme-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeListComponent {
  readonly shipped = input.required<ColorTheme[]>();
  readonly custom = input.required<ColorTheme[]>();
  readonly selectedId = input<string | null>(null);
  readonly themeSelected = output<string>();

  protected readonly READ_ONLY_TEXT = READ_ONLY_TEXT;
  protected readonly lockTooltip = { body: READ_ONLY_TEXT, position: TooltipPosition.Top };

  /** The theme's seven palette indexes in slot order. */
  protected colorIndexes(theme: ColorTheme): number[] {
    return DEVICE_COLOR_SLOTS.map((slot) => theme.parts.device[slot]);
  }

  /** The theme's color names, for the swatch strip's accessible name. */
  protected colorNames(theme: ColorTheme): string {
    return this.colorIndexes(theme)
      .map((index) => c64Color(index)?.name ?? 'Unknown color')
      .join(', ');
  }
}
