import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import {
  BindingCardComponent,
  LoopsCuesPanelComponent,
  ScalingCompactCardComponent,
  SpeedPanelComponent,
  TransportPanelComponent,
  VoicePanelComponent,
} from '@teensyrom-nx/ui/components';
import { isDjFileDrag, readDjFileDragData, type DjFileDragPayload } from '../drag/dj-file-drag';
import type { DeckRef } from '../deck-ref';
import { createDeckPlaceholders } from '../placeholders/deck-placeholders';

@Component({
  selector: 'lib-dj-deck-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents', '[attr.data-deck]': 'deck().letter' },
  imports: [
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

  /** Whether a SID drag is currently in flight anywhere in the view — lights this deck's overlay. */
  readonly dropActive = input<boolean>(false);

  readonly fileDropped = output<DjFileDragPayload>();

  /** Whether the pointer is over this deck's own overlay while a SID drag is in flight. */
  readonly hot = signal(false);

  private dragEnterCount = 0;

  onOverlayDragEnter(event: DragEvent): void {
    if (!event.dataTransfer || !isDjFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    this.dragEnterCount++;
    this.hot.set(true);
  }

  onOverlayDragOver(event: DragEvent): void {
    if (!event.dataTransfer || !isDjFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  onOverlayDragLeave(event: DragEvent): void {
    if (!event.dataTransfer || !isDjFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
    if (this.dragEnterCount === 0) {
      this.hot.set(false);
    }
  }

  onOverlayDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragEnterCount = 0;
    this.hot.set(false);

    const payload = readDjFileDragData(event.dataTransfer);
    if (payload) {
      this.fileDropped.emit(payload);
    }
  }
}
