import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Device, StorageType } from '@teensyrom-nx/domain';
import {
  ActionButtonComponent,
  TooltipConfig,
  TooltipDirective,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import {
  WatchFolderFormErrors,
  availableStorage,
  controlValue,
  engineErrorMatcher,
  formValid,
} from '../watch-folder-form.util';

/**
 * The device form of a watched folder. In `add` mode it picks a device, its storage, the device
 * folder and launch. In `edit` mode the device and storage show read-only, since a destination
 * cannot move to another device or storage, and only the device folder and launch change.
 * Presentational; the panel owns the form group, saves it and supplies the engine's refusals
 * through `errors`.
 */
@Component({
  selector: 'lib-watch-folder-device-form',
  imports: [
    ReactiveFormsModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    ActionButtonComponent,
    TooltipDirective,
  ],
  templateUrl: './watch-folder-device-form.component.html',
  styleUrl: './watch-folder-device-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchFolderDeviceFormComponent {
  /** Whether this adds a device to the folder or edits one already on it. */
  readonly mode = input.required<'add' | 'edit'>();
  /** Controls `device`, `storage`, `devicePath` and `launch` in add mode; `devicePath` and `launch` in edit mode. */
  readonly formGroup = input.required<FormGroup>();
  /** The engine's refusal per field, or under `form` for one that concerns no field. */
  readonly errors = input<WatchFolderFormErrors>({});
  /** The connected devices the folder can still deliver to; add mode only. */
  readonly devices = input<Device[]>([]);
  /** The device being edited, shown read-only; edit mode only. */
  readonly deviceName = input('');
  /** The storage being edited, shown read-only; edit mode only. */
  readonly storageType = input<StorageType | null>(null);
  /** Whether the save is in flight. */
  readonly submitting = input(false);

  /** Emits when Save is pressed on a valid form. */
  readonly formSubmit = output<void>();
  /** Emits when Cancel is pressed or Escape is pressed in the form. */
  readonly formCancel = output<void>();

  private readonly deviceField = viewChild('deviceField', { read: ElementRef<HTMLElement> });
  private readonly pathField = viewChild('pathField', { read: ElementRef<HTMLElement> });

  private readonly valid = formValid(this.formGroup);
  private readonly deviceId = controlValue<string>(this.formGroup, 'device');

  protected readonly deviceTooltip: TooltipConfig = {
    body: 'The TeensyROM the files are copied to.',
    position: TooltipPosition.Top,
  };
  protected readonly storageTooltip: TooltipConfig = {
    body: 'The device storage the files are copied to.',
    position: TooltipPosition.Top,
  };
  protected readonly devicePathTooltip: TooltipConfig = {
    body: 'Folder on the device the files are copied into.',
    position: TooltipPosition.Top,
  };
  protected readonly launchTooltip: TooltipConfig = {
    body: 'Start each file on the device once it is copied.',
    position: TooltipPosition.Top,
  };
  protected readonly cancelTooltip: TooltipConfig = {
    body: 'Close the form without saving.',
    position: TooltipPosition.Top,
  };
  protected readonly submitTooltip: TooltipConfig = {
    body: 'Save this device.',
    position: TooltipPosition.Top,
  };

  protected readonly canSubmit = computed(() => this.valid() && !this.submitting());
  /** Both storages are always shown; the ones the chosen device lacks are disabled. */
  protected readonly storageChoices = [StorageType.Sd, StorageType.Usb];
  protected readonly storageOptions = computed(() =>
    availableStorage(this.devices().find((device) => device.deviceId === this.deviceId()))
  );
  protected readonly formLabel = computed(() =>
    this.mode() === 'add' ? 'Add device' : 'Edit device'
  );

  protected readonly deviceMatcher = engineErrorMatcher(this.errors, 'device');
  protected readonly devicePathMatcher = engineErrorMatcher(this.errors, 'devicePath');

  constructor() {
    afterNextRender(() => (this.deviceField() ?? this.pathField())?.nativeElement.focus());
  }

  protected onSubmit(): void {
    if (this.canSubmit()) {
      this.formSubmit.emit();
    }
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    this.formCancel.emit();
  }
}
