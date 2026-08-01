import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipDirective, TooltipConfig, TooltipPosition, TooltipTitleColor } from './tooltip.directive';
import { TooltipRendererService } from './tooltip-renderer.service';
import { PreferencesService } from '@teensyrom-nx/ui/styles';

/**
 * Test host component for TooltipDirective
 */
@Component({
  standalone: true,
  imports: [TooltipDirective],
  template: `
    <div
      [libTooltip]="tooltipConfig()"
      data-testid="tooltip-host"
    >
      Hover target
    </div>
  `,
})
class TestHostComponent {
  tooltipConfig = signal<TooltipConfig>({
    body: 'Test tooltip',
    position: TooltipPosition.Top
  });
}

describe('TooltipDirective', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let hostElement: DebugElement;
  let mockTooltipService: {
    createTooltip: ReturnType<typeof vi.fn>;
    destroyTooltip: ReturnType<typeof vi.fn>;
  };
  let mockTooltipElement: HTMLElement;
  let mockPreferencesService: {
    tooltipsEnabled: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    // Ensure touch device detection is false by explicitly removing ontouchstart
    if ('ontouchstart' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).ontouchstart;
    }

    // Create mock tooltip element
    mockTooltipElement = document.createElement('div');
    mockTooltipElement.textContent = 'Mock tooltip';

    // Create mock service
    mockTooltipService = {
      createTooltip: vi.fn().mockReturnValue(mockTooltipElement),
      destroyTooltip: vi.fn(),
    };

    // Create mock preferences service
    mockPreferencesService = {
      tooltipsEnabled: vi.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: TooltipRendererService, useValue: mockTooltipService },
        { provide: PreferencesService, useValue: mockPreferencesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    hostElement = fixture.debugElement.query(By.css('[data-testid="tooltip-host"]'));
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create directive and attach to host element', () => {
    expect(hostElement).toBeTruthy();
    const directive = hostElement.injector.get(TooltipDirective);
    expect(directive).toBeTruthy();
  });

  describe('mouseenter behavior', () => {
    it('should call createTooltip on service when mouse enters', () => {
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);
      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Test tooltip', position: TooltipPosition.Top },
        hostElement.nativeElement,
        TooltipPosition.Top
      );
    });

    it('should pass correct position preference to service', () => {
      component.tooltipConfig.set({
        body: 'Test tooltip',
        position: TooltipPosition.Bottom
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Test tooltip', position: TooltipPosition.Bottom },
        hostElement.nativeElement,
        TooltipPosition.Bottom
      );
    });

    it('should not call createTooltip when both title and body are empty', () => {
      component.tooltipConfig.set({ title: '', body: '' });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));

      expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
    });

    it('should not call createTooltip when both title and body are undefined', () => {
      component.tooltipConfig.set({});
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));

      expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
    });

    it('should not create duplicate tooltip on multiple mouseenter events', () => {
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);
    });
  });

  describe('mouseleave behavior', () => {
    it('should call destroyTooltip on service when mouse leaves', () => {
      // Show tooltip first
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay
      mockTooltipService.createTooltip.mockClear();

      // Hide tooltip
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));

      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledTimes(1);
      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledWith(
        mockTooltipElement,
        hostElement.nativeElement
      );
    });

    it('should not call destroyTooltip if no tooltip is showing', () => {
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));

      expect(mockTooltipService.destroyTooltip).not.toHaveBeenCalled();
    });

    it('should allow re-showing tooltip after hiding', () => {
      // Show
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay
      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);

      // Hide
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledTimes(1);

      // Show again
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay
      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(2);
    });
  });

  describe('ngOnDestroy cleanup', () => {
    it('should destroy tooltip when directive is destroyed while tooltip is visible', () => {
      // Show tooltip
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      // Destroy directive (component destruction)
      fixture.destroy();

      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledTimes(1);
      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledWith(
        mockTooltipElement,
        hostElement.nativeElement
      );
    });

    it('should not call destroyTooltip if no tooltip is visible on destroy', () => {
      // Destroy without showing tooltip
      fixture.destroy();

      expect(mockTooltipService.destroyTooltip).not.toHaveBeenCalled();
    });

    it('should not error when destroying after manually hiding tooltip', () => {
      // Show and hide tooltip
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      mockTooltipService.destroyTooltip.mockClear();

      // Destroy directive
      expect(() => fixture.destroy()).not.toThrow();
      expect(mockTooltipService.destroyTooltip).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete hover cycle correctly', () => {
      // Hover in
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay
      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);

      // Hover out
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledTimes(1);
    });

    it('should handle tooltip config changes', () => {
      // Show initial tooltip
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay
      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Test tooltip', position: TooltipPosition.Top },
        expect.any(HTMLElement),
        TooltipPosition.Top
      );

      // Hide
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));

      // Change config and show again
      component.tooltipConfig.set({
        title: 'New Title',
        body: 'New tooltip text',
        position: TooltipPosition.Bottom
      });
      fixture.detectChanges();
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { title: 'New Title', body: 'New tooltip text', position: TooltipPosition.Bottom },
        expect.any(HTMLElement),
        TooltipPosition.Bottom
      );
    });

    it('should handle position changes', () => {
      // Show with Top position
      component.tooltipConfig.set({
        body: 'Test tooltip',
        position: TooltipPosition.Top
      });
      fixture.detectChanges();
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Test tooltip', position: TooltipPosition.Top },
        expect.any(HTMLElement),
        TooltipPosition.Top
      );

      // Hide and change position
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      component.tooltipConfig.set({
        body: 'Test tooltip',
        position: TooltipPosition.Bottom
      });
      fixture.detectChanges();

      // Show again with new position
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Test tooltip', position: TooltipPosition.Bottom },
        expect.any(HTMLElement),
        TooltipPosition.Bottom
      );
    });
  });

  describe('TooltipConfig API', () => {
    it('should render tooltip with title only', () => {
      component.tooltipConfig.set({
        title: 'Save',
        position: TooltipPosition.Top
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { title: 'Save', position: TooltipPosition.Top },
        expect.any(HTMLElement),
        TooltipPosition.Top
      );
    });

    it('should render tooltip with body only', () => {
      component.tooltipConfig.set({
        body: 'Click to save',
        position: TooltipPosition.Bottom
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Click to save', position: TooltipPosition.Bottom },
        expect.any(HTMLElement),
        TooltipPosition.Bottom
      );
    });

    it('should render tooltip with title and body', () => {
      component.tooltipConfig.set({
        title: 'Save',
        body: 'Click to save changes',
        position: TooltipPosition.Left
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { title: 'Save', body: 'Click to save changes', position: TooltipPosition.Left },
        expect.any(HTMLElement),
        TooltipPosition.Left
      );
    });

    it('should support all position enum values', () => {
      const positions = [
        TooltipPosition.Top,
        TooltipPosition.Bottom,
        TooltipPosition.Left,
        TooltipPosition.Right
      ];

      positions.forEach((position, index) => {
        component.tooltipConfig.set({
          body: 'Test',
          position
        });
        fixture.detectChanges();

        hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
        vi.advanceTimersByTime(500); // Advance past the default delay

        expect(mockTooltipService.createTooltip).toHaveBeenNthCalledWith(
          index + 1,
          { body: 'Test', position },
          expect.any(HTMLElement),
          position
        );

        // Clean up for next iteration
        hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      });
    });

    it('should support title color variants', () => {
      component.tooltipConfig.set({
        title: 'Save',
        titleColor: TooltipTitleColor.Highlight,
        body: 'Click to save',
        position: TooltipPosition.Top
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        {
          title: 'Save',
          titleColor: TooltipTitleColor.Highlight,
          body: 'Click to save',
          position: TooltipPosition.Top
        },
        expect.any(HTMLElement),
        TooltipPosition.Top
      );
    });

    it('should use default position when not specified', () => {
      component.tooltipConfig.set({
        body: 'Test tooltip'
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      vi.advanceTimersByTime(500); // Advance past the default delay

      // Should default to TooltipPosition.Top
      expect(mockTooltipService.createTooltip).toHaveBeenCalledWith(
        { body: 'Test tooltip' },
        expect.any(HTMLElement),
        TooltipPosition.Top
      );
    });

    it('should treat empty strings as not provided', () => {
      component.tooltipConfig.set({
        title: '',
        body: ''
      });
      fixture.detectChanges();

      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));

      // Should not create tooltip
      expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
    });
  });
});

describe('TooltipDirective - Touch Device Behavior', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostElement: DebugElement;
  let mockTooltipService: {
    createTooltip: ReturnType<typeof vi.fn>;
    destroyTooltip: ReturnType<typeof vi.fn>;
  };
  let mockTooltipElement: HTMLElement;
  let mockPreferencesService: {
    tooltipsEnabled: ReturnType<typeof vi.fn>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let originalOntouchstart: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Mock touch device detection BEFORE creating component
    originalOntouchstart = window.ontouchstart;
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: true,
    });

    // Create mock tooltip element
    mockTooltipElement = document.createElement('div');
    mockTooltipElement.textContent = 'Mock tooltip';

    // Create mock service
    mockTooltipService = {
      createTooltip: vi.fn().mockReturnValue(mockTooltipElement),
      destroyTooltip: vi.fn(),
    };

    // Create mock preferences service
    mockPreferencesService = {
      tooltipsEnabled: vi.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: TooltipRendererService, useValue: mockTooltipService },
        { provide: PreferencesService, useValue: mockPreferencesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostElement = fixture.debugElement.query(By.css('[data-testid="tooltip-host"]'));
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();

    // Restore original ontouchstart property
    if (originalOntouchstart === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).ontouchstart;
    } else {
      Object.defineProperty(window, 'ontouchstart', {
        configurable: true,
        value: originalOntouchstart,
      });
    }
  });

  it('should NOT show tooltip after long-press (700ms) on touch devices', () => {
    // Long-press support was removed; tooltips are disabled entirely on touch devices.
    hostElement.nativeElement.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(700); // Long-press threshold

    expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
  });

  it('should NOT show tooltip if touch ends before long-press threshold', () => {
    hostElement.nativeElement.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(500); // Less than 700ms threshold
    hostElement.nativeElement.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200); // Complete the 700ms

    expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
  });

  it('should ignore mouseenter on touch devices', () => {
    hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(500);

    expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
  });

  it('should ignore mouseleave on touch devices', () => {
    // Mouseleave is a no-op on touch devices (no tooltip was ever shown to hide).
    hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
    expect(mockTooltipService.destroyTooltip).not.toHaveBeenCalled();
  });

  it('should cancel long-press on touchcancel event', () => {
    hostElement.nativeElement.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(500);
    hostElement.nativeElement.dispatchEvent(new Event('touchcancel'));
    vi.advanceTimersByTime(200); // Complete the 700ms

    expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
  });

  it('should never create a tooltip across repeated long-presses on touch devices', () => {
    hostElement.nativeElement.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(700);
    hostElement.nativeElement.dispatchEvent(new Event('touchstart'));
    vi.advanceTimersByTime(700);

    expect(mockTooltipService.createTooltip).not.toHaveBeenCalled();
    expect(mockTooltipService.destroyTooltip).not.toHaveBeenCalled();
  });
});
