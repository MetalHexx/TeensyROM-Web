import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LayoutComponent } from './layout.component';
import {
  DEVICE_SERVICE,
  DEVICE_STORAGE_SERVICE,
  VERSION_SERVICE,
  ALERT_SERVICE,
  IDeviceService,
  IStorageService,
  IVersionService,
  IAlertService,
  Device,
  StorageDirectory,
  AppVersion,
} from '@teensyrom-nx/domain';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { NAV_ITEMS } from '@teensyrom-nx/app/navigation';
import { By } from '@angular/platform-browser';
import '../../test-setup';

@Component({ standalone: true, template: '<p>Test</p>' })
class TestComponent {}

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let router: Router;

  beforeEach(async () => {
    const mockDeviceService: Partial<IDeviceService> = {
      findDevices: () => of([]),
      getConnectedDevices: () => of([]),
      connectDevice: () => of({} as Device),
      disconnectDevice: () => of(undefined),
      resetDevice: () => of(undefined),
      pingDevice: () => of(undefined),
    };

    const mockStorageService: Partial<IStorageService> = {
      getDirectory: () => of({} as StorageDirectory),
      index: () => of({}),
      indexAll: () => of({}),
    };

    const mockVersionService: Partial<IVersionService> = {
      getVersion: () => of({ version: '1.0.0-test' } as AppVersion),
    };

    const mockAlertService: Partial<IAlertService> = {
      alerts$: of([]),
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([
          { path: 'player', component: TestComponent },
          { path: 'player/:subpath', component: TestComponent },
          { path: 'devices', component: TestComponent },
          { path: 'settings', component: TestComponent },
        ]),
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
        { provide: VERSION_SERVICE, useValue: mockVersionService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('nav rail integration', () => {
    it('should render nav rail component', () => {
      const navRail = fixture.debugElement.query(By.css('lib-nav-rail'));
      expect(navRail).toBeTruthy();
    });

    it('should pass menu items to nav rail', () => {
      expect(component.menuItems).toBe(NAV_ITEMS);
      expect(component.menuItems.length).toBeGreaterThan(0);
    });

    it('should have active route initialized from current router url', () => {
      // Initial route is empty or root
      expect(component.activeRoute()).toBeDefined();
    });

    it('should update active route after navigation', async () => {
      await router.navigate(['player']);
      fixture.detectChanges();

      expect(component.activeRoute()).toBe('player');
    });

    it('should navigate when onNavItemClick is called', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.onNavItemClick({ name: 'Devices', icon: 'devices', route: 'devices' });

      expect(navigateSpy).toHaveBeenCalledWith(['devices']);
    });

    it('should extract first path segment for nested routes', async () => {
      // Navigate to a nested path
      await router.navigate(['player', 'browse']);
      fixture.detectChanges();

      // Should only get 'player' from '/player/browse'
      expect(component.activeRoute()).toBe('player');
    });
  });
});
