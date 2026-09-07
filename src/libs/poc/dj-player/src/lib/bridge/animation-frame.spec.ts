import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { animationFrameSignal } from './animation-frame';

/**
 * Stands in for the browser's frame scheduler. Requests are captured rather than actually
 * scheduled, so a test fires them by hand instead of racing real frame timing.
 */
function installFakeRaf(): { fire: () => void; pending: () => number | null; cancelled: number[] } {
  let nextId = 0;
  let pendingId: number | null = null;
  let pendingCallback: FrameRequestCallback | null = null;
  const cancelled: number[] = [];

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    nextId++;
    pendingId = nextId;
    pendingCallback = callback;
    return nextId;
  });

  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    cancelled.push(handle);
    if (handle === pendingId) {
      pendingId = null;
      pendingCallback = null;
    }
  });

  return {
    fire: (): void => {
      const callback = pendingCallback;
      pendingCallback = null;
      callback?.(0);
    },
    pending: () => pendingId,
    cancelled,
  };
}

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

function fireVisibilityChange(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

@Component({ selector: 'lib-test-host', standalone: true, template: '' })
class TestHostComponent {
  private next = 0;
  readonly value = animationFrameSignal(() => this.next++);
}

describe('animationFrameSignal', () => {
  let raf: ReturnType<typeof installFakeRaf>;
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(() => {
    setDocumentHidden(false);
    raf = installFakeRaf();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('polls the read function once per driven frame', () => {
    const initial = host.value();

    raf.fire();
    const afterOne = host.value();
    raf.fire();
    const afterTwo = host.value();

    expect(afterOne).toBe(initial + 1);
    expect(afterTwo).toBe(initial + 2);
  });

  it('does not schedule a frame at creation when the document starts hidden', () => {
    vi.unstubAllGlobals();
    setDocumentHidden(true);
    raf = installFakeRaf();

    const hiddenFixture = TestBed.createComponent(TestHostComponent);
    hiddenFixture.detectChanges();

    expect(raf.pending()).toBeNull();
  });

  it('stops polling and resumes when visibility changes', () => {
    const beforeHide = host.value();

    setDocumentHidden(true);
    fireVisibilityChange();

    expect(raf.pending()).toBeNull();

    setDocumentHidden(false);
    fireVisibilityChange();

    expect(raf.pending()).not.toBeNull();

    raf.fire();
    expect(host.value()).toBe(beforeHide + 1);
  });

  it('cancels the pending frame and stops listening for visibility changes on destroy', () => {
    const pendingBeforeDestroy = raf.pending();
    expect(pendingBeforeDestroy).not.toBeNull();

    fixture.destroy();

    expect(raf.cancelled).toContain(pendingBeforeDestroy);

    const valueAtDestroy = host.value();
    setDocumentHidden(true);
    fireVisibilityChange();
    setDocumentHidden(false);
    fireVisibilityChange();

    // No new frame was scheduled after destroy, so nothing is left to fire.
    expect(raf.pending()).toBeNull();
    expect(host.value()).toBe(valueAtDestroy);
  });
});
