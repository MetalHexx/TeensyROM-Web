import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';

/** One port the user can pick for a controller. */
export interface ControllerPortOption {
  /** The port's unique identifier, emitted by `portSelect` when it is chosen. */
  readonly id: string;
  /** The port's visible name. */
  readonly label: string;
}

/** The port picker a controller row shows while its port is unknown. */
export interface ControllerPortChoice {
  /** The ports to choose from. */
  readonly options: readonly ControllerPortOption[];
  /** The picker's accessible name, e.g. 'Port for Launch Control XL'. */
  readonly accessibleName: string;
}

/** One MIDI controller's caller-composed display state and the names it announces. */
export interface ControllerRowModel {
  /** The controller's name, e.g. 'Launch Control XL'. */
  readonly name: string;
  /** Its status as text — 'Listening', 'Off', 'No mappings', 'Not connected', 'In use by another
   *  application' or 'Choose its port' — so the state never rests on colour alone. */
  readonly statusText: string;
  /** Whether the app is listening to this controller: the switch's position. */
  readonly listening: boolean;
  /** Accessible name for the switch, e.g. 'Listen to Launch Control XL'. */
  readonly toggleAccessibleName: string;
  /** The port picker to show, or `null` when the port is known and there is nothing to choose. */
  readonly portChoice: ControllerPortChoice | null;
}

/**
 * One MIDI controller in a list: its name, its status as text, a switch for whether the app listens
 * to it, and — while its port is unknown — a port picker. Purely presentational; the caller owns
 * the model and updates it from the outputs.
 *
 * The switch is the house `mat-slide-toggle`, as in the settings view.
 *
 * @example
 * ```html
 * <lib-controller-row
 *   [model]="controller()"
 *   (listeningChange)="onListeningChange($event)"
 *   (portSelect)="onPortSelect($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-controller-row',
  imports: [MatSlideToggleModule],
  templateUrl: './controller-row.component.html',
  styleUrl: './controller-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControllerRowComponent {
  /** The controller's display state and accessible names. */
  readonly model = input.required<ControllerRowModel>();
  /** Emits the switch's new position when the user flips it. */
  readonly listeningChange = output<boolean>();
  /** Emits the `id` of the port the user chose. */
  readonly portSelect = output<string>();

  /** Forwards the switch's new position. */
  protected onToggle(change: MatSlideToggleChange): void {
    this.listeningChange.emit(change.checked);
  }

  /** Forwards the chosen port's id; the placeholder option emits nothing. */
  protected onPortChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (id !== '') {
      this.portSelect.emit(id);
    }
  }
}
