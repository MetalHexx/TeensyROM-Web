// Frame timer — times every rendering frame on the page, from its first animation-frame callback to
// the end of the task that ran it (rAF callbacks, style, layout, paint, layerize, commit), by posting
// a MessageChannel message from the first callback. Also injects CSS for live A/B tests.
//
// Paste into the console (or run through Claude in Chrome's javascript_tool) with the loop playing.
// Installs window.__frameTimer once; reload the page to remove it.
//   __frameTimer.reset()                     start a measuring window
//   __frameTimer.report()                    frames/s, painting frames/s (> 1.2 ms) with p50/p90/max,
//                                            render ms/s since the last reset
//   __frameTimer.css(text)                   inject a style sheet ('' removes it)
//   __frameTimer.ab([[name, css], ...], ms)  each variant: 1.5 s to settle, then `ms` measured; results
//                                            land in __frameTimer.results as they finish, `done` at the
//                                            end. Run it without awaiting and poll — a tool call may
//                                            time out before a long A/B ends.
// It wraps requestAnimationFrame, so it sees the deck loop's requests (made through the global each
// frame) from the next frame on. Numbers include whatever queued behind the frame (an audio
// callback, a timer): compare variants within one run, not across sessions.
(() => {
  if (window.__frameTimer) {
    return 'frame timer already installed';
  }
  const raf = window.requestAnimationFrame;
  const channel = new MessageChannel();
  const state = { samples: [], frames: 0, t0: performance.now() };
  let frameStart = -1;
  channel.port1.onmessage = () => {
    state.samples.push(performance.now() - frameStart);
    frameStart = -1;
  };
  window.requestAnimationFrame = function (callback) {
    return raf.call(window, (time) => {
      if (frameStart < 0) {
        frameStart = performance.now();
        state.frames++;
        channel.port2.postMessage(0);
      }
      callback(time);
    });
  };
  const style = document.createElement('style');
  style.id = 'frame-timer-css';
  document.head.appendChild(style);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const timer = {
    results: [],
    done: true,
    css(text) {
      style.textContent = text;
    },
    reset() {
      state.samples = [];
      state.frames = 0;
      state.t0 = performance.now();
    },
    report() {
      const span = (performance.now() - state.t0) / 1000;
      const sorted = [...state.samples].sort((a, b) => a - b);
      const painting = sorted.filter((ms) => ms > 1.2);
      const at = (p) => (painting.length ? +painting[Math.floor(p * (painting.length - 1))].toFixed(2) : null);
      return {
        seconds: +span.toFixed(1),
        framesPerSec: +(state.frames / span).toFixed(1),
        paintingFramesPerSec: +(painting.length / span).toFixed(1),
        paintingFrameMs: { p50: at(0.5), p90: at(0.9), max: at(1) },
        renderMsPerSec: +(sorted.reduce((sum, ms) => sum + ms, 0) / span).toFixed(1),
      };
    },
    async ab(variants, ms = 8000) {
      timer.results = [];
      timer.done = false;
      for (const [name, css] of variants) {
        timer.css(css);
        await sleep(1500);
        timer.reset();
        await sleep(ms);
        timer.results.push({ name, ...timer.report() });
      }
      timer.css('');
      timer.done = true;
      return timer.results;
    },
  };
  window.__frameTimer = timer;
  return 'frame timer installed';
})();
