import '@analogjs/vitest-angular/setup-zone';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

// Mock ResizeObserver for tests - not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {
    // No-op for test environment
  }
  unobserve() {
    // No-op for test environment
  }
  disconnect() {
    // No-op for test environment
  }
};

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
