import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { BottomBarComponent } from './bottom-bar.component';
import { BottomBarItem } from './bottom-bar.model';

const TEST_ITEMS: BottomBarItem[] = [
  { name: 'Player', icon: 'play_arrow', route: 'player' },
  { name: 'Devices', icon: 'devices', route: 'devices' },
  { name: 'Settings', icon: 'settings', route: 'settings' },
];

@Component({
  standalone: true,
  imports: [BottomBarComponent],
  template: `
    <lib-bottom-bar
      [items]="items()"
      [activeRoute]="activeRoute()"
      (itemClick)="onItemClick($event)"
    />
  `,
})
class TestHostComponent {
  items = signal<BottomBarItem[]>(TEST_ITEMS);
  activeRoute = signal<string>('');
  lastClickedItem: BottomBarItem | null = null;
  onItemClick(item: BottomBarItem): void {
    this.lastClickedItem = item;
  }
}

describe('BottomBarComponent', () => {
  let hostFixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, BottomBarComponent],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
    hostFixture.detectChanges();
  });

  describe('rendering', () => {
    it('should render all navigation items', () => {
      const items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      expect(items.length).toBe(3);
    });

    it('should display item icons', () => {
      const icons = hostFixture.debugElement.queryAll(By.css('.bottom-bar__icon'));
      expect(icons[0].nativeElement.textContent.trim()).toBe('play_arrow');
      expect(icons[1].nativeElement.textContent.trim()).toBe('devices');
      expect(icons[2].nativeElement.textContent.trim()).toBe('settings');
    });

    it('should display item labels', () => {
      const labels = hostFixture.debugElement.queryAll(By.css('.bottom-bar__label'));
      expect(labels[0].nativeElement.textContent.trim()).toBe('Player');
      expect(labels[1].nativeElement.textContent.trim()).toBe('Devices');
      expect(labels[2].nativeElement.textContent.trim()).toBe('Settings');
    });

    it('should set aria-label on each item', () => {
      const items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      expect(items[0].nativeElement.getAttribute('aria-label')).toBe('Player');
      expect(items[1].nativeElement.getAttribute('aria-label')).toBe('Devices');
    });
  });

  describe('active state', () => {
    it('should highlight the active item', () => {
      hostComponent.activeRoute.set('player');
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      expect(items[0].nativeElement.classList.contains('active')).toBe(true);
      expect(items[1].nativeElement.classList.contains('active')).toBe(false);
    });

    it('should set aria-current on active item', () => {
      hostComponent.activeRoute.set('devices');
      hostFixture.detectChanges();

      const items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      expect(items[1].nativeElement.getAttribute('aria-current')).toBe('page');
      expect(items[0].nativeElement.getAttribute('aria-current')).toBeNull();
    });

    it('should update active state when route changes', () => {
      hostComponent.activeRoute.set('player');
      hostFixture.detectChanges();

      let items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      expect(items[0].nativeElement.classList.contains('active')).toBe(true);

      hostComponent.activeRoute.set('settings');
      hostFixture.detectChanges();

      items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      expect(items[0].nativeElement.classList.contains('active')).toBe(false);
      expect(items[2].nativeElement.classList.contains('active')).toBe(true);
    });
  });

  describe('interaction', () => {
    it('should emit itemClick when an item is clicked', () => {
      const items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));
      items[1].nativeElement.click();

      expect(hostComponent.lastClickedItem).toEqual({
        name: 'Devices',
        icon: 'devices',
        route: 'devices',
      });
    });

    it('should emit the correct item for each button', () => {
      const items = hostFixture.debugElement.queryAll(By.css('.bottom-bar__item'));

      items[0].nativeElement.click();
      expect(hostComponent.lastClickedItem?.route).toBe('player');

      items[2].nativeElement.click();
      expect(hostComponent.lastClickedItem?.route).toBe('settings');
    });
  });

  describe('accessibility', () => {
    it('should have navigation role on the nav element', () => {
      const nav = hostFixture.debugElement.query(By.css('nav'));
      expect(nav.nativeElement.getAttribute('role')).toBe('navigation');
    });

    it('should have menubar role on the list', () => {
      const list = hostFixture.debugElement.query(By.css('.bottom-bar__list'));
      expect(list.nativeElement.getAttribute('role')).toBe('menubar');
    });

    it('should have menuitem role on list items', () => {
      const listItems = hostFixture.debugElement.queryAll(By.css('li'));
      listItems.forEach((li) => {
        expect(li.nativeElement.getAttribute('role')).toBe('menuitem');
      });
    });
  });
});
