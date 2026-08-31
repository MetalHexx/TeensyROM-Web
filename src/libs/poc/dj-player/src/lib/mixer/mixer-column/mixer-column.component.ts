import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CrossfaderComponent } from '../crossfader/crossfader.component';

/**
 * The mixer column: an obviously-empty region reserved for the mixing surface future work adds, and
 * the crossfader beneath it. Nothing else — no per-deck gain fader, no curve selector, no curve-shape
 * preview, and no numeric readout of the resulting register value.
 *
 * `:host` claims the fixed `mx` grid area directly, in both the page's two-deck layout and its
 * N-deck fallback: there is exactly one mixer column regardless of how many decks compose, so naming
 * it here is not a deck naming a column — see `dj-poc-view.component.ts`'s own grid layout, which
 * never touches this area name.
 */
@Component({
  selector: 'lib-mixer-column',
  templateUrl: './mixer-column.component.html',
  styleUrl: './mixer-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrossfaderComponent],
})
export class MixerColumnComponent {}
