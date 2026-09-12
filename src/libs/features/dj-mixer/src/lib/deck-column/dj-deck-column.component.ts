import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  ScalingCardComponent,
  ScalingCompactCardComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';
import { createDeckPlaceholders } from '../placeholders/deck-placeholders';

@Component({
  selector: 'lib-dj-deck-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents', '[attr.data-deck]': 'deck().letter' },
  imports: [
    ScalingCardComponent,
    ScalingCompactCardComponent,
    TransportPanelComponent,
    VoicePanelComponent,
    SpeedPanelComponent,
    LoopsCuesPanelComponent,
    BindingCardComponent,
  ],
  templateUrl: './dj-deck-column.component.html',
  styleUrl: './dj-deck-column.component.scss',
})
export class DjDeckColumnComponent {
  readonly deck = input.required<DeckRef>();
  readonly models = computed(() => createDeckPlaceholders(this.deck()));
}
