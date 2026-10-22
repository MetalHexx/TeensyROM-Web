import {
  VOICE_STRIP_CONTROLS,
  type ControlIdentity,
  type DeckControlId,
} from '@teensyrom-nx/application';

/** The anchors that do not follow the uniform patterns: the elements the UI components render
 *  under their own `data-part`, `jump-*` and `voice-mute|hold` names. */
const ANCHOR_OVERRIDES: Partial<Record<DeckControlId, string>> = {
  'subtune-previous': '[data-control="subtune"] [data-part="previous"]',
  'subtune-next': '[data-control="subtune"] [data-part="next"]',
  'speed-jump-up': '[data-control="jump-up"]',
  'speed-jump-home': '[data-control="jump-home"]',
  'speed-jump-down': '[data-control="jump-down"]',
  'voice-1-mute': '[data-voice="1"] [data-control="voice-mute"]',
  'voice-2-mute': '[data-voice="2"] [data-control="voice-mute"]',
  'voice-3-mute': '[data-voice="3"] [data-control="voice-mute"]',
  'voice-1-hold': '[data-voice="1"] [data-control="voice-hold"]',
  'voice-2-hold': '[data-voice="2"] [data-control="voice-hold"]',
  'voice-3-hold': '[data-voice="3"] [data-control="voice-hold"]',
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
