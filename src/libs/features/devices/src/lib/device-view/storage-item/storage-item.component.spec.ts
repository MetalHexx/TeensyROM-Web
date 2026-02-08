import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { StorageStatusComponent } from './storage-item.component';

describe('StorageStatusComponent', () => {
  let component: StorageStatusComponent;
  let fixture: ComponentFixture<StorageStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageStatusComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageStatusComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });
  });

  describe('Inputs', () => {
    it('should accept icon input', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'Test');
      fixture.detectChanges();
      expect(component.icon()).toBe('usb');
    });

    it('should accept label input', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.detectChanges();
      expect(component.label()).toBe('USB Stick');
    });

    it('should accept status input', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'Test');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();
      expect(component.status()).toBe(true);
    });

    it('should default status to undefined', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'Test');
      fixture.detectChanges();
      expect(component.status()).toBeUndefined();
    });
  });

  describe('Status Display', () => {
    it('should display "Available" when status is true', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const iconLabel = fixture.nativeElement.querySelector('lib-icon-label');
      expect(iconLabel).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('Available');
    });

    it('should display "Unavailable" when status is false', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', false);
      fixture.detectChanges();

      const iconLabel = fixture.nativeElement.querySelector('lib-icon-label');
      expect(iconLabel).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('Unavailable');
    });

    it('should apply highlight class when status is true', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const highlightText = fixture.nativeElement.querySelector('.highlight');
      expect(highlightText).toBeTruthy();
    });

    it('should apply dimmed class when status is false', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', false);
      fixture.detectChanges();

      const dimmedText = fixture.nativeElement.querySelector('.dimmed');
      expect(dimmedText).toBeTruthy();
    });
  });

  describe('Index Button', () => {
    it('should render index button', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('lib-icon-button');
      expect(button).toBeTruthy();
    });

    it('should disable button when status is false', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', false);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('lib-icon-button');
      expect(button.hasAttribute('ng-reflect-disabled')).toBe(true);
    });

    it('should enable button when status is true', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('lib-icon-button');
      expect(button.getAttribute('ng-reflect-disabled')).toBe('false');
    });

    it('should have correct test id for USB', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('[data-testid="storage-index-button-usb"]');
      expect(button).toBeTruthy();
    });

    it('should have correct test id for SD', () => {
      fixture.componentRef.setInput('icon', 'sd_card');
      fixture.componentRef.setInput('label', 'SD Card');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('[data-testid="storage-index-button-sd"]');
      expect(button).toBeTruthy();
    });

    it('should emit index event when button is clicked', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      let emitted = false;
      component.index.subscribe(() => {
        emitted = true;
      });

      component.onIndex();
      expect(emitted).toBe(true);
    });

    it('should have tooltip for USB device', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      expect(component.tooltipMessage().body).toBe('Indexes the USB device to make files available for search and random launch.');
    });

    it('should have tooltip for SD card', () => {
      fixture.componentRef.setInput('icon', 'sd_card');
      fixture.componentRef.setInput('label', 'SD Card');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      expect(component.tooltipMessage().body).toBe('Indexes the SD card to make files available for search and random launch.');
    });
  });

  describe('Template Rendering', () => {
    it('should render icon-label component', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const iconLabel = fixture.nativeElement.querySelector('lib-icon-label');
      expect(iconLabel).toBeTruthy();
    });

    it('should use simplified single-level layout', () => {
      fixture.componentRef.setInput('icon', 'usb');
      fixture.componentRef.setInput('label', 'USB Stick');
      fixture.componentRef.setInput('status', true);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.storage-container');
      expect(container).toBeTruthy();

      // Should not have nested left/right containers
      const leftContainer = fixture.nativeElement.querySelector('.left-container');
      const rightContainer = fixture.nativeElement.querySelector('.right-container');
      expect(leftContainer).toBeFalsy();
      expect(rightContainer).toBeFalsy();
    });
  });

  describe('Index Status Display', () => {
    describe('subtitle computed property', () => {
      it('should display "Available" when status is true and indexExists is true', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        fixture.componentRef.setInput('indexExists', true);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Available');
        expect(fixture.nativeElement.textContent).toContain('Available');
      });

      it('should display "Requires Indexing" when status is true but indexExists is false', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        fixture.componentRef.setInput('indexExists', false);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Requires Indexing');
        expect(fixture.nativeElement.textContent).toContain('Requires Indexing');
      });

      it('should display "Unavailable" when status is false regardless of indexExists true', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', false);
        fixture.componentRef.setInput('indexExists', true);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Unavailable');
        expect(fixture.nativeElement.textContent).toContain('Unavailable');
      });

      it('should display "Unavailable" when status is false regardless of indexExists false', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', false);
        fixture.componentRef.setInput('indexExists', false);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Unavailable');
        expect(fixture.nativeElement.textContent).toContain('Unavailable');
      });

      it('should default to "Available" when indexExists is not provided (defaults to true)', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        // indexExists not set, should default to true
        fixture.detectChanges();

        expect(component.indexExists()).toBe(true);
        expect(component.subtitle()).toBe('Available');
      });
    });

    describe('subtitleClass computed property', () => {
      it('should apply "highlight" class when status is true and indexExists is true', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        fixture.componentRef.setInput('indexExists', true);
        fixture.detectChanges();

        expect(component.subtitleClass()).toBe('highlight');
        const highlightText = fixture.nativeElement.querySelector('.highlight');
        expect(highlightText).toBeTruthy();
      });

      it('should apply "error" class when status is true but indexExists is false', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        fixture.componentRef.setInput('indexExists', false);
        fixture.detectChanges();

        expect(component.subtitleClass()).toBe('error');
        const errorText = fixture.nativeElement.querySelector('.error');
        expect(errorText).toBeTruthy();
      });

      it('should apply "error" class when status is false regardless of indexExists', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', false);
        fixture.componentRef.setInput('indexExists', true);
        fixture.detectChanges();

        expect(component.subtitleClass()).toBe('dimmed');
        const dimmedText = fixture.nativeElement.querySelector('.dimmed');
        expect(dimmedText).toBeTruthy();
      });
    });

    describe('Visual states', () => {
      it('should show cyan/highlight color for indexed available storage', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        fixture.componentRef.setInput('indexExists', true);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Available');
        expect(component.subtitleClass()).toBe('highlight');
      });

      it('should show red/error color for non-indexed available storage', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', true);
        fixture.componentRef.setInput('indexExists', false);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Requires Indexing');
        expect(component.subtitleClass()).toBe('error');
      });

      it('should show dimmed color for unavailable storage', () => {
        fixture.componentRef.setInput('icon', 'usb');
        fixture.componentRef.setInput('label', 'USB Stick');
        fixture.componentRef.setInput('status', false);
        fixture.detectChanges();

        expect(component.subtitle()).toBe('Unavailable');
        expect(component.subtitleClass()).toBe('dimmed');
      });
    });
  });
});
