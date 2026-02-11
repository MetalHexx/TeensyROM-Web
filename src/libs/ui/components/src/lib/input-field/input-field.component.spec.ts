import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { InputFieldComponent } from './input-field.component';
import { ComponentRef } from '@angular/core';
import { vi } from 'vitest';

describe('InputFieldComponent', () => {
  let component: InputFieldComponent;
  let fixture: ComponentFixture<InputFieldComponent>;
  let componentRef: ComponentRef<InputFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputFieldComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(InputFieldComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    // Set required inputs
    componentRef.setInput('placeholder', 'Test Placeholder');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should display search icon when empty', () => {
    componentRef.setInput('placeholder', 'Enter text');
    fixture.detectChanges();

    const searchIcon = fixture.nativeElement.querySelector('.search-icon');
    expect(searchIcon).toBeTruthy();
    expect(searchIcon.textContent).toContain('search');
  });

  it('should handle input type correctly', () => {
    componentRef.setInput('placeholder', 'Enter password');
    componentRef.setInput('inputType', 'password');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('password');
  });

  it('should handle disabled state', () => {
    componentRef.setInput('placeholder', 'This is disabled');
    componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    expect(input.disabled).toBe(true);
  });

  it('should emit inputFocus and inputBlur events', () => {
    componentRef.setInput('placeholder', 'Test');
    fixture.detectChanges();

    const focusSpy = vi.spyOn(component.inputFocus, 'emit');
    const blurSpy = vi.spyOn(component.inputBlur, 'emit');

    const input = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));

    expect(focusSpy).toHaveBeenCalled();
    expect(blurSpy).toHaveBeenCalled();
  });

  it('should emit valueChange event on input', () => {
    componentRef.setInput('placeholder', 'Test');
    fixture.detectChanges();

    const valueChangeSpy = vi.spyOn(component.valueChange, 'emit');

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'test value';
    input.dispatchEvent(new Event('input'));

    expect(valueChangeSpy).toHaveBeenCalledWith('test value');
  });

  it('should handle multiple input changes', () => {
    componentRef.setInput('placeholder', 'Type to search...');
    fixture.detectChanges();

    const valueChangeSpy = vi.spyOn(component.valueChange, 'emit');
    const input = fixture.nativeElement.querySelector('input');

    // Simulate typing "hello"
    const values = ['h', 'he', 'hel', 'hell', 'hello'];
    values.forEach((value) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    });

    expect(valueChangeSpy).toHaveBeenCalledTimes(5);
    expect(valueChangeSpy).toHaveBeenLastCalledWith('hello');
  });

it('should hide search icon when value is present', () => {
    componentRef.setInput('placeholder', 'Enter text');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'test';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const searchIcon = fixture.nativeElement.querySelector('.search-icon');
    expect(searchIcon).toBeFalsy();
  });

  describe('Clear button functionality', () => {
    it('should not show clear button when clearable is false', () => {
      componentRef.setInput('placeholder', 'Test');
      componentRef.setInput('clearable', false);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      input.value = 'test value';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const clearButton = fixture.nativeElement.querySelector('.clear-button');
      expect(clearButton).toBeFalsy();
    });

    it('should not show clear button when value is empty', () => {
      componentRef.setInput('placeholder', 'Test');
      componentRef.setInput('clearable', true);
      fixture.detectChanges();

      const clearButton = fixture.nativeElement.querySelector('.clear-button');
      expect(clearButton).toBeFalsy();
    });

    it('should show clear button when clearable is true and value is present', () => {
      componentRef.setInput('placeholder', 'Test');
      componentRef.setInput('clearable', true);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      input.value = 'test value';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const clearButton = fixture.nativeElement.querySelector('.clear-button');
      expect(clearButton).toBeTruthy();
    });

    it('should emit cleared event and clear value when clear button is clicked', () => {
      componentRef.setInput('placeholder', 'Test');
      componentRef.setInput('clearable', true);
      fixture.detectChanges();

      const clearedSpy = vi.spyOn(component.cleared, 'emit');
      const valueChangeSpy = vi.spyOn(component.valueChange, 'emit');

      // Set a value
      const input = fixture.nativeElement.querySelector('input');
      input.value = 'test value';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Click clear button
      const clearButton = fixture.nativeElement.querySelector('.clear-button');
      clearButton.click();
      fixture.detectChanges();

      expect(clearedSpy).toHaveBeenCalled();
      expect(valueChangeSpy).toHaveBeenCalledWith('');
      expect(component.value).toBe('');
    });

    it('should hide clear button after clearing', () => {
      componentRef.setInput('placeholder', 'Test');
      componentRef.setInput('clearable', true);
      fixture.detectChanges();

      // Set a value
      const input = fixture.nativeElement.querySelector('input');
      input.value = 'test value';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Verify clear button is visible
      let clearButton = fixture.nativeElement.querySelector('.clear-button');
      expect(clearButton).toBeTruthy();

      // Click clear button
      clearButton.click();
      fixture.detectChanges();

      // Verify clear button is hidden
      clearButton = fixture.nativeElement.querySelector('.clear-button');
      expect(clearButton).toBeFalsy();
    });
  });
});
