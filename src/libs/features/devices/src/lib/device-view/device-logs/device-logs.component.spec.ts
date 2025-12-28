import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceLogsComponent } from './device-logs.component';
import { DEVICE_LOGS_SERVICE, IDeviceLogsService } from '@teensyrom-nx/domain';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('DeviceLogsComponent', () => {
  let component: DeviceLogsComponent;
  let fixture: ComponentFixture<DeviceLogsComponent>;
  let mockLogsService: Partial<IDeviceLogsService>;
  let logsSignal: WritableSignal<string[]>;
  let isConnectedSignal: WritableSignal<boolean>;

  beforeEach(async () => {
    // Create writable signals for test control
    logsSignal = signal<string[]>([]);
    isConnectedSignal = signal<boolean>(false);

    // Create contract-typed mock service
    mockLogsService = {
      logs: logsSignal.asReadonly(),
      isConnected: isConnectedSignal.asReadonly(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      clear: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DeviceLogsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DEVICE_LOGS_SERVICE, useValue: mockLogsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Make scrollTop and scrollHeight writable in jsdom for testing
    const logsContent = fixture.nativeElement.querySelector('.logs-content');
    if (logsContent) {
      Object.defineProperty(logsContent, 'scrollTop', {
        writable: true,
        configurable: true,
        value: 0,
      });
      Object.defineProperty(logsContent, 'scrollHeight', {
        writable: true,
        configurable: true,
        value: 0,
      });
      Object.defineProperty(logsContent, 'clientHeight', {
        writable: true,
        configurable: true,
        value: 150,
      });
    }
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should inject logs service', () => {
      expect(component.logs).toBeDefined();
      expect(component.isConnected).toBeDefined();
    });

    it('should initialize with empty logs', () => {
      expect(component.logs()).toEqual([]);
    });

    it('should initialize with disconnected state', () => {
      expect(component.isConnected()).toBe(false);
    });

    it('should display "No logs to display" when no logs exist', () => {
      const noLogsMessage = fixture.nativeElement.querySelector('.no-logs');
      expect(noLogsMessage).toBeTruthy();
      expect(noLogsMessage.textContent).toContain('No logs to display');
    });
  });

  describe('Start/Stop Logs', () => {
    it('should show start button when disconnected', () => {
      isConnectedSignal.set(false);
      fixture.detectChanges();

      const startButton = fixture.nativeElement.querySelector('[ariaLabel="Start Logs"]');
      expect(startButton).toBeTruthy();
    });

    it('should show stop button when connected', () => {
      isConnectedSignal.set(true);
      fixture.detectChanges();

      const stopButton = fixture.nativeElement.querySelector('[ariaLabel="Stop Logs"]');
      expect(stopButton).toBeTruthy();
    });

    it('should call logsService.connect when start button clicked', () => {
      isConnectedSignal.set(false);
      fixture.detectChanges();

      component.startLogs();
      fixture.detectChanges();

      expect(mockLogsService.connect).toHaveBeenCalledOnce();
    });

    it('should call logsService.disconnect when stop button clicked', () => {
      isConnectedSignal.set(true);
      fixture.detectChanges();

      component.stopLogs();
      fixture.detectChanges();

      expect(mockLogsService.disconnect).toHaveBeenCalledOnce();
    });

    it('should destroy effect when stopping logs', () => {
      isConnectedSignal.set(true);
      fixture.detectChanges();

      const effectRef = component.logEffectRef;
      expect(effectRef).toBeDefined();
      
      const destroySpy = vi.spyOn(effectRef as { destroy: () => void }, 'destroy');
      
      component.stopLogs();

      expect(destroySpy).toHaveBeenCalledOnce();
    });
  });

  describe('Clear Logs', () => {
    it('should show clear button', () => {
      const clearButton = fixture.nativeElement.querySelector('[ariaLabel="Clear Logs"]');
      expect(clearButton).toBeTruthy();
    });

    it('should call logsService.clear when clear button clicked', () => {
      component.clearLogs();
      fixture.detectChanges();

      expect(mockLogsService.clear).toHaveBeenCalledOnce();
    });
  });

  describe('Logs Display', () => {
    it('should display log lines when logs exist', () => {
      logsSignal.set(['Log line 1', 'Log line 2', 'Log line 3']);
      fixture.detectChanges();

      const logLines = fixture.nativeElement.querySelectorAll('.log-line');
      expect(logLines.length).toBe(3);
      expect(logLines[0].textContent).toBe('Log line 1');
      expect(logLines[1].textContent).toBe('Log line 2');
      expect(logLines[2].textContent).toBe('Log line 3');
    });

    it('should hide "No logs to display" message when logs exist', () => {
      logsSignal.set(['Log line 1']);
      fixture.detectChanges();

      const noLogsMessage = fixture.nativeElement.querySelector('.no-logs');
      expect(noLogsMessage).toBeFalsy();
    });

    it('should update display when new logs are added', () => {
      logsSignal.set(['Log 1']);
      fixture.detectChanges();

      let logLines = fixture.nativeElement.querySelectorAll('.log-line');
      expect(logLines.length).toBe(1);

      logsSignal.set(['Log 1', 'Log 2']);
      fixture.detectChanges();

      logLines = fixture.nativeElement.querySelectorAll('.log-line');
      expect(logLines.length).toBe(2);
    });
  });

  describe('Auto-Scroll Behavior', () => {
    it('should trigger scroll when new logs arrive', async () => {
      logsSignal.set(['Log 1']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');
      const initialScrollTop = logsContent.scrollTop;

      // Set scrollHeight to simulate content that needs scrolling
      Object.defineProperty(logsContent, 'scrollHeight', { value: 500, configurable: true });

      // Add more logs
      logsSignal.set(['Log 1', 'Log 2']);
      fixture.detectChanges();

      // Wait for requestAnimationFrame to execute (double RAF)
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      expect(logsContent.scrollTop).toBeGreaterThan(initialScrollTop);
    });

    it('should scroll to bottom when scrollToElement is called', () => {
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');
      component.scrollToElement();

      expect(logsContent.scrollTop).toBe(logsContent.scrollHeight);
    });

    it('should not throw error when scrollToElement called before view init', () => {
      const newFixture = TestBed.createComponent(DeviceLogsComponent);

      expect(() => {
        newFixture.componentRef.injector.get(DeviceLogsComponent).scrollToElement();
      }).not.toThrow();
    });

    it('should scroll to bottom on ngAfterViewInit when logs exist', async () => {
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');
      const initialScrollTop = logsContent.scrollTop;

      // Set scrollHeight to simulate content that needs scrolling
      Object.defineProperty(logsContent, 'scrollHeight', { value: 500, configurable: true });

      // Trigger ngAfterViewInit by creating a new component
      const newFixture = TestBed.createComponent(DeviceLogsComponent);
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      newFixture.detectChanges();

      // Set scrollHeight on the new fixture's element as well
      const newLogsContent = newFixture.nativeElement.querySelector('.logs-content');
      Object.defineProperty(newLogsContent, 'scrollTop', { writable: true, configurable: true, value: 0 });
      Object.defineProperty(newLogsContent, 'scrollHeight', { value: 500, configurable: true });
      Object.defineProperty(newLogsContent, 'clientHeight', { value: 150, configurable: true });

      // Wait for double RAF
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      expect(newFixture.nativeElement.querySelector('.logs-content')?.scrollTop).toBeGreaterThan(0);
    });
  });

  describe('Manual Scroll Detection', () => {
    it('should disable auto-scroll when user scrolls up', () => {
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');

      // Mock scroll position to simulate user scrolling up (more than 100px from bottom)
      Object.defineProperty(logsContent, 'scrollHeight', { value: 300, configurable: true });
      Object.defineProperty(logsContent, 'scrollTop', { value: 50, configurable: true });
      Object.defineProperty(logsContent, 'clientHeight', { value: 150, configurable: true });

      component.onScroll();

      // distanceFromBottom = 300 - 50 - 150 = 100, which is NOT < threshold(100), so autoScroll = false
      expect(component.autoScroll()).toBe(false);
    });

    it('should enable auto-scroll when user scrolls to bottom', () => {
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');

      // Mock scroll position to simulate user at bottom (within 100px threshold)
      Object.defineProperty(logsContent, 'scrollHeight', { value: 300, configurable: true });
      Object.defineProperty(logsContent, 'scrollTop', { value: 150, configurable: true });
      Object.defineProperty(logsContent, 'clientHeight', { value: 150, configurable: true });

      component.onScroll();

      // distanceFromBottom = 300 - 150 - 150 = 0, which is < threshold(100)
      expect(component.autoScroll()).toBe(true);
    });

    it('should use 100px threshold for "at bottom" detection', () => {
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');

      // Mock position exactly 99px from bottom (within threshold)
      Object.defineProperty(logsContent, 'scrollHeight', { value: 300, configurable: true });
      Object.defineProperty(logsContent, 'scrollTop', { value: 51, configurable: true });
      Object.defineProperty(logsContent, 'clientHeight', { value: 150, configurable: true });

      component.onScroll();

      // distanceFromBottom = 300 - 51 - 150 = 99, which is < threshold(100)
      expect(component.autoScroll()).toBe(true);
    });

    it('should disable auto-scroll when just beyond threshold', () => {
      logsSignal.set(['Log 1', 'Log 2', 'Log 3']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');

      // Mock position exactly 100px from bottom (at threshold boundary)
      Object.defineProperty(logsContent, 'scrollHeight', { value: 300, configurable: true });
      Object.defineProperty(logsContent, 'scrollTop', { value: 50, configurable: true });
      Object.defineProperty(logsContent, 'clientHeight', { value: 150, configurable: true });

      component.onScroll();

      // distanceFromBottom = 300 - 50 - 150 = 100, which is NOT < threshold(100)
      expect(component.autoScroll()).toBe(false);
    });

    it('should not scroll automatically when auto-scroll is disabled', async () => {
      logsSignal.set(['Log 1']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');

      // Disable auto-scroll
      component.autoScroll.set(false);

      // Store initial scrollTop
      const initialScrollTop = logsContent.scrollTop;

      // Add new log
      logsSignal.set(['Log 1', 'Log 2']);
      fixture.detectChanges();

      // Wait for double RAF
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      // Should not have scrolled
      expect(logsContent.scrollTop).toBe(initialScrollTop);
    });

    it('should resume auto-scroll after user returns to bottom', async () => {
      logsSignal.set(['Log 1']);
      fixture.detectChanges();

      const logsContent = fixture.nativeElement.querySelector('.logs-content');

      // User scrolls up - disable auto-scroll
      Object.defineProperty(logsContent, 'scrollHeight', { value: 300, configurable: true });
      Object.defineProperty(logsContent, 'scrollTop', { value: 50, configurable: true });
      Object.defineProperty(logsContent, 'clientHeight', { value: 150, configurable: true });
      component.onScroll();

      expect(component.autoScroll()).toBe(false);

      // User scrolls back to bottom
      Object.defineProperty(logsContent, 'scrollTop', { value: 150, configurable: true });
      component.onScroll();

      expect(component.autoScroll()).toBe(true);

      // Add new log - should auto-scroll now
      const initialScrollTop = logsContent.scrollTop;
      logsSignal.set(['Log 1', 'Log 2']);
      fixture.detectChanges();

      // Wait for double RAF
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      expect(logsContent.scrollTop).toBeGreaterThan(initialScrollTop);
    });
  });

  describe('Scroll Event Binding', () => {
    it('should trigger onScroll when scroll event fires', () => {
      const onScrollSpy = vi.spyOn(component, 'onScroll');
      
      const logsContent = fixture.nativeElement.querySelector('.logs-content');
      logsContent.dispatchEvent(new Event('scroll'));

      expect(onScrollSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid log additions without error', async () => {
      for (let i = 0; i < 10; i++) {
        logsSignal.update((logs) => [...logs, `Log ${i}`]);
        fixture.detectChanges();
      }

      // Wait for double RAF
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const logLines = fixture.nativeElement.querySelectorAll('.log-line');
      expect(logLines.length).toBe(10);
    });

    it('should handle clearing logs during active connection', () => {
      isConnectedSignal.set(true);
      logsSignal.set(['Log 1', 'Log 2']);
      fixture.detectChanges();

      if (mockLogsService.clear) {
        mockLogsService.clear();
      }
      logsSignal.set([]);
      fixture.detectChanges();

      const noLogsMessage = fixture.nativeElement.querySelector('.no-logs');
      expect(noLogsMessage).toBeTruthy();
    });
  });

  describe('Component Teardown', () => {
    it('should have effect reference available for cleanup', () => {
      // Verify effect exists and can be destroyed
      expect(component.logEffectRef).toBeDefined();
      
      // stopLogs will destroy the effect explicitly
      component.stopLogs();
      
      // Effect should still be defined after manual destroy
      expect(component.logEffectRef).toBeDefined();
    });
  });
});
