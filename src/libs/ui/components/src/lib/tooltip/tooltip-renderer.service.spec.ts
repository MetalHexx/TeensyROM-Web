import { TestBed } from '@angular/core/testing';
import { RendererFactory2 } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipRendererService } from './tooltip-renderer.service';
import { TooltipConfig, TooltipPosition, TooltipTitleColor } from './tooltip.directive';

describe('TooltipRendererService', () => {
  let service: TooltipRendererService;
  let mockRenderer: {
    createElement: ReturnType<typeof vi.fn>;
    createText: ReturnType<typeof vi.fn>;
    setAttribute: ReturnType<typeof vi.fn>;
    removeAttribute: ReturnType<typeof vi.fn>;
    addClass: ReturnType<typeof vi.fn>;
    removeClass: ReturnType<typeof vi.fn>;
    setStyle: ReturnType<typeof vi.fn>;
    appendChild: ReturnType<typeof vi.fn>;
    removeChild: ReturnType<typeof vi.fn>;
  };
  let mockTriggerElement: HTMLElement;
  let mockTooltipElement: HTMLElement;

  beforeEach(() => {
    // Create spy for Renderer2
    mockRenderer = {
      createElement: vi.fn(),
      createText: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addClass: vi.fn(),
      removeClass: vi.fn(),
      setStyle: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    };

    // Create mock RendererFactory2
    const mockRendererFactory = {
      createRenderer: vi.fn().mockReturnValue(mockRenderer),
    };

    TestBed.configureTestingModule({
      providers: [
        TooltipRendererService,
        { provide: RendererFactory2, useValue: mockRendererFactory },
      ],
    });

    service = TestBed.inject(TooltipRendererService);

    // Create mock elements
    mockTriggerElement = document.createElement('button');
    mockTooltipElement = document.createElement('div');

    // Setup default mock behaviors
    mockRenderer.createElement.mockReturnValue(mockTooltipElement);
    mockRenderer.createText.mockReturnValue(document.createTextNode(''));
  });

  afterEach(() => {
    // Cleanup any tooltips that may have been added to body
    const tooltips = document.body.querySelectorAll('[role="tooltip"]');
    tooltips.forEach((tooltip) => tooltip.remove());
  });

  describe('createTooltip', () => {
    it('should create tooltip element with correct role', () => {
      const config: TooltipConfig = { body: 'Test tooltip' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      expect(mockRenderer.createElement).toHaveBeenCalledWith('div');
      expect(mockRenderer.setAttribute).toHaveBeenCalledWith(
        mockTooltipElement,
        'role',
        'tooltip'
      );
    });

    it('should add tooltip class to element', () => {
      const config: TooltipConfig = { body: 'Test tooltip' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      expect(mockRenderer.addClass).toHaveBeenCalledWith(mockTooltipElement, 'lib-tooltip');
    });

    it('should create text node with provided text', () => {
      const tooltipText = 'Test tooltip content';
      const config: TooltipConfig = { body: tooltipText };

      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      expect(mockRenderer.createText).toHaveBeenCalledWith(tooltipText);
    });

    it('should append text node to tooltip element', () => {
      const mockTextNode = document.createTextNode('Test');
      mockRenderer.createText.mockReturnValue(mockTextNode);
      const config: TooltipConfig = { body: 'Test' };

      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      expect(mockRenderer.appendChild).toHaveBeenCalledWith(mockTooltipElement, mockTextNode);
    });

    it('should generate unique tooltip ID', () => {
      const config1: TooltipConfig = { body: 'Test 1' };
      const config2: TooltipConfig = { body: 'Test 2' };
      service.createTooltip(config1, mockTriggerElement, TooltipPosition.Top);
      service.createTooltip(config2, mockTriggerElement, TooltipPosition.Top);

      const setAttributeCalls = mockRenderer.setAttribute.mock.calls.filter(
        (call) => call[1] === 'id'
      );

      expect(setAttributeCalls.length).toBeGreaterThanOrEqual(2);
      const id1 = setAttributeCalls[0][2];
      const id2 = setAttributeCalls[1][2];
      expect(id1).toMatch(/^tooltip-\d+$/);
      expect(id2).toMatch(/^tooltip-\d+$/);
      expect(id1).not.toEqual(id2);
    });

    it('should set aria-describedby on trigger element', () => {
      const config: TooltipConfig = { body: 'Test' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      const setAttributeCalls = mockRenderer.setAttribute.mock.calls;
      const ariaCall = setAttributeCalls.find((call) => call[1] === 'aria-describedby');

      expect(ariaCall).toBeDefined();
      expect(ariaCall?.[0]).toBe(mockTriggerElement);
      expect(ariaCall?.[2]).toMatch(/^tooltip-\d+$/);
    });

    it('should apply base positioning styles', () => {
      const config: TooltipConfig = { body: 'Test' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Tooltip now uses CSS classes, only verifies visibility styles are set
      expect(mockRenderer.setStyle).toHaveBeenCalledWith(
        mockTooltipElement,
        'visibility',
        'hidden'
      );
      expect(mockRenderer.setStyle).toHaveBeenCalledWith(
        mockTooltipElement,
        'visibility',
        'visible'
      );
    });

    it('should apply visual styles', () => {
      const config: TooltipConfig = { body: 'Test' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Styles are now handled by CSS classes, verify class is added
      expect(mockRenderer.addClass).toHaveBeenCalledWith(mockTooltipElement, 'lib-tooltip');
      expect(mockRenderer.addClass).toHaveBeenCalledWith(mockTooltipElement, 'lib-tooltip--visible');
    });

    it('should append tooltip to document.body', () => {
      const config: TooltipConfig = { body: 'Test' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      expect(mockRenderer.appendChild).toHaveBeenCalledWith(document.body, mockTooltipElement);
    });

    it('should initially hide tooltip for measurement', () => {
      const config: TooltipConfig = { body: 'Test' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      const visibilityCall = mockRenderer.setStyle.mock.calls.find(
        (call) => call[1] === 'visibility' && call[2] === 'hidden'
      );

      expect(visibilityCall).toBeDefined();
    });

    it('should make tooltip visible after positioning', () => {
      const config: TooltipConfig = { body: 'Test' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      const visibilityCall = mockRenderer.setStyle.mock.calls.find(
        (call) => call[1] === 'visibility' && call[2] === 'visible'
      );

      expect(visibilityCall).toBeDefined();
    });

    it('should return the created tooltip element', () => {
      const config: TooltipConfig = { body: 'Test' };
      const result = service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      expect(result).toBe(mockTooltipElement);
    });

    it('should create title element with correct class when title provided', () => {
      const config: TooltipConfig = { title: 'Test Title' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify createElement was called for title div
      expect(mockRenderer.createElement).toHaveBeenCalled();
      // Verify title class was added
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__title');
      // Verify text was created with title text
      expect(mockRenderer.createText).toHaveBeenCalledWith('Test Title');
    });

    it('should create body element with correct class when body provided', () => {
      const config: TooltipConfig = { body: 'Test Body' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify body class was added
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__body');
      // Verify text was created with body text
      expect(mockRenderer.createText).toHaveBeenCalledWith('Test Body');
    });

    it('should create both title and body when both provided', () => {
      const config: TooltipConfig = { title: 'Test Title', body: 'Test Body' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify both classes were added
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__title');
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__body');
      // Verify both texts were created
      expect(mockRenderer.createText).toHaveBeenCalledWith('Test Title');
      expect(mockRenderer.createText).toHaveBeenCalledWith('Test Body');
    });

    it('should apply default color class when titleColor not specified', () => {
      const config: TooltipConfig = { title: 'Test Title' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify default color class was added
      expect(mockRenderer.addClass).toHaveBeenCalledWith(
        expect.anything(),
        'lib-tooltip__title--default'
      );
    });

    it('should apply highlight color class when titleColor is Highlight', () => {
      const config: TooltipConfig = {
        title: 'Test Title',
        titleColor: TooltipTitleColor.Highlight,
      };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify highlight color class was added
      expect(mockRenderer.addClass).toHaveBeenCalledWith(
        expect.anything(),
        'lib-tooltip__title--highlight'
      );
    });

    it('should not create title element when title is empty string', () => {
      mockRenderer.createText.mockClear();
      mockRenderer.addClass.mockClear();
      
      const config: TooltipConfig = { title: '', body: 'Test Body' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify title class was NOT added
      const titleClassCalls = mockRenderer.addClass.mock.calls.filter(
        (call) => call[1] === 'lib-tooltip__title'
      );
      expect(titleClassCalls.length).toBe(0);
      
      // But body should be created
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__body');
    });

    it('should not create body element when body is empty string', () => {
      mockRenderer.createText.mockClear();
      mockRenderer.addClass.mockClear();
      
      const config: TooltipConfig = { title: 'Test Title', body: '' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify body class was NOT added
      const bodyClassCalls = mockRenderer.addClass.mock.calls.filter(
        (call) => call[1] === 'lib-tooltip__body'
      );
      expect(bodyClassCalls.length).toBe(0);
      
      // But title should be created
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__title');
    });

    it('should not create title element when title is whitespace only', () => {
      mockRenderer.createText.mockClear();
      mockRenderer.addClass.mockClear();
      
      const config: TooltipConfig = { title: '   ', body: 'Test Body' };
      service.createTooltip(config, mockTriggerElement, TooltipPosition.Top);

      // Verify title class was NOT added
      const titleClassCalls = mockRenderer.addClass.mock.calls.filter(
        (call) => call[1] === 'lib-tooltip__title'
      );
      expect(titleClassCalls.length).toBe(0);
      
      // But body should be created
      expect(mockRenderer.addClass).toHaveBeenCalledWith(expect.anything(), 'lib-tooltip__body');
    });
  });

  describe('destroyTooltip', () => {
    beforeEach(() => {
      // Create a real tooltip for destroy tests
      mockTooltipElement = document.createElement('div');
      mockTooltipElement.setAttribute('role', 'tooltip');
      document.body.appendChild(mockTooltipElement);
    });

    it('should remove aria-describedby from trigger element', () => {
      vi.useFakeTimers();
      service.destroyTooltip(mockTooltipElement, mockTriggerElement);

      expect(mockRenderer.removeAttribute).toHaveBeenCalledWith(
        mockTriggerElement,
        'aria-describedby'
      );
      vi.useRealTimers();
    });

    it('should remove tooltip element from DOM', () => {
      vi.useFakeTimers();
      service.destroyTooltip(mockTooltipElement, mockTriggerElement);

      // Should removeClass to trigger fade-out
      expect(mockRenderer.removeClass).toHaveBeenCalledWith(mockTooltipElement, 'lib-tooltip--visible');

      // Should remove from DOM after animation (150ms)
      vi.advanceTimersByTime(150);
      expect(mockRenderer.removeChild).toHaveBeenCalledWith(document.body, mockTooltipElement);
      vi.useRealTimers();
    });
  });

  describe('position calculation', () => {
    let realTriggerElement: HTMLElement;
    let realService: TooltipRendererService;

    beforeEach(() => {
      // Use real service for position calculation tests
      realService = new TooltipRendererService(TestBed.inject(RendererFactory2));

      // Create real trigger element with specific position
      realTriggerElement = document.createElement('button');
      realTriggerElement.textContent = 'Trigger';
      realTriggerElement.style.position = 'absolute';
      realTriggerElement.style.left = '100px';
      realTriggerElement.style.top = '200px';
      realTriggerElement.style.width = '80px';
      realTriggerElement.style.height = '30px';
      document.body.appendChild(realTriggerElement);
    });

    afterEach(() => {
      if (realTriggerElement && realTriggerElement.parentNode) {
        realTriggerElement.remove();
      }
    });

    it('should position tooltip centered horizontally over trigger', () => {
      const config: TooltipConfig = { body: 'Test tooltip' };
      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Top);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const tooltipCenter = tooltipRect.left + tooltipRect.width / 2;

      // Tooltip should be centered horizontally (allow 2px tolerance for rounding)
      expect(Math.abs(tooltipCenter - triggerCenter)).toBeLessThan(2);

      tooltip.remove();
    });

    it('should position tooltip above trigger when position is "above" and space available', () => {
      // Position trigger in middle of screen
      realTriggerElement.style.top = '400px';
      const config: TooltipConfig = { body: 'Test tooltip' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Top);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Tooltip should be above trigger (bottom of tooltip < top of trigger with gap)
      expect(tooltipRect.bottom).toBeLessThanOrEqual(triggerRect.top);

      tooltip.remove();
    });

    it('should position tooltip below trigger when position is "below"', () => {
      realTriggerElement.style.top = '100px';
      const config: TooltipConfig = { body: 'Test tooltip' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Bottom);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Tooltip should be below trigger (top of tooltip >= bottom of trigger)
      expect(tooltipRect.top).toBeGreaterThanOrEqual(triggerRect.bottom);

      tooltip.remove();
    });

    it('should flip to below when "above" would overflow top of viewport', () => {
      // Position trigger near top of viewport
      realTriggerElement.style.top = '10px';
      const config: TooltipConfig = { body: 'Test tooltip' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Top);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Should flip to below when above would overflow
      expect(tooltipRect.top).toBeGreaterThanOrEqual(triggerRect.bottom);

      tooltip.remove();
    });

    it('should flip to above when "below" would overflow bottom of viewport', () => {
      // Position trigger near bottom of viewport
      const viewportHeight = window.innerHeight;
      realTriggerElement.style.top = `${viewportHeight - 50}px`;
      const config: TooltipConfig = { body: 'Test tooltip' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Bottom);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Should flip to above when below would overflow
      expect(tooltipRect.bottom).toBeLessThanOrEqual(triggerRect.top);

      tooltip.remove();
    });

    it('should clamp tooltip to left edge when trigger is too far left', () => {
      realTriggerElement.style.left = '0px';
      const config: TooltipConfig = { body: 'Test tooltip text' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Top);

      const tooltipRect = tooltip.getBoundingClientRect();

      // Should not go off left edge
      expect(tooltipRect.left).toBeGreaterThanOrEqual(0);

      tooltip.remove();
    });

    it('should clamp tooltip to right edge when trigger is too far right', () => {
      const viewportWidth = window.innerWidth;
      realTriggerElement.style.left = `${viewportWidth - 50}px`;
      const config: TooltipConfig = { body: 'Test tooltip text' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Top);

      const tooltipRect = tooltip.getBoundingClientRect();

      // Should not go off right edge
      expect(tooltipRect.right).toBeLessThanOrEqual(viewportWidth);

      tooltip.remove();
    });

    it('should maintain 8px gap between tooltip and trigger', () => {
      // Create mock elements for this test
      const testTrigger = document.createElement('button');
      const testTooltip = document.createElement('div');
      const config: TooltipConfig = { body: 'Test' };
      
      // Mock trigger element bounds
      const triggerRect = {
        top: 400,
        bottom: 420,
        left: 100,
        right: 200,
        width: 100,
        height: 20,
        x: 100,
        y: 400,
        toJSON: () => ({})
      } as DOMRect;

      // Mock tooltip element bounds
      const tooltipRect = {
        top: 0,
        bottom: 30,
        left: 0,
        right: 120,
        width: 120,
        height: 30,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect;

      vi.spyOn(testTrigger, 'getBoundingClientRect').mockReturnValue(triggerRect);
      vi.spyOn(testTooltip, 'getBoundingClientRect').mockReturnValue(tooltipRect);
      
      // Mock renderer to return our test tooltip
      vi.spyOn(realService['renderer'], 'createElement').mockReturnValue(testTooltip);
      vi.spyOn(realService['renderer'], 'setStyle');

      realService.createTooltip(config, testTrigger, TooltipPosition.Top);

      // Find the setStyle call for 'top' - should be triggerTop - tooltipHeight - gap
      // 400 - 30 - 8 = 362
      expect(realService['renderer'].setStyle).toHaveBeenCalledWith(testTooltip, 'top', '362px');
    });

    it('should position tooltip to the left of trigger element', () => {
      const config: TooltipConfig = { body: 'Test' };
      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Left);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Tooltip should be left of trigger (right of tooltip <= left of trigger)
      expect(tooltipRect.right).toBeLessThanOrEqual(triggerRect.left);

      tooltip.remove();
    });

    it('should position tooltip to the right of trigger element', () => {
      const config: TooltipConfig = { body: 'Test' };
      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Right);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Tooltip should be right of trigger (left of tooltip >= right of trigger)
      expect(tooltipRect.left).toBeGreaterThanOrEqual(triggerRect.right);

      tooltip.remove();
    });

    it('should center tooltip vertically when positioned left or right', () => {
      const config: TooltipConfig = { body: 'Test' };
      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Left);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      const triggerCenter = triggerRect.top + triggerRect.height / 2;
      const tooltipCenter = tooltipRect.top + tooltipRect.height / 2;

      // Tooltip should be centered vertically (allow 2px tolerance for rounding)
      expect(Math.abs(tooltipCenter - triggerCenter)).toBeLessThan(2);

      tooltip.remove();
    });

    it('should flip to right when left would overflow left viewport edge', () => {
      // Position trigger near left edge
      realTriggerElement.style.left = '10px';
      const config: TooltipConfig = { body: 'Test tooltip' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Left);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Should flip to right when left would overflow
      expect(tooltipRect.left).toBeGreaterThanOrEqual(triggerRect.right);

      tooltip.remove();
    });

    it('should flip to left when right would overflow right viewport edge', () => {
      // Position trigger near right edge
      const viewportWidth = window.innerWidth;
      realTriggerElement.style.left = `${viewportWidth - 50}px`;
      const config: TooltipConfig = { body: 'Test tooltip' };

      const tooltip = realService.createTooltip(config, realTriggerElement, TooltipPosition.Right);

      const triggerRect = realTriggerElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Should flip to left when right would overflow
      expect(tooltipRect.right).toBeLessThanOrEqual(triggerRect.left);

      tooltip.remove();
    });
  });

  describe('integration', () => {
    it('should create multiple tooltips with unique IDs via ARIA relationships', () => {
      // Reset mock to track setAttribute calls
      mockRenderer.setAttribute.mockClear();
      
      const trigger1 = document.createElement('button');
      const trigger2 = document.createElement('button');
      const config1: TooltipConfig = { body: 'Tooltip 1' };
      const config2: TooltipConfig = { body: 'Tooltip 2' };

      service.createTooltip(config1, trigger1, TooltipPosition.Top);
      service.createTooltip(config2, trigger2, TooltipPosition.Bottom);

      // Find the setAttribute calls for aria-describedby on both triggers
      const aria1Calls = mockRenderer.setAttribute.mock.calls.filter(
        call => call[0] === trigger1 && call[1] === 'aria-describedby'
      );
      const aria2Calls = mockRenderer.setAttribute.mock.calls.filter(
        call => call[0] === trigger2 && call[1] === 'aria-describedby'
      );
      
      expect(aria1Calls.length).toBe(1);
      expect(aria2Calls.length).toBe(1);
      
      const aria1Value = aria1Calls[0][2];
      const aria2Value = aria2Calls[0][2];
      
      // Verify IDs are unique and match expected pattern
      expect(aria1Value).toMatch(/^tooltip-\d+$/);
      expect(aria2Value).toMatch(/^tooltip-\d+$/);
      expect(aria1Value).not.toEqual(aria2Value);
    });

    it('should properly clean up all resources on destroy', () => {
      vi.useFakeTimers();
      // Reset mock to track calls
      mockRenderer.setAttribute.mockClear();
      mockRenderer.removeAttribute.mockClear();
      mockRenderer.removeChild.mockClear();
      mockRenderer.removeClass.mockClear();
      
      const trigger = document.createElement('button');
      const config: TooltipConfig = { body: 'Test' };
      const tooltip = service.createTooltip(config, trigger, TooltipPosition.Top);

      // Verify ARIA relationship was established
      const setAttributeCalls = mockRenderer.setAttribute.mock.calls.filter(
        call => call[0] === trigger && call[1] === 'aria-describedby'
      );
      expect(setAttributeCalls.length).toBe(1);
      const tooltipId = setAttributeCalls[0][2];
      expect(tooltipId).toMatch(/^tooltip-\d+$/);

      // Destroy and verify cleanup
      service.destroyTooltip(tooltip, trigger);

      // Verify ARIA relationship was removed
      expect(mockRenderer.removeAttribute).toHaveBeenCalledWith(trigger, 'aria-describedby');
      
      // Verify fade-out class was removed
      expect(mockRenderer.removeClass).toHaveBeenCalledWith(tooltip, 'lib-tooltip--visible');
      
      // Verify tooltip removal from DOM after animation
      vi.advanceTimersByTime(150);
      expect(mockRenderer.removeChild).toHaveBeenCalledWith(document.body, tooltip);
      
      vi.useRealTimers();
    });
  });
});
