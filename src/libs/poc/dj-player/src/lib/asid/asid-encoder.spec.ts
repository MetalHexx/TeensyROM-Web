import { describe, it, expect } from 'vitest';
import {
  buildDisplayCharsPacket,
  buildSidDataPacket,
  buildSidTypePacket,
  buildStartPacket,
  buildStopPacket,
} from './asid-encoder';
import { RegisterFrame } from './register-frame';

describe('buildStartPacket / buildStopPacket', () => {
  it('builds the four-byte start packet', () => {
    expect(buildStartPacket()).toEqual(Uint8Array.from([0xf0, 0x2d, 0x4c, 0xf7]));
  });

  it('builds the four-byte stop packet', () => {
    expect(buildStopPacket()).toEqual(Uint8Array.from([0xf0, 0x2d, 0x4d, 0xf7]));
  });
});

describe('buildSidTypePacket', () => {
  it('encodes a 6581 chip as type bit0 = 0', () => {
    expect(buildSidTypePacket(0, false)).toEqual(Uint8Array.from([0xf0, 0x2d, 0x32, 0x00, 0x00, 0xf7]));
  });

  it('encodes an 8580 chip on a non-zero chip index as type bit0 = 1', () => {
    expect(buildSidTypePacket(2, true)).toEqual(Uint8Array.from([0xf0, 0x2d, 0x32, 0x02, 0x01, 0xf7]));
  });
});

describe('buildDisplayCharsPacket', () => {
  it('wraps ASCII text bytes between the header and terminator', () => {
    expect(buildDisplayCharsPacket('HI')).toEqual(
      Uint8Array.from([0xf0, 0x2d, 0x4f, 0x48, 0x49, 0xf7])
    );
  });

  it('drops characters at or above 0x80 rather than corrupting the stream with a masked byte', () => {
    const packet = buildDisplayCharsPacket('AéB'); // 'é' = 0xe9
    const dataBytes = packet.slice(3, -1); // the payload, excluding SysEx framing

    expect(Array.from(dataBytes)).toEqual([0x41, 0x42]); // A, B — é dropped
    expect(Array.from(dataBytes).every((byte) => byte < 0x80)).toBe(true);
  });
});

describe('buildSidDataPacket', () => {
  it('produces exactly twelve bytes, all mask bytes zero, for an empty frame', () => {
    const packet = buildSidDataPacket(new RegisterFrame().takeSnapshot());

    expect(packet).toHaveLength(12);
    expect(packet).toEqual(Uint8Array.from([0xf0, 0x2d, 0x4e, 0, 0, 0, 0, 0, 0, 0, 0, 0xf7]));
  });

  it('produces a 15-byte packet for writes to registers 0, 1 and 24, in ascending slot order', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(0, 0x11);
    frame.onSidWrite(1, 0x22);
    frame.onSidWrite(24, 0x33);

    const packet = buildSidDataPacket(frame.takeSnapshot());

    expect(packet).toHaveLength(15);
    // slots 0, 1 and 21 -> present-mask byte 0 bits 0-1, byte 3 bit 0
    expect(packet[3]).toBe(0b11);
    expect(packet[4]).toBe(0);
    expect(packet[5]).toBe(0);
    expect(packet[6]).toBe(0b1);
    expect(Array.from(packet.slice(11, 14))).toEqual([0x11, 0x22, 0x33]);
    expect(packet[14]).toBe(0xf7);
  });

  it('sets the MSB mask bit and sends the low 7 bits for a value >= 0x80', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(0, 0xff);

    const packet = buildSidDataPacket(frame.takeSnapshot());

    expect(packet[3]).toBe(0b1); // present mask, slot 0
    expect(packet[7]).toBe(0b1); // MSB mask, slot 0
    expect(packet[11]).toBe(0x7f);
  });

  it('carries both writes to register 4 in one frame, in slots 22 and 25', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(4, 0x01);
    frame.onSidWrite(4, 0x02);

    const packet = buildSidDataPacket(frame.takeSnapshot());

    // slot 22 -> byte 3 bit 1, slot 25 -> byte 3 bit 4
    expect(packet[6]).toBe((1 << 1) | (1 << 4));
    expect(Array.from(packet.slice(11, 13))).toEqual([0x01, 0x02]);
  });
});
