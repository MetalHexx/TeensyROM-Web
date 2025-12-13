import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { DropdownDialogComponent } from './dropdown-dialog.component';

@Component({
  selector: 'lib-test-wrapper',
  standalone: true,
  imports: [DropdownDialogComponent],
  template: `
    <lib-dropdown-dialog>
      <button class="trigger-button">Open Dialog</button>
      <div dialog-content class="dialog-content">Dialog Content</div>
    </lib-dropdown-dialog>
  `
})
class TestWrapperComponent {}

@Component({
  selector: 'lib-test-multiple-instances',
  standalone: true,
  imports: [DropdownDialogComponent],
  template: `
    <lib-dropdown-dialog>
      <button class="trigger-1">Trigger 1</button>
      <div dialog-content class="content-1">Content 1</div>
    </lib-dropdown-dialog>
    
    <lib-dropdown-dialog>
      <button class="trigger-2">Trigger 2</button>
      <div dialog-content class="content-2">Content 2</div>
    </lib-dropdown-dialog>
  `
})
class TestMultipleInstancesComponent {}

describe('DropdownDialogComponent', () => {
  let component: DropdownDialogComponent;
  let fixture: ComponentFixture<DropdownDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownDialogComponent, OverlayModule],
      providers: [provideNoopAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Rendering', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have trigger element reference', () => {
      const trigger = component['trigger']();
      expect(trigger).toBeDefined();
    });

    it('should have dialog template reference', () => {
      const template = component['dialogTemplate']();
      expect(template).toBeDefined();
    });
  });

  describe('Overlay Lifecycle', () => {
    it('should initialize with isOpen false', () => {
      expect(component.isOpen()).toBe(false);
    });

    it('should set isOpen signal to true when opened', () => {
      component.open();
      expect(component.isOpen()).toBe(true);
    });

    it('should set isOpen signal to false when closed', () => {
      component.open();
      component.close();
      expect(component.isOpen()).toBe(false);
    });

    it('should not create second overlay if already open', () => {
      component.open();
      const firstOverlayRef = component['overlayRef']();
      
      component.open();
      const secondOverlayRef = component['overlayRef']();
      
      expect(firstOverlayRef).toBe(secondOverlayRef);
    });

    it('should handle close() when already closed (no-op)', () => {
      expect(() => component.close()).not.toThrow();
      expect(component.isOpen()).toBe(false);
    });

    it('should clear overlayRef signal on close', () => {
      component.open();
      expect(component['overlayRef']()).toBeTruthy();

      component.close();
      expect(component['overlayRef']()).toBeNull();
    });
  });

  describe('Content Projection', () => {
    it('should project trigger content in default slot', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TestWrapperComponent],
        providers: [provideNoopAnimations()]
      }).compileComponents();

      const wrapperFixture = TestBed.createComponent(TestWrapperComponent);
      wrapperFixture.detectChanges();
      
      const triggerButton = wrapperFixture.nativeElement.querySelector('.trigger-button');
      expect(triggerButton).toBeTruthy();
      expect(triggerButton.textContent).toContain('Open Dialog');
    });
  });

  describe('Multiple Instances', () => {
    it('should render multiple instances with independent triggers', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TestMultipleInstancesComponent],
        providers: [provideNoopAnimations()]
      }).compileComponents();

      const multiInstanceFixture = TestBed.createComponent(TestMultipleInstancesComponent);
      multiInstanceFixture.detectChanges();
      
      const trigger1 = multiInstanceFixture.nativeElement.querySelector('.trigger-1');
      const trigger2 = multiInstanceFixture.nativeElement.querySelector('.trigger-2');

      expect(trigger1?.textContent).toContain('Trigger 1');
      expect(trigger2?.textContent).toContain('Trigger 2');
    });
  });

  describe('State Management', () => {
    it('should maintain isOpen signal state correctly through lifecycle', () => {
      expect(component.isOpen()).toBe(false);

      component.open();
      expect(component.isOpen()).toBe(true);

      component.close();
      expect(component.isOpen()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close calls', () => {
      component.open();
      component.close();
      component.open();
      component.close();

      expect(component.isOpen()).toBe(false);
    });
  });
});

