// Send analysis — reads what send-capture.js recorded (window.__sends) and says whether the pops the
// listener marked line up with anything the page did: irregular sends (bunched or late packets) or
// particular frame content (gates, noise, test-bit hard restarts). Run it in the same tab, after the
// recording, from the console or Claude in Chrome's javascript_tool; it returns a JSON summary.
//
// ASID data packets are `F0 2D 4E <4 present-mask bytes> <4 MSB-mask bytes> <values> F7`: bit
// (slot % 7) of byte (slot / 7) per slot, values in slot order. Slot → register is the firmware's
// table (sidablist `ASID_SLOT_TO_REGISTER`); slots 25–27 are the second write of a voice's control
// register in the same frame.
//
// Each mark is compared with the stretch of sends REACTION_MS before it (a tap comes 100–900 ms
// after the sound), and the same stats are taken over every unmarked stretch as the baseline: a
// cause shows as marked stretches standing out from the baseline, not as a single example.
((REACTION_MS = [900, 100], BUNCHED_MS = 2.5, LATE_MS = 15) => {
  const recording = window.__sends;
  if (!recording) {
    return 'nothing recorded — run send-capture.js first';
  }
  const SLOT_TO_REGISTER = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 4, 11, 18, 4, 11, 18];
  const CONTROL = [4, 11, 18];
  const registers = new Array(25).fill(0);
  const packets = [];
  for (const send of recording.sends) {
    const b = send.bytes;
    if (b[0] !== 0xf0 || b[1] !== 0x2d || b[2] !== 0x4e) {
      continue;
    }
    const before = CONTROL.map((r) => registers[r]);
    const controlWrites = [[], [], []];
    let next = 11;
    for (let slot = 0; slot < 28; slot++) {
      const byte = (slot / 7) | 0;
      const bit = 1 << (slot % 7);
      if (b[3 + byte] & bit) {
        const value = b[next++] | (b[7 + byte] & bit ? 0x80 : 0);
        const register = SLOT_TO_REGISTER[slot];
        registers[register] = value;
        const voice = CONTROL.indexOf(register);
        if (voice >= 0) {
          controlWrites[voice].push(value);
        }
      }
    }
    const events = [];
    controlWrites.forEach((writes, voice) => {
      let previous = before[voice];
      for (const value of writes) {
        if ((value & 1) !== (previous & 1)) events.push(`v${voice + 1} gate ${value & 1 ? 'on' : 'off'}`);
        if (value & 0x08 && !(previous & 0x08)) events.push(`v${voice + 1} test`);
        if (value & 0x80 && !(previous & 0x80)) events.push(`v${voice + 1} noise`);
        previous = value;
      }
      if (writes.length > 1) events.push(`v${voice + 1} double ctrl`);
    });
    packets.push({ at: send.at, ts: send.ts, events });
  }
  if (packets.length < 2) {
    return 'no ASID data packets recorded';
  }

  const gaps = [];
  for (let i = 1; i < packets.length; i++) {
    packets[i].gap = packets[i].at - packets[i - 1].at;
    gaps.push(packets[i].gap);
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const pct = (p) => +sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(2);
  const span = (packets.at(-1).at - packets[0].at) / 1000;

  const stretch = (from, to) => {
    const inside = packets.filter((p) => p.at >= from && p.at < to && p.gap !== undefined);
    return {
      packets: inside.length,
      bunched: inside.filter((p) => p.gap < BUNCHED_MS).length,
      late: inside.filter((p) => p.gap > LATE_MS).length,
      maxGap: inside.length ? +Math.max(...inside.map((p) => p.gap)).toFixed(1) : null,
      events: inside.flatMap((p) => p.events),
    };
  };
  const [early, late] = REACTION_MS;
  const marked = recording.marks.map((mark) => ({ secondsIn: +((mark - packets[0].at) / 1000).toFixed(2), ...stretch(mark - early, mark - late) }));

  // Baseline: back-to-back stretches of the same length that hold no marked stretch.
  const width = early - late;
  const baseline = [];
  for (let from = packets[0].at; from + width < packets.at(-1).at; from += width) {
    const overlaps = recording.marks.some((mark) => from < mark - late && from + width > mark - early);
    if (!overlaps) baseline.push(stretch(from, from + width));
  }
  const mean = (list, key) => (list.length ? +(list.reduce((sum, s) => sum + s[key], 0) / list.length).toFixed(2) : null);
  const share = (list, test) => (list.length ? +((100 * list.filter(test).length) / list.length).toFixed(1) : null);
  const summarize = (list) => ({
    stretches: list.length,
    meanBunched: mean(list, 'bunched'),
    meanLate: mean(list, 'late'),
    withBunchedPct: share(list, (s) => s.bunched > 0),
    withLatePct: share(list, (s) => s.late > 0),
    withNoiseOrTestPct: share(list, (s) => s.events.some((e) => e.includes('noise') || e.includes('test'))),
  });

  return {
    recorded: { seconds: +span.toFixed(1), packets: packets.length, marks: recording.marks.length, otherSends: recording.sends.length - packets.length },
    sendGapsMs: { p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: +sorted.at(-1).toFixed(1), bunchedPct: +((100 * gaps.filter((g) => g < BUNCHED_MS).length) / gaps.length).toFixed(2), latePct: +((100 * gaps.filter((g) => g > LATE_MS).length) / gaps.length).toFixed(2) },
    stamped: packets.some((p) => p.ts > 0) ? 'packets carry timestamps (schedule-ahead > 0): wire timing is Chrome’s, not these send times' : 'unstamped (schedule-ahead 0): sent at once',
    markedStretches: summarize(marked),
    baselineStretches: summarize(baseline),
    marks: marked.map((m) => ({ ...m, events: [...new Set(m.events)].slice(0, 12) })),
  };
})();
