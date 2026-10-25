import {
  VOICE_NUMBERS,
  VOICE_STRIP_CONTROLS,
  type ControlIdentity,
  type DeckControlId,
} from '@teensyrom-nx/application';

/** The mute and hold anchors: the voice strip renders its switches under `voice-mute` and
 *  `voice-hold`, not under the control id. */
const VOICE_SWITCH_ANCHORS: Record<string, string> = Object.fromEntries(
  VOICE_NUMBERS.flatMap((voice) =>
    ['mute', 'hold'].map((switchName) => [
      `voice-${voice}-${switchName}`,
      `[data-voice="${voice}"] [data-control="voice-${switchName}"]`,
    ])
  )
);

/** The anchors that do not follow the uniform patterns: the elements the UI components render
 *  under their own `data-part` and `jump-*` names, plus the voice switches. */
const ANCHOR_OVERRIDES: Partial<Record<DeckControlId, string>> = {
  'subtune-previous': '[data-control="subtune"] [data-part="previous"]',
  'subtune-next': '[data-control="subtune"] [data-part="next"]',
  'speed-jump-up': '[data-control="jump-up"]',
  'speed-jump-home': '[data-control="jump-home"]',
  'speed-jump-down': '[data-control="jump-down"]',
  'loop-start-snap-previous': '[data-control="loop-start"] [data-part="snap-previous"]',
  'loop-start-snap-next': '[data-control="loop-start"] [data-part="snap-next"]',
  'loop-end-snap-previous': '[data-control="loop-end"] [data-part="snap-previous"]',
  'loop-end-snap-next': '[data-control="loop-end"] [data-part="snap-next"]',
  ...VOICE_SWITCH_ANCHORS,
};

const VOICE_STRIP_CONTROL_SET: ReadonlySet<string> = new Set(VOICE_STRIP_CONTROLS);

/** A per-voice panel id `voice-<n>-<control>`, as its voice number and strip control. */
function voiceStripParts(control: DeckControlId): { voice: string; control: string } | null {
  const match = /^voice-(\d)-(.+)$/.exec(control);
  return match !== null && VOICE_STRIP_CONTROL_SET.has(match[2])
    ? { voice: match[1], control: match[2] }
    : null;
}

/** The selector for a control relative to its owner. A per-voice panel control sits inside its
 *  voice strip's `data-voice`; every other control carries its own id as `data-control`, unless
 *  an override says otherwise. */
function controlAnchor(control: DeckControlId): string {
  const override = ANCHOR_OVERRIDES[control];
  if (override !== undefined) {
    return override;
  }
  const strip = voiceStripParts(control);
  return strip === null
    ? `[data-control="${control}"]`
    : `[data-voice="${strip.voice}"] [data-control="${strip.control}"]`;
}

/** The selector for a control within the DJ view: a deck control scoped to the `data-deck` element
 *  that owns it, a mixer-owned control as is. */
export function anchorFor(identity: ControlIdentity): string {
  const anchor = controlAnchor(identity.control);
  return identity.owner === 'mixer' ? anchor : `[data-deck="${identity.owner}"] ${anchor}`;
}
