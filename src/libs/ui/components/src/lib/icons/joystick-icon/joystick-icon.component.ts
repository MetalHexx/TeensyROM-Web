import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Fixed-artwork SVG icon depicting a joystick/controller, sized and colored
 * by its parent via `fill: currentColor`. Has no inputs or outputs — it is a
 * pure presentational glyph designed for projection into
 * {@link IconButtonComponent} (`<lib-icon-button><lib-joystick-icon /></lib-icon-button>`)
 * as an alternative to a Material icon ligature, though it can also be used
 * standalone anywhere an inline icon is needed.
 *
 * Reach for `lib-joystick-icon` specifically for "games" filter and
 * navigation affordances; for any other glyph, use `lib-styled-icon` with a
 * Material icon name instead of adding a new custom SVG component.
 *
 * @example
 * ```html
 * <lib-icon-button ariaLabel="Games Filter" size="large" (buttonClick)="onGamesClick()">
 *   <lib-joystick-icon></lib-joystick-icon>
 * </lib-icon-button>
 * ```
 */
@Component({
  selector: 'lib-joystick-icon',
  imports: [CommonModule],
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
      <path
        d="m272-440 208 120 208-120-168-97v137h-80v-137l-168 97Zm168-189v-17q-44-13-72-49.5T340-780q0-58 41-99t99-41q58 0 99 41t41 99q0-48-28 84.5T520-646v17l280 161q19 11 29.5 29.5T840-398v76q0 22-10.5 40.5T800-252L520-91q-19 11-40 11t-40-11L160-252q-19-11-29.5-29.5T120-322v-76q0-22 10.5-40.5T160-468l280-161Zm0 378L200-389v67l280 162 280-162v-67L520-251q-19 11-40 11t-40-11Zm40-469q25 0 42.5-17.5T540-780q0-25-17.5-42.5T480-840q-25 0-42.5 17.5T420-780q0 25 17.5 42.5T480-720Zm0 560Z"
      />
    </svg>
  `,
  styleUrl: './joystick-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoystickIconComponent {}
