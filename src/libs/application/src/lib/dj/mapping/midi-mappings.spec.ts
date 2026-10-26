import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logWarn } from '@teensyrom-nx/utils';
import type { ControlMappingRecord, MidiSettingsRecord } from '../ports';
import type { ControlIdentity, MappingStyle } from './mapping.models';
import {
  EMPTY_SETTINGS,
  LAUNCH_CONTROL,
  ccSource,
  noteSource,
  setUpMappingHarness,
  type MappingHarness,
} from './testing/mapping-harness';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

const SPEED_A: ControlIdentity = { owner: 'A', control: 'speed' };
const SPEED_B: ControlIdentity = { owner: 'B', control: 'speed' };
const KEY_B: ControlIdentity = { owner: 'B', control: 'key' };
const LOOP_SELECT_A: ControlIdentity = { owner: 'A', control: 'loop-select' };
const PLAY_A: ControlIdentity = { owner: 'A', control: 'play-pause' };
const REPEAT_A: ControlIdentity = { owner: 'A', control: 'repeat' };
const HOLD_1_A: ControlIdentity = { owner: 'A', control: 'voice-1-hold' };

const style = (kind: MappingStyle['kind'], amount: number | null = null): MappingStyle => ({
  kind,
  amount,
});

const record = (id: string, number: number, owner: string, control: string): ControlMappingRecord =>
  ({
    id,
    source: ccSource(number),
    owner,
    control,
    style: style('absolute'),
  } as ControlMappingRecord);

const SAVED: MidiSettingsRecord = {
  controllers: [
    { id: LAUNCH_CONTROL, name: 'Launch Control XL', lastPortId: 'port-1', listening: true },
  ],
  mappings: [record('m1', 7, 'A', 'speed'), record('m2', 8, 'B', 'speed')],
  deckBindings: [],
};

describe('MidiMappings', () => {
  let h: MappingHarness;

  function setUp(settings: MidiSettingsRecord = EMPTY_SETTINGS): void {
    TestBed.resetTestingModule();
    h = setUpMappingHarness(settings);
    h.makeShapeable('A');
  }

  async function saved(): Promise<MidiSettingsRecord> {
    await vi.advanceTimersByTimeAsync(300);
    return h.repository.save.mock.calls.at(-1)?.[0] as MidiSettingsRecord;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logWarn).mockClear();
    setUp();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hydrate', () => {
    it('loads the saved controllers and mappings into the store and marks it loaded', async () => {
      setUp(SAVED);

      await h.mappings.hydrate();

      expect(h.mappingStore.loaded()).toBe(true);
      expect(h.mappingStore.controllers()).toEqual(SAVED.controllers);
      expect(h.mappingStore.mappings()).toEqual([
        { id: 'm1', source: ccSource(7), control: SPEED_A, style: style('absolute') },
        { id: 'm2', source: ccSource(8), control: SPEED_B, style: style('absolute') },
      ]);
    });

    it('drops, with a warning, a mapping whose control is not on the list', async () => {
      setUp({
        ...SAVED,
        mappings: [
          record('ok', 7, 'A', 'speed'),
          record('retired', 8, 'A', 'tape-speed'),
          record('misowned', 9, 'mixer', 'speed'),
        ],
      });

      await h.mappings.hydrate();

      expect(h.mappingStore.mappings().map((m) => m.id)).toEqual(['ok']);
      expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(2);
    });

    it('skips a saved mapping on a removed mixer control, keeps a key mapping, and saves only what remains', async () => {
      setUp({
        ...SAVED,
        mappings: [
          record('level', 7, 'A', 'level'),
          record('cutoff', 8, 'A', 'cutoff'),
          record('resonance', 9, 'B', 'resonance'),
          record('width', 10, 'B', 'pulse-width'),
          record('crossfader', 11, 'mixer', 'crossfader'),
          record('key', 12, 'B', 'key'),
        ],
      });

      await h.mappings.hydrate();
      h.mappings.bind(ccSource(20), SPEED_A, style('absolute'));

      expect(h.mappingStore.mappings().map((m) => m.control)).toEqual([KEY_B, SPEED_A]);
      expect((await saved()).mappings.map((m) => `${m.owner}:${m.control}`)).toEqual([
        'B:key',
        'A:speed',
      ]);
    });

    it('keeps the first mapping when two saved mappings share a source', async () => {
      setUp({
        ...SAVED,
        mappings: [record('first', 7, 'A', 'speed'), record('second', 7, 'B', 'speed')],
      });

      await h.mappings.hydrate();

      expect(h.mappingStore.mappings().map((m) => m.id)).toEqual(['first']);
    });

    it('runs once: a second call does not overwrite later changes', async () => {
      setUp(SAVED);
      await h.mappings.hydrate();
      h.mappings.remove('m1');

      await h.mappings.hydrate();

      expect(h.mappingStore.mappings().map((m) => m.id)).toEqual(['m2']);
    });

    it('lands an empty loaded store when the load fails, and never saves over the server', async () => {
      TestBed.resetTestingModule();
      h = setUpMappingHarness();
      h.repository.load.mockRejectedValue(new Error('offline'));

      await h.mappings.hydrate();
      h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));
      await vi.advanceTimersByTimeAsync(1000);

      expect(h.mappingStore.loaded()).toBe(true);
      expect(h.mappingStore.mappings()).toHaveLength(1);
      expect(h.repository.save).not.toHaveBeenCalled();
    });
  });

  describe('bind', () => {
    it('adds a mapping with a fresh id and saves it with the deck bindings', async () => {
      await h.mappings.hydrate();

      const { mapping, movedFrom } = h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));

      expect(movedFrom).toBeNull();
      expect(mapping.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(h.mappingStore.mappings()).toEqual([mapping]);
      expect(await saved()).toEqual({
        controllers: [],
        mappings: [
          {
            id: mapping.id,
            source: ccSource(7),
            owner: 'A',
            control: 'speed',
            style: style('absolute'),
          },
        ],
        deckBindings: [],
      });
    });

    it('returns an existing mapping unchanged when the source already drives that control', async () => {
      await h.mappings.hydrate();
      const first = h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));
      await saved();
      h.repository.save.mockClear();

      const again = h.mappings.bind(ccSource(7), SPEED_A, style('step', 0.1));

      expect(again.mapping).toBe(first.mapping);
      expect(again.movedFrom).toBeNull();
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.repository.save).not.toHaveBeenCalled();
    });

    it('moves a source that drives another control: the old mapping goes and the old control is reported', async () => {
      await h.mappings.hydrate();
      const first = h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));

      const moved = h.mappings.bind(ccSource(7), KEY_B, style('relative-offset', 0.02));

      expect(moved.movedFrom).toEqual(SPEED_A);
      expect(moved.mapping.id).not.toBe(first.mapping.id);
      expect(h.mappingStore.mappings()).toEqual([moved.mapping]);
    });

    it('lets a control keep several sources', async () => {
      await h.mappings.hydrate();

      h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));
      h.mappings.bind(ccSource(8), SPEED_A, style('absolute'));
      h.mappings.bind(noteSource(36), SPEED_A, style('step', 0.1));

      expect(h.mappingStore.mappingsForControl(SPEED_A)()).toHaveLength(3);
    });

    it('replaces a style the control cannot take from that source with the default, keeping amounts in range', async () => {
      await h.mappings.hydrate();

      const fromNote = h.mappings.bind(noteSource(36), SPEED_A, style('absolute'));
      const wide = h.mappings.bind(ccSource(7), KEY_B, style('relative-offset', 5));

      expect(fromNote.mapping.style).toEqual(style('step', 0.05));
      expect(wide.mapping.style).toEqual(style('relative-offset', 1));
    });

    it('refuses a control that is not on the list', async () => {
      await h.mappings.hydrate();

      expect(() =>
        h.mappings.bind(ccSource(7), { owner: 'mixer', control: 'speed' }, style('absolute'))
      ).toThrow(/not a mappable control/);
    });
  });

  describe('remove', () => {
    it('removes the mapping, announces it by control and owner, and saves', async () => {
      setUp(SAVED);
      await h.mappings.hydrate();

      h.mappings.remove('m1');

      expect(h.mappingStore.mappings().map((m) => m.id)).toEqual(['m2']);
      expect(h.mappingStore.announcement()).toBe('Binding deleted: Speed, deck A');
      expect((await saved()).mappings.map((m) => m.id)).toEqual(['m2']);
    });

    it('ignores an unknown id', async () => {
      setUp(SAVED);
      await h.mappings.hydrate();

      h.mappings.remove('nope');

      expect(h.mappingStore.mappings()).toHaveLength(2);
      expect(h.mappingStore.announcement()).toBeNull();
    });

    it("lets go of the mapping's hold before it goes", async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(noteSource(60), HOLD_1_A, style('hold'));
      h.engine.handle({ ...noteSource(60), value: 100, pressed: true });
      expect(h.djStore.deck('A')().voices[0].held).toBe(true);

      h.mappings.remove(mapping.id);

      expect(h.djStore.deck('A')().voices[0].held).toBe(false);
    });
  });

  describe('setStyle', () => {
    it('applies an available style, keeps its amount in range and saves', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));

      h.mappings.setStyle(mapping.id, style('relative-signed', 9));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('relative-signed', 1));
      expect((await saved()).mappings[0].style).toEqual(style('relative-signed', 1));
    });

    it('refuses a style the nature and source kind do not offer', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(noteSource(36), PLAY_A, style('press'));
      await saved();
      h.repository.save.mockClear();

      h.mappings.setStyle(mapping.id, style('absolute'));
      h.mappings.setStyle(mapping.id, style('latch'));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('press'));
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.repository.save).not.toHaveBeenCalled();
    });

    it('refuses absolute on the loop selection and keeps the style it had', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), LOOP_SELECT_A, style('relative-offset', 1));

      h.mappings.setStyle(mapping.id, style('absolute'));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('relative-offset', 1));
    });

    it.each([
      ['latch-release', REPEAT_A, null],
      ['on-release', REPEAT_A, null],
      ['off-release', REPEAT_A, null],
      ['step-release', KEY_B, 0.1],
    ] as const)('accepts %s on a control that can take it', async (kind, control, amount) => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(noteSource(36), control, style('release'));

      h.mappings.setStyle(mapping.id, style(kind, amount));

      expect(h.mappingStore.mappings()[0].style).toEqual(style(kind, amount));
    });

    it('refuses a release kind the control cannot take', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(noteSource(36), PLAY_A, style('press'));

      h.mappings.setStyle(mapping.id, style('latch-release'));
      h.mappings.setStyle(mapping.id, style('step-release', 0.1));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('press'));
    });

    it('drops the amount of a style that takes none', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), SPEED_A, style('relative-offset', 0.02));

      h.mappings.setStyle(mapping.id, style('absolute', 0.5));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('absolute'));
    });
  });

  describe('replaceSource', () => {
    it('moves a mapping to another source and keeps its style when the new source still offers it', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), KEY_B, style('step', 0.2));

      const result = h.mappings.replaceSource(mapping.id, noteSource(36), style('step', 0.5));

      expect(result?.movedFrom).toBeNull();
      expect(h.mappingStore.mappings()).toEqual([
        { id: mapping.id, source: noteSource(36), control: KEY_B, style: style('step', 0.2) },
      ]);
    });

    it('keeps a release kind when the mapping is learned onto another source', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(noteSource(36), REPEAT_A, style('on-release'));

      h.mappings.replaceSource(mapping.id, noteSource(37), style('latch'));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('on-release'));
    });

    it('uses the proposed style when the new source kind no longer offers the current one', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), KEY_B, style('absolute'));

      h.mappings.replaceSource(mapping.id, noteSource(36), style('step', 0.1));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('step', 0.1));
    });

    it('swaps a style the loop selection does not offer for the proposed one on a new source', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), LOOP_SELECT_A, style('relative-signed', 1));

      h.mappings.replaceSource(mapping.id, noteSource(36), style('absolute'));

      expect(h.mappingStore.mappings()[0].style).toEqual(style('step', 1));
    });

    it('applies the move rule: a source that drives another control is taken from it', async () => {
      await h.mappings.hydrate();
      const other = h.mappings.bind(ccSource(8), SPEED_A, style('absolute'));
      const { mapping } = h.mappings.bind(ccSource(7), KEY_B, style('absolute'));

      const result = h.mappings.replaceSource(mapping.id, ccSource(8), style('absolute'));

      expect(result?.movedFrom).toEqual(SPEED_A);
      expect(h.mappingStore.mappings().map((m) => m.id)).toEqual([mapping.id]);
      expect(h.mappingStore.mappings()[0].source).toEqual(ccSource(8));
      expect(h.mappingStore.mappingsForControl(SPEED_A)()).toEqual([]);
      expect(other.mapping.id).not.toBe(mapping.id);
    });

    it('leaves a mapping alone when its source is chosen again, and ignores an unknown id', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), KEY_B, style('absolute'));

      expect(h.mappings.replaceSource(mapping.id, ccSource(7), style('absolute'))?.mapping).toBe(
        mapping
      );
      expect(h.mappings.replaceSource('nope', ccSource(9), style('absolute'))).toBeNull();
    });

    it('saves the move', async () => {
      await h.mappings.hydrate();
      const { mapping } = h.mappings.bind(ccSource(7), KEY_B, style('absolute'));

      h.mappings.replaceSource(mapping.id, ccSource(9), style('absolute'));

      expect((await saved()).mappings[0].source).toEqual(ccSource(9));
    });
  });

  it('what is saved comes back on hydrate', async () => {
    await h.mappings.hydrate();
    h.mappings.bind(ccSource(7), SPEED_A, style('absolute'));
    h.mappings.bind(noteSource(36), KEY_B, style('step', 0.1));
    const settings = await saved();

    setUp(settings);
    await h.mappings.hydrate();

    expect(h.mappingStore.mappings().map((m) => [m.source, m.control, m.style])).toEqual([
      [ccSource(7), SPEED_A, style('absolute')],
      [noteSource(36), KEY_B, style('step', 0.1)],
    ]);
  });
});
