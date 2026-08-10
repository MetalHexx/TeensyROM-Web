import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ConfirmationDialogComponent', () => {
  let component: ConfirmationDialogComponent;
  let fixture: ComponentFixture<ConfirmationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('Input Properties - Default Values', () => {
    it('should initialize with default title "Confirm Action"', () => {
      expect(component.title()).toBe('Confirm Action');
    });

    it('should initialize with empty message', () => {
      expect(component.message()).toBe('');
    });

    it('should initialize with default confirm label "Delete"', () => {
      expect(component.confirmLabel()).toBe('Delete');
    });

    it('should initialize with default cancel label "Cancel"', () => {
      expect(component.cancelLabel()).toBe('Cancel');
    });
  });

  describe('Input Properties - Custom Values', () => {
    it('should display custom title when provided', () => {
      fixture.componentRef.setInput('title', 'Delete Preset');
      fixture.detectChanges();

      expect(component.title()).toBe('Delete Preset');

      const headerElement = fixture.nativeElement.querySelector('.dialog-header h2');
      expect(headerElement?.textContent?.trim()).toBe('Delete Preset');
    });

    it('should display custom message when provided', () => {
      const customMessage = 'Are you sure you want to delete this preset?';
      fixture.componentRef.setInput('message', customMessage);
      fixture.detectChanges();

      expect(component.message()).toBe(customMessage);

      const messageElement = fixture.nativeElement.querySelector('.dialog-message p');
      expect(messageElement?.textContent?.trim()).toBe(customMessage);
    });

    it('should display custom confirm label when provided', () => {
      fixture.componentRef.setInput('confirmLabel', 'Remove');
      fixture.detectChanges();

      expect(component.confirmLabel()).toBe('Remove');
    });

    it('should display custom cancel label when provided', () => {
      fixture.componentRef.setInput('cancelLabel', 'Keep');
      fixture.detectChanges();

      expect(component.cancelLabel()).toBe('Keep');
    });
  });

  describe('Icon Display', () => {
    it('should display warning icon in header', () => {
      const warningIcon = fixture.nativeElement.querySelector('.warning-icon');
      expect(warningIcon).toBeTruthy();
      expect(warningIcon?.textContent?.trim()).toBe('warning');
    });

    it('should apply error color styling to warning icon', () => {
      const warningIcon = fixture.nativeElement.querySelector('.warning-icon');
      expect(warningIcon?.classList.contains('warning-icon')).toBe(true);
    });
  });

  describe('Event Emission - Button Clicks', () => {
    it('should emit confirmed event when confirm button is clicked', () => {
      let emitted = false;
      component.confirmed.subscribe(() => (emitted = true));

      component.onConfirmClick();

      expect(emitted).toBe(true);
    });

    it('should emit cancelled event when cancel button is clicked', () => {
      let emitted = false;
      component.cancelled.subscribe(() => (emitted = true));

      component.onCancelClick();

      expect(emitted).toBe(true);
    });
  });

  describe('Event Emission - Keyboard Navigation', () => {
    it('should emit confirmed event when Enter key is pressed', () => {
      let emitted = false;
      component.confirmed.subscribe(() => (emitted = true));

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      component.onKeyDown(event);

      expect(emitted).toBe(true);
    });

    it('should emit cancelled event when Escape key is pressed', () => {
      let emitted = false;
      component.cancelled.subscribe(() => (emitted = true));

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.onKeyDown(event);

      expect(emitted).toBe(true);
    });

    it('should not emit any event for other keys', () => {
      let confirmedEmitted = false;
      let cancelledEmitted = false;

      component.confirmed.subscribe(() => (confirmedEmitted = true));
      component.cancelled.subscribe(() => (cancelledEmitted = true));

      const event = new KeyboardEvent('keydown', { key: 'a' });
      component.onKeyDown(event);

      expect(confirmedEmitted).toBe(false);
      expect(cancelledEmitted).toBe(false);
    });
  });

  describe('Template Structure', () => {
    it('should render dialog header with title', () => {
      const header = fixture.nativeElement.querySelector('.dialog-header');
      expect(header).toBeTruthy();

      const title = header?.querySelector('h2');
      expect(title?.textContent?.trim()).toBe('Confirm Action');
    });

    it('should render dialog message area', () => {
      fixture.componentRef.setInput('message', 'Test message');
      fixture.detectChanges();

      const messageArea = fixture.nativeElement.querySelector('.dialog-message');
      expect(messageArea).toBeTruthy();

      const paragraph = messageArea?.querySelector('p');
      expect(paragraph?.textContent?.trim()).toBe('Test message');
    });

    it('should render button row with two buttons', () => {
      const buttonRow = fixture.nativeElement.querySelector('.button-row');
      expect(buttonRow).toBeTruthy();

      const buttons = buttonRow?.querySelectorAll('lib-icon-button');
      expect(buttons?.length).toBe(2);
    });
  });

  describe('Labelled action mode (showLabels)', () => {
    it('renders icon-only buttons with today\'s icons when no new inputs are set', () => {
      expect(fixture.nativeElement.querySelectorAll('lib-icon-button').length).toBe(2);
      expect(fixture.nativeElement.querySelectorAll('lib-action-button').length).toBe(0);

      const icons = Array.from(fixture.nativeElement.querySelectorAll('mat-icon')).map((el: Element) =>
        el.textContent?.trim()
      );
      expect(icons).toContain('delete');
      expect(icons).toContain('close');
    });

    it('renders two labelled buttons with no trash icon when showLabels is true', () => {
      fixture.componentRef.setInput('confirmLabel', 'Cancel transfer');
      fixture.componentRef.setInput('cancelLabel', 'Keep transferring');
      fixture.componentRef.setInput('showLabels', true);
      fixture.componentRef.setInput('confirmIcon', 'close');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('lib-icon-button').length).toBe(0);

      const actionButtons = fixture.nativeElement.querySelectorAll('lib-action-button');
      expect(actionButtons.length).toBe(2);

      const labels = Array.from(actionButtons).map(
        (el: Element) => el.querySelector('.icon-label-text.primary')?.textContent?.trim()
      );
      expect(labels).toEqual(['Keep transferring', 'Cancel transfer']);

      const icons = Array.from(fixture.nativeElement.querySelectorAll('mat-icon')).map((el: Element) =>
        el.textContent?.trim()
      );
      expect(icons).not.toContain('delete');
    });

    it('still emits confirmed and cancelled from the labelled buttons', () => {
      fixture.componentRef.setInput('showLabels', true);
      fixture.detectChanges();

      let confirmed = false;
      let cancelled = false;
      component.confirmed.subscribe(() => (confirmed = true));
      component.cancelled.subscribe(() => (cancelled = true));

      const buttons = fixture.nativeElement.querySelectorAll('lib-action-button button');
      expect(buttons.length).toBe(2);

      // Mockup order: Keep transferring (cancel) then Cancel transfer (confirm).
      (buttons[0] as HTMLButtonElement).click();
      expect(cancelled).toBe(true);

      (buttons[1] as HTMLButtonElement).click();
      expect(confirmed).toBe(true);
    });
  });

  describe('Message Text Wrapping', () => {
    it('should support multi-line messages', () => {
      const multiLineMessage = 'Line 1\nLine 2\nLine 3';
      fixture.componentRef.setInput('message', multiLineMessage);
      fixture.detectChanges();

      const messageElement = fixture.nativeElement.querySelector('.dialog-message p');
      expect(messageElement?.textContent).toContain('Line 1');
      expect(messageElement?.textContent).toContain('Line 2');
      expect(messageElement?.textContent).toContain('Line 3');
    });

    it('should handle long preset names in message', () => {
      const longMessage = `Are you sure you want to delete preset 'My Very Long Preset Name That Should Wrap To Multiple Lines When Displayed'?`;
      fixture.componentRef.setInput('message', longMessage);
      fixture.detectChanges();

      const messageElement = fixture.nativeElement.querySelector('.dialog-message p');
      expect(messageElement?.textContent?.trim()).toBe(longMessage);
    });
  });
});
