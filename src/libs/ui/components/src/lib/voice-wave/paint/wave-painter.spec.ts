import { afterEach, describe, it, expect } from 'vitest';
import { WAVEFORM_NOISE, WAVEFORM_PULSE } from '../wave-feed-layout';
import type { WaveVoiceView } from '../model/wave-view';
import { WavePainter, type WavePaintSize, type WavePaintStyle } from './wave-painter';

/** Every call and property write on a context, in order; gradients and layers are recorded too. */
class RecordingContext {
  readonly calls: { name: string; args: unknown[] }[] = [];

  count(name: string): number {
    return this.calls.filter((call) => call.name === name).length;
  }

  clear(): void {
    this.calls.length = 0;
  }

  asContext(): OffscreenCanvasRenderingContext2D {
    return new Proxy(this, {
      get: (target, property: string) => {
        if (property in target) return (target as unknown as Record<string, unknown>)[property];
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
          return (...args: unknown[]) => {
            target.calls.push({ name: property, args });
            return { addColorStop: () => undefined };
          };
        }
        return (...args: unknown[]) => {
          target.calls.push({ name: property, args });
        };
      },
      set: () => true,
    }) as unknown as OffscreenCanvasRenderingContext2D;
  }
}

function harness() {
  const target = new RecordingContext();
  const layerContext = new RecordingContext();
  const layers: { width: number; height: number }[] = [];
  const painter = new WavePainter((width, height) => {
    layers.push({ width, height });
    return { getContext: () => layerContext.asContext() } as unknown as OffscreenCanvas;
  });
  return { target, layerContext, layers, painter, ctx: target.asContext() };
}

const STYLE: WavePaintStyle = { trace: [0, 247, 255], glass: [6, 9, 10] };
const SIZE: WavePaintSize = { width: 80, height: 44, dpr: 2 };

function view(over: Partial<WaveVoiceView> = {}): WaveVoiceView {
  return {
    amplitude: 0.8,
    cycles: 3,
    waveform: WAVEFORM_PULSE,
    duty: 0.5,
    syncCycles: 0,
    ringCycles: 0,
    sounding: true,
    ...over,
  };
}

/** The trace path's coordinates as one string, to compare pictures. */
function pathOf(context: RecordingContext): string {
  return context.calls
    .filter((call) => call.name === 'moveTo' || call.name === 'lineTo')
    .map((call) => call.args.join(','))
    .join(' ');
}

describe('WavePainter', () => {
  const realFloat32Array = globalThis.Float32Array;
  afterEach(() => {
    globalThis.Float32Array = realFloat32Array;
  });

  it('blits the static layer and strokes one trace path when playing', () => {
    const { painter, ctx, target, layers } = harness();

    painter.paint(ctx, view(), 'playing', STYLE, SIZE, 0);

    expect(layers).toEqual([{ width: 160, height: 88 }]);
    expect(target.count('drawImage')).toBe(1);
    expect(target.count('beginPath')).toBe(1);
    expect(target.count('stroke')).toBeGreaterThanOrEqual(2);
    expect(target.count('moveTo')).toBe(1);
  });

  it('uses the cheap glow: stacked strokes, no shadow blur', () => {
    const { painter, target } = harness();
    const writes: string[] = [];
    const watching = new Proxy(target.asContext(), {
      set: (context, property: string, value) => {
        writes.push(property);
        (context as unknown as Record<string, unknown>)[property] = value;
        return true;
      },
    });

    painter.paint(watching, view(), 'playing', STYLE, SIZE, 0);

    expect(writes).not.toContain('shadowBlur');
    expect(writes).toContain('globalCompositeOperation');
  });

  it('draws a flat pose as the centre line only, with no trace path', () => {
    const { painter, ctx, target } = harness();

    painter.paint(ctx, view(), 'flat', STYLE, SIZE, 0);

    expect(target.count('drawImage')).toBe(1);
    expect(target.count('stroke')).toBe(0);
    expect(target.count('beginPath')).toBe(0);
    expect(target.count('fillRect')).toBe(1);
  });

  it('draws a silent view flat even when asked to play', () => {
    const { painter, ctx, target } = harness();

    painter.paint(ctx, view({ sounding: false, amplitude: 0 }), 'playing', STYLE, SIZE, 0);

    expect(target.count('stroke')).toBe(0);
  });

  it('draws a held pose from the view it is given', () => {
    const { painter, ctx, target } = harness();

    painter.paint(ctx, view(), 'held', STYLE, SIZE, 0);

    expect(target.count('beginPath')).toBe(1);
    expect(target.count('stroke')).toBeGreaterThanOrEqual(2);
  });

  it('builds the static layer once and then creates no layers, gradients or buffers per paint', () => {
    const { painter, ctx, target, layers, layerContext } = harness();
    painter.paint(ctx, view(), 'playing', STYLE, SIZE, 0);
    const gradients =
      layerContext.count('createLinearGradient') + layerContext.count('createRadialGradient');
    let buffers = 0;
    globalThis.Float32Array = class extends realFloat32Array {
      constructor(...args: ConstructorParameters<typeof realFloat32Array>) {
        super(...args);
        buffers++;
      }
    } as typeof Float32Array;

    for (let i = 1; i <= 5; i++) {
      painter.paint(ctx, view(), i % 2 ? 'playing' : 'held', STYLE, SIZE, i * 20);
      painter.paint(ctx, view(), 'flat', STYLE, SIZE, i * 20);
    }

    expect(layers).toHaveLength(1);
    expect(
      layerContext.count('createLinearGradient') + layerContext.count('createRadialGradient')
    ).toBe(gradients);
    expect(target.count('createLinearGradient')).toBe(0);
    expect(buffers).toBe(0);
  });

  it.each([
    ['size', { ...SIZE, width: 90 }, STYLE],
    ['density', { ...SIZE, dpr: 1 }, STYLE],
    ['style', SIZE, { ...STYLE, trace: [179, 51, 179] as const }],
  ])('rebuilds the static layer when the %s changes', (_what, size, style) => {
    const { painter, ctx, layers } = harness();
    painter.paint(ctx, view(), 'playing', STYLE, SIZE, 0);

    painter.paint(ctx, view(), 'playing', style, size, 0);
    painter.paint(ctx, view(), 'playing', style, size, 0);

    expect(layers).toHaveLength(2);
  });

  it('keeps its noise step still while held and advances it only while playing', () => {
    const { painter, ctx, target } = harness();
    const noise = view({ waveform: WAVEFORM_NOISE });
    const draw = (pose: 'playing' | 'held', timeMs: number) => {
      target.clear();
      painter.paint(ctx, noise, pose, STYLE, SIZE, timeMs);
      return pathOf(target);
    };

    const first = draw('playing', 1000);
    const held = draw('held', 5000);
    const heldLater = draw('held', 9000);
    const advanced = draw('playing', 9000);

    expect(held).toBe(first);
    expect(heldLater).toBe(first);
    expect(advanced).not.toBe(first);
  });
});
