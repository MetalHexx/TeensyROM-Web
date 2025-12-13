import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DropdownDialogComponent } from './dropdown-dialog.component';
import { PresetNameDialogComponent, PresetNameValidationFn } from '../preset-name-dialog/preset-name-dialog.component';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';

// ============================================================================
// Test Host Components
// ============================================================================

@Component({
  selector: 'lib-preset-dialog-test-component',
  standalone: true,
  imports: [DropdownDialogComponent, PresetNameDialogComponent],
  template: `
    <lib-dropdown-dialog #dropdownDialog>
      <button class="open-button" (click)="dropdownDialog.open()">Open Preset Dialog</button>
      <div dialog-content>
        <lib-preset-name-dialog #dialog
          [title]="title"
          [initialValue]="initialValue"
          [reservedNames]="reservedNames"
          [validationFn]="validationFn"
          (confirmed)="onConfirmed($event)"
          (cancelled)="onCancelled()">
        </lib-preset-name-dialog>
      </div>
    </lib-dropdown-dialog>
  `
})
class PresetDialogTestComponent {
  @ViewChild('dropdownDialog') dropdownDialog!: DropdownDialogComponent;
  @ViewChild('dialog') dialog!: PresetNameDialogComponent;
  
  title = 'Test Preset Dialog';
  initialValue = '';
  reservedNames: string[] = [];
  validationFn: PresetNameValidationFn = (name: string, reserved: string[]) => {
    if (name.trim() === '') return 'Name cannot be empty';
    if (reserved.includes(name.trim())) return 'Name already exists';
    if (name.length > 50) return 'Name too long';
    return '';
  };
  confirmedValue: string | null = null;
  cancelledCalled = false;

  onConfirmed(value: string): void {
    this.confirmedValue = value;
  }

  onCancelled(): void {
    this.cancelledCalled = true;
  }
}

@Component({
  selector: 'lib-confirmation-dialog-test-component',
  standalone: true,
  imports: [DropdownDialogComponent, ConfirmationDialogComponent],
  template: `
    <lib-dropdown-dialog #dropdownDialog>
      <button class="open-button" (click)="dropdownDialog.open()">Open Confirmation</button>
      <div dialog-content>
        <lib-confirmation-dialog #dialog
          [title]="title"
          [message]="message"
          [confirmLabel]="confirmLabel"
          [cancelLabel]="cancelLabel"
          (confirmed)="onConfirmed()"
          (cancelled)="onCancelled()">
        </lib-confirmation-dialog>
      </div>
    </lib-dropdown-dialog>
  `
})
class ConfirmationDialogTestComponent {
  @ViewChild('dropdownDialog') dropdownDialog!: DropdownDialogComponent;
  @ViewChild('dialog') dialog!: ConfirmationDialogComponent;
  
  title = 'Confirm Action';
  message = 'Are you sure?';
  confirmLabel = 'Delete';
  cancelLabel = 'Cancel';
  confirmedCalled = false;
  cancelledCalled = false;

  onConfirmed(): void {
    this.confirmedCalled = true;
  }

  onCancelled(): void {
    this.cancelledCalled = true;
  }
}

@Component({
  selector: 'lib-multiple-dialogs-test-component',
  standalone: true,
  imports: [DropdownDialogComponent, PresetNameDialogComponent],
  template: `
    <lib-dropdown-dialog #dialog1>
      <button class="open-button-1" (click)="dialog1.open()">Open Dialog 1</button>
      <div dialog-content>
        <lib-preset-name-dialog
          [title]="'Dialog 1'"
          [validationFn]="validationFn"
          (confirmed)="onConfirmed1($event)">
        </lib-preset-name-dialog>
      </div>
    </lib-dropdown-dialog>
    
    <lib-dropdown-dialog #dialog2>
      <button class="open-button-2" (click)="dialog2.open()">Open Dialog 2</button>
      <div dialog-content>
        <lib-preset-name-dialog
          [title]="'Dialog 2'"
          [validationFn]="validationFn"
          (confirmed)="onConfirmed2($event)">
        </lib-preset-name-dialog>
      </div>
    </lib-dropdown-dialog>
  `
})
class MultipleDialogsTestComponent {
  @ViewChild('dialog1') dialog1!: DropdownDialogComponent;
  @ViewChild('dialog2') dialog2!: DropdownDialogComponent;
  
  validationFn: PresetNameValidationFn = (name: string) => {
    return name.trim() === '' ? 'Name cannot be empty' : '';
  };
  confirmedValue1: string | null = null;
  confirmedValue2: string | null = null;

  onConfirmed1(value: string): void {
    this.confirmedValue1 = value;
  }

  onConfirmed2(value: string): void {
    this.confirmedValue2 = value;
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('DropdownDialog Integration Tests', () => {
  
  describe('PresetNameDialog Composability', () => {
    let fixture: ComponentFixture<PresetDialogTestComponent>;
    let component: PresetDialogTestComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [PresetDialogTestComponent, OverlayModule],
        providers: [provideNoopAnimations()]
      }).compileComponents();

      fixture = TestBed.createComponent(PresetDialogTestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    describe('Content Projection and Overlay Rendering', () => {
      it('should render preset dialog in overlay when opened', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        const overlay = document.querySelector('.cdk-overlay-pane');
        expect(overlay).toBeTruthy();

        const presetDialog = overlay?.querySelector('lib-preset-name-dialog');
        expect(presetDialog).toBeTruthy();
      });

      it('should close overlay when closed programmatically', async () => {
        component.dropdownDialog.open();
        fixture.detectChanges();
        expect(component.dropdownDialog.isOpen()).toBe(true);

        component.dropdownDialog.close();
        fixture.detectChanges();

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(component.dropdownDialog.isOpen()).toBe(false);
        const overlay = document.querySelector('.cdk-overlay-pane');
        expect(overlay).toBeFalsy();
      });

      it('should project initial value to dialog input', () => {
        // Re-create fixture with initial value set (matches real-world usage where
        // the component is created with initialValue already bound)
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          imports: [PresetDialogTestComponent],
          providers: [provideNoopAnimations()],
        });
        
        const newFixture = TestBed.createComponent(PresetDialogTestComponent);
        const newComponent = newFixture.componentInstance;
        newComponent.initialValue = 'My Custom Preset'; // Set before first change detection
        newFixture.detectChanges(); // ngOnInit runs here with initialValue bound

        newComponent.dropdownDialog.open();
        newFixture.detectChanges();

        expect(newComponent.dialog.currentName()).toBe('My Custom Preset');
      });

      it('should project title to dialog', () => {
        component.title = 'Rename Preset';
        fixture.detectChanges();

        component.dropdownDialog.open();
        fixture.detectChanges();

        expect(component.dialog.title()).toBe('Rename Preset');
      });
    });

    describe('Event Propagation', () => {
      it('should emit confirmed event with value through dropdown-dialog', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        // Simulate dialog confirmation by calling component method directly
        component.dialog.currentName.set('Test Name');
        component.dialog.onSaveClick();
        fixture.detectChanges();

        expect(component.confirmedValue).toBe('Test Name');
      });

      it('should emit cancelled event through dropdown-dialog', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        // Simulate dialog cancellation
        component.dialog.onCancelClick();
        fixture.detectChanges();

        expect(component.cancelledCalled).toBe(true);
      });

      it('should emit trimmed value on confirm', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        component.dialog.currentName.set('  Test Name  ');
        component.dialog.onSaveClick();
        fixture.detectChanges();

        expect(component.confirmedValue).toBe('Test Name');
      });
    });

    describe('Validation Integration', () => {
      it('should reflect validation state from dialog component', () => {
        component.reservedNames = ['Existing Name'];
        fixture.detectChanges();

        component.dropdownDialog.open();
        fixture.detectChanges();

        component.dialog.currentName.set('Existing Name');
        fixture.detectChanges();

        expect(component.dialog.validationError()).toContain('already exists');
        expect(component.dialog.canSave()).toBe(false);
      });

      it('should allow save when validation passes', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        component.dialog.currentName.set('Valid Name');
        fixture.detectChanges();

        expect(component.dialog.validationError()).toBe('');
        expect(component.dialog.canSave()).toBe(true);
      });
    });

    describe('Behavior Parity with Standalone', () => {
      let standaloneFixture: ComponentFixture<PresetNameDialogComponent>;
      let wrappedFixture: ComponentFixture<PresetDialogTestComponent>;

      beforeEach(async () => {
        await TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
          imports: [PresetNameDialogComponent, PresetDialogTestComponent, OverlayModule],
          providers: [provideNoopAnimations()]
        }).compileComponents();

        standaloneFixture = TestBed.createComponent(PresetNameDialogComponent);
        wrappedFixture = TestBed.createComponent(PresetDialogTestComponent);

        const validationFn: PresetNameValidationFn = (name: string, reserved: string[]) => {
          if (name.trim() === '') return 'Name cannot be empty';
          if (reserved.includes(name.trim())) return 'Name already exists';
          return '';
        };

        standaloneFixture.componentRef.setInput('validationFn', validationFn);
        standaloneFixture.componentRef.setInput('reservedNames', ['Reserved']);
        
        wrappedFixture.componentInstance.reservedNames = ['Reserved'];
        wrappedFixture.componentInstance.validationFn = validationFn;
        
        wrappedFixture.detectChanges();
        standaloneFixture.detectChanges();
      });

      it('should validate empty names identically', () => {
        // Wrapped version
        wrappedFixture.componentInstance.dropdownDialog.open();
        wrappedFixture.detectChanges();
        wrappedFixture.componentInstance.dialog.currentName.set('');
        wrappedFixture.detectChanges();
        const wrappedError = wrappedFixture.componentInstance.dialog.validationError();

        // Standalone version
        standaloneFixture.componentInstance.currentName.set('');
        standaloneFixture.detectChanges();
        const standaloneError = standaloneFixture.componentInstance.validationError();

        expect(wrappedError).toBe(standaloneError);
        expect(wrappedError).toContain('cannot be empty');
      });

      it('should validate reserved names identically', () => {
        // Wrapped version
        wrappedFixture.componentInstance.dropdownDialog.open();
        wrappedFixture.detectChanges();
        wrappedFixture.componentInstance.dialog.currentName.set('Reserved');
        wrappedFixture.detectChanges();
        const wrappedError = wrappedFixture.componentInstance.dialog.validationError();

        // Standalone version
        standaloneFixture.componentInstance.currentName.set('Reserved');
        standaloneFixture.detectChanges();
        const standaloneError = standaloneFixture.componentInstance.validationError();

        expect(wrappedError).toBe(standaloneError);
        expect(wrappedError).toContain('already exists');
      });

      it('should compute canSave identically', () => {
        // Wrapped version
        wrappedFixture.componentInstance.dropdownDialog.open();
        wrappedFixture.detectChanges();
        wrappedFixture.componentInstance.dialog.currentName.set('Valid Name');
        wrappedFixture.detectChanges();
        const wrappedCanSave = wrappedFixture.componentInstance.dialog.canSave();

        // Standalone version
        standaloneFixture.componentInstance.currentName.set('Valid Name');
        standaloneFixture.detectChanges();
        const standaloneCanSave = standaloneFixture.componentInstance.canSave();

        expect(wrappedCanSave).toBe(standaloneCanSave);
        expect(wrappedCanSave).toBe(true);
      });
    });
  });

  describe('ConfirmationDialog Composability', () => {
    let fixture: ComponentFixture<ConfirmationDialogTestComponent>;
    let component: ConfirmationDialogTestComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [ConfirmationDialogTestComponent, OverlayModule],
        providers: [provideNoopAnimations()]
      }).compileComponents();

      fixture = TestBed.createComponent(ConfirmationDialogTestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    describe('Content Projection and Overlay Rendering', () => {
      it('should render confirmation dialog in overlay when opened', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        const overlay = document.querySelector('.cdk-overlay-pane');
        expect(overlay).toBeTruthy();

        const confirmDialog = overlay?.querySelector('lib-confirmation-dialog');
        expect(confirmDialog).toBeTruthy();
      });

      it('should project title and message to dialog', () => {
        component.title = 'Delete Preset';
        component.message = 'This action cannot be undone.';
        fixture.detectChanges();

        component.dropdownDialog.open();
        fixture.detectChanges();

        expect(component.dialog.title()).toBe('Delete Preset');
        expect(component.dialog.message()).toBe('This action cannot be undone.');
      });

      it('should project button labels to dialog', () => {
        component.confirmLabel = 'Remove';
        component.cancelLabel = 'Keep';
        fixture.detectChanges();

        component.dropdownDialog.open();
        fixture.detectChanges();

        expect(component.dialog.confirmLabel()).toBe('Remove');
        expect(component.dialog.cancelLabel()).toBe('Keep');
      });
    });

    describe('Event Propagation', () => {
      it('should emit confirmed event through dropdown-dialog', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        // Simulate confirmation by calling component method directly
        component.dialog.onConfirmClick();
        fixture.detectChanges();

        expect(component.confirmedCalled).toBe(true);
      });

      it('should emit cancelled event through dropdown-dialog', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        // Simulate cancellation
        component.dialog.onCancelClick();
        fixture.detectChanges();

        expect(component.cancelledCalled).toBe(true);
      });
    });

    describe('Keyboard Event Handling', () => {
      it('should handle Enter key for confirmation', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        // Call keyboard handler directly through component API
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        component.dialog.onKeyDown(event);
        fixture.detectChanges();

        expect(component.confirmedCalled).toBe(true);
      });

      it('should handle Escape key for cancellation', () => {
        component.dropdownDialog.open();
        fixture.detectChanges();

        // Call keyboard handler directly through component API
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        component.dialog.onKeyDown(event);
        fixture.detectChanges();

        expect(component.cancelledCalled).toBe(true);
      });
    });
  });

  describe('Multiple Instances', () => {
    let fixture: ComponentFixture<MultipleDialogsTestComponent>;
    let component: MultipleDialogsTestComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [MultipleDialogsTestComponent, OverlayModule],
        providers: [provideNoopAnimations()]
      }).compileComponents();

      fixture = TestBed.createComponent(MultipleDialogsTestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should handle multiple dropdown dialogs independently', () => {
      // Open first dialog
      component.dialog1.open();
      fixture.detectChanges();
      expect(component.dialog1.isOpen()).toBe(true);
      expect(component.dialog2.isOpen()).toBe(false);

      // Close first, open second
      component.dialog1.close();
      fixture.detectChanges();
      
      component.dialog2.open();
      fixture.detectChanges();
      expect(component.dialog1.isOpen()).toBe(false);
      expect(component.dialog2.isOpen()).toBe(true);
    });

    it('should maintain separate overlay states for each instance', () => {
      component.dialog1.open();
      fixture.detectChanges();

      const overlay1 = document.querySelector('.cdk-overlay-pane');
      expect(overlay1).toBeTruthy();

      component.dialog1.close();
      fixture.detectChanges();

      component.dialog2.open();
      fixture.detectChanges();

      const overlay2 = document.querySelector('.cdk-overlay-pane');
      expect(overlay2).toBeTruthy();
    });
  });
});
