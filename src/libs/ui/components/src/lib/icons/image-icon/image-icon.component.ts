import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Fixed-artwork SVG icon depicting a photo/image, sized and colored by its
 * parent via `fill: currentColor`. Has no inputs or outputs — it is a pure
 * presentational glyph designed for projection into
 * {@link IconButtonComponent} (`<lib-icon-button><lib-image-icon /></lib-icon-button>`)
 * as an alternative to a Material icon ligature, though it can also be used
 * standalone anywhere an inline icon is needed.
 *
 * Reach for `lib-image-icon` specifically for "images/photos" filter and
 * navigation affordances; for any other glyph, use `lib-styled-icon` with a
 * Material icon name instead of adding a new custom SVG component.
 *
 * @example
 * ```html
 * <lib-icon-button ariaLabel="Images Filter" size="large" (buttonClick)="onImagesClick()">
 *   <lib-image-icon></lib-image-icon>
 * </lib-icon-button>
 * ```
 */
@Component({
  selector: 'lib-image-icon',
  imports: [CommonModule],
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
      <path
        d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"
      />
    </svg>
  `,
  styleUrl: './image-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageIconComponent {}
