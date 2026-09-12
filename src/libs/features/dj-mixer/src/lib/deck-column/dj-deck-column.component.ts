import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { DeckRef } from '../deck-ref';

@Component({
  selector: 'lib-dj-deck-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  templateUrl: './dj-deck-column.component.html',
  styleUrl: './dj-deck-column.component.scss',
})
export class DjDeckColumnComponent {
  readonly deck = input.required<DeckRef>();
}
