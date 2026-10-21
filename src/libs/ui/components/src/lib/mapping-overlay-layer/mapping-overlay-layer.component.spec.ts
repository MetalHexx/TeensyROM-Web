import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MappingOverlayLayerComponent,
  MappingOverlayTarget,
} from './mapping-overlay-layer.component';

/** Records what the layer observes, and lets a test deliver a resize notification. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.add(element);
  }

  unobserve(element: Element): void {
    this.observed.delete(element);
  }

  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }
}

type Box = { left: number; top: number; width: number; height: number };

/** jsdom has no layout, so every box the layer measures is stubbed. */
function stubBox(element: Element, { left, top, width, height }: Box): void {
  element.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      x: left,
      y: top,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    } as DOMRect);
}

describe('MappingOverlayLayerComponent', () => {
  let fixture: ComponentFixture<MappingOverlayLayerComponent>;
  let component: MappingOverlayLayerComponent;
  let scope: HTMLElement;
  let frames: (FrameRequestCallback | null)[];
  let selected: string[];
  let dismissed: number;

  const stop: MappingOverlayTarget = {
    id: 'deck-a-stop',
    anchor: '[data-control="stop"]',
    state: 'selectable',
    accessibleName: 'Map Stop, deck A',
  };
  const speed: MappingOverlayTarget = {
    id: 'deck-a-speed',
    anchor: '[data-control="speed"]',
    state: 'bound',
    accessibleName: 'Map Speed, deck A',
  };

  beforeEach(async () => {
    FakeResizeObserver.instances = [];
    frames = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      frames[handle - 1] = null;
    });

    scope = document.createElement('div');
    document.body.appendChild(scope);

    await TestBed.configureTestingModule({
      imports: [MappingOverlayLayerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MappingOverlayLayerComponent);
    component = fixture.componentInstance;
    stubBox(fixture.nativeElement, { left: 10, top: 20, width: 400, height: 300 });
    fixture.componentRef.setInput('scope', scope);

    selected = [];
    dismissed = 0;
    component.targetSelect.subscribe((id) => selected.push(id));
    component.dismiss.subscribe(() => dismissed++);
  });

  afterEach(() => {
    scope.remove();
    vi.unstubAllGlobals();
  });

  function addAnchor(control: string, box: Box): HTMLElement {
    const anchor = document.createElement('button');
    anchor.setAttribute('data-control', control);
    scope.appendChild(anchor);
    stubBox(anchor, box);
    return anchor;
  }

  function show(targets: readonly MappingOverlayTarget[]): void {
    fixture.componentRef.setInput('targets', targets);
    fixture.detectChanges();
    flushFrames();
  }

  /** Runs the queued animation frames, then renders what they measured. */
  function flushFrames(): void {
    const pending = frames;
    frames = [];
    pending.forEach((callback) => callback?.(0));
    fixture.detectChanges();
  }

  function overlays(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.mapping-overlay'));
  }

  function resizeObserver(): FakeResizeObserver {
    return FakeResizeObserver.instances[0];
  }

  describe('overlays', () => {
    it('draws one button per target, with its state, pressed flag and accessible name', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      addAnchor('speed', { left: 200, top: 60, width: 24, height: 120 });

      show([stop, { ...speed, state: 'selected' }]);

      expect(overlays().map((overlay) => overlay.getAttribute('data-state'))).toEqual([
        'selectable',
        'selected',
      ]);
      expect(overlays().map((overlay) => overlay.getAttribute('aria-pressed'))).toEqual([
        'false',
        'true',
      ]);
      expect(overlays().map((overlay) => overlay.getAttribute('aria-label'))).toEqual([
        'Map Stop, deck A',
        'Map Speed, deck A',
      ]);
    });

    it('draws no overlay for an anchor that is not found', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });

      show([stop, speed]);

      expect(overlays()).toHaveLength(1);
      expect(overlays()[0].getAttribute('aria-label')).toBe('Map Stop, deck A');
    });

    it('lays each overlay on its anchor, relative to the layer and inset by 3px', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });

      show([stop]);

      const style = overlays()[0].style;
      expect([style.left, style.top, style.width, style.height]).toEqual([
        '87px',
        '27px',
        '86px',
        '36px',
      ]);
    });

    it('re-measures when the window resizes', () => {
      const anchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      show([stop]);

      stubBox(anchor, { left: 140, top: 70, width: 100, height: 30 });
      window.dispatchEvent(new Event('resize'));
      flushFrames();

      const style = overlays()[0].style;
      expect([style.left, style.top, style.width]).toEqual(['127px', '47px', '106px']);
    });

    it('re-measures when the scope or an anchor resizes', () => {
      const anchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      show([stop]);

      stubBox(anchor, { left: 100, top: 50, width: 120, height: 30 });
      resizeObserver().callback([], resizeObserver() as unknown as ResizeObserver);
      flushFrames();

      expect(overlays()[0].style.width).toBe('126px');
    });

    it('coalesces several triggers into one measure per frame', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      show([stop]);

      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
      resizeObserver().callback([], resizeObserver() as unknown as ResizeObserver);

      expect(frames.filter(Boolean)).toHaveLength(1);
    });

    it('follows a change of targets', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      addAnchor('speed', { left: 200, top: 60, width: 24, height: 120 });
      show([stop]);

      show([speed]);

      expect(overlays().map((overlay) => overlay.getAttribute('aria-label'))).toEqual([
        'Map Speed, deck A',
      ]);
    });

    it('observes the scope and every resolved anchor, and disconnects on destroy', () => {
      const stopAnchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      const speedAnchor = addAnchor('speed', { left: 200, top: 60, width: 24, height: 120 });
      show([stop, speed]);

      expect(resizeObserver().observed).toEqual(new Set([scope, stopAnchor, speedAnchor]));

      fixture.destroy();

      expect(resizeObserver().disconnected).toBe(true);
    });

    it('stops observing an anchor whose target goes', () => {
      const stopAnchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      const speedAnchor = addAnchor('speed', { left: 200, top: 60, width: 24, height: 120 });
      show([stop, speed]);

      show([speed]);

      expect(resizeObserver().observed).toEqual(new Set([scope, speedAnchor]));
      expect(resizeObserver().observed.has(stopAnchor)).toBe(false);
    });
  });

  describe('inert anchors', () => {
    it('makes each resolved anchor inert, and no other control', () => {
      const stopAnchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      const other = addAnchor('level', { left: 300, top: 50, width: 80, height: 30 });

      show([stop]);

      expect(stopAnchor.hasAttribute('inert')).toBe(true);
      expect(other.hasAttribute('inert')).toBe(false);
    });

    it('restores an anchor when its target goes', () => {
      const stopAnchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      const speedAnchor = addAnchor('speed', { left: 200, top: 60, width: 24, height: 120 });
      show([stop, speed]);

      show([speed]);

      expect(stopAnchor.hasAttribute('inert')).toBe(false);
      expect(speedAnchor.hasAttribute('inert')).toBe(true);
    });

    it('restores every anchor when the layer is destroyed', () => {
      const stopAnchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      show([stop]);

      fixture.destroy();

      expect(stopAnchor.hasAttribute('inert')).toBe(false);
    });

    it('leaves alone an anchor that was already inert', () => {
      const stopAnchor = addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      stopAnchor.setAttribute('inert', '');
      show([stop]);

      show([]);
      fixture.destroy();

      expect(stopAnchor.hasAttribute('inert')).toBe(true);
    });
  });

  describe('events', () => {
    it('emits targetSelect with the id of the activated overlay', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      addAnchor('speed', { left: 200, top: 60, width: 24, height: 120 });
      show([stop, speed]);

      overlays()[1].click();

      expect(selected).toEqual(['deck-a-speed']);
    });

    it('emits dismiss when Escape is pressed on an overlay', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      show([stop]);

      overlays()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(dismissed).toBe(1);
    });

    it('ignores other keys', () => {
      addAnchor('stop', { left: 100, top: 50, width: 80, height: 30 });
      show([stop]);

      overlays()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

      expect(dismissed).toBe(0);
    });
  });
});
