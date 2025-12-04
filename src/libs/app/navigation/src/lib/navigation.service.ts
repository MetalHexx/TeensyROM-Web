import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NAV_ITEMS } from './navigation.constants';
import { NavItem } from './navigation-item.model';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private _router = inject(Router);
  private _isNavOpen = signal(false);
  private _isExpanded = signal(false);
  private _isPinned = signal(false);
  private _navItems = signal<NavItem[]>(NAV_ITEMS);

  isNavOpen = this._isNavOpen.asReadonly();
  isExpanded = this._isExpanded.asReadonly();
  isPinned = this._isPinned.asReadonly();
  navItems = this._navItems.asReadonly();

  openNav() {
    this._isNavOpen.set(true);
  }

  closeNav() {
    this._isNavOpen.set(false);
  }

  toggleNav() {
    this._isNavOpen.update((isOpen) => !isOpen);
  }

  expandNav() {
    this._isExpanded.set(true);
  }

  collapseNav() {
    if (!this._isPinned()) {
      this._isExpanded.set(false);
    }
  }

  togglePin() {
    const wasPinned = this._isPinned();
    this._isPinned.set(!wasPinned);

    // If pinning (was false, now true), expand if not already expanded
    if (!wasPinned && !this._isExpanded()) {
      this._isExpanded.set(true);
    }
  }

  navigateTo(navItem: NavItem) {
    if (navItem.route) {
      this._router.navigate([navItem.route]);
      this.closeNav();
    }
  }
}
