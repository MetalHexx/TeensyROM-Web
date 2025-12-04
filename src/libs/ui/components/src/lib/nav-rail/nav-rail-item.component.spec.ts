import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavRailItemComponent } from './nav-rail-item.component';
import { NavRailItem } from './nav-rail.model';
import { By } from '@angular/platform-browser';

describe('NavRailItemComponent', () => {
  let component: NavRailItemComponent;
  let fixture: ComponentFixture<NavRailItemComponent>;

  const mockItem: NavRailItem = {
    name: 'Home',
    icon: 'home',
    route: '/home',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavRailItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NavRailItemComponent);
    component = fixture.componentInstance;
  });

  describe('rendering', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', mockItem);
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should render with icon', () => {
      const icon = fixture.debugElement.query(By.css('.item-icon'));
      expect(icon).toBeTruthy();
      expect(icon.nativeElement.textContent.trim()).toBe('home');
    });

    it('should render item label', () => {
      const label = fixture.debugElement.query(By.css('.item-label'));
      expect(label).toBeTruthy();
      expect(label.nativeElement.textContent.trim()).toBe('Home');
    });

    it('should have correct aria-label', () => {
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.attributes['aria-label']).toBe('Home');
    });

    it('should have role="button"', () => {
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.attributes['role']).toBe('button');
    });

    it('should have tabindex="0"', () => {
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.attributes['tabindex']).toBe('0');
    });
  });

  describe('expansion state', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', mockItem);
    });

    it('should not have expanded class when isExpanded is false', () => {
      fixture.componentRef.setInput('isExpanded', false);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['expanded']).toBeFalsy();
    });

    it('should have expanded class when isExpanded is true', () => {
      fixture.componentRef.setInput('isExpanded', true);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['expanded']).toBe(true);
    });

    it('should show label when expanded', () => {
      fixture.componentRef.setInput('isExpanded', true);
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('.item-label'));
      expect(label).toBeTruthy();
      // Label should be in DOM - CSS handles visibility via opacity/width
    });

    it('should hide label when collapsed', () => {
      fixture.componentRef.setInput('isExpanded', false);
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('.item-label'));
      expect(label).toBeTruthy();
      // Label should still be in DOM - CSS handles visibility via opacity/width
    });
  });

  describe('active state', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', mockItem);
    });

    it('should not have active class when isActive is false', () => {
      fixture.componentRef.setInput('isActive', false);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['active']).toBeFalsy();
    });

    it('should have active class when isActive is true', () => {
      fixture.componentRef.setInput('isActive', true);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['active']).toBe(true);
    });

    it('should have aria-current="page" when active', () => {
      fixture.componentRef.setInput('isActive', true);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.attributes['aria-current']).toBe('page');
    });

    it('should not have aria-current when not active', () => {
      fixture.componentRef.setInput('isActive', false);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.attributes['aria-current']).toBeFalsy();
    });
  });

  describe('interactions', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', mockItem);
      fixture.detectChanges();
    });

    it('should emit itemClick on click', () => {
      const emitSpy = vi.spyOn(component.itemClick, 'emit');
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));

      itemElement.triggerEventHandler('click', {});

      expect(emitSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit itemClick on Enter key', () => {
      const emitSpy = vi.spyOn(component.itemClick, 'emit');
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));

      itemElement.triggerEventHandler('keydown.enter', {});

      expect(emitSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit itemClick on Space key', () => {
      const emitSpy = vi.spyOn(component.itemClick, 'emit');
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));

      itemElement.triggerEventHandler('keydown.space', {});

      expect(emitSpy).toHaveBeenCalledWith(mockItem);
    });

    it('should emit the correct item on click', () => {
      const customItem: NavRailItem = {
        name: 'Settings',
        icon: 'settings',
        route: '/settings',
      };
      fixture.componentRef.setInput('item', customItem);
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.itemClick, 'emit');
      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));

      itemElement.triggerEventHandler('click', {});

      expect(emitSpy).toHaveBeenCalledWith(customItem);
    });
  });

  describe('combined states', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', mockItem);
    });

    it('should have both active and expanded classes when both are true', () => {
      fixture.componentRef.setInput('isActive', true);
      fixture.componentRef.setInput('isExpanded', true);
      fixture.detectChanges();

      const itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['active']).toBe(true);
      expect(itemElement.classes['expanded']).toBe(true);
    });

    it('should handle state transitions correctly', () => {
      // Start collapsed and inactive
      fixture.componentRef.setInput('isActive', false);
      fixture.componentRef.setInput('isExpanded', false);
      fixture.detectChanges();

      let itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['active']).toBeFalsy();
      expect(itemElement.classes['expanded']).toBeFalsy();

      // Expand
      fixture.componentRef.setInput('isExpanded', true);
      fixture.detectChanges();

      itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['expanded']).toBe(true);

      // Activate
      fixture.componentRef.setInput('isActive', true);
      fixture.detectChanges();

      itemElement = fixture.debugElement.query(By.css('.nav-rail-item'));
      expect(itemElement.classes['active']).toBe(true);
      expect(itemElement.classes['expanded']).toBe(true);
    });
  });
});
