import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DEVICE_COLOR_SLOTS, DeviceColors } from '@teensyrom-nx/domain';
import {
  ScalingCardComponent,
  StyledIconComponent,
  TooltipDirective,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { ColorSlotRowComponent } from '../color-slot-row/color-slot-row.component';
import { COLOR_SLOT_LABELS } from '../color-slot-labels';

export interface ColorChange {
  slot: keyof DeviceColors;
  colorIndex: number;
}

/** The seven C64 menu color rows of the selected theme, with an info tooltip on where the colors come from. */
@Component({
  selector: 'lib-theme-colors-card',
  imports: [ScalingCardComponent, ColorSlotRowComponent, StyledIconComponent, TooltipDirective],
  templateUrl: './theme-colors-card.component.html',
  styleUrl: './theme-colors-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeColorsCardComponent {
  readonly colors = input.required<DeviceColors>();
  readonly subtitle = input.required<string>();
  readonly infoText = input.required<string>();
  readonly colorChange = output<ColorChange>();

  protected readonly slots = DEVICE_COLOR_SLOTS;
  protected readonly slotLabels = COLOR_SLOT_LABELS;
  protected readonly TooltipPosition = TooltipPosition;
}
