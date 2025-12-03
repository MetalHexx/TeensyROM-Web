import 'zone.js';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Polyfills for MSW v2 - web streams are not available in jsdom
if (!globalThis.TransformStream) {
  const { TransformStream } = await import('node:stream/web');
  globalThis.TransformStream = TransformStream as unknown as typeof globalThis.TransformStream;
}

if (!globalThis.WritableStream) {
  const { WritableStream } = await import('node:stream/web');
  globalThis.WritableStream = WritableStream as unknown as typeof globalThis.WritableStream;
}

if (!globalThis.ReadableStream) {
  const { ReadableStream } = await import('node:stream/web');
  globalThis.ReadableStream = ReadableStream as unknown as typeof globalThis.ReadableStream;
}

// Initialize Angular testing environment
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
