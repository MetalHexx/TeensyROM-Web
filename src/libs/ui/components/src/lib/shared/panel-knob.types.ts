/** One panel knob as its owner describes it: the operator's offset and the range it lives in. */
export interface PanelKnobModel {
  /** The operator's offset. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly home: number;
  /** The native range's keyboard step; drag stays continuous. */
  readonly step: number;
  /** e.g. "Deck A voice 2 attack". */
  readonly accessibleName: string;
  /** Appended to the value text off home: "semitones", "cents". */
  readonly valueUnit?: string | null;
}
