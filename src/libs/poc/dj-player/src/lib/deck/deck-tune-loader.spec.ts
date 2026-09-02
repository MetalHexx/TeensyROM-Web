import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DeckTuneLoader } from './deck-tune-loader';
import { DjPlayerEngine } from '../engine/dj-player-engine';
import { TuneIndexService } from '../analysis/tune-index.service';

const PSID_HEADER_SIZE = 0x7c;

/** A minimal well-formed PSID v2 file — enough for `parseSidFile` to accept without throwing. */
function validSidBytes(): Uint8Array {
  const payload = [0xa9, 0x00, 0x60];
  const buffer = new Uint8Array(PSID_HEADER_SIZE + payload.length);
  const view = new DataView(buffer.buffer);
  buffer.set([0x50, 0x53, 0x49, 0x44], 0x00); // 'PSID'
  view.setUint16(0x04, 2, false);
  view.setUint16(0x06, PSID_HEADER_SIZE, false);
  view.setUint16(0x08, 0x1000, false);
  view.setUint16(0x0a, 0x1000, false);
  view.setUint16(0x0c, 0x1003, false);
  view.setUint16(0x0e, 1, false);
  view.setUint16(0x10, 1, false);
  view.setUint32(0x12, 0, false);
  buffer.set(payload, PSID_HEADER_SIZE);
  return buffer;
}

interface FakeEngine {
  loadTune: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
}

interface FakeTuneIndex {
  setTune: ReturnType<typeof vi.fn>;
}

describe('DeckTuneLoader', () => {
  let loader: DeckTuneLoader;
  let engine: FakeEngine;
  let tuneIndex: FakeTuneIndex;
  let resolveSetTune: () => void;

  beforeEach(() => {
    engine = { loadTune: vi.fn(), play: vi.fn(() => Promise.resolve()) };
    // Held until the test resolves it, so the load-order assertion can observe `play()` withheld
    // for the whole span of the await — mirrors the view's own withheld-play suite.
    tuneIndex = {
      setTune: vi.fn(() => new Promise<void>((resolve) => (resolveSetTune = resolve))),
    };

    TestBed.configureTestingModule({
      providers: [
        DeckTuneLoader,
        { provide: DjPlayerEngine, useValue: engine as unknown as DjPlayerEngine },
        { provide: TuneIndexService, useValue: tuneIndex as unknown as TuneIndexService },
      ],
    });
    loader = TestBed.inject(DeckTuneLoader);
  });

  it('offers the bundled tunes up front', () => {
    expect(loader.availableTunes().length).toBeGreaterThan(0);
  });

  describe('selectTune', () => {
    it('loads the engine, then awaits the tune index, then plays — never out of that order', async () => {
      loader.selectTune({ id: 'auto', label: 'Auto tune', getBytes: validSidBytes });

      expect(engine.loadTune).toHaveBeenCalledTimes(1);
      expect(tuneIndex.setTune).toHaveBeenCalledTimes(1);
      expect(engine.play).not.toHaveBeenCalled();

      resolveSetTune();
      await Promise.resolve();
      await Promise.resolve();

      expect(engine.play).toHaveBeenCalledTimes(1);
    });

    it('passes the parsed file and the source label to the tune index', () => {
      loader.selectTune({ id: 'auto', label: 'Auto tune', getBytes: validSidBytes });

      expect(tuneIndex.setTune).toHaveBeenCalledWith(
        engine.loadTune.mock.calls[0][0],
        'Auto tune'
      );
    });

    it('sets a tune error and clears currentTune when the bytes do not parse, without touching the engine', () => {
      loader.selectTune({
        id: 'bad',
        label: 'Bad tune',
        getBytes: () => Uint8Array.from([1, 2, 3]),
      });

      expect(loader.tuneError()).toBeTruthy();
      expect(loader.currentTune()).toBeNull();
      expect(engine.loadTune).not.toHaveBeenCalled();
    });
  });

  describe('onFilePicked', () => {
    function pickedFileEvent(name: string, bytes: Uint8Array): Event {
      // jsdom's File has no working arrayBuffer(); a minimal stand-in is enough since only the
      // hand-off — not File parsing itself — is under test here.
      const file = { name, arrayBuffer: () => Promise.resolve(bytes.buffer) } as unknown as File;
      const input = { files: [file], value: 'stale.sid' } as unknown as HTMLInputElement;
      return { target: input } as unknown as Event;
    }

    it('adds the picked file to availableTunes and hands its own name to the tune index', async () => {
      const before = loader.availableTunes().length;

      const pending = loader.onFilePicked(pickedFileEvent('mytune.sid', validSidBytes()));
      await vi.waitFor(() => expect(tuneIndex.setTune).toHaveBeenCalled());
      resolveSetTune();
      await pending;

      expect(loader.availableTunes().length).toBe(before + 1);
      expect(tuneIndex.setTune).toHaveBeenCalledWith(
        engine.loadTune.mock.calls[0][0],
        'mytune.sid'
      );
    });

    it('clears the input value so the same file can be re-picked later in the session', async () => {
      const event = pickedFileEvent('mytune.sid', validSidBytes());
      const input = event.target as HTMLInputElement;

      const pending = loader.onFilePicked(event);
      expect(input.value).toBe('');

      await vi.waitFor(() => expect(tuneIndex.setTune).toHaveBeenCalled());
      resolveSetTune();
      await pending;
    });

    it('sets a tune error on an unparsable picked file, without adding it to availableTunes', async () => {
      const before = loader.availableTunes().length;

      await loader.onFilePicked(pickedFileEvent('bad.sid', Uint8Array.from([1, 2, 3])));

      expect(loader.tuneError()).toBeTruthy();
      expect(loader.availableTunes().length).toBe(before);
    });

    it('does nothing when no file was picked', async () => {
      const input = { files: [], value: '' } as unknown as HTMLInputElement;

      await loader.onFilePicked({ target: input } as unknown as Event);

      expect(engine.loadTune).not.toHaveBeenCalled();
    });
  });
});
