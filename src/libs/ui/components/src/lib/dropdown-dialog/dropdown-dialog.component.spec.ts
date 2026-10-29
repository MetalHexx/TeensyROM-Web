import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

@Component({
  selector: 'lib-test-focus-host',
  standalone: true,
  imports: [DropdownDialogComponent],
  template: `
    <lib-dropdown-dialog #dialog (closed)="closedCount = closedCount + 1">
      <button class="trigger-button" (click)="dialog.open()">Open</button>
      <div dialog-content>
        <button class="first-inside">First</button>
        <button class="second-inside">Second</button>
      </div>
    </lib-dropdown-dialog>
  `
})
class FocusHostComponent {
  closedCount = 0;
}

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

  describe('Keyboard and focus', () => {
    let host: ComponentFixture<FocusHostComponent>;
    let trigger: HTMLButtonElement;

    beforeEach(async () => {
    // jsdom has no layout, so CDK's focus trap sees every element as hidden and skips it.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [FocusHostComponent],
        providers: [provideNoopAnimations()]
      }).compileComponents();
      host = TestBed.createComponent(FocusHostComponent);
      document.body.appendChild(host.nativeElement);
      host.detectChanges();
      trigger = host.nativeElement.querySelector('.trigger-button');
      trigger.focus();
    });

    function pressEscape(): void {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    }

    it('moves focus into the popup on open', async () => {
      trigger.click();
      await vi.waitFor(() => {
        expect(document.activeElement?.classList.contains('first-inside')).toBe(true);
      });
    });

    it('closes on Escape, emits closed once, and returns focus to the opener', async () => {
      trigger.click();
      await vi.waitFor(() => {
        expect(document.activeElement).not.toBe(trigger);
      });

      pressEscape();

      expect(host.componentInstance.closedCount).toBe(1);
      expect(document.querySelector('.first-inside')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('does not emit closed again when close() is called after it already closed', () => {
      trigger.click();
      pressEscape();
      host.debugElement.children[0].componentInstance.close();

      expect(host.componentInstance.closedCount).toBe(1);
    });

    afterEach(() => {
      host.nativeElement.remove();
      vi.restoreAllMocks();
    });
  });
});
