// Raw access to a TeensyROM over USB serial or TCP, outside the API: open a link, send tokens,
// decode what comes back into timed events, and list the Teensy USB ports with the image behind each.
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const toolsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools');

let serialport = null;
function serialModule() {
  if (serialport) return serialport;
  try {
    serialport = createRequire(path.join(toolsDir, 'package.json'))('serialport');
  } catch {
    throw new Error(`serialport is not installed. Run once: npm install --prefix "${toolsDir}" serialport@13.0.0`);
  }
  return serialport;
}

// Tokens from the firmware's Common_Defs.h. The app sends a token high byte first; the TR answers
// low byte first, so Ack (0x64CC) arrives as CC 64 and GoodSid (0x9B81) as 81 9B.
export const Token = {
  Launch: 0x6444, Version: 0x6476, Ack: 0x64CC, Reset: 0x64EE,
  FwCheck: 0x64E0, FwMinimal: 0x64E1, FwFull: 0x64E2,
  Retry: 0x9B7E, Fail: 0x9B7F, BadSid: 0x9B80, GoodSid: 0x9B81,
};

// Only what the TR sends is scanned for: the app-side tokens' low bytes are printable ASCII.
const replyTokens = new Map(['Ack', 'FwMinimal', 'FwFull', 'Retry', 'Fail', 'BadSid', 'GoodSid']
  .map((name) => [Token[name], name]));

export const tokenBytes = (token) => Buffer.from([token >> 8, token & 0xff]);

// The two USB identities of one TeensyROM (TeensyUsbIds.cs in the API) and the launch drive types.
export const Usb = { Vendor: '16c0', Full: '0489', Minimal: '0483' };
export const Drive = { USB: 0, SD: 1, Teensy: 2 };

export const DefaultTcpPort = 2112;

/** Teensy USB serial ports right now, each tagged full / minimal / unknown by product id. */
export async function listTeensyPorts() {
  const { SerialPort } = serialModule();
  const ports = await SerialPort.list();
  return ports
    .filter((p) => (p.vendorId ?? '').toLowerCase() === Usb.Vendor)
    .map((p) => {
      const pid = (p.productId ?? '').toLowerCase();
      return { path: p.path, pid, image: pid === Usb.Full ? 'full' : pid === Usb.Minimal ? 'minimal' : 'unknown' };
    });
}

export const isTcpTarget = (target) => /^tcp:/i.test(target) || /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(target);

/**
 * Opens a link to `target`: a serial port name (COM4, /dev/ttyACM0) or a TCP endpoint
 * (192.168.1.37, 192.168.1.37:2112, tcp:host:port). Resolves once it is open; rejects on failure.
 */
export async function open(target, { connectTimeoutMs = 2000 } = {}) {
  const dataListeners = [];
  const closeListeners = [];
  const emitData = (chunk) => dataListeners.forEach((fn) => fn(chunk));
  let closed = false;
  const emitClose = (why) => {
    if (closed) return;
    closed = true;
    closeListeners.forEach((fn) => fn(why));
  };

  if (isTcpTarget(target)) {
    const [host, portText] = target.replace(/^tcp:/i, '').split(':');
    const port = Number(portText ?? DefaultTcpPort);
    const socket = net.connect({ host, port });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.destroy(); reject(new Error(`connect timeout after ${connectTimeoutMs} ms`)); }, connectTimeoutMs);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('error', (err) => { clearTimeout(timer); reject(err); });
    });
    socket.setNoDelay(true);
    socket.on('data', emitData);
    socket.on('error', (err) => emitClose(err.message));
    socket.on('close', () => emitClose('closed'));
    return {
      name: `${host}:${port}`,
      kind: 'tcp',
      isOpen: () => !closed,
      write: (buf) => new Promise((resolve) => socket.write(buf, () => resolve())),
      close: async () => { socket.destroy(); return null; },
      onData: (fn) => dataListeners.push(fn),
      onClose: (fn) => closeListeners.push(fn),
    };
  }

  const { SerialPort } = serialModule();
  const port = new SerialPort({ path: target, baudRate: 115200, autoOpen: false });
  await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
  await new Promise((resolve) => port.set({ dtr: true }, () => resolve()));
  port.on('data', emitData);
  port.on('error', (err) => emitClose(err.message));
  port.on('close', (err) => emitClose(err?.message ?? 'closed'));
  return {
    name: target,
    kind: 'serial',
    isOpen: () => port.isOpen && !closed,
    write: (buf) => new Promise((resolve) => port.write(buf, () => port.drain(() => resolve()))),
    // A port whose device already vanished can fail to close: returned as a message, never thrown.
    close: () => new Promise((resolve) => {
      if (!port.isOpen) return resolve(null);
      port.close((err) => resolve(err ? err.message : null));
    }),
    onData: (fn) => dataListeners.push(fn),
    onClose: (fn) => closeListeners.push(fn),
  };
}

/**
 * Decodes a link's byte stream into events: `token` (Ack, GoodSid, ...), `reply` (a version reply,
 * emitted at its UID line: fw, minimal, uid), `boot` (the reply's "Boot:" line, on firmware that has it)
 * and `text` (any other line, e.g. boot messages the firmware prints to USB serial).
 */
export function decode(link, onEvent) {
  let pending = Buffer.alloc(0);
  let line = '';
  let reply = null;
  const versionLine = /^(Teensy:|.* Hz$|[A-Z][a-z]{2} [ \d]\d \d{4},)/;

  link.onData((chunk) => {
    pending = Buffer.concat([pending, chunk]);
    let i = 0;
    while (i < pending.length) {
      if (i + 1 < pending.length) {
        const name = replyTokens.get(pending[i] | (pending[i + 1] << 8));
        if (name) { onEvent({ type: 'token', name }); i += 2; continue; }
      } else if (pending[i] >= 0x80) {
        break; // possibly the first byte of a token: wait for the next chunk
      }
      const ch = String.fromCharCode(pending[i]);
      i += 1;
      if (ch === '\r') continue;
      if (ch !== '\n') { line += ch; continue; }
      const text = line.trim();
      line = '';
      if (!text) continue;
      const fw = text.match(/FW: (.*)$/);
      if (fw) { reply = { fw: fw[1], minimal: /minimal/i.test(text) }; continue; }
      const uid = text.match(/UID: (\d+)/);
      if (uid && reply) { onEvent({ type: 'reply', ...reply, uid: uid[1] }); reply = null; continue; }
      const boot = text.match(/^Boot: (complete|in progress)/);
      if (boot) { onEvent({ type: 'boot', state: boot[1] }); continue; }
      if (versionLine.test(text)) continue;
      onEvent({ type: 'text', text });
    }
    pending = pending.subarray(i);
  });
}

/** Sends a launch: token, Ack, drive byte + NUL-terminated path, Ack (LaunchFile() in SerUSBIO.ino). */
export async function sendLaunch(link, drive, filePath) {
  await link.write(tokenBytes(Token.Launch));
  await sleep(50);
  await link.write(Buffer.concat([Buffer.from([drive]), Buffer.from(filePath, 'latin1'), Buffer.from([0])]));
}

/** Milliseconds since `t0` (a performance.now() value), one decimal. */
export const since = (t0) => Math.round((performance.now() - t0) * 10) / 10;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
