import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { DeviceStore } from '@teensyrom-nx/application';
import { EmptyStateMessageComponent } from '@teensyrom-nx/ui/components';
import type { Device } from '@teensyrom-nx/domain';
import { DjDeckColumnComponent } from '../deck-column/dj-deck-column.component';
import { DjMixerCardComponent } from '../mixer-card/dj-mixer-card.component';
import type { DeckRef } from '../deck-ref';

@Component({
  selector: 'lib-dj-mixer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateMessageComponent, DjDeckColumnComponent, DjMixerCardComponent],
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
}
