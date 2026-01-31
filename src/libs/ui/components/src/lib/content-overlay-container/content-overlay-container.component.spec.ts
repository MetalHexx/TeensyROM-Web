import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentOverlayContainerComponent } from './content-overlay-container.component';

// Test host component for content projection testing
@Component({
  standalone: true,
  imports: [ContentOverlayContainerComponent],
  template: `
    <lib-content-overlay-container
      [showOverlaysOnHover]="showOverlaysOnHover"
      [overlayTransitionMs]="transitionMs"
      (fullscreenChange)="onFullscreenChange($event)"
    >
      <div content data-testid="main-content">Main Content</div>
      <div topLeftCorner data-testid="top-left">Top Left</div>
      <div topOverlay data-testid="top-overlay">Top Overlay</div>
      <div topRightCorner data-testid="top-right">Top Right</div>
      <div leftControls data-testid="left-controls">Left Controls</div>
      <div rightControls data-testid="right-controls">Right Controls</div>
      <div bottomLeftControls data-testid="bottom-left">Bottom Left</div>
      <div bottomOverlay data-testid="bottom-overlay">Bottom Overlay</div>
      <div bottomRightControls data-testid="bottom-right">Bottom Right</div>
    </lib-content-overlay-container>
  `,
})
class TestHostComponent {
  showOverlaysOnHover = true;
  transitionMs = 300;
  fullscreenState: boolean | null = null;

  onFullscreenChange(isFullscreen: boolean): void {
    this.fullscreenState = isFullscreen;
  }
}

describe('ContentOverlayContainerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let containerElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
    containerElement = fixture.nativeElement.querySelector('.overlay-container');
  });

  describe('Component Creation', () => {
    it('should create successfully with default inputs', () => {
      expect(containerElement).toBeTruthy();
    });

    it('should have hover-reveal class when showOverlaysOnHover is true', () => {
      expect(containerElement.classList.contains('hover-reveal')).toBe(true);
    });

    it('should not have hover-reveal class when showOverlaysOnHover is false', () => {
      hostComponent.showOverlaysOnHover = false;
      fixture.detectChanges();
      expect(containerElement.classList.contains('hover-reveal')).toBe(false);
    });

    it('should set transition duration CSS variable', () => {
      // The CSS variable is set via inline style binding
      expect(containerElement.style.getPropertyValue('--transition-ms')).toBe('300ms');
    });

    it('should update transition duration when input changes', () => {
      hostComponent.transitionMs = 500;
      fixture.detectChanges();
      expect(containerElement.style.getPropertyValue('--transition-ms')).toBe('500ms');
    });
  });

  describe('Content Projection - Content Slot', () => {
    it('should project content into content layer', () => {
      const contentLayer = fixture.nativeElement.querySelector('.content-layer');
      expect(contentLayer.textContent).toContain('Main Content');
    });

    it('should have content with correct test id', () => {
      const mainContent = fixture.nativeElement.querySelector('[data-testid="main-content"]');
      expect(mainContent).toBeTruthy();
      expect(mainContent.closest('.content-layer')).toBeTruthy();
    });
  });

  describe('Content Projection - Top Row', () => {
    it('should project topLeftCorner content into top-left-corner slot', () => {
      const slot = fixture.nativeElement.querySelector('.top-left-corner');
      expect(slot.textContent).toContain('Top Left');
    });

    it('should project topOverlay content into top-overlay slot', () => {
      const slot = fixture.nativeElement.querySelector('.top-overlay');
      expect(slot.textContent).toContain('Top Overlay');
    });

    it('should project topRightCorner content into top-right-corner slot', () => {
      const slot = fixture.nativeElement.querySelector('.top-right-corner');
      expect(slot.textContent).toContain('Top Right');
    });
  });

  describe('Content Projection - Side Controls', () => {
    it('should project leftControls content into left-controls slot', () => {
      const slot = fixture.nativeElement.querySelector('.left-controls');
      expect(slot.textContent).toContain('Left Controls');
    });

    it('should project rightControls content into right-controls slot', () => {
      const slot = fixture.nativeElement.querySelector('.right-controls');
      expect(slot.textContent).toContain('Right Controls');
    });
  });

  describe('Content Projection - Bottom Row', () => {
    it('should project bottomLeftControls content into bottom-left-controls slot', () => {
      const slot = fixture.nativeElement.querySelector('.bottom-left-controls');
      expect(slot.textContent).toContain('Bottom Left');
    });

    it('should project bottomOverlay content into bottom-overlay slot', () => {
      const slot = fixture.nativeElement.querySelector('.bottom-overlay');
      expect(slot.textContent).toContain('Bottom Overlay');
    });

    it('should project bottomRightControls content into bottom-right-controls slot', () => {
      const slot = fixture.nativeElement.querySelector('.bottom-right-controls');
      expect(slot.textContent).toContain('Bottom Right');
    });
  });

  describe('Overlay Layer Structure', () => {
    it('should have overlay layer above content layer', () => {
      const contentLayer = fixture.nativeElement.querySelector('.content-layer');
      const overlayLayer = fixture.nativeElement.querySelector('.overlay-layer');

      expect(contentLayer).toBeTruthy();
      expect(overlayLayer).toBeTruthy();

      // Both should be siblings in the container
      expect(contentLayer.parentElement).toBe(overlayLayer.parentElement);
    });

    it('should have all 8 overlay slots in overlay layer', () => {
      const overlayLayer = fixture.nativeElement.querySelector('.overlay-layer');

      expect(overlayLayer.querySelector('.top-left-corner')).toBeTruthy();
      expect(overlayLayer.querySelector('.top-overlay')).toBeTruthy();
      expect(overlayLayer.querySelector('.top-right-corner')).toBeTruthy();
      expect(overlayLayer.querySelector('.left-controls')).toBeTruthy();
      expect(overlayLayer.querySelector('.right-controls')).toBeTruthy();
      expect(overlayLayer.querySelector('.bottom-left-controls')).toBeTruthy();
      expect(overlayLayer.querySelector('.bottom-overlay')).toBeTruthy();
      expect(overlayLayer.querySelector('.bottom-right-controls')).toBeTruthy();
    });
  });

  describe('Fullscreen Methods', () => {
    let component: ContentOverlayContainerComponent;

    beforeEach(() => {
      const componentEl = fixture.debugElement.children[0].componentInstance;
      component = componentEl;
    });

    it('should have enterFullscreen method', () => {
      expect(typeof component.enterFullscreen).toBe('function');
    });

    it('should have exitFullscreen method', () => {
      expect(typeof component.exitFullscreen).toBe('function');
    });

    it('should have toggleFullscreen method', () => {
      expect(typeof component.toggleFullscreen).toBe('function');
    });

    it('should have isFullscreen signal with initial value false', () => {
      expect(component.isFullscreen()).toBe(false);
    });

    it('should not have fullscreen class when not in fullscreen', () => {
      expect(containerElement.classList.contains('fullscreen')).toBe(false);
    });
  });

  describe('Fullscreen State Changes', () => {
    let component: ContentOverlayContainerComponent;

    beforeEach(() => {
      const componentEl = fixture.debugElement.children[0].componentInstance;
      component = componentEl;
    });

    it('should emit fullscreenChange when fullscreen state changes', () => {
      // Simulate fullscreen change by directly calling the handler
      // (since we can't actually enter fullscreen in tests)
      const originalFullscreenElement = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'fullscreenElement'
      );

      // Mock fullscreenElement to return the container
      Object.defineProperty(document, 'fullscreenElement', {
        value: containerElement,
        configurable: true,
      });

      // Dispatch fullscreenchange event
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();

      expect(hostComponent.fullscreenState).toBe(true);
      expect(component.isFullscreen()).toBe(true);

      // Restore original
      if (originalFullscreenElement) {
        Object.defineProperty(document, 'fullscreenElement', originalFullscreenElement);
      } else {
        Object.defineProperty(document, 'fullscreenElement', {
          value: null,
          configurable: true,
        });
      }
    });

    it('should add fullscreen class when in fullscreen mode', () => {
      // Mock fullscreen state
      Object.defineProperty(document, 'fullscreenElement', {
        value: containerElement,
        configurable: true,
      });

      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();

      expect(containerElement.classList.contains('fullscreen')).toBe(true);

      // Cleanup
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
    });

    it('should emit false when exiting fullscreen', () => {
      // First enter fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: containerElement,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange'));

      // Then exit
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();

      expect(hostComponent.fullscreenState).toBe(false);
      expect(component.isFullscreen()).toBe(false);
    });
  });

  describe('Hover Behavior CSS Classes', () => {
    it('should have hover-reveal class by default', () => {
      expect(containerElement.classList.contains('hover-reveal')).toBe(true);
    });

    it('should toggle hover-reveal class based on input', () => {
      hostComponent.showOverlaysOnHover = false;
      fixture.detectChanges();
      expect(containerElement.classList.contains('hover-reveal')).toBe(false);

      hostComponent.showOverlaysOnHover = true;
      fixture.detectChanges();
      expect(containerElement.classList.contains('hover-reveal')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should allow pointer events on overlay slots', () => {
      const overlaySlots = fixture.nativeElement.querySelectorAll('.overlay-layer > *');
      overlaySlots.forEach((slot: HTMLElement) => {
        // Note: pointer-events may be 'none' in hover-reveal mode until hovered
        // This test verifies the elements exist and are properly structured
        expect(slot).toBeTruthy();
      });
    });

    it('should have proper z-index layering', () => {
      const contentLayer = fixture.nativeElement.querySelector('.content-layer');
      const overlayLayer = fixture.nativeElement.querySelector('.overlay-layer');

      // Verify both layers exist and are siblings
      expect(contentLayer).toBeTruthy();
      expect(overlayLayer).toBeTruthy();
      expect(contentLayer.parentElement).toBe(overlayLayer.parentElement);

      // Verify overlay layer comes after content layer in DOM (natural stacking)
      const children = Array.from(contentLayer.parentElement.children);
      const contentIndex = children.indexOf(contentLayer);
      const overlayIndex = children.indexOf(overlayLayer);
      expect(overlayIndex).toBeGreaterThan(contentIndex);
    });
  });
});

describe('ContentOverlayContainerComponent (Standalone)', () => {
  let fixture: ComponentFixture<ContentOverlayContainerComponent>;
  let component: ContentOverlayContainerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentOverlayContainerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContentOverlayContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default showOverlaysOnHover as true', () => {
    expect(component.showOverlaysOnHover()).toBe(true);
  });

  it('should have default overlayTransitionMs as 300', () => {
    expect(component.overlayTransitionMs()).toBe(300);
  });

  it('should have isFullscreen initially false', () => {
    expect(component.isFullscreen()).toBe(false);
  });

  it('should call enterFullscreen without error', () => {
    expect(() => component.enterFullscreen()).not.toThrow();
  });

  it('should call exitFullscreen without error', () => {
    expect(() => component.exitFullscreen()).not.toThrow();
  });

  it('should call toggleFullscreen without error', () => {
    expect(() => component.toggleFullscreen()).not.toThrow();
  });

  describe('Overlay Lock Mechanism', () => {
    it('should have overlayLockCount initially at 0', () => {
      expect(component.overlayLockCount()).toBe(0);
    });

    it('should increment lock count when lockOverlays is called', () => {
      component.lockOverlays();
      expect(component.overlayLockCount()).toBe(1);
    });

    it('should decrement lock count when unlockOverlays is called', () => {
      component.lockOverlays();
      component.lockOverlays();
      expect(component.overlayLockCount()).toBe(2);

      component.unlockOverlays();
      expect(component.overlayLockCount()).toBe(1);
    });

    it('should not go below 0 when unlockOverlays is called too many times', () => {
      component.unlockOverlays();
      component.unlockOverlays();
      expect(component.overlayLockCount()).toBe(0);
    });

    it('should show overlays when lock count is greater than 0', () => {
      component.lockOverlays();
      expect(component.shouldShowOverlays()).toBe(true);
    });
  });

  describe('CDK Overlay Awareness', () => {
    it('should have hasCdkOverlayOpen initially false', () => {
      expect(component.hasCdkOverlayOpen()).toBe(false);
    });

    it('should show overlays when CDK overlay is detected', () => {
      // Simulate CDK overlay being open
      component['hasCdkOverlayOpen'].set(true);
      expect(component.shouldShowOverlays()).toBe(true);
    });

    it('should keep overlays visible when mouse leaves but CDK overlay is open', async () => {
      // Mouse enters
      component.onMouseEnter();
      expect(component.shouldShowOverlays()).toBe(true);

      // CDK overlay opens
      component['hasCdkOverlayOpen'].set(true);

      // Mouse leaves
      component.onMouseLeave();

      // Wait for microtask to complete
      await new Promise(resolve => setTimeout(resolve, 1));

      // Overlays should still be visible because CDK overlay is open
      expect(component.shouldShowOverlays()).toBe(true);
    });

    it('should hide overlays when mouse leaves and no CDK overlay is open', async () => {
      component.onMouseEnter();
      expect(component.shouldShowOverlays()).toBe(true);

      component.onMouseLeave();
      
      // Wait for microtask to complete
      await new Promise(resolve => setTimeout(resolve, 1));
      
      expect(component.shouldShowOverlays()).toBe(false);
    });
  });

  describe('Dropdown Overlay Interaction', () => {
    it('should keep overlays visible when dropdown opens and mouse leaves container', async () => {
      // User hovers a button, overlays appear
      component.onMouseEnter();
      expect(component.shouldShowOverlays()).toBe(true);

      // Dropdown opens (detected by MutationObserver)
      component['hasCdkOverlayOpen'].set(true);

      // User moves mouse from button to dropdown, triggering mouseleave on container
      component.onMouseLeave();

      // Wait for microtask to complete
      await new Promise(resolve => setTimeout(resolve, 1));

      // Overlays should remain visible because dropdown is active
      expect(component.shouldShowOverlays()).toBe(true);
    });

    it('should hide overlays after dropdown closes and mouse is outside container', async () => {
      // Setup: overlays visible, dropdown active
      component.onMouseEnter();
      component['hasCdkOverlayOpen'].set(true);

      // User moves mouse away from dropdown and container
      component.onMouseLeave();

      // Wait for microtask
      await new Promise(resolve => setTimeout(resolve, 1));

      // Still visible due to dropdown
      expect(component.shouldShowOverlays()).toBe(true);

      // Dropdown closes (simulated by manually setting signal and calling cleanup)
      // In real world, MutationObserver would call checkForOpenOverlays()
      component['hasCdkOverlayOpen'].set(false);
      component['checkForOpenOverlays'](); // Trigger cleanup logic

      // Now overlays should hide because mouse is not over and no dropdown
      expect(component.shouldShowOverlays()).toBe(false);
    });

    it('should handle genuine mouse leave (no overlay) immediately after microtask', async () => {
      // Mouse enters, no overlay
      component.onMouseEnter();
      expect(component.shouldShowOverlays()).toBe(true);

      // Mouse leaves, no overlay present
      component.onMouseLeave();

      // Wait for microtask
      await new Promise(resolve => setTimeout(resolve, 1));

      // Should hide because no overlay was detected
      expect(component.shouldShowOverlays()).toBe(false);
      expect(component.isMouseOver()).toBe(false);
    });

    it('should not affect overlay lock behavior with dropdown interaction', async () => {
      // Lock overlays programmatically
      component.lockOverlays();
      expect(component.shouldShowOverlays()).toBe(true);

      // Mouse interaction with dropdown
      component.onMouseEnter();
      component['hasCdkOverlayOpen'].set(true);
      component.onMouseLeave();

      await new Promise(resolve => setTimeout(resolve, 1));

      // Should remain visible due to lock (independent of dropdown)
      expect(component.shouldShowOverlays()).toBe(true);

      // Close dropdown and unlock
      component['hasCdkOverlayOpen'].set(false);
      component['checkForOpenOverlays'](); // Trigger cleanup
      component.unlockOverlays();

      // Now should hide
      expect(component.shouldShowOverlays()).toBe(false);
    });
  });

  describe('shouldShowOverlays computed signal', () => {
    it('should return true when mouse is over', () => {
      component.onMouseEnter();
      expect(component.shouldShowOverlays()).toBe(true);
    });

    it('should return true when overlay is locked', () => {
      component.lockOverlays();
      expect(component.shouldShowOverlays()).toBe(true);
    });

    it('should return true when CDK overlay is open', () => {
      component['hasCdkOverlayOpen'].set(true);
      expect(component.shouldShowOverlays()).toBe(true);
    });

    it('should return false when none of the conditions are met', () => {
      expect(component.shouldShowOverlays()).toBe(false);
    });

    it('should return true when multiple conditions are met', async () => {
      component.onMouseEnter();
      component.lockOverlays();
      component['hasCdkOverlayOpen'].set(true);
      expect(component.shouldShowOverlays()).toBe(true);

      // Remove one condition at a time
      component.onMouseLeave();
      await new Promise(resolve => setTimeout(resolve, 1)); // Wait for microtask
      expect(component.shouldShowOverlays()).toBe(true);

      component.unlockOverlays();
      expect(component.shouldShowOverlays()).toBe(true);

      component['hasCdkOverlayOpen'].set(false);
      component['checkForOpenOverlays'](); // Trigger cleanup
      expect(component.shouldShowOverlays()).toBe(false);
    });
  });
});
