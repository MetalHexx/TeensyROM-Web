import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MenuItem } from './menu-item.model';

/**
 * A standalone, config-driven row for navigation and action lists — an icon plus a label,
 * driven entirely by an `item` object rather than content projection. Emits `menuClick`
 * with that same object on activation (click, Enter, or Space); the caller decides what an
 * item's `payload` means and how to act on it.
 *
 * This is easily confused with `DropdownMenuItemComponent` (`lib-dropdown-menu-item`):
 * that component only makes sense projected inside a `DropdownMenuComponent`'s
 * `[dropdown-content]` slot, takes its label via content projection, shows a
 * selection-check icon, and can auto-close its parent dropdown. `MenuItemComponent`, by
 * contrast, has no relationship to `DropdownMenuComponent` and is meant for standalone
 * lists — e.g. a settings navigation menu or a device picker — where each row is described
 * by a `MenuItem` config object instead of projected markup.
 *
 * @example
 * ```html
 * <lib-menu-item [item]="{ name: 'Settings', icon: 'settings' }" (menuClick)="onSelect($event)">
 * </lib-menu-item>
 * ```
 */
@Component({
  selector: 'lib-menu-item',
  standalone: true,
  imports: [MatIconModule, MatListModule],
  templateUrl: './menu-item.component.html',
  styleUrls: ['./menu-item.component.scss'],
})
export class MenuItemComponent<T = unknown> {
  /**
   * The item to render: `name` is the label, `icon` is a Material Design icon name, and
   * `payload` is caller-defined data re-emitted on click. Required — no default.
   */
  @Input() item!: MenuItem<T>;

  /** Emitted with the full `item` object on click, Enter, or Space. */
  @Output() menuClick = new EventEmitter<MenuItem<T>>();

  onClick() {
    this.menuClick.emit(this.item);
  }
}
