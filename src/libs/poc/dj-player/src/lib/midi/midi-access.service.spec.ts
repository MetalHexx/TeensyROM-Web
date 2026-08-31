import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MidiAccessService } from './midi-access.service';

interface FakeMidiOutput {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly send: (data: Uint8Array, timestamp?: number) => void;
  readonly clear?: () => void;
}

interface FakeMidiAccess {
  outputs: Map<string, FakeMidiOutput>;
  onstatechange: ((e: unknown) => void) | null;
}

/** `withClear` attaches a spy `clear()` — the unsupported path is the default, since that is the one
 *  the whole feature has to survive rather than merely benefit from. */
function makeOutput(
  id: string,
  name: string | null,
  manufacturer: string | null,
  withClear = false
): FakeMidiOutput {
  const output: FakeMidiOutput = { id, name, manufacturer, send: vi.fn() };
  return withClear ? { ...output, clear: vi.fn() } : output;
}

function makeAccess(outputs: FakeMidiOutput[]): FakeMidiAccess {
  return { outputs: new Map(outputs.map((output) => [output.id, output])), onstatechange: null };
}

/** Replaces `navigator.requestMIDIAccess` for the duration of a test. `undefined` simulates a
 * browser (e.g. Safari) that never exposes the API at all. */
function stubRequestMidiAccess(
  impl: undefined | ((options?: { sysex?: boolean }) => Promise<FakeMidiAccess>)
): void {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: impl,
  });
}

describe('MidiAccessService', () => {
  let service: MidiAccessService;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    TestBed.configureTestingModule({ providers: [MidiAccessService] });
    service = TestBed.inject(MidiAccessService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stubRequestMidiAccess(undefined);
  });

  it('starts idle with no ports', () => {
    expect(service.accessState()).toBe('idle');
    expect(service.ports()).toEqual([]);
  });

  it('sets unsupported and a non-null lastError when the browser exposes no requestMIDIAccess', async () => {
    stubRequestMidiAccess(undefined);

    await service.requestAccess();

    expect(service.accessState()).toBe('unsupported');
    expect(service.ports()).toEqual([]);
    expect(service.lastError()).toBeTruthy();
  });

  it('sets denied and a non-null lastError when the permission prompt is rejected', async () => {
    stubRequestMidiAccess(() => Promise.reject(new Error('permission dismissed')));

    await service.requestAccess();

    expect(service.accessState()).toBe('denied');
    expect(service.lastError()).toBeTruthy();
  });

  it('populates ports with name and manufacturer once SysEx access is granted', async () => {
    const access = makeAccess([
      makeOutput('port-1', 'TeensyROM Cart', 'Acme'),
      makeOutput('port-2', 'Other Output', 'Someone Else'),
    ]);
    stubRequestMidiAccess(() => Promise.resolve(access));

    await service.requestAccess();

    expect(service.accessState()).toBe('granted');
    expect(service.ports()).toEqual([
      { id: 'port-1', name: 'TeensyROM Cart', manufacturer: 'Acme' },
      { id: 'port-2', name: 'Other Output', manufacturer: 'Someone Else' },
    ]);
  });

  it('re-enumerates rather than re-prompting on a second call while already granted', async () => {
    const requestSpy = vi.fn(() => Promise.resolve(makeAccess([makeOutput('port-1', 'A', 'Acme')])));
    stubRequestMidiAccess(requestSpy);

    await service.requestAccess();
    expect(requestSpy).toHaveBeenCalledTimes(1);

    await service.requestAccess();

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(service.accessState()).toBe('granted');
    expect(service.ports()).toEqual([{ id: 'port-1', name: 'A', manufacturer: 'Acme' }]);
  });

  it('refreshes ports on a hot-plug event without a fresh requestAccess() call', async () => {
    const access = makeAccess([makeOutput('port-1', 'A', 'Acme')]);
    stubRequestMidiAccess(() => Promise.resolve(access));
    await service.requestAccess();

    access.outputs.set('port-2', makeOutput('port-2', 'B', 'Acme'));
    access.onstatechange?.({});

    expect(service.ports().map((port) => port.id)).toEqual(['port-1', 'port-2']);
  });

  describe('claims', () => {
    it('grants a claim on an unheld port and reports the holder', () => {
      expect(service.claim('A', 'port-1')).toBe(true);
      expect(service.deckHolding('port-1')).toBe('A');
    });

    it('refuses a claim on a port another deck already holds, in both directions', () => {
      expect(service.claim('A', 'port-1')).toBe(true);

      expect(service.claim('B', 'port-1')).toBe(false);
      expect(service.deckHolding('port-1')).toBe('A');

      expect(service.claim('B', 'port-2')).toBe(true);
      expect(service.claim('A', 'port-2')).toBe(false);
      expect(service.deckHolding('port-2')).toBe('B');
    });

    it('releases the claiming deck\'s previous claim once a new claim succeeds', () => {
      service.claim('A', 'port-1');

      service.claim('A', 'port-2');

      expect(service.deckHolding('port-1')).toBeNull();
      expect(service.deckHolding('port-2')).toBe('A');
    });

    it('release() drops the named deck\'s claim without touching another deck\'s', () => {
      service.claim('A', 'port-1');
      service.claim('B', 'port-2');

      service.release('A');

      expect(service.deckHolding('port-1')).toBeNull();
      expect(service.deckHolding('port-2')).toBe('B');
    });
  });

  describe('send / cancelPending / supportsCancel by port id', () => {
    it('forwards bytes to the named port, with and without a timestamp', async () => {
      const output = makeOutput('port-1', 'A', 'Acme');
      stubRequestMidiAccess(() => Promise.resolve(makeAccess([output])));
      await service.requestAccess();

      const bytes = Uint8Array.from([0xf0, 0x2d, 0xf7]);
      service.send('port-1', bytes);
      service.send('port-1', bytes, 123);

      expect(output.send).toHaveBeenNthCalledWith(1, bytes);
      expect(output.send).toHaveBeenNthCalledWith(2, bytes, 123);
    });

    it('warns and does not throw when send() names a port that is not a current output', () => {
      expect(() => service.send('missing', Uint8Array.from([0xf0]))).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('supportsCancel is true only for a port exposing clear(), never assumed from a browser check', async () => {
      const access = makeAccess([
        makeOutput('port-1', 'A', 'Acme', true),
        makeOutput('port-2', 'B', 'Acme', false),
      ]);
      stubRequestMidiAccess(() => Promise.resolve(access));
      await service.requestAccess();

      expect(service.supportsCancel('port-1')).toBe(true);
      expect(service.supportsCancel('port-2')).toBe(false);
      expect(service.supportsCancel('missing')).toBe(false);
    });

    it('cancelPending() calls the named port\'s clear() and reports true when it supports one', async () => {
      const output = makeOutput('port-1', 'A', 'Acme', true);
      stubRequestMidiAccess(() => Promise.resolve(makeAccess([output])));
      await service.requestAccess();

      expect(service.cancelPending('port-1')).toBe(true);
      expect(output.clear).toHaveBeenCalledTimes(1);
    });

    it('cancelPending() reports false rather than throwing when a detected clear() itself throws', async () => {
      const output = makeOutput('port-1', 'A', 'Acme', true);
      (output.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('boom');
      });
      stubRequestMidiAccess(() => Promise.resolve(makeAccess([output])));
      await service.requestAccess();

      let result: boolean | undefined;
      expect(() => {
        result = service.cancelPending('port-1');
      }).not.toThrow();
      expect(result).toBe(false);
    });
  });
});
