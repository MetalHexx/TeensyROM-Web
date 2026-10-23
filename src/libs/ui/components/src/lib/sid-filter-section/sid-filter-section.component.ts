import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LedSwitchComponent } from '../led-switch/led-switch.component';
import { PanelSectionComponent } from '../panel-section/panel-section.component';
import { RotaryKnobComponent } from '../rotary-knob/rotary-knob.component';
import type { LiveLevelIndicator, LiveLightIndicator } from '../shared/live-indicator';
import type { PanelKnobModel } from '../shared/panel-knob.types';

export type FilterModeKind = 'low-pass' | 'band-pass' | 'high-pass';

/** Everything the filter section draws; the application owns every value in it. */
export interface SidFilterSectionModel {
  readonly cutoff: PanelKnobModel;
  readonly resonance: PanelKnobModel;
  /** The mode the tune holds the operator off, or null. */
  readonly modeLock: FilterModeKind | null;
  /** Accessible names of the three mode switches. */
  readonly modeNames: Readonly<Record<FilterModeKind, string>>;
  readonly disabled: boolean;
}

/** The section's live indicators, in the order a painter addresses them. */
export interface SidFilterSectionLiveTargets {
  readonly cutoff: LiveLevelIndicator;
  readonly resonance: LiveLevelIndicator;
  /** Low, band, high. */
  readonly modes: readonly [LiveLightIndicator, LiveLightIndicator, LiveLightIndicator];
}

const MODES: readonly { readonly kind: FilterModeKind; readonly label: string }[] = [
  { kind: 'low-pass', label: 'LP' },
  { kind: 'band-pass', label: 'BP' },
  { kind: 'high-pass', label: 'HP' },
];

/**
 * The SID panel's filter section: Cutoff and Res knobs beside an LP/BP/HP column of switches. It
 * holds no state: the application feeds it a `model` and reacts to `knobChange` and `modePress`. A
 * painter sets the live indicators through the instances `liveTargets()` returns.
 *
 * @example
 * ```html
 * <lib-sid-filter-section
 *   [model]="filterModel()"
 *   (knobChange)="onKnob($event)"
 *   (modePress)="onMode($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-sid-filter-section',
  imports: [PanelSectionComponent, RotaryKnobComponent, LedSwitchComponent],
  templateUrl: './sid-filter-section.component.html',
  styleUrl: './sid-filter-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidFilterSectionComponent {
  readonly model = input.required<SidFilterSectionModel>();
  /** Emits the knob's id and its new position. */
  readonly knobChange = output<{ knob: 'cutoff' | 'resonance'; value: number }>();
  /** Emits the pressed filter mode. */
  readonly modePress = output<FilterModeKind>();

  protected readonly modes = MODES;

  private readonly cutoff = viewChild.required<RotaryKnobComponent>('cutoff');
  private readonly resonance = viewChild.required<RotaryKnobComponent>('resonance');
  private readonly modeSwitches = viewChildren(LedSwitchComponent);

  /** The section's live indicators, for a painter. Valid once the view has rendered; returns the
   *  same instances on every call. */
  liveTargets(): SidFilterSectionLiveTargets {
    const [low, band, high] = this.modeSwitches();
    return {
      cutoff: this.cutoff(),
      resonance: this.resonance(),
      modes: [low, band, high],
    };
  }
}
