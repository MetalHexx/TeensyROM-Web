import type { ControlId, ControlIdentity } from '@teensyrom-nx/application';

/**
 * The CSS selector that finds each mappable control's own element, relative to its owner. A deck
 * control is looked up inside its deck, so the same selector serves both decks. The selectors read
 * the `data-control`, `data-part` and `data-voice` attributes the UI components render on their
 * controls.
 */
export const CONTROL_ANCHORS: Record<ControlId, string> = {
  'play-pause': '[data-control="play-pause"]',
  stop: '[data-control="stop"]',
  'subtune-previous': '[data-control="subtune"] [data-part="previous"]',
  'subtune-next': '[data-control="subtune"] [data-part="next"]',
  seek: '[data-control="seek"]',
  speed: '[data-control="speed"]',
  'speed-jump-up': '[data-control="jump-up"]',
  'speed-jump-home': '[data-control="jump-home"]',
  'speed-jump-down': '[data-control="jump-down"]',
  repeat: '[data-control="repeat"]',
  'voice-1-mute': '[data-voice="1"] [data-control="voice-mute"]',
  'voice-2-mute': '[data-voice="2"] [data-control="voice-mute"]',
  'voice-3-mute': '[data-voice="3"] [data-control="voice-mute"]',
  'voice-1-hold': '[data-voice="1"] [data-control="voice-hold"]',
  'voice-2-hold': '[data-voice="2"] [data-control="voice-hold"]',
  'voice-3-hold': '[data-voice="3"] [data-control="voice-hold"]',
  'clear-voice-mutes': '[data-control="clear-voice-mutes"]',
  key: '[data-control="key"]',
};

/** The selector for a control within the DJ view: a mixer-owned control as is, a deck control
 *  scoped to the `data-deck` element that owns it. */
export function anchorFor(identity: ControlIdentity): string {
  const anchor = CONTROL_ANCHORS[identity.control];
  return identity.owner === 'mixer' ? anchor : `[data-deck="${identity.owner}"] ${anchor}`;
}
