import { Component, input, output, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective, TooltipConfig } from '../tooltip/tooltip.directive';

/**
 * A lightweight, versatile input field with a built-in search icon, optional clear button, and
 * tooltip support. Implements `ControlValueAccessor`, so it drops into template-driven or
 * reactive forms (`[(ngModel)]`, `[formControl]`) exactly like a native `<input>` would.
 *
 * Reach for this over a raw Material form field when you need a compact search/filter box with a
 * leading icon and an optional clear affordance and don't need labels, hints, or validation
 * messages. For a full form field with those, use Material's form field directly.
 *
 * @example
 * ```html
 * <lib-input-field
 *   placeholder="Search files..."
 *   [clearable]="true"
 *   (valueChange)="onSearch($event)"
 *   (cleared)="onClearSearch()"
 * ></lib-input-field>
 * ```
 */
@Component({
  selector: 'lib-input-field',
  imports: [CommonModule, MatIconModule, TooltipDirective],
  templateUrl: './input-field.component.html',
  styleUrl: './input-field.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputFieldComponent),
      multi: true,
    },
  ],
})
export class InputFieldComponent implements ControlValueAccessor {
  /** Placeholder text shown in the field when it is empty. */
  placeholder = input.required<string>();

  /** Tooltip shown on hover over the entire input area (icon, text, and clear button). Omit for no tooltip. */
  tooltip = input<TooltipConfig | undefined>();

  /** Tooltip shown on hover over the clear button specifically. Only relevant when `clearable` is `true`. */
  clearTooltip = input<TooltipConfig | undefined>();

  /** HTML `type` attribute passed through to the native input (`'text'`, `'search'`, `'email'`, `'password'`, etc.) — defaults to `'text'`. */
  inputType = input<string>('text');

  /** Disables the input and prevents interaction — defaults to `false`. */
  disabled = input<boolean>(false);

  /** Shows a `close` icon button once the input has a value, letting the user clear it in one click — defaults to `false` (no clear button). */
  clearable = input<boolean>(false);

  /** Emits the current input value on every keystroke. */
  valueChange = output<string>();

  /** Emits when the input receives focus. */
  inputFocus = output<void>();

  /** Emits when the input loses focus. */
  inputBlur = output<void>();

  /** Emits when the clear button is clicked, after the value has been reset to empty. */
  cleared = output<void>();

  /** Current input value, kept in sync with the native `<input>` and the bound form control. */
  value = '';

  /** Registered `ControlValueAccessor` change callback, invoked with the new value on every keystroke. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private onChange = (_value: string) => {
    // Callback function for form control changes
  };
  /** Registered `ControlValueAccessor` touched callback, invoked on blur. */
  private onTouched = () => {
    // Callback function for form control touch events
  };

  /** `ControlValueAccessor`: sets `value` from the bound form control (e.g. on `patchValue`/`reset`). */
  writeValue(value: string): void {
    this.value = value || '';
  }

  /** `ControlValueAccessor`: registers the callback invoked with the new value on every keystroke. */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  /** `ControlValueAccessor`: registers the callback invoked when the field is touched (blurred). */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** `ControlValueAccessor`: no-op — disabled state is driven entirely by the `disabled` input. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setDisabledState(_isDisabled: boolean): void {
    // Handled by the disabled input signal
  }

  // Event handlers
  /** Updates `value`, notifies the form control, and emits `valueChange` on every keystroke. */
  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  /** Emits `inputFocus` when the native input receives focus. */
  onFocus(): void {
    this.inputFocus.emit();
  }

  /** Notifies the form control it was touched and emits `inputBlur` when the native input loses focus. */
  onBlur(): void {
    this.onTouched();
    this.inputBlur.emit();
  }

  /** Resets `value` to empty, notifies the form control, and emits `valueChange` then `cleared`. */
  onClear(): void {
    this.value = '';
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.cleared.emit();
  }
}
