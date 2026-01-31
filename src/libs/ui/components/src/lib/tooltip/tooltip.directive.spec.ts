import { Component, DebugElement, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TooltipDirective, TooltipConfig, TooltipPosition, TooltipTitleColor } from './tooltip.directive';
import { TooltipRendererService } from './tooltip-renderer.service';

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

  beforeEach(async () => {
    // Create mock tooltip element
    mockTooltipElement = document.createElement('div');
    mockTooltipElement.textContent = 'Mock tooltip';

    // Create mock service
    mockTooltipService = {
      createTooltip: vi.fn().mockReturnValue(mockTooltipElement),
      destroyTooltip: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: TooltipRendererService, useValue: mockTooltipService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    hostElement = fixture.debugElement.query(By.css('[data-testid="tooltip-host"]'));
    fixture.detectChanges();
  });

  it('should create directive and attach to host element', () => {
    expect(hostElement).toBeTruthy();
    const directive = hostElement.injector.get(TooltipDirective);
    expect(directive).toBeTruthy();
  });

  describe('mouseenter behavior', () => {
    it('should call createTooltip on service when mouse enters', () => {
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));

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

      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);
    });
  });

  describe('mouseleave behavior', () => {
    it('should call destroyTooltip on service when mouse leaves', () => {
      // Show tooltip first
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
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
      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);

      // Hide
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledTimes(1);

      // Show again
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(2);
    });
  });

  describe('ngOnDestroy cleanup', () => {
    it('should destroy tooltip when directive is destroyed while tooltip is visible', () => {
      // Show tooltip
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));

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
      expect(mockTooltipService.createTooltip).toHaveBeenCalledTimes(1);

      // Hover out
      hostElement.nativeElement.dispatchEvent(new Event('mouseleave'));
      expect(mockTooltipService.destroyTooltip).toHaveBeenCalledTimes(1);
    });

    it('should handle tooltip config changes', () => {
      // Show initial tooltip
      hostElement.nativeElement.dispatchEvent(new Event('mouseenter'));
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
