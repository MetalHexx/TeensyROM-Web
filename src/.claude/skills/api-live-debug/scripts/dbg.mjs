// dbg.mjs — drives netcoredbg over the Debug Adapter Protocol; controlled via local HTTP.
// usage: node dbg.mjs <netcoredbg.exe> <pid> <httpPort> <logFile>
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
import path from 'node:path';

const [, , exe, pidArg, portArg, logFile] = process.argv;
const PID = Number(pidArg);
const PORT = Number(portArg || 21300);
const SRC_ROOT = 'C:\\dev\\src\\TeensyROM-Web\\src\\apps\\api\\src';
const ts = () => new Date().toISOString().slice(11, 23);
const log = (line) => appendFileSync(logFile, `${ts()} ${line}\n`);

const dbg = spawn(exe, ['--interpreter=vscode'], { stdio: ['pipe', 'pipe', 'pipe'] });
dbg.stderr.on('data', (d) => log(`[stderr] ${d.toString().trim()}`));
dbg.on('exit', (c) => { log(`[dbg] netcoredbg exited ${c}`); process.exit(0); });

// ---- DAP framing ----
let seq = 1;
const pending = new Map();
let buf = Buffer.alloc(0);
function send(command, args = {}) {
  return new Promise((resolve, reject) => {
    const msg = { seq: seq++, type: 'request', command, arguments: args };
    pending.set(msg.seq, { resolve, reject, command });
    const body = Buffer.from(JSON.stringify(msg), 'utf8');
    dbg.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    dbg.stdin.write(body);
  });
}
dbg.stdout.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const h = buf.indexOf('\r\n\r\n');
    if (h < 0) return;
    const m = /Content-Length:\s*(\d+)/i.exec(buf.subarray(0, h).toString());
    if (!m) { buf = buf.subarray(h + 4); continue; }
    const len = Number(m[1]);
    if (buf.length < h + 4 + len) return;
    const body = buf.subarray(h + 4, h + 4 + len).toString('utf8');
    buf = buf.subarray(h + 4 + len);
    let msg;
    try { msg = JSON.parse(body); } catch { log(`[bad json] ${body}`); continue; }
    if (msg.type === 'response') {
      const p = pending.get(msg.request_seq);
      if (!p) continue;
      pending.delete(msg.request_seq);
      if (msg.success) p.resolve(msg.body ?? {});
      else p.reject(new Error(`${p.command}: ${msg.message ?? 'failed'}`));
    } else if (msg.type === 'event') {
      onEvent(msg).catch((err) => log(`[event error] ${err.message}`));
    }
  }
});

// ---- state ----
const state = { attached: false, stopped: null, bps: new Map() }; // bps: file -> [{line, mode, exprs, condition, verified}]
let initializedResolve;
const initialized = new Promise((r) => (initializedResolve = r));

const norm = (p) => path.win32.normalize(p).toLowerCase();
const resolveFile = (f) => (path.win32.isAbsolute(f) ? f : path.win32.join(SRC_ROOT, f));
const short = (p) => (p ? p.replace(/^.*[\\/]/, '') : '?');
const frameLabel = (f) => `${short(f.source?.path)}:${f.line} ${f.name}`;
function findBp(frame) {
  if (!frame?.source?.path) return null;
  const key = [...state.bps.keys()].find((k) => norm(k) === norm(frame.source.path));
  const list = key ? state.bps.get(key) : [];
  return list.find((b) => (b.actualLine ?? b.line) === frame.line) ?? null;
}
async function evalStr(expression, frameId) {
  try { return (await send('evaluate', { expression, frameId, context: 'watch' })).result; }
  catch (err) { return `<${err.message}>`; }
}

async function onEvent(e) {
  const b = e.body ?? {};
  switch (e.event) {
    case 'initialized': initializedResolve(); break;
    case 'output': log(`[out:${b.category ?? '?'}] ${(b.output ?? '').trimEnd()}`); break;
    case 'stopped': await onStopped(b); break;
    case 'continued': state.stopped = null; break;
    case 'thread': break;
    case 'breakpoint': log(`[bp-event] ${JSON.stringify(b)}`); break;
    case 'module': if (b.module?.symbolStatus === 'Symbols loaded.') log(`[symbols] ${b.module.name}`); break; // one line per debuggable module; the rest is noise
    case 'capabilities': break;
    case 'exited': case 'terminated': state.attached = false; log(`[dbg] ${e.event} ${JSON.stringify(b)}`); break;
    default: log(`[event ${e.event}] ${JSON.stringify(b)}`);
  }
}
async function onStopped(b) {
  const threadId = b.threadId;
  let frames = [];
  try { frames = (await send('stackTrace', { threadId, startFrame: 0, levels: 12 })).stackFrames ?? []; }
  catch (err) { log(`[stopped] stackTrace failed: ${err.message}`); }
  const top = frames[0];
  const where = top ? frameLabel(top) : '?';
  if (b.reason === 'entry') { log('[stopped entry] auto-continue'); await send('continue', { threadId }); return; }
  const bp = b.reason === 'breakpoint' ? findBp(top) : null;
  if (bp?.mode === 'trace') {
    const vals = [];
    for (const ex of bp.exprs ?? []) vals.push(`${ex} = ${await evalStr(ex, top.id)}`);
    log(`[TRACE ${where}] t${threadId} ${vals.join(' | ')}`);
    try { await send('continue', { threadId }); } catch (err) { log(`[trace] continue failed: ${err.message}`); }
    return;
  }
  state.stopped = { threadId, reason: b.reason, frames, where, text: b.text ?? null };
  log(`[HELD ${where}] reason=${b.reason} t${threadId}${b.text ? ' ' + b.text : ''}`);
}

async function syncBps(file) {
  const list = state.bps.get(file) ?? [];
  const r = await send('setBreakpoints', {
    source: { path: file },
    breakpoints: list.map((b) => ({ line: b.line, condition: b.condition || undefined })),
  });
  (r.breakpoints ?? []).forEach((rb, i) => { if (list[i]) { list[i].verified = rb.verified; list[i].actualLine = rb.line; list[i].message = rb.message; } });
  return list;
}
async function locals(frameId, depth) {
  const scopes = (await send('scopes', { frameId })).scopes ?? [];
  const out = {};
  for (const s of scopes) out[s.name] = await expand(s.variablesReference, depth);
  return out;
}
async function expand(ref, depth) {
  if (!ref) return null;
  const vars = (await send('variables', { variablesReference: ref })).variables ?? [];
  const out = {};
  for (const v of vars) {
    out[v.name] = depth > 1 && v.variablesReference
      ? { value: v.value, type: v.type, children: await expand(v.variablesReference, depth - 1) }
      : { value: v.value, type: v.type, ref: v.variablesReference || undefined };
  }
  return out;
}
const needStopped = () => { if (!state.stopped) throw new Error('not stopped'); return state.stopped; };

// ---- HTTP control ----
const routes = {
  'GET /status': async () => ({
    attached: state.attached, pid: PID,
    stopped: state.stopped && { threadId: state.stopped.threadId, reason: state.stopped.reason, where: state.stopped.where, text: state.stopped.text, frames: state.stopped.frames.map(frameLabel) },
    breakpoints: [...state.bps.entries()].flatMap(([f, l]) => l.map((b) => ({ file: short(f), ...b }))),
  }),
  'POST /bp': async ({ file, line, mode = 'hold', exprs = [], condition }) => {
    const f = resolveFile(file);
    const key = [...state.bps.keys()].find((k) => norm(k) === norm(f)) ?? f;
    const list = state.bps.get(key) ?? [];
    const i = list.findIndex((b) => b.line === line);
    const bp = { line, mode, exprs, condition };
    if (i >= 0) list[i] = bp; else list.push(bp);
    state.bps.set(key, list);
    return { file: short(key), breakpoints: await syncBps(key) };
  },
  'DELETE /bp': async ({ file, line }) => {
    const f = resolveFile(file);
    const key = [...state.bps.keys()].find((k) => norm(k) === norm(f));
    if (!key) return { removed: false };
    state.bps.set(key, (state.bps.get(key) ?? []).filter((b) => b.line !== line));
    return { file: short(key), breakpoints: await syncBps(key) };
  },
  'POST /continue': async () => { const s = needStopped(); await send('continue', { threadId: s.threadId }); state.stopped = null; log(`[continue] t${s.threadId}`); return { ok: true }; },
  'POST /next': async () => { const s = needStopped(); await send('next', { threadId: s.threadId }); state.stopped = null; return { ok: true }; },
  'POST /stepIn': async () => { const s = needStopped(); await send('stepIn', { threadId: s.threadId }); state.stopped = null; return { ok: true }; },
  'POST /stepOut': async () => { const s = needStopped(); await send('stepOut', { threadId: s.threadId }); state.stopped = null; return { ok: true }; },
  'POST /pause': async () => { const t = (await send('threads')).threads?.[0]; await send('pause', { threadId: t?.id ?? 0 }); return { ok: true }; },
  'GET /threads': async () => send('threads'),
  'GET /stack': async ({ levels = 30 }) => { const s = needStopped(); const r = await send('stackTrace', { threadId: s.threadId, startFrame: 0, levels: Number(levels) }); return { frames: (r.stackFrames ?? []).map((f, i) => `#${i} ${frameLabel(f)}`) }; },
  'GET /locals': async ({ frame = 0, depth = 1 }) => { const s = needStopped(); const f = s.frames[Number(frame)]; if (!f) throw new Error('no such frame'); return { frame: frameLabel(f), locals: await locals(f.id, Number(depth)) }; },
  'POST /eval': async ({ expr, frame = 0 }) => { const s = needStopped(); const f = s.frames[Number(frame)]; const r = await send('evaluate', { expression: expr, frameId: f?.id, context: 'watch' }); return { expr, result: r.result, type: r.type, ref: r.variablesReference || undefined }; },
  'POST /vars': async ({ ref, depth = 1 }) => expand(Number(ref), Number(depth)),
  'POST /detach': async () => { log('[dbg] detaching'); try { await send('disconnect', { terminateDebuggee: false }); } catch {} setTimeout(() => process.exit(0), 500); return { ok: true }; },
};
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  for await (const c of req) body += c;
  let out, status = 200;
  try {
    const args = { ...Object.fromEntries(url.searchParams), ...(body ? JSON.parse(body) : {}) };
    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) { status = 404; out = { error: 'no such route' }; }
    else out = await route(args);
  } catch (err) { status = 500; out = { error: err.message }; }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(out, null, 1));
}).listen(PORT, '127.0.0.1');

// ---- attach ----
try {
  await send('initialize', { clientID: 'claude', adapterID: 'coreclr', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path', supportsVariableType: true });
  await Promise.race([initialized, new Promise((r) => setTimeout(r, 3000))]);
  await send('attach', { processId: PID });
  await send('setExceptionBreakpoints', { filters: [] });
  await send('configurationDone', {});
  state.attached = true;
  log(`[dbg] attached to pid ${PID}; control on http://127.0.0.1:${PORT}`);
} catch (err) {
  log(`[dbg] attach failed: ${err.message}`);
  process.exit(1);
}
