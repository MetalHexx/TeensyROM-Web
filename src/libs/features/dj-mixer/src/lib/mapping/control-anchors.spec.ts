import { DECK_CONTROL_IDS, type ControlId } from '@teensyrom-nx/application';
import { CONTROL_ANCHORS, anchorFor } from './control-anchors';

const ALL_CONTROL_IDS: readonly ControlId[] = DECK_CONTROL_IDS;

describe('CONTROL_ANCHORS', () => {
  it('has a selector for every mappable control', () => {
    for (const control of ALL_CONTROL_IDS) {
      expect(CONTROL_ANCHORS[control], control).toBeTruthy();
    }
    expect(Object.keys(CONTROL_ANCHORS).sort()).toEqual([...ALL_CONTROL_IDS].sort());
  });

  it('reaches a stepper button and a voice row control through their parts', () => {
    expect(CONTROL_ANCHORS['subtune-next']).toBe('[data-control="subtune"] [data-part="next"]');
    expect(CONTROL_ANCHORS['voice-2-hold']).toBe('[data-voice="2"] [data-control="voice-hold"]');
  });
});

describe('anchorFor', () => {
  it('scopes a deck control to its deck', () => {
    expect(anchorFor({ owner: 'A', control: 'stop' })).toBe(
      '[data-deck="A"] [data-control="stop"]'
    );
    expect(anchorFor({ owner: 'B', control: 'voice-1-mute' })).toBe(
      '[data-deck="B"] [data-voice="1"] [data-control="voice-mute"]'
    );
  });

  it('leaves a mixer-owned control unscoped', () => {
    expect(anchorFor({ owner: 'mixer', control: 'key' })).toBe('[data-control="key"]');
  });
});
