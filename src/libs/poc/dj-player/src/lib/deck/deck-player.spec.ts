import { describe, it, expect, beforeEach, vi } from 'vitest';
import { frames } from '@sidablist/core';
import { scrubToPercent } from './deck-player';
import { MarkerCollection } from './marker-collection';
import { createFakeDeckPlayer } from '../../testing/player-doubles';
import type { FakeDeckPlayer } from '../../testing/player-doubles';

// An 80-second tune at 50 Hz, against the fixed 300-second jump ceiling. Deliberately unequal, so a
// scrub resolved against the wrong one of the two cannot coincidentally land in the right place.
const POSITION_BASIS_FRAMES = 4_000;
const CEILING_FRAMES = 15_000;

describe('scrubToPercent', () => {
  let player: FakeDeckPlayer;
  let markers: MarkerCollection;

  beforeEach(() => {
    player = createFakeDeckPlayer();
    player.snapshot.update((snapshot) => ({
      ...snapshot,
      basis: {
        ...snapshot.basis,
        positionBasisFrames: frames(POSITION_BASIS_FRAMES),
        ceilingFrames: frames(CEILING_FRAMES),
      },
    }));
    markers = new MarkerCollection(player.player);
  });

  it.each([
    [0, 0],
    [25, 1_000],
    [50, 2_000],
    [87.5, 3_500],
    [100, 4_000],
  ])('resolves %s%% onto frame %s of the position basis', async (percent, expected) => {
    await scrubToPercent(player.player, markers, percent);

    expect(player.player.seek).toHaveBeenCalledWith(frames(expected));
  });

  it('falls back with the basis when detection answered nothing', async () => {
    player.snapshot.update((snapshot) => ({
      ...snapshot,
      // What core reports for an unmeasured tune: the basis stands the ceiling in for itself.
      basis: { ...snapshot.basis, positionBasisFrames: frames(CEILING_FRAMES) },
    }));

    await scrubToPercent(player.player, markers, 50);

    expect(player.player.seek).toHaveBeenCalledWith(frames(CEILING_FRAMES / 2));
  });

  it('pins a percentage past either end of the track to that end', async () => {
    await scrubToPercent(player.player, markers, 140);
    expect(player.player.seek).toHaveBeenLastCalledWith(frames(POSITION_BASIS_FRAMES));

    await scrubToPercent(player.player, markers, -40);
    expect(player.player.seek).toHaveBeenLastCalledWith(frames(0));
  });

  it('drops a running marker loop, since a manual scrub outranks it', async () => {
    const stopMarkerLoop = vi.spyOn(markers, 'stopMarkerLoop');

    await scrubToPercent(player.player, markers, 50);

    expect(stopMarkerLoop).toHaveBeenCalled();
    expect(player.player.setActiveLoop).toHaveBeenCalledWith(null);
  });
});
