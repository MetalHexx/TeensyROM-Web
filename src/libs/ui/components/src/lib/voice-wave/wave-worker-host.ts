import { WaveBankModel } from './model/wave-bank-model';
import type { WaveVoice, WaveVoiceView, WaveWindowState } from './model/wave-view';
import { WavePainter, type WavePaintSize, type WavePaintStyle } from './paint/wave-painter';
import {
  WAVE_ENTRY_STRIDE,
  WAVE_FEED_MAX_ENTRIES,
  WAVE_HEADER_COUNT,
  WAVE_HEADER_DROPPED,
  WAVE_HEADER_LENGTH,
  WAVE_HEADER_RESTARTED,
} from './wave-feed-layout';
import type { MainToWorker, WaveWorkerScope } from './wave-protocol';

/** Windows are drawn no faster than this, whatever the display's refresh rate. */
export const WAVE_DRAW_INTERVAL_MS = 1000 / 60;

/** Frame timestamps jitter; a frame this much early still counts as on time, or a 60 Hz display would drop to 30. */
const FRAME_SLACK_MS = 1;

type AttachMessage = Extract<MainToWorker, { type: 'attach' }>;
type PaletteMessage = Extract<MainToWorker, { type: 'palette' }>;

interface Bank {
  readonly model: WaveBankModel;
  state: WaveWindowState;
  /** The frame this bank's model was last stepped in, so a frame steps it once. */
  steppedFrame: number;
}

interface Win {
  readonly id: number;
  readonly bank: Bank;
  readonly voice: WaveVoice;
  readonly canvas: OffscreenCanvas;
  readonly ctx: OffscreenCanvasRenderingContext2D;
  readonly painter: WavePainter;
  size: WavePaintSize;
  style: WavePaintStyle | null;
  visible: boolean;
  override: WaveWindowState | null;
  /** The pose last drawn; null when the picture is stale (new, resized, new colours, cleared). */
  drawnPose: WaveWindowState | null;
  /** Whether the last picture was a trace rather than a flat line. */
  drawnTrace: boolean;
}

function pixels(cssPixels: number, dpr: number): number {
  return Math.max(1, Math.round(cssPixels * dpr));
}

/** Whether a view paints as a trace (the painter draws any other view as the flat line). */
function traces(view: WaveVoiceView): boolean {
  return view.sounding && view.amplitude > 0;
}

/**
 * The testable heart of the wave worker: owns one model per bank and one painter per window, ingests
 * every delivery as it arrives, and draws the visible windows from the newest state.
 *
 * Ingest is lossless and immediate; drawing is latest-wins and runs from a single frame loop that is
 * only scheduled while there is something to draw. A visible window needs a draw when its picture is
 * stale or its pose changed, and, while playing, for as long as a trace is on screen or sounding. A
 * flat or held window is drawn once, and so is a playing window whose voice is silent (a flat line).
 * No window is drawn until a palette has arrived, and a window is not visible until told so.
 *
 * Everything comes in through `handle` and goes out through the scope. A thrown error posts one
 * `fault` and stops the host for good.
 */
export class WaveWorkerHost {
  private readonly banks = new Map<string, Bank>();
  private readonly windows: Win[] = [];

  private palette: PaletteMessage | null = null;
  private timeShift = 0;
  private reducedMotion = false;
  private suppressed = false;
  private faulted = false;

  private frameHandle: number | null = null;
  private frameNumber = 0;
  private lastDrawAt = Number.NEGATIVE_INFINITY;

  private draws = 0;
  private skipped = 0;
  private drawMsTotal = 0;
  private drawMsMax = 0;

  constructor(private readonly scope: WaveWorkerScope) {}

  handle(message: MainToWorker): void {
    if (this.faulted) return;
    try {
      this.dispatch(message);
    } catch (error) {
      this.fail(error);
    }
  }

  private dispatch(message: MainToWorker): void {
    switch (message.type) {
      case 'init':
        this.timeShift = this.scope.timeOrigin - message.mainTimeOrigin;
        break;
      case 'attach':
        this.attach(message);
        break;
      case 'detach':
        this.remove(message.id);
        break;
      case 'resize': {
        const win = this.find(message.id);
        if (win) {
          win.size = { width: message.width, height: message.height, dpr: message.dpr };
          win.drawnPose = null;
          this.wake();
        }
        break;
      }
      case 'visible': {
        const win = this.find(message.id);
        if (win) {
          win.visible = message.visible;
          this.wake();
        }
        break;
      }
      case 'override': {
        const win = this.find(message.id);
        if (win) {
          win.override = message.state;
          this.wake();
        }
        break;
      }
      case 'state':
        this.bankFor(message.bank).state = message.state;
        this.wake();
        break;
      case 'palette':
        this.palette = message;
        for (const win of this.windows) {
          win.style = this.styleFor(win.voice);
          win.drawnPose = null;
        }
        this.wake();
        break;
      case 'motion':
        this.reducedMotion = message.reduced;
        this.wake();
        break;
      case 'suppress':
        this.suppress(message.suppressed);
        break;
      case 'feed':
        this.ingest(message.bank, message.buffer);
        break;
      case 'stats':
        this.scope.post({
          type: 'stats',
          request: message.request,
          values: {
            draws: this.draws,
            skipped: this.skipped,
            meanDrawMs: this.draws === 0 ? 0 : this.drawMsTotal / this.draws,
            maxDrawMs: this.drawMsMax,
          },
        });
        break;
    }
  }

  private find(id: number): Win | undefined {
    for (const win of this.windows) if (win.id === id) return win;
    return undefined;
  }

  private remove(id: number): void {
    const win = this.find(id);
    if (win) this.windows.splice(this.windows.indexOf(win), 1);
  }

  private attach(message: AttachMessage): void {
    const ctx = message.canvas.getContext('2d');
    if (ctx === null) throw new Error('the wave canvas has no 2d context');
    this.remove(message.id);
    this.windows.push({
      id: message.id,
      bank: this.bankFor(message.bank),
      voice: message.voice,
      canvas: message.canvas,
      ctx,
      painter: new WavePainter((width, height) => this.scope.createLayer(width, height)),
      size: { width: message.width, height: message.height, dpr: message.dpr },
      style: this.styleFor(message.voice),
      visible: false,
      override: null,
      drawnPose: null,
      drawnTrace: false,
    });
  }

  private bankFor(name: string): Bank {
    let bank = this.banks.get(name);
    if (bank === undefined) {
      bank = { model: new WaveBankModel(), state: 'flat', steppedFrame: -1 };
      this.banks.set(name, bank);
    }
    return bank;
  }

  private styleFor(voice: WaveVoice): WavePaintStyle | null {
    return this.palette === null
      ? null
      : { trace: this.palette.voices[voice], glass: this.palette.glass };
  }

  /** Applies every entry of the feed in order, then hands the buffer back for reuse. */
  private ingest(bankName: string, buffer: Float64Array): void {
    const model = this.bankFor(bankName).model;
    if (buffer[WAVE_HEADER_RESTARTED] !== 0 || buffer[WAVE_HEADER_DROPPED] > 0) model.restart();
    const count = Math.min(buffer[WAVE_HEADER_COUNT], WAVE_FEED_MAX_ENTRIES);
    for (let i = 0; i < count; i++) {
      model.ingestEntry(buffer, WAVE_HEADER_LENGTH + i * WAVE_ENTRY_STRIDE);
    }
    this.scope.post({ type: 'recycle', bank: bankName, buffer }, [buffer.buffer]);
    this.wake();
  }

  private suppress(suppressed: boolean): void {
    if (suppressed === this.suppressed) return;
    this.suppressed = suppressed;
    if (!suppressed) {
      this.wake();
      return;
    }
    this.cancelFrame();
    for (const win of this.windows) {
      win.ctx.clearRect(0, 0, win.canvas.width, win.canvas.height);
      win.drawnPose = null;
      win.drawnTrace = false;
    }
  }

  /** The window's pose: its override, else its bank's state; reduced motion holds a playing window still. */
  private poseOf(win: Win): WaveWindowState {
    const pose = win.override ?? win.bank.state;
    return this.reducedMotion && pose === 'playing' ? 'held' : pose;
  }

  /** Schedules a frame if some visible window may need drawing and none is scheduled. */
  private wake(): void {
    if (this.frameHandle !== null || this.suppressed || this.faulted || this.palette === null) {
      return;
    }
    for (const win of this.windows) {
      if (!win.visible) continue;
      const pose = this.poseOf(win);
      if (pose === 'playing' || win.drawnPose !== pose) {
        this.frameHandle = this.scope.requestFrame(this.onFrame);
        return;
      }
    }
  }

  private cancelFrame(): void {
    if (this.frameHandle === null) return;
    this.scope.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private readonly onFrame = (): void => {
    this.frameHandle = null;
    if (this.faulted || this.suppressed) return;
    try {
      this.drawFrame();
    } catch (error) {
      this.fail(error);
    }
  };

  private drawFrame(): void {
    const now = this.scope.now();
    if (now - this.lastDrawAt + FRAME_SLACK_MS < WAVE_DRAW_INTERVAL_MS) {
      this.skipped++;
      this.wake();
      return;
    }

    const timeMs = now + this.timeShift;
    const frame = ++this.frameNumber;
    let drew = false;
    let moving = false;
    for (const win of this.windows) {
      const style = win.style;
      if (!win.visible || style === null) continue;

      const bank = win.bank;
      if (bank.steppedFrame !== frame) {
        bank.model.step(timeMs);
        bank.steppedFrame = frame;
      }
      const pose = this.poseOf(win);
      const view = bank.model.view(win.voice);
      if (win.drawnPose !== pose || (pose === 'playing' && (win.drawnTrace || traces(view)))) {
        this.paint(win, pose, view, style, timeMs);
        drew = true;
      }
      if (win.drawnTrace) moving = true;
    }

    if (drew) this.lastDrawAt = now;
    if (moving) this.frameHandle = this.scope.requestFrame(this.onFrame);
  }

  private paint(
    win: Win,
    pose: WaveWindowState,
    view: WaveVoiceView,
    style: WavePaintStyle,
    timeMs: number
  ): void {
    const { canvas, size } = win;
    const width = pixels(size.width, size.dpr);
    const height = pixels(size.height, size.dpr);
    // Assigning a canvas dimension clears the canvas, so only on a real change, and in the repainting frame.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const started = this.scope.now();
    win.painter.paint(win.ctx, view, pose, style, size, timeMs);
    const spent = this.scope.now() - started;

    this.draws++;
    this.drawMsTotal += spent;
    if (spent > this.drawMsMax) this.drawMsMax = spent;
    win.drawnPose = pose;
    win.drawnTrace = pose === 'playing' && traces(view);
  }

  private fail(error: unknown): void {
    if (this.faulted) return;
    this.faulted = true;
    this.cancelFrame();
    this.scope.post({
      type: 'fault',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
