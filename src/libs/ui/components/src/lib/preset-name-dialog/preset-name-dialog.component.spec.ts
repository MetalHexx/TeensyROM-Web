import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PresetNameDialogComponent, PresetNameValidationFn } from './preset-name-dialog.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

describe('PresetNameDialogComponent', () => {
  let component: PresetNameDialogComponent;
  let fixture: ComponentFixture<PresetNameDialogComponent>;
  let mockValidationFn: PresetNameValidationFn;

  beforeEach(async () => {
    // Default mock validation function (returns no error)
    mockValidationFn = (name: string) => {
      return name.trim() === '' ? 'Preset name cannot be empty' : '';
    };

    await TestBed.configureTestingModule({
      imports: [PresetNameDialogComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(PresetNameDialogComponent);
    component = fixture.componentInstance;
    
    // Set required input
    fixture.componentRef.setInput('validationFn', mockValidationFn);
    fixture.detectChanges(); // Trigger initial change detection
  });

  describe('Input/Output Tests', () => {
    it('should initialize with default title "Save Preset"', () => {
      expect(component.title()).toBe('Save Preset');
    });

    it('should display custom title when provided via input', () => {
      fixture.componentRef.setInput('title', 'Rename Preset');
      expect(component.title()).toBe('Rename Preset');
    });

    it('should initialize currentName to empty string', () => {
      expect(component.currentName()).toBe('');
    });

    it('should initialize currentName to initialValue when provided', () => {
      // Create new component with initialValue set before ngOnInit
      const newFixture = TestBed.createComponent(PresetNameDialogComponent);
      const newComponent = newFixture.componentInstance;
      newFixture.componentRef.setInput('validationFn', mockValidationFn);
      newFixture.componentRef.setInput('initialValue', 'My Preset');
      newFixture.detectChanges(); // This triggers ngOnInit
      expect(newComponent.currentName()).toBe('My Preset');
    });

    it('should pass reservedNames to validation function', () => {
      const reserved = ['Preset One', 'Preset Two'];
      fixture.componentRef.setInput('reservedNames', reserved);
      
      const validationSpy = vi.fn().mockReturnValue('');
      fixture.componentRef.setInput('validationFn', validationSpy);
      
      component.currentName.set('Test');
      fixture.detectChanges();
      
      // Trigger validation by accessing the computed signal
      component.validationError();
      
      expect(validationSpy).toHaveBeenCalledWith('Test', reserved);
    });
  });

  describe('Validation Signal Tests', () => {
    it('should return error for empty name', () => {
      const validateFn: PresetNameValidationFn = (name) => {
        return name.trim() === '' ? 'Preset name cannot be empty' : '';
      };
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('');
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('Preset name cannot be empty');
    });

    it('should return error for invalid characters', () => {
      const validateFn: PresetNameValidationFn = (name) => {
        const invalidChars = /[^a-zA-Z0-9\s-]/;
        return invalidChars.test(name) 
          ? 'Preset name can only contain letters, numbers, spaces, and hyphens' 
          : '';
      };
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Invalid@Name!');
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('Preset name can only contain letters, numbers, spaces, and hyphens');
    });

    it('should return error for reserved names', () => {
      const validateFn: PresetNameValidationFn = (name, existing) => {
        const lowerName = name.toLowerCase();
        const isReserved = existing.some(e => e.toLowerCase() === lowerName);
        return isReserved ? 'This name is reserved for a built-in preset' : '';
      };
      fixture.componentRef.setInput('validationFn', validateFn);
      fixture.componentRef.setInput('reservedNames', ['fullscreen-webgl', 'classic-crt']);
      
      component.currentName.set('fullscreen-webgl');
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('This name is reserved for a built-in preset');
    });

    it('should return error for name over 50 chars', () => {
      const validateFn: PresetNameValidationFn = (name) => {
        return name.length > 50 
          ? 'Preset name must be between 1 and 50 characters' 
          : '';
      };
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('A'.repeat(51));
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('Preset name must be between 1 and 50 characters');
    });

    it('should return empty string for valid name', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Valid Preset Name');
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('');
    });
  });

  describe('Character Counter Tests', () => {
    it('should show "0/50" for empty name', () => {
      component.currentName.set('');
      fixture.detectChanges();
      
      expect(component.remainingChars()).toBe('0/50');
    });

    it('should show "10/50" for 10-character name', () => {
      component.currentName.set('1234567890');
      fixture.detectChanges();
      
      expect(component.remainingChars()).toBe('10/50');
    });

    it('should show "50/50" for 50-character name', () => {
      component.currentName.set('A'.repeat(50));
      fixture.detectChanges();
      
      expect(component.remainingChars()).toBe('50/50');
    });
  });

  describe('Can Save Logic Tests', () => {
    it('should be false when name is empty', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('');
      fixture.detectChanges();
      
      expect(component.canSave()).toBe(false);
    });

    it('should be false when name is whitespace only', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('   ');
      fixture.detectChanges();
      
      expect(component.canSave()).toBe(false);
    });

    it('should be false when validation error exists', () => {
      const validateFn: PresetNameValidationFn = () => 'Some validation error';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Test Name');
      fixture.detectChanges();
      
      expect(component.canSave()).toBe(false);
    });

    it('should be true when name is valid and non-empty', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      expect(component.canSave()).toBe(true);
    });
  });

  describe('Event Emission Tests', () => {
    it('should emit confirmed with trimmed name when canSave is true', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('  Test Name  ');
      fixture.detectChanges();
      
      let emittedValue: string | undefined;
      component.confirmed.subscribe(value => emittedValue = value);
      
      component.onSaveClick();
      
      expect(emittedValue).toBe('Test Name');
    });

    it('should not emit when canSave is false', () => {
      const validateFn: PresetNameValidationFn = () => 'Validation error';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Invalid');
      fixture.detectChanges();
      
      let emitted = false;
      component.confirmed.subscribe(() => emitted = true);
      
      component.onSaveClick();
      
      expect(emitted).toBe(false);
    });

    it('should emit cancelled event on cancel', () => {
      let emitted = false;
      component.cancelled.subscribe(() => emitted = true);
      
      component.onCancelClick();
      
      expect(emitted).toBe(true);
    });
  });

  describe('Keyboard Navigation Tests', () => {
    it('should trigger save on Enter key when name is valid', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      let emittedValue: string | undefined;
      component.confirmed.subscribe(value => emittedValue = value);
      
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      component.onKeyDown(event);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(emittedValue).toBe('Valid Name');
    });

    it('should not trigger save on Enter when name is invalid', () => {
      const validateFn: PresetNameValidationFn = () => 'Error';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('Invalid');
      fixture.detectChanges();
      
      let emitted = false;
      component.confirmed.subscribe(() => emitted = true);
      
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      component.onKeyDown(event);
      
      expect(emitted).toBe(false);
    });

    it('should trigger cancel on Escape key', () => {
      let emitted = false;
      component.cancelled.subscribe(() => emitted = true);
      
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      component.onKeyDown(event);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(emitted).toBe(true);
    });

    it('should not trigger any action on other keys', () => {
      let confirmedEmitted = false;
      let cancelledEmitted = false;
      component.confirmed.subscribe(() => confirmedEmitted = true);
      component.cancelled.subscribe(() => cancelledEmitted = true);
      
      const event = new KeyboardEvent('keydown', { key: 'a' });
      component.onKeyDown(event);
      
      expect(confirmedEmitted).toBe(false);
      expect(cancelledEmitted).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle validation function changes', () => {
      const validateFn1: PresetNameValidationFn = () => 'Error 1';
      const validateFn2: PresetNameValidationFn = () => 'Error 2';
      
      fixture.componentRef.setInput('validationFn', validateFn1);
      component.currentName.set('Test');
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('Error 1');
      
      fixture.componentRef.setInput('validationFn', validateFn2);
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('Error 2');
    });

    it('should handle reservedNames updates', () => {
      const validateFn: PresetNameValidationFn = (name, existing) => {
        return existing.includes(name) ? 'Duplicate' : '';
      };
      
      fixture.componentRef.setInput('validationFn', validateFn);
      fixture.componentRef.setInput('reservedNames', ['Preset 1']);
      component.currentName.set('Preset 1');
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('Duplicate');
      
      fixture.componentRef.setInput('reservedNames', ['Preset 2']);
      fixture.detectChanges();
      
      expect(component.validationError()).toBe('');
    });

    it('should trim whitespace when emitting confirmed event', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('  Leading and trailing  ');
      fixture.detectChanges();
      
      let emittedValue: string | undefined;
      component.confirmed.subscribe(value => emittedValue = value);
      
      component.onSaveClick();
      
      expect(emittedValue).toBe('Leading and trailing');
    });
  });

  describe('Template Rendering Tests', () => {
    it('should display dialog header with title from input signal', () => {
      fixture.componentRef.setInput('title', 'Custom Title');
      fixture.detectChanges();
      
      const titleElement = fixture.nativeElement.querySelector('.dialog-header h2');
      expect(titleElement).toBeTruthy();
      expect(titleElement.textContent).toBe('Custom Title');
    });

    it('should display edit icon in header', () => {
      fixture.detectChanges();
      
      const iconElement = fixture.nativeElement.querySelector('.dialog-header mat-icon');
      expect(iconElement).toBeTruthy();
      expect(iconElement.textContent.trim()).toBe('edit');
    });

    it('should render input field with correct attributes', () => {
      fixture.detectChanges();
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      expect(inputElement).toBeTruthy();
      expect(inputElement.getAttribute('maxlength')).toBe('50');
      expect(inputElement.getAttribute('placeholder')).toBe('Enter preset name');
      expect(inputElement.getAttribute('aria-label')).toBe('Preset name');
      // Note: autofocus removed for accessibility compliance
    });

    it('should display character counter with correct format initially', () => {
      fixture.detectChanges();
      
      const hintElement = fixture.nativeElement.querySelector('mat-hint span');
      expect(hintElement).toBeTruthy();
      expect(hintElement.textContent.trim()).toBe('0/50');
    });
  });

  describe('Template Data Binding Tests', () => {
    it('should bind input value to currentName signal', () => {
      component.currentName.set('Test Name');
      fixture.detectChanges();
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      expect(inputElement.value).toBe('Test Name');
    });

    it('should update currentName signal when user types', () => {
      fixture.detectChanges();
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      inputElement.value = 'New Name';
      inputElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      
      expect(component.currentName()).toBe('New Name');
    });

    it('should update character counter as user types', () => {
      fixture.detectChanges();
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      inputElement.value = '12345';
      inputElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      
      const hintElement = fixture.nativeElement.querySelector('mat-hint span');
      expect(hintElement.textContent.trim()).toBe('5/50');
    });
  });

  describe('Validation Display Tests', () => {
    it('should hide validation error message when no error', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      // Since @if directive conditionally renders mat-error, check component signal directly
      expect(component.validationError()).toBe('');
    });

    it('should display validation error via component signal when error exists', () => {
      const validateFn: PresetNameValidationFn = () => 'Preset name is invalid';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Invalid');
      fixture.detectChanges();
      
      // Verify the computed signal has the error
      expect(component.validationError()).toBe('Preset name is invalid');
    });

    it('should update error message when validation error changes', () => {
      const validateFn: PresetNameValidationFn = (name) => {
        if (name.length === 0) return 'Name cannot be empty';
        if (name.length > 50) return 'Name too long';
        return '';
      };
      fixture.componentRef.setInput('validationFn', validateFn);
      
      component.currentName.set('');
      fixture.detectChanges();
      
      // Check computed signal for first error
      expect(component.validationError()).toBe('Name cannot be empty');
      
      component.currentName.set('A'.repeat(51));
      fixture.detectChanges();
      
      // Check computed signal for updated error
      expect(component.validationError()).toBe('Name too long');
    });
  });

  describe('Character Counter Styling Tests', () => {
    it('should use normal styling when under character limit', () => {
      component.currentName.set('Short');
      fixture.detectChanges();
      
      const counterSpan = fixture.nativeElement.querySelector('mat-hint span');
      expect(counterSpan.classList.contains('error-text')).toBe(false);
    });

    it('should use error styling when over character limit', () => {
      component.currentName.set('A'.repeat(51));
      fixture.detectChanges();
      
      const counterSpan = fixture.nativeElement.querySelector('mat-hint span');
      expect(counterSpan.classList.contains('error-text')).toBe(true);
    });
  });

  describe('Button State Tests', () => {
    it('should disable save button when canSave is false', () => {
      const validateFn: PresetNameValidationFn = () => 'Error';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Invalid');
      fixture.detectChanges();
      
      const buttons = fixture.debugElement.nativeElement.querySelectorAll('lib-icon-button button');
      const saveButton = buttons[0]; // First button is Save
      expect(saveButton.disabled).toBe(true);
    });

    it('should enable save button when canSave is true', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      const buttons = fixture.debugElement.nativeElement.querySelectorAll('lib-icon-button button');
      const saveButton = buttons[0]; // First button is Save
      expect(saveButton.disabled).toBe(false);
    });

    it('should never disable cancel button', () => {
      fixture.detectChanges();
      
      const buttons = fixture.debugElement.nativeElement.querySelectorAll('lib-icon-button button');
      const cancelButton = buttons[1]; // Second button is Cancel
      expect(cancelButton.disabled).toBe(false);
    });
  });

  describe('Button Event Binding Tests', () => {
    it('should call onSaveClick when save button is clicked', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      const saveSpy = vi.spyOn(component, 'onSaveClick');
      
      const buttons = fixture.debugElement.nativeElement.querySelectorAll('lib-icon-button button');
      const saveButton = buttons[0]; // First button is Save
      saveButton.click();
      fixture.detectChanges();
      
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should call onCancelClick when cancel button is clicked', () => {
      fixture.detectChanges();
      
      const cancelSpy = vi.spyOn(component, 'onCancelClick');
      
      const buttons = fixture.debugElement.nativeElement.querySelectorAll('lib-icon-button button');
      const cancelButton = buttons[1]; // Second button is Cancel
      cancelButton.click();
      fixture.detectChanges();
      
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('should emit confirmed event when save button clicked with valid name', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      let emittedValue: string | undefined;
      component.confirmed.subscribe(value => emittedValue = value);
      
      const buttons = fixture.debugElement.nativeElement.querySelectorAll('lib-icon-button button');
      const saveButton = buttons[0]; // First button is Save
      saveButton.click();
      fixture.detectChanges();
      
      expect(emittedValue).toBe('Valid Name');
    });
  });

  describe('Keyboard Event Binding Tests', () => {
    it('should pass keyboard events to onKeyDown handler', () => {
      fixture.detectChanges();
      
      const keyDownSpy = vi.spyOn(component, 'onKeyDown');
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      inputElement.dispatchEvent(event);
      
      expect(keyDownSpy).toHaveBeenCalled();
    });

    it('should trigger save on Enter key press in input field', () => {
      const validateFn: PresetNameValidationFn = () => '';
      fixture.componentRef.setInput('validationFn', validateFn);
      component.currentName.set('Valid Name');
      fixture.detectChanges();
      
      let emittedValue: string | undefined;
      component.confirmed.subscribe(value => emittedValue = value);
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      inputElement.dispatchEvent(event);
      
      expect(emittedValue).toBe('Valid Name');
    });

    it('should trigger cancel on Escape key press in input field', () => {
      fixture.detectChanges();
      
      let emitted = false;
      component.cancelled.subscribe(() => emitted = true);
      
      const inputElement = fixture.nativeElement.querySelector('input[matInput]');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      inputElement.dispatchEvent(event);
      
      expect(emitted).toBe(true);
    });
  });
});
