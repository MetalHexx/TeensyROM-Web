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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Device } from '@teensyrom-nx/domain';
import { ActionButtonComponent } from '@teensyrom-nx/ui/components';
import {
  WatchFolderFormErrors,
  availableStorage,
  controlValue,
  engineErrorMatcher,
  formValid,
} from '../watch-folder-form.util';

/**
 * The add-folder form: the folder to watch and its first device with storage, device folder and
 * launch. Presentational; the panel owns the form group, saves it and supplies the engine's
 * refusals through `errors`.
 */
@Component({
  selector: 'lib-watch-folder-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    ActionButtonComponent,
  ],
  templateUrl: './watch-folder-form.component.html',
  styleUrl: './watch-folder-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchFolderFormComponent {
  /** Controls `folder`, `device`, `storage`, `devicePath` and `launch`. */
  readonly formGroup = input.required<FormGroup>();
  /** The engine's refusal per field, or under `form` for one that concerns no field. */
  readonly errors = input<WatchFolderFormErrors>({});
  /** The connected devices the folder can deliver to. */
  readonly devices = input<Device[]>([]);
  /** Whether the save is in flight. */
  readonly submitting = input(false);

  /** Emits when Add is pressed on a valid form. */
  readonly formSubmit = output<void>();
  /** Emits when Cancel is pressed or Escape is pressed in the form. */
  readonly formCancel = output<void>();

  private readonly firstField = viewChild<ElementRef<HTMLElement>>('firstField');

  private readonly valid = formValid(this.formGroup);
  private readonly deviceId = controlValue<string>(this.formGroup, 'device');

  protected readonly canSubmit = computed(() => this.valid() && !this.submitting());
  protected readonly storageOptions = computed(() =>
    availableStorage(this.devices().find((device) => device.deviceId === this.deviceId()))
  );

  protected readonly folderMatcher = engineErrorMatcher(this.errors, 'folder');
  protected readonly deviceMatcher = engineErrorMatcher(this.errors, 'device');
  protected readonly storageMatcher = engineErrorMatcher(this.errors, 'storage');
  protected readonly devicePathMatcher = engineErrorMatcher(this.errors, 'devicePath');

  constructor() {
    afterNextRender(() => this.firstField()?.nativeElement.focus());
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
