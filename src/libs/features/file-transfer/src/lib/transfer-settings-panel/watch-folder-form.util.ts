import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { EMPTY, map, startWith, switchMap } from 'rxjs';
import { Device, StorageType, WatchFolderField } from '@teensyrom-nx/domain';

/** Engine refusals by the form field they concern, or `form` for one that concerns none. */
export type WatchFolderFormErrors = Partial<Record<WatchFolderField | 'form', string>>;

export const DEFAULT_DEVICE_PATH = '/auto-transfer';

/** The storage a device has available, in the order SD then USB. */
export function availableStorage(device: Device | undefined): StorageType[] {
  const storage: StorageType[] = [];
  if (device?.sdStorage.available) storage.push(StorageType.Sd);
  if (device?.usbStorage.available) storage.push(StorageType.Usb);
  return storage;
}

/** Rejects a value that is empty or only whitespace. */
export function notBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() === '' ? { required: true } : null;
}

/** Tracks whether a form group is valid as a signal, so a button's disabled state follows the form. */
export function formValid(group: Signal<FormGroup>): Signal<boolean> {
  return toSignal(
    toObservable(group).pipe(
      switchMap((g) => g.statusChanges.pipe(startWith(g.status))),
      map((status) => status === 'VALID')
    ),
    { initialValue: false }
  );
}

/** Tracks one control's value as a signal; null when the group has no such control. */
export function controlValue<T>(group: Signal<FormGroup>, name: string): Signal<T | null> {
  return toSignal(
    toObservable(group).pipe(
      switchMap((g) => {
        const control = g.get(name);
        return control ? control.valueChanges.pipe(startWith(control.value as T)) : EMPTY;
      })
    ),
    { initialValue: null }
  ) as Signal<T | null>;
}

/** Marks a field as errored while the engine's refusal for it is shown. */
export function engineErrorMatcher(
  errors: Signal<WatchFolderFormErrors>,
  field: WatchFolderField
): ErrorStateMatcher {
  return { isErrorState: () => !!errors()[field] };
}
