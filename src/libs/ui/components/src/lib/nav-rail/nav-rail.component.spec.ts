import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NavRailComponent } from './nav-rail.component';
import { NavRailItem } from './nav-rail.model';

// Test host component for testing input/output bindings
@Component({
  standalone: true,
  imports: [NavRailComponent],
  template: `
    <lib-nav-rail
      [items]="items()"
      [activeRoute]="activeRoute()"
      (itemClick)="onItemClick($event)"
    />
  `,
})
class TestHostComponent {
  items = signal<NavRailItem[]>([]);
  activeRoute = signal<string>('');
  clickedItem: NavRailItem | null = null;

  onItemClick(item: NavRailItem): void {
    this.clickedItem = item;
  }
}

describe('NavRailComponent', () => {
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  const mockItems: NavRailItem[] = [
    { name: 'Home', icon: 'home', route: '/home' },
    { name: 'Settings', icon: 'settings', route: '/settings' },
    { name: 'About', icon: 'info', route: '/about' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NavRailComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create the component', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const navRail = hostFixture.debugElement.query(By.directive(NavRailComponent));
      expect(navRail).toBeTruthy();
    });
  });

  describe('Rendering Items', () => {
    it('should render all navigation items', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      expect(items.length).toBe(3);
    });

    it('should display item icons', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const icons = hostFixture.debugElement.queryAll(By.css('.item-icon'));
      expect(icons.length).toBe(3);
      expect(icons[0].nativeElement.textContent.trim()).toBe('home');
      expect(icons[1].nativeElement.textContent.trim()).toBe('settings');
      expect(icons[2].nativeElement.textContent.trim()).toBe('info');
    });

    it('should display item labels', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const labels = hostFixture.debugElement.queryAll(By.css('.item-label'));
      expect(labels.length).toBe(3);
      expect(labels[0].nativeElement.textContent.trim()).toBe('Home');
      expect(labels[1].nativeElement.textContent.trim()).toBe('Settings');
      expect(labels[2].nativeElement.textContent.trim()).toBe('About');
    });

    it('should render empty list when no items provided', () => {
      hostComponent.items.set([]);
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      expect(items.length).toBe(0);
    });
  });

  describe('Active State', () => {
    it('should apply active class to matching route', () => {
      hostComponent.items.set(mockItems);
      hostComponent.activeRoute.set('/settings');
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      expect(items[0].classes['active']).toBeFalsy();
      expect(items[1].classes['active']).toBeTruthy();
      expect(items[2].classes['active']).toBeFalsy();
    });

    it('should set aria-current on active item', () => {
      hostComponent.items.set(mockItems);
      hostComponent.activeRoute.set('/home');
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      expect(items[0].attributes['aria-current']).toBe('page');
      expect(items[1].attributes['aria-current']).toBeUndefined();
    });

    it('should not apply active class when no route matches', () => {
      hostComponent.items.set(mockItems);
      hostComponent.activeRoute.set('/unknown');
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      items.forEach((item) => {
        expect(item.classes['active']).toBeFalsy();
      });
    });

    it('should update active state when activeRoute changes', () => {
      hostComponent.items.set(mockItems);
      hostComponent.activeRoute.set('/home');
      hostFixture.detectChanges();

      let items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      expect(items[0].classes['active']).toBeTruthy();

      hostComponent.activeRoute.set('/about');
      hostFixture.detectChanges();

      items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      expect(items[0].classes['active']).toBeFalsy();
      expect(items[2].classes['active']).toBeTruthy();
    });
  });

  describe('Item Click', () => {
    it('should emit itemClick when item is clicked', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      items[1].nativeElement.click();

      expect(hostComponent.clickedItem).toEqual(mockItems[1]);
    });

    it('should emit itemClick on Enter key press', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      items[0].triggerEventHandler('keydown.enter', {});

      expect(hostComponent.clickedItem).toEqual(mockItems[0]);
    });

    it('should emit itemClick on Space key press', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      items[2].triggerEventHandler('keydown.space', {});

      expect(hostComponent.clickedItem).toEqual(mockItems[2]);
    });
  });

  describe('Accessibility', () => {
    it('should have navigation role on nav element', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const nav = hostFixture.debugElement.query(By.css('.nav-rail'));
      expect(nav.attributes['role']).toBe('navigation');
    });

    it('should have menubar role on list', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const list = hostFixture.debugElement.query(By.css('.nav-rail__list'));
      expect(list.attributes['role']).toBe('menubar');
    });

    it('should have menuitem role on each item', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      // menuitem role is now on the parent <li> element
      const items = hostFixture.debugElement.queryAll(By.css('[role="menuitem"]'));
      expect(items.length).toBe(3);
    });

    it('should have tabindex on items for keyboard navigation', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      items.forEach((item) => {
        expect(item.attributes['tabindex']).toBe('0');
      });
    });

    it('should have aria-label on navigation element', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const nav = hostFixture.debugElement.query(By.css('.nav-rail'));
      expect(nav.attributes['aria-label']).toBe('Main navigation');
    });
  });

  describe('Wrapper Component', () => {
    it('should be wrapped in lib-scaling-compact-card', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const wrapper = hostFixture.debugElement.query(By.css('lib-scaling-compact-card'));
      expect(wrapper).toBeTruthy();
    });
  });

  describe('Width Styling', () => {
    it('should apply expanded class to nav when isExpanded is true', fakeAsync(() => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const navRailDebug = hostFixture.debugElement.query(By.directive(NavRailComponent));
      const component = navRailDebug.componentInstance;
      const nav = hostFixture.debugElement.query(By.css('.nav-rail'));

      // Initially not expanded
      expect(nav.classes['expanded']).toBeFalsy();

      // Trigger expansion
      component.onMouseEnter();
      tick(150);
      hostFixture.detectChanges();

      expect(nav.classes['expanded']).toBeTruthy();

      // Clean up
      component.onMouseLeave();
      tick(150);
    }));

    it('should remove expanded class from nav when isExpanded is false', fakeAsync(() => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const navRailDebug = hostFixture.debugElement.query(By.directive(NavRailComponent));
      const component = navRailDebug.componentInstance;

      // Expand first
      component.onMouseEnter();
      tick(150);
      hostFixture.detectChanges();

      const nav = hostFixture.debugElement.query(By.css('.nav-rail'));
      expect(nav.classes['expanded']).toBeTruthy();

      // Collapse
      component.onMouseLeave();
      tick(150);
      hostFixture.detectChanges();

      expect(nav.classes['expanded']).toBeFalsy();
    }));

    it('should set CSS custom properties on host for width values', () => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const navRailDebug = hostFixture.debugElement.query(By.directive(NavRailComponent));
      const hostEl = navRailDebug.nativeElement;

      // Check that CSS custom properties are set via style
      expect(hostEl.style.getPropertyValue('--nav-rail-collapsed-width')).toBe('56px');
      expect(hostEl.style.getPropertyValue('--nav-rail-expanded-width')).toBe('200px');
    });
  });

  describe('Payload Support', () => {
    it('should handle items with payload', () => {
      interface CustomPayload {
        id: number;
        type: string;
      }

      // Create a separate host component for payload testing with proper typing
      @Component({
        standalone: true,
        imports: [NavRailComponent],
        template: `
          <lib-nav-rail
            [items]="items()"
            [activeRoute]="activeRoute()"
            (itemClick)="onItemClick($event)"
          />
        `,
      })
      class PayloadTestHostComponent {
        items = signal<NavRailItem<CustomPayload>[]>([]);
        activeRoute = signal<string>('');
        clickedItem: NavRailItem<CustomPayload> | null = null;

        onItemClick(item: NavRailItem<CustomPayload>): void {
          this.clickedItem = item;
        }
      }

      const payloadFixture = TestBed.createComponent(PayloadTestHostComponent);
      const payloadComponent = payloadFixture.componentInstance;
      const itemsWithPayload: NavRailItem<CustomPayload>[] = [
        { name: 'Custom', icon: 'star', route: '/custom', payload: { id: 123, type: 'special' } },
      ];

      payloadComponent.items.set(itemsWithPayload);
      payloadFixture.detectChanges();

      const items = payloadFixture.debugElement.queryAll(By.css('.nav-rail-item'));
      items[0].nativeElement.click();

      expect(payloadComponent.clickedItem).toEqual(itemsWithPayload[0]);
      expect(payloadComponent.clickedItem?.payload).toEqual({ id: 123, type: 'special' });
    });
  });

  describe('Hover Expansion', () => {
    let component: NavRailComponent;

    beforeEach(() => {
      hostComponent.items.set(mockItems);
      hostFixture.detectChanges();

      const navRailDebug = hostFixture.debugElement.query(By.directive(NavRailComponent));
      component = navRailDebug.componentInstance;
    });

    it('should not expand before delay completes', fakeAsync(() => {
      component.onMouseEnter();
      tick(100); // Less than default 150ms delay
      expect(component.isExpanded()).toBe(false);

      // Clean up timer
      component.onMouseLeave();
      tick(150);
    }));

    it('should expand after delay completes', fakeAsync(() => {
      component.onMouseEnter();
      tick(150); // At default delay
      expect(component.isExpanded()).toBe(true);

      // Clean up
      component.onMouseLeave();
      tick(150);
    }));

    it('should set isHovering to true on mouse enter', fakeAsync(() => {
      expect(component.isHovering()).toBe(false);
      component.onMouseEnter();
      expect(component.isHovering()).toBe(true);

      // Clean up timer
      component.onMouseLeave();
      tick(150);
    }));

    it('should set isHovering to false on mouse leave', fakeAsync(() => {
      component.onMouseEnter();
      tick(150); // Let it expand
      expect(component.isHovering()).toBe(true);

      component.onMouseLeave();
      expect(component.isHovering()).toBe(false);

      // Clean up timer
      tick(150);
    }));

    it('should cancel expansion when mouse leaves before delay', fakeAsync(() => {
      component.onMouseEnter();
      tick(100); // Less than delay
      component.onMouseLeave();
      tick(100); // Let any remaining timers complete
      expect(component.isExpanded()).toBe(false);
    }));

    it('should not collapse before delay completes', fakeAsync(() => {
      // First expand
      component.onMouseEnter();
      tick(150);
      expect(component.isExpanded()).toBe(true);

      // Leave but not long enough
      component.onMouseLeave();
      tick(100); // Less than delay
      expect(component.isExpanded()).toBe(true);

      // Clean up timer
      tick(100);
    }));

    it('should collapse after delay completes', fakeAsync(() => {
      // First expand
      component.onMouseEnter();
      tick(150);
      expect(component.isExpanded()).toBe(true);

      // Leave and wait for collapse
      component.onMouseLeave();
      tick(150);
      expect(component.isExpanded()).toBe(false);
    }));

    it('should cancel collapse when mouse re-enters before delay', fakeAsync(() => {
      // First expand
      component.onMouseEnter();
      tick(150);
      expect(component.isExpanded()).toBe(true);

      // Start leaving
      component.onMouseLeave();
      tick(100); // Less than delay

      // Re-enter before collapse
      component.onMouseEnter();
      tick(150);

      // Should still be expanded
      expect(component.isExpanded()).toBe(true);

      // Clean up
      component.onMouseLeave();
      tick(150);
    }));

    it('should handle rapid hover-leave sequences without state change', fakeAsync(() => {
      // Quick pass through
      component.onMouseEnter();
      tick(50);
      component.onMouseLeave();
      tick(50);
      component.onMouseEnter();
      tick(50);
      component.onMouseLeave();
      tick(50);

      // Should not have expanded
      expect(component.isExpanded()).toBe(false);
    }));

    it('should clean up timers on destroy', fakeAsync(() => {
      // Start expansion timer
      component.onMouseEnter();
      tick(50); // Timer is pending

      // Destroy should clean up without errors
      hostFixture.destroy();

      // No remaining timers should cause issues
      tick(200);
    }));
  });
});
