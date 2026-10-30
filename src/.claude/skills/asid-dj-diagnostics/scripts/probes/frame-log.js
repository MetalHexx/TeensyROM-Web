// Frame log — which frames the page asks for and gets, for SECONDS seconds: each frame's timestamp,
// the gap from the frame before, who asked (callback names: the deck loop's is `tick`), and when it
// was asked relative to the frame's own timestamp (negative = asked before that vsync). This is how
// to check the deck loop's cadence (`LivePaintPacer`): on a 100 Hz display, healthy is gaps of
// 30 ms, frames/s ≈ painting frames/s ≈ 33, and few 10 ms gaps (each one a frame woken too early
// and turned away).
//
// Paste into the console (or await it through Claude in Chrome's javascript_tool) with the loop
// playing; it restores requestAnimationFrame when done.
(async (SECONDS = 4) => {
  const inner = window.requestAnimationFrame;
  const log = [];
  window.requestAnimationFrame = function (callback) {
    const askedAt = performance.now();
    const name = callback.name || '(anonymous)';
    return inner.call(window, (time) => {
      log.push({ time, ranAt: performance.now(), name, askedAt });
      callback(time);
    });
  };
  await new Promise((resolve) => setTimeout(resolve, SECONDS * 1000));
  window.requestAnimationFrame = inner;

  const frames = new Map();
  for (const entry of log) {
    const frame = frames.get(entry.time) ?? { time: entry.time, ranAt: entry.ranAt, names: [], asked: [] };
    frame.names.push(entry.name);
    frame.asked.push(+(entry.askedAt - entry.time).toFixed(1));
    frames.set(entry.time, frame);
  }
  const list = [...frames.values()].sort((a, b) => a.time - b.time);
  const gaps = {};
  for (let i = 1; i < list.length; i++) {
    const gap = Math.round((list[i].time - list[i - 1].time) / 5) * 5;
    gaps[gap] = (gaps[gap] ?? 0) + 1;
  }
  const callbacks = {};
  for (const entry of log) {
    callbacks[entry.name] = (callbacks[entry.name] ?? 0) + 1;
  }
  return {
    framesPerSec: +(list.length / SECONDS).toFixed(1),
    callbacksPerSec: Object.fromEntries(Object.entries(callbacks).map(([name, n]) => [name, +(n / SECONDS).toFixed(1)])),
    gapHistogramMs: gaps,
    first40: list.slice(0, 40).map((frame, i) =>
      `${i ? '+' + (frame.time - list[i - 1].time).toFixed(1) : 't0'} ran +${(frame.ranAt - frame.time).toFixed(1)} [${frame.names.join(',')}] asked ${frame.asked.join(',')}`
    ),
  };
})();
