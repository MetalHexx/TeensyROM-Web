import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { MidiInputMessage } from '@teensyrom-nx/application';
import { MidiAccessService } from './midi-access.service';
import { MidiInputService } from './midi-input.service';

type OpenBehavior = 'opens' | 'rejects' | 'stays-closed';

interface FakeInput {
  id: string;
  name: string | null;
  manufacturer: string | null;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onmidimessage: ((event: { data: Uint8Array | null; timeStamp?: number }) => void) | null;
}

function makeInput(
  id: string,
  options: { state?: 'connected' | 'disconnected'; behavior?: OpenBehavior } = {}
): FakeInput {
  const { state = 'connected', behavior = 'opens' } = options;
  const input: FakeInput = {
    id,
    name: `Controller ${id}`,
    manufacturer: 'Acme',
    state,
    connection: 'closed',
    open: vi.fn(() => {
      if (behavior === 'rejects') {
        return Promise.reject(new Error('InvalidAccessError'));
      }
      if (behavior === 'opens') {
        input.connection = 'open';
      }
      return Promise.resolve(input);
    }),
    close: vi.fn(() => {
      input.connection = 'closed';
      return Promise.resolve(input);
    }),
    onmidimessage: null,
  };
  return input;
}

function stubRequestMidiAccess(inputs: FakeInput[]): void {
  const access = {
    inputs: new Map(inputs.map((input) => [input.id, input])),
    outputs: new Map(),
    onstatechange: null,
  };
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(access),
  });
}

const EVENT_TIME = 1234.5;

function send(input: FakeInput, ...bytes: number[]): void {
  input.onmidimessage?.({ data: Uint8Array.from(bytes), timeStamp: EVENT_TIME });
}

describe('MidiInputService', () => {
  let service: MidiInputService;
  let access: MidiAccessService;
  let received: MidiInputMessage[];

  async function setUp(inputs: FakeInput[]): Promise<void> {
    stubRequestMidiAccess(inputs);
    await access.requestAccess();
    received = [];
    service.subscribe((message) => received.push(message));
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.configureTestingModule({});
    access = TestBed.inject(MidiAccessService);
    service = TestBed.inject(MidiInputService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  describe('inputs', () => {
    it('is empty until MIDI access is granted, then lists every input and never opens one', async () => {
      const pad = makeInput('pad');
      const knobs = makeInput('knobs', { state: 'disconnected' });
      expect(service.inputs()).toEqual([]);

      await setUp([pad, knobs]);

      expect(service.inputs().map((port) => [port.id, port.connected])).toEqual([
        ['pad', true],
        ['knobs', false],
      ]);
      expect(pad.open).not.toHaveBeenCalled();
      expect(pad.onmidimessage).toBeNull();
    });
  });

  describe('open', () => {
    it('is missing before access is granted and for an unknown or disconnected input', async () => {
      expect(await service.open('pad')).toBe('missing');

      await setUp([makeInput('unplugged', { state: 'disconnected' })]);

      expect(await service.open('nope')).toBe('missing');
      expect(await service.open('unplugged')).toBe('missing');
      expect(service.isOpen('unplugged')).toBe(false);
    });

    it('opens a connected input and starts delivery', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);

      expect(await service.open('pad')).toBe('open');

      expect(service.isOpen('pad')).toBe(true);
      send(pad, 0x90, 60, 100);
      expect(received).toHaveLength(1);
    });

    it('is unavailable, without rejecting, when the browser refuses to open the port', async () => {
      const pad = makeInput('pad', { behavior: 'rejects' });
      await setUp([pad]);

      await expect(service.open('pad')).resolves.toBe('unavailable');

      expect(service.isOpen('pad')).toBe(false);
      expect(pad.onmidimessage).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('is unavailable when open() resolves but the connection stays closed', async () => {
      const pad = makeInput('pad', { behavior: 'stays-closed' });
      await setUp([pad]);

      expect(await service.open('pad')).toBe('unavailable');

      expect(service.isOpen('pad')).toBe(false);
      expect(pad.onmidimessage).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('is a no-op on a port that is already open', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');
      const handler = pad.onmidimessage;

      expect(await service.open('pad')).toBe('open');

      expect(pad.open).toHaveBeenCalledTimes(1);
      expect(pad.onmidimessage).toBe(handler);
    });

    it('opens only the port it was asked for', async () => {
      const pad = makeInput('pad');
      const knobs = makeInput('knobs');
      await setUp([pad, knobs]);

      await service.open('pad');

      expect(knobs.open).not.toHaveBeenCalled();
      expect(knobs.onmidimessage).toBeNull();
    });
  });

  describe('close', () => {
    it('stops delivery, releases the port and forgets it', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');

      service.close('pad');

      expect(pad.onmidimessage).toBeNull();
      expect(pad.close).toHaveBeenCalledTimes(1);
      expect(service.isOpen('pad')).toBe(false);
    });

    it('is idempotent, and a no-op for a port that was never opened', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');

      service.close('pad');
      service.close('pad');
      service.close('never-opened');

      expect(pad.close).toHaveBeenCalledTimes(1);
    });

    it('logs rather than throws when the browser fails to close the port', async () => {
      const pad = makeInput('pad');
      pad.close.mockImplementation(() => Promise.reject(new Error('boom')));
      await setUp([pad]);
      await service.open('pad');

      expect(() => service.close('pad')).not.toThrow();
      await Promise.resolve();

      expect(console.warn).toHaveBeenCalled();
    });

    it('can be reopened after closing', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');
      service.close('pad');

      expect(await service.open('pad')).toBe('open');

      send(pad, 0x90, 60, 100);
      expect(received).toHaveLength(1);
    });
  });

  describe('isOpen', () => {
    it('turns false when the port stops reporting itself open, such as after an unplug', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');

      pad.connection = 'pending';

      expect(service.isOpen('pad')).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('delivers to every listener until it unsubscribes', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');
      const second: MidiInputMessage[] = [];
      const unsubscribe = service.subscribe((message) => second.push(message));

      send(pad, 0x90, 60, 100);
      unsubscribe();
      send(pad, 0x90, 61, 100);

      expect(received.map((message) => message.number)).toEqual([60, 61]);
      expect(second.map((message) => message.number)).toEqual([60]);
    });

    it('keeps delivering to the other listeners when one throws, and logs the failure', async () => {
      const pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');
      const throwing = vi.fn(() => {
        throw new Error('listener failed');
      });
      service.subscribe(throwing);
      const after: MidiInputMessage[] = [];
      service.subscribe((message) => after.push(message));

      expect(() => send(pad, 0x90, 60, 100)).not.toThrow();

      expect(throwing).toHaveBeenCalledTimes(1);
      expect(received).toHaveLength(1);
      expect(after).toHaveLength(1);
      expect(console.error).toHaveBeenCalled();
    });

    it('tags each message with the port it came from', async () => {
      const pad = makeInput('pad');
      const knobs = makeInput('knobs');
      await setUp([pad, knobs]);
      await service.open('pad');
      await service.open('knobs');

      send(pad, 0x90, 60, 100);
      send(knobs, 0xb0, 7, 90);

      expect(received.map((message) => message.portId)).toEqual(['pad', 'knobs']);
    });
  });

  describe('decoding', () => {
    let pad: FakeInput;

    beforeEach(async () => {
      pad = makeInput('pad');
      await setUp([pad]);
      await service.open('pad');
    });

    it.each([
      {
        label: 'note-on',
        bytes: [0x90, 60, 100],
        expected: { kind: 'note', channel: 1, number: 60, value: 100, pressed: true },
      },
      {
        label: 'note-on with velocity 0 as a release',
        bytes: [0x90, 60, 0],
        expected: { kind: 'note', channel: 1, number: 60, value: 0, pressed: false },
      },
      {
        label: 'note-off, ignoring its release velocity',
        bytes: [0x80, 60, 64],
        expected: { kind: 'note', channel: 1, number: 60, value: 0, pressed: false },
      },
      {
        label: 'CC at the pressed threshold',
        bytes: [0xb0, 20, 64],
        expected: { kind: 'cc', channel: 1, number: 20, value: 64, pressed: true },
      },
      {
        label: 'CC just below the pressed threshold',
        bytes: [0xb0, 20, 63],
        expected: { kind: 'cc', channel: 1, number: 20, value: 63, pressed: false },
      },
      {
        label: 'CC at full range',
        bytes: [0xb0, 127, 127],
        expected: { kind: 'cc', channel: 1, number: 127, value: 127, pressed: true },
      },
      {
        label: 'channel 16, one-based',
        bytes: [0x9f, 36, 1],
        expected: { kind: 'note', channel: 16, number: 36, value: 1, pressed: true },
      },
      {
        label: 'a status followed by more than the two data bytes',
        bytes: [0xb2, 7, 100, 0],
        expected: { kind: 'cc', channel: 3, number: 7, value: 100, pressed: true },
      },
      {
        label: 'pitch bend at centre as not pressed',
        bytes: [0xe0, 0, 64],
        expected: { kind: 'pitch-bend', channel: 1, number: 0, value: 8192, pressed: false },
      },
      {
        label: 'pitch bend at its lowest',
        bytes: [0xe0, 0, 0],
        expected: { kind: 'pitch-bend', channel: 1, number: 0, value: 0, pressed: true },
      },
      {
        label: 'pitch bend at its highest',
        bytes: [0xe0, 127, 127],
        expected: { kind: 'pitch-bend', channel: 1, number: 0, value: 16383, pressed: true },
      },
      {
        label: 'pitch bend with the low byte first',
        bytes: [0xe0, 1, 64],
        expected: { kind: 'pitch-bend', channel: 1, number: 0, value: 8193, pressed: true },
      },
      {
        label: 'pitch bend on channel 5',
        bytes: [0xe4, 0, 100],
        expected: { kind: 'pitch-bend', channel: 5, number: 0, value: 12800, pressed: true },
      },
    ])('decodes $label', ({ bytes, expected }) => {
      send(pad, ...bytes);

      expect(received).toEqual([{ portId: 'pad', timeStampMs: EVENT_TIME, ...expected }]);
    });

    it('falls back to the performance clock when the event has no timestamp', () => {
      vi.spyOn(performance, 'now').mockReturnValue(777);

      pad.onmidimessage?.({ data: Uint8Array.from([0x90, 60, 100]) });

      expect(received.map((message) => message.timeStampMs)).toEqual([777]);
    });

    it.each([
      { label: 'SysEx', bytes: [0xf0, 0x2d, 0x01, 0xf7] },
      { label: 'timing clock', bytes: [0xf8, 0, 0] },
      { label: 'active sensing', bytes: [0xfe, 0, 0] },
      { label: 'program change', bytes: [0xc0, 5, 0] },
      { label: 'polyphonic aftertouch', bytes: [0xa0, 60, 50] },
      { label: 'channel pressure', bytes: [0xd0, 50, 0] },
      { label: 'a message shorter than 3 bytes', bytes: [0x90, 60] },
      { label: 'an empty message', bytes: [] },
      { label: 'running-status data with no status byte', bytes: [0x3c, 0x64, 0x00] },
      { label: 'a first data byte with the high bit set', bytes: [0x90, 0x80, 100] },
      { label: 'a second data byte with the high bit set', bytes: [0xb0, 20, 0x90] },
      { label: 'a pitch bend data byte with the high bit set', bytes: [0xe0, 0, 0x90] },
    ])('drops $label', ({ bytes }) => {
      send(pad, ...bytes);

      expect(received).toEqual([]);
    });

    it('drops a message with no data', () => {
      pad.onmidimessage?.({ data: null });

      expect(received).toEqual([]);
    });
  });
});
