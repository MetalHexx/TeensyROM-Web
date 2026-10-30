// Send capture + pop marker — records every MIDI send the page makes (when, the timestamp it was
// handed, the bytes) and a mark each time the listener presses the backtick key (` — left of 1) on
// hearing a pop. Forwards every send unchanged.
//
// The operator pastes this into the console, CLOSES DevTools, clicks an empty part of the page so it
// has keyboard focus, plays the loop and taps ` at each pop. Nothing is attached while they listen.
// Afterwards, run send-analysis.js in the same tab (console or Claude in Chrome). Stop recording with
// __sends.stop(); a reload removes everything.
//
// Also the byte capture for comparing two pages (POC vs mixer): record the same loop on both and
// compare the decoded packets from send-analysis.js.
(() => {
  if (window.__sends) {
    return 'send capture already installed';
  }
  const original = MIDIOutput.prototype.send;
  const sends = [];
  const marks = [];
  MIDIOutput.prototype.send = function (data, timestamp) {
    sends.push({ at: performance.now(), ts: timestamp ?? 0, port: this.name, bytes: Array.from(data) });
    return original.call(this, data, timestamp);
  };
  const onKey = (event) => {
    if (event.key === '`') {
      marks.push(performance.now());
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  addEventListener('keydown', onKey, true);
  window.__sends = {
    sends,
    marks,
    stop() {
      MIDIOutput.prototype.send = original;
      removeEventListener('keydown', onKey, true);
      return `stopped: ${sends.length} sends, ${marks.length} marks`;
    },
  };
  return 'recording — press ` at each pop';
})();
