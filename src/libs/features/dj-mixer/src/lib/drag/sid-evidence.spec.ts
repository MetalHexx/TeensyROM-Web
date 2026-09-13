import { describe, it, expect } from 'vitest';
import { parseSidHeader, sha256Hex, formatSidEvidence } from './sid-evidence';
import { DjFileEntry } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';

const hasCryptoSubtle = !!globalThis.crypto?.subtle;

describe('sid-evidence', () => {
  describe('parseSidHeader', () => {
    it('should parse a valid PSID header', () => {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      const uint8 = new Uint8Array(buffer);

      // Write PSID magic
      uint8[0] = 0x50; // P
      uint8[1] = 0x53; // S
      uint8[2] = 0x49; // I
      uint8[3] = 0x44; // D

      // Write version 2 in big-endian
      view.setUint16(4, 2, false);

      const header = parseSidHeader(buffer);

      expect(header).toEqual({ magic: 'PSID', version: 2 });
    });

    it('should parse a valid RSID header', () => {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      const uint8 = new Uint8Array(buffer);

      // Write RSID magic
      uint8[0] = 0x52; // R
      uint8[1] = 0x53; // S
      uint8[2] = 0x49; // I
      uint8[3] = 0x44; // D

      // Write version 1 in big-endian
      view.setUint16(4, 1, false);

      const header = parseSidHeader(buffer);

      expect(header).toEqual({ magic: 'RSID', version: 1 });
    });

    it('should return null for invalid magic', () => {
      const buffer = new ArrayBuffer(6);
      const uint8 = new Uint8Array(buffer);

      // Write garbage magic
      uint8[0] = 0x00;
      uint8[1] = 0x00;
      uint8[2] = 0x00;
      uint8[3] = 0x00;

      const header = parseSidHeader(buffer);

      expect(header).toBeNull();
    });

    it('should return null for short buffer', () => {
      const buffer = new ArrayBuffer(5);

      const header = parseSidHeader(buffer);

      expect(header).toBeNull();
    });
  });

  describe('sha256Hex', () => {
    (hasCryptoSubtle ? it : it.skip)('should compute SHA-256 hash of empty buffer', async () => {
      // Well-known SHA-256 of zero bytes: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const buffer = new ArrayBuffer(0);

      const hash = await sha256Hex(buffer);

      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    (hasCryptoSubtle ? it : it.skip)('should produce a 64-character hex string', async () => {
      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view.set([0x50, 0x53, 0x49, 0x44]); // PSID

      const hash = await sha256Hex(buffer);

      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe('formatSidEvidence', () => {
    (hasCryptoSubtle ? it : it.skip)('should format a retrieved entry with valid SID header', async () => {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      const uint8 = new Uint8Array(buffer);

      // Write PSID v2 header
      uint8[0] = 0x50; // P
      uint8[1] = 0x53; // S
      uint8[2] = 0x49; // I
      uint8[3] = 0x44; // D
      view.setUint16(4, 2, false);

      const entry: DjFileEntry = {
        deviceId: 'dev1',
        storageType: StorageType.Sd,
        path: '/music',
        fileName: 'song.sid',
        status: 'retrieved',
        bytes: buffer,
        byteLength: 6,
        error: null,
      };

      const text = await formatSidEvidence(entry);

      expect(text).toContain('song.sid');
      expect(text).toContain('6 bytes');
      expect(text).toContain('PSID v2');
      expect(text).toContain('SHA-256');
      expect(text).toMatch(/SHA-256 [0-9a-f]{64}/);
    });

    (hasCryptoSubtle ? it : it.skip)('should format a retrieved entry with non-SID data', async () => {
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      view.fill(0xff);

      const entry: DjFileEntry = {
        deviceId: 'dev1',
        storageType: StorageType.Usb,
        path: '/files',
        fileName: 'test.bin',
        status: 'retrieved',
        bytes: buffer,
        byteLength: 10,
        error: null,
      };

      const text = await formatSidEvidence(entry);

      expect(text).toContain('test.bin');
      expect(text).toContain('10 bytes');
      expect(text).toContain('not a SID header');
      expect(text).toContain('SHA-256');
    });

    it('should format a failed entry', async () => {
      const entry: DjFileEntry = {
        deviceId: 'dev1',
        storageType: StorageType.Sd,
        path: '/music',
        fileName: 'missing.sid',
        status: 'failed',
        bytes: null,
        byteLength: null,
        error: 'File not found',
      };

      const text = await formatSidEvidence(entry);

      expect(text).toBe('missing.sid\nRetrieval failed: File not found');
    });

    it('should handle retrieving status', async () => {
      const entry: DjFileEntry = {
        deviceId: 'dev1',
        storageType: StorageType.Sd,
        path: '/music',
        fileName: 'loading.sid',
        status: 'retrieving',
        bytes: null,
        byteLength: null,
        error: null,
      };

      const text = await formatSidEvidence(entry);

      expect(text).toBe('Retrieval did not complete');
    });

    it('should handle undefined entry', async () => {
      const text = await formatSidEvidence(undefined);

      expect(text).toBe('Retrieval did not complete');
    });

    it('should handle retrieved entry with null bytes', async () => {
      const entry: DjFileEntry = {
        deviceId: 'dev1',
        storageType: StorageType.Sd,
        path: '/music',
        fileName: 'null-bytes.sid',
        status: 'retrieved',
        bytes: null,
        byteLength: 0,
        error: null,
      };

      const text = await formatSidEvidence(entry);

      expect(text).toBe('Retrieval did not complete');
    });
  });
});
