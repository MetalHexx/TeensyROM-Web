import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { DeviceStore } from '@teensyrom-nx/application';
import { EmptyStateMessageComponent, ScalingCardComponent } from '@teensyrom-nx/ui/components';
import type { Device } from '@teensyrom-nx/domain';
import { DjDeckColumnComponent } from '../deck-column/dj-deck-column.component';
import { DjMixerCardComponent } from '../mixer-card/dj-mixer-card.component';
import type { DeckRef } from '../deck-ref';

@Component({
  selector: 'lib-dj-mixer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dj-mixer-view--many]': 'isMany()' },
  imports: [
    EmptyStateMessageComponent,
    ScalingCardComponent,
    DjDeckColumnComponent,
    DjMixerCardComponent,
  ],
  templateUrl: './dj-mixer-view.component.html',
  styleUrl: './dj-mixer-view.component.scss',
})
export class DjMixerViewComponent {
  private readonly deviceStore = inject(DeviceStore);

  readonly enabledDevices = computed<Device[]>(() =>
    this.deviceStore.devices().filter((d) => d.isEnabled)
  );
  readonly decks = computed<readonly DeckRef[]>(() =>
    this.enabledDevices().map((_, index) => ({ letter: String.fromCharCode(65 + index), index }))
  );
  readonly showCrossfader = computed(() => this.decks().length >= 2);
  readonly isMany = computed(() => this.decks().length >= 3); // the stacked-at-every-width form

  /**
   * Inline `grid-template-areas` for the three-or-more stacked form. Deck count (and so row
   * count) isn't knowable in SCSS, so this is the one grid template value bound directly on the
   * element rather than owned by a breakpoint mixin — every other layout decision stays in the
   * stylesheet.
   */
  readonly manyGridAreas = computed<string>(() => {
    const rows: string[] = [];
    this.decks().forEach((deck) => {
      rows.push(`"t${deck.index} vs${deck.index}"`);
      rows.push(`"c${deck.index} vs${deck.index}"`);
      rows.push(`"b${deck.index} vs${deck.index}"`);
      if (deck.index === 0) {
        rows.push('"mx mx"');
      }
    });
    rows.push('"bottom bottom"');
    return rows.join(' ');
  });
}
