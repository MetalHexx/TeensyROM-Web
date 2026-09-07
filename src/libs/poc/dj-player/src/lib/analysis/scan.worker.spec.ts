import { describe, it, expect, afterEach, vi } from 'vitest';
import { handleScanRequest } from './scan.worker';
import type { ScanMessage, ScanResult } from './scan-runner';
import { scanTune } from './scan-tune';
import type { ScanOutput } from './scan-tune';
import { parseSidFile } from '@sidablist/core';
import type { SidFile } from '@sidablist/core';
import { decodeBundledTune } from '../sid/bundled';
import { STILL_TIME_BASE64 } from '../sid/bundled/still-time.sid';

/**
 * Counts every `runFrame()`/`initSubtune()` call across every `C64Machine` this file's code
 * creates — the same cross-instance visibility `C64Machine.prototype` spying gave before the class
 * became a factory-built, unexported internal. Reset with `.mockClear()` at the point a test wants
 * to start counting from.
 */
const { runFrameSpy, initSubtuneSpy } = vi.hoisted(() => ({
  runFrameSpy: vi.fn(),
  initSubtuneSpy: vi.fn(),
}));

vi.mock('@sidablist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sidablist/core')>();
  return {
    ...actual,
    createC64Machine: (
      ...args: Parameters<typeof actual.createC64Machine>
    ): ReturnType<typeof actual.createC64Machine> => {
      const machine = actual.createC64Machine(...args);
      return new Proxy(machine, {
        get(target, prop) {
          if (prop === 'runFrame') {
            return () => {
              runFrameSpy();
              return target.runFrame();
            };
          }
          if (prop === 'initSubtune') {
            return (song: number) => {
              initSubtuneSpy(song);
              return target.initSubtune(song);
            };
          }
          return Reflect.get(target, prop, target);
        },
      });
    },
  };
});

const RTS = 0x60;

/** INC $FB; LDA $FB; STA $D400; RTS — one write per call, to the same register every time. */
const COUNTER_PLAY = [0xe6, 0xfb, 0xa5, 0xfb, 0x8d, 0x00, 0xd4, RTS];

/** JMP $1010 — never returns, so the frame burns its whole cycle budget. */
const RUNAWAY_PLAY = [0x4c, 0x10, 0x10];

/**
 * A minimal tune: init at $1000 returns immediately, play at $1010 runs `playBytes`. Two subtunes,
 * because neither bundled tune has a second one to switch to, and cheap enough that a whole ladder
 * of it costs nothing.
 */
function tune(playBytes: readonly number[]): SidFile {
  const data = new Uint8Array(0x10 + playBytes.length);
  data[0] = RTS;
  data.set(playBytes, 0x10);
  return {
    format: 'PSID',
    version: 2,
    loadAddress: 0x1000,
    initAddress: 0x1000,
    playAddress: 0x1010,
    songs: 2,
    startSong: 1,
    speedFlags: 0,
    name: '',
    author: '',
    released: '',
    clock: 'pal',
    model: 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data,
  };
}

const counterTune = tune(COUNTER_PLAY);
const runawayTune = tune(RUNAWAY_PLAY);

const BUNDLED_BYTES = decodeBundledTune(STILL_TIME_BASE64);

/**
 * A fresh parse of the same bytes for every rung — the worker is handed a brand new `SidFile` object
 * each time, exactly as `postMessage`'s structured clone would hand it one. A session match that
 * leaned on the file would never recognise a rung as a deepening.
 */
function bundledTune(): SidFile {
  return parseSidFile(BUNDLED_BYTES.slice());
}

let lastId = 0;
let lastSession = 0;

function newSession(): number {
  return ++lastSession;
}

function drive(file: SidFile, session: number, subtune: number, maxFrames: number): ScanMessage[] {
  const messages: ScanMessage[] = [];
  handleScanRequest({ id: ++lastId, session, file, subtune, maxFrames }, (message) =>
    messages.push(message)
  );
  return messages;
}

function terminalOf(messages: readonly ScanMessage[]): ScanResult {
  const terminal = messages.filter((message): message is ScanResult => message.kind !== 'progress');
  if (terminal.length !== 1) {
    throw new Error(`expected exactly one terminal message, got ${terminal.length}`);
  }
  return terminal[0];
}

function outputOf(messages: readonly ScanMessage[]): ScanOutput {
  const terminal = terminalOf(messages);
  if (terminal.kind === 'failed') {
    throw new Error(`expected a completed scan, got a failure: ${terminal.error}`);
  }
  return terminal.output;
}

describe('the scan worker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emulates each frame exactly once across a four-rung ladder over one session', () => {
    const session = newSession();
    const rungs = [40, 80, 120, 160];
    runFrameSpy.mockClear();
    initSubtuneSpy.mockClear();

    for (const maxFrames of rungs) {
      expect(outputOf(drive(bundledTune(), session, 1, maxFrames)).frames).toBe(maxFrames);
    }

    // The whole ladder costs one clean init and one pass over the deepest rung's frames.
    expect(initSubtuneSpy).toHaveBeenCalledTimes(1);
    expect(runFrameSpy).toHaveBeenCalledTimes(160);
  });

  it('deepened across rungs, answers with the scan a single deep request would have produced', () => {
    const session = newSession();
    for (const maxFrames of [30, 60, 90]) {
      drive(counterTune, session, 1, maxFrames);
    }
    const deepened = outputOf(drive(counterTune, session, 1, 120));

    expect(deepened).toEqual(scanTune(counterTune, 1, 120));
  });

  it('starts a clean scan when the session changes', () => {
    drive(counterTune, newSession(), 1, 30);
    runFrameSpy.mockClear();
    initSubtuneSpy.mockClear();

    const messages = drive(counterTune, newSession(), 1, 30);

    expect(initSubtuneSpy).toHaveBeenCalledTimes(1);
    expect(runFrameSpy).toHaveBeenCalledTimes(30);
    expect(outputOf(messages).frames).toBe(30);
  });

  it('starts a clean scan when the subtune changes under the same session', () => {
    const session = newSession();
    drive(counterTune, session, 1, 30);
    runFrameSpy.mockClear();
    initSubtuneSpy.mockClear();

    const messages = drive(counterTune, session, 2, 30);

    expect(initSubtuneSpy).toHaveBeenCalledWith(2);
    expect(runFrameSpy).toHaveBeenCalledTimes(30);
    expect(outputOf(messages).frames).toBe(30);
  });

  it('reports a cycle-budget failure as a message, and refuses to deepen the machine that failed', () => {
    const session = newSession();

    const failed = terminalOf(drive(runawayTune, session, 1, 5));
    if (failed.kind !== 'failed') {
      throw new Error('expected the runaway tune to blow its cycle budget');
    }
    expect(failed.error).toContain('exceeded its cycle budget');

    // Same session and subtune, so a held scan would be resumed — and this one would fail again on
    // the very next frame. It succeeds because the failure discarded it.
    expect(outputOf(drive(counterTune, session, 1, 10)).frames).toBe(10);
  });
});
