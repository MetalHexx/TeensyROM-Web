import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { C64ColorPickerComponent } from '@teensyrom-nx/ui/components';

/** One device color slot: its picker, label and description. */
@Component({
  selector: 'lib-color-slot-row',
  imports: [C64ColorPickerComponent],
  templateUrl: './color-slot-row.component.html',
  styleUrl: './color-slot-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorSlotRowComponent {
  readonly slotLabel = input.required<string>();
  readonly description = input.required<string>();
  readonly value = input.required<number>();
  readonly valueChange = output<number>();
}
