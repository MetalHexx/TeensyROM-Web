import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Compact, static image thumbnail for cover art, album artwork, or file
 * previews. Renders a single `<img>` with `object-fit: cover` and rounded
 * corners when `imageUrl` is set, and nothing at all when it is `null` —
 * safe to bind directly to optional/nullable image data.
 *
 * Reach for `lib-thumbnail-image` when you have exactly one static image to
 * show. Reach for `lib-cycle-image` instead when you have zero, one, or many
 * images and want automatic cycling and placeholder handling; `cycle-image`
 * is the superset for multi-image and empty-state scenarios.
 *
 * @example
 * ```html
 * <lib-thumbnail-image [imageUrl]="file.coverArtUrl" size="small"></lib-thumbnail-image>
 * ```
 */
@Component({
  selector: 'lib-thumbnail-image',
  imports: [CommonModule],
  templateUrl: './thumbnail-image.component.html',
  styleUrl: './thumbnail-image.component.scss',
})
export class ThumbnailImageComponent {
  /** URL of the image to display. When `null` (the default), the component renders nothing. */
  imageUrl = input<string | null>(null);
  /**
   * Rendered dimensions. Defaults to `'medium'`.
   * - `'small'` — 32x32px, compact lists and inline previews
   * - `'medium'` — 48x48px, standard player controls and file listings
   * - `'large'` — 64x64px, detailed views and featured content
   */
  size = input<'small' | 'medium' | 'large'>('medium');
}
