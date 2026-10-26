import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** What a deck's settings sign says. The caller decides it; the sign draws it. */
export interface DeckSettingsSignModel {
  /** 'Main', or the marker's name, e.g. 'Item 2'. */
  readonly text: string;
  /** A marker's own settings are in play: drawn lit. */
  readonly own: boolean;
  /** e.g. 'Settings in play deck A: Item 2'. */
  readonly accessibleName: string;
}

/**
 * A small inset sign naming whose mixer settings are in play on a deck: a dot and uppercase
 * monospaced text, dim for the main track and lit cyan when a marker's own settings are in play.
 * Purely presentational: it holds no rule and the caller supplies the text and the accessible name.
 * The host carries `data-own` while lit, and the sign never animates.
 *
 * @example
 * ```html
 * <lib-deck-settings-sign [model]="{ text: 'Item 2', own: true, accessibleName: 'Settings in play deck A: Item 2' }" />
 * ```
 */
@Component({
  selector: 'lib-deck-settings-sign',
  templateUrl: './deck-settings-sign.component.html',
  styleUrl: './deck-settings-sign.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'model().accessibleName',
    '[attr.data-own]': 'model().own ? "" : null',
  },
})
export class DeckSettingsSignComponent {
  /** The sign's text, lit state and accessible name. */
  readonly model = input.required<DeckSettingsSignModel>();
}
