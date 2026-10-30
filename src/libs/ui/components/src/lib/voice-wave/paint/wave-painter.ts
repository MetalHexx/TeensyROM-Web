import { NOISE_RATE_HZ, waveSample } from '../model/wave-shape';
import type { WaveVoiceView, WaveWindowState } from '../model/wave-view';

/** The window's colours as 0…255 triples: the voice's trace colour and the dark glass it sits on. */
export interface WavePaintStyle {
  readonly trace: readonly [number, number, number];
  readonly glass: readonly [number, number, number];
}

/** The window's size in CSS pixels and the density to draw it at. */
export interface WavePaintSize {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
}

/** Builds an offscreen layer of the given size in device pixels. */
export type WaveLayerFactory = (width: number, height: number) => OffscreenCanvas;

/** About one trace sample per this many device pixels. */
const DEVICE_PIXELS_PER_SAMPLE = 2;
/** The trace uses this fraction of the half-height at full amplitude. */
const TRACE_HEIGHT = 0.82;
/** The trace fades to nothing over this fraction of the width at each edge. */
const EDGE_FADE = 0.07;
/** A held window is drawn dimmer, as the mockup's paused window is. */
const HELD_ALPHA = 0.6;

/** Stacked glow strokes, widest first: CSS pixels and alpha. */
const GLOW_WIDTH = 6;
const GLOW_ALPHA = 0.12;
const HALO_WIDTH = 3.5;
const HALO_ALPHA = 0.28;
const CORE_WIDTH = 1.7;
/** The core is the trace colour mixed this far toward white. */
const CORE_WHITE_MIX = 0.5;

const GLASS_TINT = 0.11;
const FLAT_LINE_WIDTH = 1.2;
const FLAT_LINE_MIX = 0.45;
const FLAT_LINE_GREY = 85;

function mix(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

function rgba(r: number, g: number, b: number, alpha: number): string {
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Draws one wave window in the house look: a dark glass window with a faint graticule, a centre
 * line and a scanline sheen, the voice's colour as the trace with a neon glow, the trace fading
 * toward the left and right edges.
 *
 * Serves one window: the three windows of a bank have three trace colours, so the worker host keeps
 * one painter per window. The static look (glass, graticule, centre line, sheen) is drawn once per
 * size, density and style into a layer from `createLayer` and blitted on every paint; the edge-fade
 * gradients are built with it from the layer's context, as a gradient is not tied to one context.
 * The sheen sits under the trace, a deliberate simplification of the mockup that keeps this to one
 * blit.
 *
 * The glow is two wide strokes of low alpha under the core stroke, composited additively, rather
 * than a per-frame `shadowBlur`, which is the expensive path on a canvas; the bench will say whether
 * it holds up against the mockup. The trace is sampled into a point buffer built with the layer and
 * reused, so a steady paint creates no objects.
 *
 * The noise step is this painter's own state, advanced from `timeMs` only while the pose is
 * `playing`; a `held` pose draws the view it is given and leaves the step where it was.
 */
export class WavePainter {
  private layer: OffscreenCanvas | null = null;
  private points = new Float32Array(0);
  private edgeGlow: CanvasGradient | null = null;
  private edgeCore: CanvasGradient | null = null;
  private flatLine = '';

  private builtWidth = -1;
  private builtHeight = -1;
  private builtDpr = -1;
  private readonly builtTrace = [-1, -1, -1];
  private readonly builtGlass = [-1, -1, -1];

  private noiseStep = 0;

  constructor(private readonly createLayer: WaveLayerFactory) {}

  paint(
    ctx: OffscreenCanvasRenderingContext2D,
    view: WaveVoiceView,
    pose: WaveWindowState,
    style: WavePaintStyle,
    size: WavePaintSize,
    timeMs: number
  ): void {
    const width = Math.max(1, Math.round(size.width * size.dpr));
    const height = Math.max(1, Math.round(size.height * size.dpr));
    if (this.needsRebuild(width, height, size.dpr, style))
      this.rebuild(width, height, size.dpr, style);
    if (pose === 'playing') this.noiseStep = Math.floor((timeMs * NOISE_RATE_HZ) / 1000);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.layer as OffscreenCanvas, 0, 0, width, height);

    if (pose === 'flat' || !view.sounding || view.amplitude <= 0) {
      this.drawFlat(ctx, width, height, size.dpr);
      return;
    }
    this.drawTrace(ctx, view, width, height, size.dpr, pose === 'held' ? HELD_ALPHA : 1);
  }

  private drawFlat(
    ctx: OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number
  ): void {
    const thickness = Math.max(1, Math.round(FLAT_LINE_WIDTH * dpr));
    ctx.fillStyle = this.flatLine;
    ctx.fillRect(0, Math.round((height - thickness) / 2), width, thickness);
  }

  private drawTrace(
    ctx: OffscreenCanvasRenderingContext2D,
    view: WaveVoiceView,
    width: number,
    height: number,
    dpr: number,
    alpha: number
  ): void {
    const points = this.points;
    const samples = points.length >> 1;
    const centre = height / 2;
    const reach = centre * TRACE_HEIGHT * view.amplitude;
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1);
      points[2 * i] = u * width;
      points[2 * i + 1] = centre - reach * waveSample(view, u, this.noiseStep);
    }

    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 1; i < samples; i++) ctx.lineTo(points[2 * i], points[2 * i + 1]);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = this.edgeGlow as CanvasGradient;
    ctx.lineWidth = GLOW_WIDTH * dpr;
    ctx.globalAlpha = GLOW_ALPHA * alpha;
    ctx.stroke();
    ctx.lineWidth = HALO_WIDTH * dpr;
    ctx.globalAlpha = HALO_ALPHA * alpha;
    ctx.stroke();
    ctx.strokeStyle = this.edgeCore as CanvasGradient;
    ctx.lineWidth = CORE_WIDTH * dpr;
    ctx.globalAlpha = alpha;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private needsRebuild(width: number, height: number, dpr: number, style: WavePaintStyle): boolean {
    const { trace, glass } = style;
    return (
      this.layer === null ||
      width !== this.builtWidth ||
      height !== this.builtHeight ||
      dpr !== this.builtDpr ||
      trace[0] !== this.builtTrace[0] ||
      trace[1] !== this.builtTrace[1] ||
      trace[2] !== this.builtTrace[2] ||
      glass[0] !== this.builtGlass[0] ||
      glass[1] !== this.builtGlass[1] ||
      glass[2] !== this.builtGlass[2]
    );
  }

  private rebuild(width: number, height: number, dpr: number, style: WavePaintStyle): void {
    const { trace, glass } = style;
    this.builtWidth = width;
    this.builtHeight = height;
    this.builtDpr = dpr;
    for (let i = 0; i < 3; i++) {
      this.builtTrace[i] = trace[i];
      this.builtGlass[i] = glass[i];
    }

    const layer = this.createLayer(width, height);
    const c = layer.getContext('2d');
    if (c === null) throw new Error('the wave layer has no 2d context');
    this.layer = layer;
    this.points = new Float32Array(2 * Math.max(2, Math.ceil(width / DEVICE_PIXELS_PER_SAMPLE)));
    this.drawStaticLayer(c, width, height, dpr, trace, glass);

    const core: [number, number, number] = [
      mix(trace[0], 255, CORE_WHITE_MIX),
      mix(trace[1], 255, CORE_WHITE_MIX),
      mix(trace[2], 255, CORE_WHITE_MIX),
    ];
    this.edgeGlow = edgeFade(c, width, trace);
    this.edgeCore = edgeFade(c, width, core);
    this.flatLine = rgba(
      mix(trace[0], FLAT_LINE_GREY, FLAT_LINE_MIX),
      mix(trace[1], FLAT_LINE_GREY, FLAT_LINE_MIX),
      mix(trace[2], FLAT_LINE_GREY, FLAT_LINE_MIX),
      1
    );
  }

  private drawStaticLayer(
    c: OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    dpr: number,
    trace: readonly [number, number, number],
    glass: readonly [number, number, number]
  ): void {
    const line = Math.max(1, Math.round(dpr));

    c.save();
    c.translate(width / 2, height / 2);
    c.scale(width / 2, height / 2);
    const glassGradient = c.createRadialGradient(0, 0, 0, 0, 0, 1.1);
    glassGradient.addColorStop(
      0,
      rgba(
        mix(glass[0], trace[0], GLASS_TINT),
        mix(glass[1], trace[1], GLASS_TINT),
        mix(glass[2], trace[2], GLASS_TINT),
        1
      )
    );
    glassGradient.addColorStop(1, rgba(glass[0], glass[1], glass[2], 1));
    c.fillStyle = glassGradient;
    c.fillRect(-1, -1, 2, 2);
    c.restore();

    c.fillStyle = 'rgba(255,255,255,0.055)';
    for (let i = 0; i < 4; i++) c.fillRect(0, Math.round((height * i) / 4), width, line);
    c.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 0; i < 8; i++) c.fillRect(Math.round((width * i) / 8), 0, line, height);

    c.fillStyle = 'rgba(255,255,255,0.14)';
    const centreY = Math.round((height - line) / 2);
    for (let x = 0; x < width; x += 7 * dpr)
      c.fillRect(Math.round(x), centreY, Math.round(2 * dpr), line);

    const sheen = c.createLinearGradient(0, 0, 0, height);
    sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
    c.fillStyle = sheen;
    c.fillRect(0, 0, width, height);
    c.fillStyle = 'rgba(0,0,0,0.26)';
    for (let y = 0; y < height; y += 3 * dpr) c.fillRect(0, Math.round(y), width, line);
  }
}

/** A horizontal gradient of one colour, transparent at both edges and opaque between the fades. */
function edgeFade(
  c: OffscreenCanvasRenderingContext2D,
  width: number,
  colour: readonly [number, number, number]
): CanvasGradient {
  const gradient = c.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, rgba(colour[0], colour[1], colour[2], 0));
  gradient.addColorStop(EDGE_FADE, rgba(colour[0], colour[1], colour[2], 1));
  gradient.addColorStop(1 - EDGE_FADE, rgba(colour[0], colour[1], colour[2], 1));
  gradient.addColorStop(1, rgba(colour[0], colour[1], colour[2], 0));
  return gradient;
}
