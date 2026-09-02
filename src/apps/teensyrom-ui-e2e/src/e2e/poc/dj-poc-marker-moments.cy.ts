/**
 * Real-browser verification for the marker-nudge snap/tick controls: the phase plan behind them
 * calls for the marker rows to be "looked at in a real browser at the page's own two-deck layout —
 * the ticks sit where a snap actually lands, and the two new buttons do not reflow the `.marker-slot`
 * row", naming this explicitly as a defect class a jsdom test cannot see. jsdom lays nothing out —
 * every `getBoundingClientRect()` it returns is a zero box — so a percentage-positioned tick or a
 * flex-wrap reflow is invisible to the unit suite by construction. This spec runs the genuine served
 * app in a genuine browser and reads back real geometry instead.
 *
 * The tune index is seeded directly into `localStorage`, in the exact shape and under the exact key
 * `LocalStorageTuneIndexStorage` itself writes (see `tune-index-storage.ts`, `tune-index.model.ts`),
 * so which moments a snap can reach is deterministic rather than whatever a bundled tune's real audio
 * happens to trip the novelty detector on — detector behaviour against realistic, clustered audio is
 * already covered by `marker-moments.spec.ts`. What that jsdom spec cannot cover is whether the
 * resulting percentages render, in a real box model, where the snap arithmetic says they should.
 */

const TUNE_LABEL = 'InSID3 Out — Divertigo';
// Both bundled tunes carry `songs: 1, startSong: 1` in their PSID header (checked against the raw
// bytes at the header's own offsets 0x0e/0x10) — the subtune this spec loads is always `1`.
const TUNE_SUBTUNE = 1;
const TUNE_INDEX_STORAGE_KEY = `teensyrom_dj_tune_index_${TUNE_LABEL}:${TUNE_SUBTUNE}`;

// Absolute frames, well inside even a conservative nudge range (±~50 frames, a 1x PAL tune's
// 1-second window), and with nothing seeded below frame 10 — comfortably past the tiny frame the
// marker below actually captures at (see `capturedStartFrame`), so the previous-moment control is
// also provably disabled at the very start of the captured window.
const SEEDED_MOMENT_FRAMES = [10, 25, 45] as const;

/** Widths that keep the DJ Poc grid's five columns side by side — mirrors `SIDE_BY_SIDE_WIDTHS` in
 *  `dj-poc-responsive.cy.ts`, the range the phase plan means by "the page's own two-deck layout". */
const SIDE_BY_SIDE_WIDTHS = [1500, 1240, 999] as const;

/** Mirrors `TuneIndexRecord` (`tune-index.model.ts`) field-for-field without importing it — this e2e
 *  app drives the served build through the DOM only, the same arm's-length relationship every other
 *  spec here keeps with the app's own source. */
interface SeededTuneIndexRecord {
  readonly filename: string;
  readonly subtune: number;
  readonly loopStartFrame: number | null;
  readonly loopPeriodFrames: number | null;
  readonly endedAtFrame: number | null;
  readonly sectionBoundaries: readonly number[];
  readonly detectedMoments: readonly { readonly frame: number; readonly strength: number }[];
  readonly tonic: number | null;
  readonly mode: 'major' | 'minor' | null;
  readonly camelot: string | null;
  readonly tuningReferenceHz: number | null;
  readonly tuningCents: number | null;
  readonly keyConfidence: 'strong' | 'weak' | 'none';
  readonly scalePitchClasses: readonly number[];
  readonly dominantIntervalFrames: number | null;
  readonly pulseConfidence: 'strong' | 'weak' | 'none';
  readonly nativeTempo: number | null;
  readonly callsPerFrame: number;
  readonly exactCallsPerFrame: number;
  readonly timingMode: 'exact' | 'rounded';
  readonly formatVersion: number;
  readonly computedAt: string;
}

function seededRecord(): SeededTuneIndexRecord {
  return {
    filename: TUNE_LABEL,
    subtune: TUNE_SUBTUNE,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: SEEDED_MOMENT_FRAMES.map((frame) => ({ frame, strength: 0.9 })),
    tonic: null,
    mode: null,
    camelot: null,
    tuningReferenceHz: null,
    tuningCents: null,
    keyConfidence: 'none',
    scalePitchClasses: [],
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact',
    // Must match `TUNE_INDEX_FORMAT_VERSION` (`tune-index.model.ts`) or the app discards this seed as
    // stale and falls back to a real background scan instead of the deterministic moments above.
    formatVersion: 3,
    computedAt: new Date().toISOString(),
  };
}

/** The captured marker's own frame readout, as a number — read back from the DOM rather than assumed,
 *  since exactly how many frames elapse between the transport reset and the capture click is real
 *  browser timing, not something this spec controls. */
function capturedStartFrame(): Cypress.Chainable<number> {
  return cy
    .get('[aria-label="Trigger marker 1 deck A"]')
    .closest('.marker-row')
    .find('.marker-slot')
    .first()
    .find('.marker-frame')
    .invoke('text')
    .then((text) => Number(text.replace('frame', '').trim()));
}

/** True once every direct child of `.marker-slot` sits on the track's own single flex line — a child
 *  that actually wrapped lands a full line below the rest, not merely a pixel or two off from
 *  `align-items: center` rounding between controls of different heights. */
function assertSingleLine(slot: JQuery<HTMLElement>): void {
  const centers = [...slot[0].children].map((child) => {
    const rect = (child as HTMLElement).getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  const spread = Math.max(...centers) - Math.min(...centers);
  expect(spread, 'every marker-slot child stays on the row\'s one flex line').to.be.lessThan(6);
}

describe('DJ Poc marker rows — real-browser tick alignment and reflow', () => {
  beforeEach(() => {
    cy.viewport(SIDE_BY_SIDE_WIDTHS[0], 900);
    cy.visit('/dev/dj-poc', {
      onBeforeLoad(win) {
        win.localStorage.setItem(TUNE_INDEX_STORAGE_KEY, JSON.stringify(seededRecord()));
      },
    });
    cy.get('lib-deck-host').should('have.length', 2);

    cy.get(`[aria-label="${TUNE_LABEL} deck A"]`).click();
    // Resets the position counter to 0 (`DjPlayerEngine.stop()`), the command right before the
    // capture below, so the marker lands close to frame 0 regardless of whether the tune's own
    // autoplay had already ticked a few frames forward by the time this click lands.
    cy.get('[aria-label="Stop deck A"]').click();
    cy.get('[aria-label="Add marker deck A"]').click();
  });

  it('renders the start nudge ticks exactly where a snap actually lands', () => {
    cy.viewport(999, 900);

    capturedStartFrame().then((capturedFrame) => {
      expect(capturedFrame, 'the marker captured close to the stopped transport').to.be.lessThan(
        SEEDED_MOMENT_FRAMES[0]
      );

      cy.get('[aria-label="Snap marker 1 start to previous moment deck A"]').should('be.disabled');
      cy.get('[aria-label="Nudge marker 1 start deck A"]').closest('.marker-nudge').as('track');
      cy.get('@track').find('.marker-tick').should('have.length.greaterThan', 0);

      cy.get('[aria-label="Snap marker 1 start to next moment deck A"]').click();

      const expectedOffset = SEEDED_MOMENT_FRAMES[0] - capturedFrame;
      cy.get('[aria-label="Nudge marker 1 start deck A"]')
        .should('have.prop', 'value', String(expectedOffset))
        .invoke('prop', 'max')
        .then((maxAttr) => {
          const range = Number(maxAttr);
          const expectedPercent = ((expectedOffset + range) / (2 * range)) * 100;

          cy.get('@track').then(($track) => {
            const trackRect = $track[0].getBoundingClientRect();
            const expectedLeft = trackRect.left + (expectedPercent / 100) * trackRect.width;
            const distances = [...$track[0].querySelectorAll<HTMLElement>('.marker-tick')].map(
              (tick) => Math.abs(tick.getBoundingClientRect().left - expectedLeft)
            );
            expect(
              Math.min(...distances),
              'a real tick sits, in rendered pixels, at the exact spot the snap landed on'
            ).to.be.lessThan(2);
          });
        });
    });

    cy.screenshot('marker-tick-alignment-narrow');
  });

  SIDE_BY_SIDE_WIDTHS.forEach((width) => {
    it(`does not reflow a captured row's marker-slot at ${width}px wide`, () => {
      cy.viewport(width, 900);
      cy.get('[aria-label="Trigger marker 1 deck A"]')
        .closest('.marker-row')
        .find('.marker-slot')
        .first()
        .then(($slot) => assertSingleLine($slot));
    });

    it(`does not reflow an empty row's placeholder marker-slot at ${width}px wide`, () => {
      cy.viewport(width, 900);
      cy.get('[aria-label="Add marker deck A"]').click();
      cy.get('[aria-label="Clear marker 2 deck A"]').click();
      cy.get('[aria-label="Capture cue 2 deck A"]')
        .closest('.marker-row')
        .find('.marker-slot')
        .first()
        .then(($slot) => assertSingleLine($slot));
    });
  });

  it('captures the two-deck layout at its narrowest side-by-side width for visual record', () => {
    cy.viewport(999, 900);
    cy.screenshot('marker-rows-narrow-two-deck-layout');
  });
});
