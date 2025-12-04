import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavigationService } from './navigation.service';
import { NAV_ITEMS } from './navigation.constants';
import type { NavItem } from './navigation-item.model';

describe('NavService', () => {
  let service: NavigationService;
  let router: Partial<Router>;

  beforeEach(() => {
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [NavigationService, { provide: Router, useValue: router }],
    });
    service = TestBed.inject(NavigationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have navItems equal to NAV_ITEMS', () => {
    expect(service.navItems()).toEqual(NAV_ITEMS);
  });

  it('should be closed by default', () => {
    expect(service.isNavOpen()).toBe(false);
  });

  it('should open nav', () => {
    service.openNav();
    expect(service.isNavOpen()).toBe(true);
  });

  it('should close nav', () => {
    service.openNav();
    service.closeNav();
    expect(service.isNavOpen()).toBe(false);
  });

  it('should toggle nav open/close', () => {
    service.toggleNav();
    expect(service.isNavOpen()).toBe(true);
    service.toggleNav();
    expect(service.isNavOpen()).toBe(false);
  });

  it('should navigate and close nav when navItem has a route', () => {
    const navItem: NavItem = { name: 'Test', icon: 'test', route: '/test' };
    service.openNav();
    service.navigateTo(navItem);
    expect(router.navigate).toHaveBeenCalledWith(['/test']);
    expect(service.isNavOpen()).toBe(false);
  });

  it('should not navigate or close nav when navItem has no route', () => {
    const navItem: NavItem = { name: 'Test', icon: '', route: '' };
    service.openNav();
    service.navigateTo(navItem);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.isNavOpen()).toBe(true);
  });

  describe('expansion state', () => {
    it('should have isExpanded initialized to false', () => {
      expect(service.isExpanded()).toBe(false);
    });

    it('should expand nav when expandNav is called', () => {
      service.expandNav();
      expect(service.isExpanded()).toBe(true);
    });

    it('should be idempotent when expandNav is called multiple times', () => {
      service.expandNav();
      service.expandNav();
      expect(service.isExpanded()).toBe(true);
    });

    it('should collapse nav when collapseNav is called and not pinned', () => {
      service.expandNav();
      service.collapseNav();
      expect(service.isExpanded()).toBe(false);
    });

    it('should not collapse nav when collapseNav is called and pinned', () => {
      service.expandNav();
      service.togglePin(); // Pin it
      service.collapseNav();
      expect(service.isExpanded()).toBe(true);
    });
  });

  describe('pin state', () => {
    it('should have isPinned initialized to false', () => {
      expect(service.isPinned()).toBe(false);
    });

    it('should toggle isPinned from false to true', () => {
      service.togglePin();
      expect(service.isPinned()).toBe(true);
    });

    it('should toggle isPinned from true to false', () => {
      service.togglePin(); // false -> true
      service.togglePin(); // true -> false
      expect(service.isPinned()).toBe(false);
    });

    it('should expand nav when pinning if nav is collapsed', () => {
      expect(service.isExpanded()).toBe(false);
      service.togglePin();
      expect(service.isPinned()).toBe(true);
      expect(service.isExpanded()).toBe(true);
    });

    it('should not collapse nav when unpinning', () => {
      service.expandNav();
      service.togglePin(); // Pin
      service.togglePin(); // Unpin
      expect(service.isPinned()).toBe(false);
      expect(service.isExpanded()).toBe(true);
    });
  });
});
