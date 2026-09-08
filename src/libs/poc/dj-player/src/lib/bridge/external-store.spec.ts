import { Component, effect } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { storeSignal } from './external-store';

interface FakeSnapshot {
  readonly value: number;
}

/** Stands in for core's `subscribe`/`getSnapshot` stores (`SidPlayer`, `PlayerSnapshotStore`). */
class FakeStore {
  private listeners = new Set<() => void>();
  private snapshot: FakeSnapshot = { value: 0 };
  unsubscribeCount = 0;

  getSnapshot(): FakeSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      this.unsubscribeCount++;
    };
  }

  /** Publishes a new snapshot identity and notifies — the way core reacts to a real state change. */
  emit(snapshot: FakeSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  /** Notifies without changing the snapshot's identity. Core never does this, but the signal must
   *  not mistake the re-notification for a change if it ever happened. */
  renotifySameSnapshot(): void {
    this.listeners.forEach((listener) => listener());
  }
}

@Component({ selector: 'lib-test-host', standalone: true, template: '' })
class TestHostComponent {
  readonly store = new FakeStore();
  readonly value = storeSignal(this.store);
  readCount = 0;

  constructor() {
    effect(() => {
      this.value();
      this.readCount++;
    });
  }
}

describe('storeSignal', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reads the store snapshot at creation', () => {
    expect(host.value()).toEqual({ value: 0 });
  });

  it('notifies exactly once when the snapshot identity changes', () => {
    const before = host.readCount;

    host.store.emit({ value: 1 });
    fixture.detectChanges();

    expect(host.value()).toEqual({ value: 1 });
    expect(host.readCount).toBe(before + 1);
  });

  it('does not mark the signal dirty when re-notified with the same snapshot identity', () => {
    host.store.emit({ value: 1 });
    fixture.detectChanges();
    const afterChange = host.readCount;

    host.store.renotifySameSnapshot();
    fixture.detectChanges();

    expect(host.readCount).toBe(afterChange);
  });

  it('unsubscribes from the store when the injection context is destroyed', () => {
    expect(host.store.unsubscribeCount).toBe(0);

    fixture.destroy();

    expect(host.store.unsubscribeCount).toBe(1);
  });
});
