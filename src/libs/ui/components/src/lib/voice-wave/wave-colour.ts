/** A colour as the worker takes it: red, green and blue, each 0…255. */
export type WaveRgb = [number, number, number];

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^rgba?\(\s*([^)]*?)\s*\)$/i;
const CHANNEL = /^[+-]?(?:\d+\.?\d*|\.\d+)%?$/;

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function parseHex(text: string): WaveRgb | null {
  const match = HEX.exec(text);
  if (match === null) return null;
  const digits = match[1];
  const wide = digits.length > 4;
  const step = wide ? 2 : 1;
  const channel = (index: number): number => {
    const part = digits.slice(index * step, (index + 1) * step);
    return parseInt(wide ? part : part + part, 16);
  };
  return [channel(0), channel(1), channel(2)];
}

function parseFunctional(text: string): WaveRgb | null {
  const match = FUNCTIONAL.exec(text);
  if (match === null) return null;
  const parts = match[1].split(/\s*[,/]\s*|\s+/).filter((part) => part !== '');
  if (parts.length < 3 || parts.length > 4) return null;
  const channels: number[] = [];
  for (const part of parts.slice(0, 3)) {
    if (!CHANNEL.test(part)) return null;
    const value = parseFloat(part);
    channels.push(part.endsWith('%') ? (value / 100) * 255 : value);
  }
  return [clampChannel(channels[0]), clampChannel(channels[1]), clampChannel(channels[2])];
}

/**
 * Parses a CSS colour written as hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) or `rgb()`/`rgba()`
 * (comma or space separated, numbers or percentages) into a 0…255 triple; alpha is dropped. Any
 * other form, including named colours, gives `null`.
 */
export function parseWaveColour(css: string): WaveRgb | null {
  const text = css.trim();
  return parseHex(text) ?? parseFunctional(text);
}
