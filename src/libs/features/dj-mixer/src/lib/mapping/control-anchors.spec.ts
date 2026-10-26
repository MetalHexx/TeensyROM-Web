import { DECK_CONTROL_IDS, DECK_SLOTS } from '@teensyrom-nx/application';
import { anchorFor } from './control-anchors';

describe('anchorFor', () => {
  it('gives every mappable deck control an anchor scoped to its deck', () => {
    expect(DECK_CONTROL_IDS).toHaveLength(79);
    for (const owner of DECK_SLOTS) {
      for (const control of DECK_CONTROL_IDS) {
        const anchor = anchorFor({ owner, control });
        expect(anchor.startsWith('[data-deck="' + owner + '"] '), anchor).toBe(true);
      }
    }
  });

  it('scopes a per-voice panel control to its deck and voice', () => {
    expect(anchorFor({ owner: 'A', control: 'voice-2-coarse' })).toBe(
      '[data-deck="A"] [data-voice="2"] [data-control="coarse"]'
    );
    expect(anchorFor({ owner: 'B', control: 'voice-3-wave-pulse' })).toBe(
      '[data-deck="B"] [data-voice="3"] [data-control="wave-pulse"]'
    );
  });

  it('anchors a deck-wide panel control by its own id inside its deck', () => {
    expect(anchorFor({ owner: 'B', control: 'filter-low-pass' })).toBe(
      '[data-deck="B"] [data-control="filter-low-pass"]'
    );
    expect(anchorFor({ owner: 'A', control: 'panic' })).toBe(
      '[data-deck="A"] [data-control="panic"]'
    );
  });

  it('keeps the non-uniform anchors of the transport and voice rows', () => {
    expect(anchorFor({ owner: 'A', control: 'stop' })).toBe(
      '[data-deck="A"] [data-control="stop"]'
    );
    expect(anchorFor({ owner: 'A', control: 'subtune-next' })).toBe(
      '[data-deck="A"] [data-control="subtune"] [data-part="next"]'
    );
    expect(anchorFor({ owner: 'A', control: 'speed-jump-down' })).toBe(
      '[data-deck="A"] [data-control="jump-down"]'
    );
    expect(anchorFor({ owner: 'B', control: 'voice-1-mute' })).toBe(
      '[data-deck="B"] [data-voice="1"] [data-control="voice-mute"]'
    );
    expect(anchorFor({ owner: 'A', control: 'voice-2-hold' })).toBe(
      '[data-deck="A"] [data-voice="2"] [data-control="voice-hold"]'
    );
  });

  it('leaves a mixer-owned control unscoped', () => {
    expect(anchorFor({ owner: 'mixer', control: 'key' })).toBe('[data-control="key"]');
  });
});
