import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MidiOutputService } from './midi-output.service';
import { buildDisplayCharsPacket } from '../asid/asid-encoder';

const STORAGE_KEY = 'asid-dj-0.selected-midi-port';

interface FakeMidiOutput {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly send: (data: Uint8Array, timestamp?: number) => void;
}

interface FakeMidiAccess {
  outputs: Map<string, FakeMidiOutput>;
  onstatechange: ((e: unknown) => void) | null;
}

function makeOutput(id: string, name: string | null, manufacturer: string | null): FakeMidiOutput {
  return { id, name, manufacturer, send: vi.fn() };
}

function makeAccess(outputs: FakeMidiOutput[]): FakeMidiAccess {
  return { outputs: new Map(outputs.map((output) => [output.id, output])), onstatechange: null };
}

/** Replaces `navigator.requestMIDIAccess` for the duration of a test. `undefined` simulates a
 * browser (e.g. Safari) that never exposes the API at all. */
function stubRequestMidiAccess(impl: undefined | ((options?: { sysex?: boolean }) => Promise<FakeMidiAccess>)): void {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    writable: true,
    value: impl,
  });
}

describe('MidiOutputService', () => {
  let service: MidiOutputService;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    TestBed.configureTestingModule({ providers: [MidiOutputService] });
    service = TestBed.inject(MidiOutputService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stubRequestMidiAccess(undefined);
  });

  it('starts idle with no ports', () => {
    expect(service.accessState()).toBe('idle');
    expect(service.ports()).toEqual([]);
  });

  it('sets unsupported when the browser exposes no requestMIDIAccess', async () => {
    stubRequestMidiAccess(undefined);

    await service.requestAccess();

    expect(service.accessState()).toBe('unsupported');
    expect(service.ports()).toEqual([]);
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

  it('sets denied and a readable error when the permission prompt is rejected', async () => {
    stubRequestMidiAccess(() => Promise.reject(new Error('permission dismissed')));

    await service.requestAccess();

    expect(service.accessState()).toBe('denied');
    expect(typeof service.lastError()).toBe('string');
    expect(service.lastError()?.length).toBeGreaterThan(0);
  });

  it('clears the selection and sets lastError when the selected port disappears', async () => {
    const output = makeOutput('port-1', 'TeensyROM Cart', 'Acme');
    const access = makeAccess([output]);
    stubRequestMidiAccess(() => Promise.resolve(access));

    await service.requestAccess();
    service.selectPort('port-1');
    expect(service.selectedPortId()).toBe('port-1');

    access.outputs.delete('port-1');
    access.onstatechange?.({});

    expect(service.selectedPortId()).toBeNull();
    expect(service.lastError()).toBeTruthy();
  });

  it('round-trips the selected port through localStorage across a reload', async () => {
    const access = makeAccess([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
    stubRequestMidiAccess(() => Promise.resolve(access));

    await service.requestAccess();
    service.selectPort('port-1');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('port-1');

    // Simulate a reload: a fresh service instance reads the same localStorage.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MidiOutputService] });
    const reloaded = TestBed.inject(MidiOutputService);
    stubRequestMidiAccess(() => Promise.resolve(makeAccess([makeOutput('port-1', 'TeensyROM Cart', 'Acme')])));

    await reloaded.requestAccess();

    expect(reloaded.selectedPortId()).toBe('port-1');
  });

  it('does not restore a persisted selection when that port is no longer present', async () => {
    const firstAccess = makeAccess([makeOutput('port-1', 'TeensyROM Cart', 'Acme')]);
    stubRequestMidiAccess(() => Promise.resolve(firstAccess));
    await service.requestAccess();
    service.selectPort('port-1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MidiOutputService] });
    const reloaded = TestBed.inject(MidiOutputService);
    stubRequestMidiAccess(() => Promise.resolve(makeAccess([makeOutput('port-2', 'Different Cart', 'Acme')])));

    await reloaded.requestAccess();

    expect(reloaded.selectedPortId()).toBeNull();
  });

  it('warns and does not throw when send() is called with no port selected', () => {
    expect(() => service.send(Uint8Array.from([0xf0, 0x2d, 0xf7]))).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it('forwards bytes to the selected output when send() is called', async () => {
    const output = makeOutput('port-1', 'TeensyROM Cart', 'Acme');
    const access = makeAccess([output]);
    stubRequestMidiAccess(() => Promise.resolve(access));

    await service.requestAccess();
    service.selectPort('port-1');

    const bytes = Uint8Array.from([0xf0, 0x2d, 0x4f, 0x41, 0xf7]);
    service.send(bytes);

    expect(output.send).toHaveBeenCalledTimes(1);
    expect(output.send).toHaveBeenCalledWith(bytes);
  });

  it('forwards timestampMs to the selected output send() when provided', async () => {
    const output = makeOutput('port-1', 'TeensyROM Cart', 'Acme');
    const access = makeAccess([output]);
    stubRequestMidiAccess(() => Promise.resolve(access));

    await service.requestAccess();
    service.selectPort('port-1');

    const bytes = Uint8Array.from([0xf0, 0x2d, 0x4f, 0x41, 0xf7]);
    service.send(bytes, 123);

    expect(output.send).toHaveBeenCalledWith(bytes, 123);
  });

  it('identify() sends the encoded display-chars packet to the selected output', async () => {
    const output = makeOutput('port-1', 'TeensyROM Cart', 'Acme');
    const access = makeAccess([output]);
    stubRequestMidiAccess(() => Promise.resolve(access));

    await service.requestAccess();
    service.selectPort('port-1');

    service.identify('TEST');

    expect(output.send).toHaveBeenCalledWith(buildDisplayCharsPacket('TEST'));
  });
});
