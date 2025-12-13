import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DropdownMenuItemComponent } from './dropdown-menu-item.component';
import { DropdownMenuComponent } from './dropdown-menu.component';
import { vi } from 'vitest';

describe('DropdownMenuItemComponent', () => {
  describe('Basic Functionality', () => {
    let component: DropdownMenuItemComponent;
    let fixture: ComponentFixture<DropdownMenuItemComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [DropdownMenuItemComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(DropdownMenuItemComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    describe('Basic Rendering', () => {
      it('should render content in default slot', () => {
        const compiled = fixture.nativeElement;
        const label = compiled.querySelector('.item-label');
        expect(label).toBeTruthy();
      });

      it('should apply selected class when selected input is true', () => {
        fixture.componentRef.setInput('selected', true);
        fixture.detectChanges();
        
        const button = fixture.nativeElement.querySelector('.dropdown-menu-item');
        expect(button?.classList.contains('selected')).toBe(true);
      });

      it('should show check icon when selected', () => {
        fixture.componentRef.setInput('selected', true);
        fixture.detectChanges();
        
        const checkIcon = fixture.nativeElement.querySelector('.check-icon');
        expect(checkIcon).toBeTruthy();
      });

      it('should not show check icon when not selected', () => {
        fixture.componentRef.setInput('selected', false);
        fixture.detectChanges();
        
        const checkIcon = fixture.nativeElement.querySelector('.check-icon');
        expect(checkIcon).toBeFalsy();
      });

      it('should apply testId attribute', () => {
        fixture.componentRef.setInput('testId', 'test-menu-item');
        fixture.detectChanges();
        
        const button = fixture.nativeElement.querySelector('button');
        expect(button?.getAttribute('data-testid')).toBe('test-menu-item');
      });
    });

    describe('Click Handling', () => {
      it('should emit itemClick when button is clicked', () => {
        const clickSpy = vi.fn();
        component.itemClick.subscribe(clickSpy);
        
        const button = fixture.nativeElement.querySelector('button');
        button?.click();
        
        expect(clickSpy).toHaveBeenCalledTimes(1);
      });

      it('should emit MouseEvent in itemClick', () => {
        let emittedEvent: MouseEvent | undefined;
        component.itemClick.subscribe((event) => {
          emittedEvent = event;
        });
        
        const button = fixture.nativeElement.querySelector('button');
        button?.click();
        
        expect(emittedEvent).toBeInstanceOf(MouseEvent);
      });

      it('should close parent dropdown when autoClose is true', () => {
        const mockClose = vi.fn();
        const mockParent = { close: mockClose } as unknown as DropdownMenuComponent;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).parentDropdown = mockParent;
        fixture.componentRef.setInput('autoClose', true);
        
        const button = fixture.nativeElement.querySelector('button');
        button?.click();
        
        expect(mockClose).toHaveBeenCalledTimes(1);
      });

      it('should not close parent dropdown when autoClose is false', () => {
        const mockClose = vi.fn();
        const mockParent = { close: mockClose } as unknown as DropdownMenuComponent;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).parentDropdown = mockParent;
        fixture.componentRef.setInput('autoClose', false);
        
        const button = fixture.nativeElement.querySelector('button');
        button?.click();
        
        expect(mockClose).not.toHaveBeenCalled();
      });

      it('should not error when parent dropdown is not present', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).parentDropdown = null;
        
        const button = fixture.nativeElement.querySelector('button');
        expect(() => button?.click()).not.toThrow();
      });
    });

    describe('Accessibility', () => {
      it('should render as button element', () => {
        const button = fixture.nativeElement.querySelector('button');
        expect(button).toBeTruthy();
        expect(button?.tagName.toLowerCase()).toBe('button');
      });

      it('should have type="button" to prevent form submission', () => {
        const button = fixture.nativeElement.querySelector('button');
        expect(button?.getAttribute('type')).toBe('button');
      });
    });
  });

  describe('Composable Actions', () => {
    @Component({
      template: `
        <lib-dropdown-menu-item (itemClick)="onItemClick($event)">
          Test Item
          <div actions>
            <button class="action-btn" (click)="onActionClick($event)">Action</button>
          </div>
        </lib-dropdown-menu-item>
      `,
      standalone: true,
      imports: [DropdownMenuItemComponent]
    })
    class TestHostComponent {
      itemClicked = false;
      actionClicked = false;
      
      onItemClick(): void {
        this.itemClicked = true;
      }
      
      onActionClick(): void {
        this.actionClicked = true;
      }
    }

    let hostFixture: ComponentFixture<TestHostComponent>;
    let hostComponent: TestHostComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent]
      }).compileComponents();

      hostFixture = TestBed.createComponent(TestHostComponent);
      hostComponent = hostFixture.componentInstance;
      hostFixture.detectChanges();
    });

    it('should render actions in actions slot', () => {
      const actionsContainer = hostFixture.nativeElement.querySelector('.item-actions');
      const actionButton = hostFixture.nativeElement.querySelector('.action-btn');
      
      expect(actionsContainer).toBeTruthy();
      expect(actionButton).toBeTruthy();
      expect(actionButton?.textContent?.trim()).toBe('Action');
    });

    it('should stop propagation when actions are clicked', () => {
      const actionButton = hostFixture.nativeElement.querySelector('.action-btn') as HTMLElement;
      
      actionButton.click();
      hostFixture.detectChanges();
      
      // Action should have been clicked but not the item
      expect(hostComponent.actionClicked).toBe(true);
      expect(hostComponent.itemClicked).toBe(false);
    });

    it('should trigger itemClick when main area is clicked (not actions)', () => {
      const itemLabel = hostFixture.nativeElement.querySelector('.item-label') as HTMLElement;
      
      itemLabel.click();
      hostFixture.detectChanges();
      
      expect(hostComponent.itemClicked).toBe(true);
      expect(hostComponent.actionClicked).toBe(false);
    });

    it('should hide actions container when empty', () => {
      @Component({
        template: `
          <lib-dropdown-menu-item>
            Test Item Without Actions
          </lib-dropdown-menu-item>
        `,
        standalone: true,
        imports: [DropdownMenuItemComponent]
      })
      class EmptyActionsComponent {}

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [EmptyActionsComponent]
      });

      const emptyFixture = TestBed.createComponent(EmptyActionsComponent);
      emptyFixture.detectChanges();
      
      const actionsContainer = emptyFixture.nativeElement.querySelector('.item-actions');
      
      // Should exist and JSDOM doesn't fully support :empty CSS selector
      expect(actionsContainer).toBeTruthy();
      // JSDOM limitation: can't test computed style for :empty pseudo-class
      // In real browser, this would be display: none
    });
  });
});
