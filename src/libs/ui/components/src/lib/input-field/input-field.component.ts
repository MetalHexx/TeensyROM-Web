import { Component, input, output, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TooltipDirective, TooltipConfig } from '../tooltip/tooltip.directive';

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
  // Required inputs
  placeholder = input.required<string>();

  // Optional inputs
  tooltip = input<TooltipConfig | undefined>();
  clearTooltip = input<TooltipConfig | undefined>();
  inputType = input<string>('text');
  disabled = input<boolean>(false);
  clearable = input<boolean>(false);

  // Events
  valueChange = output<string>();
  inputFocus = output<void>();
  inputBlur = output<void>();
  cleared = output<void>();

  // Internal state
  value = '';
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private onChange = (_value: string) => {
    // Callback function for form control changes
  };
  private onTouched = () => {
    // Callback function for form control touch events
  };

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setDisabledState(_isDisabled: boolean): void {
    // Handled by the disabled input signal
  }

  // Event handlers
  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

  onFocus(): void {
    this.inputFocus.emit();
  }

  onBlur(): void {
    this.onTouched();
    this.inputBlur.emit();
  }

  onClear(): void {
    this.value = '';
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.cleared.emit();
  }
}
