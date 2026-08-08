import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropzonePlaceholderComponent } from './dropzone-placeholder.component';

describe('DropzonePlaceholderComponent', () => {
  let fixture: ComponentFixture<DropzonePlaceholderComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropzonePlaceholderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DropzonePlaceholderComponent);
    fixture.detectChanges();
    element = fixture.nativeElement.querySelector('[data-testid="dropzone-placeholder"]');
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the dropzone region', () => {
    expect(element).toBeTruthy();
  });

  it('should not be focusable', () => {
    expect(element.hasAttribute('tabindex')).toBe(false);
    expect(element.getAttribute('tabIndex')).toBeNull();
  });

  it('should register no drag or drop handlers', () => {
    const dragEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];

    for (const eventName of dragEvents) {
      const event = new Event(eventName, { bubbles: true, cancelable: true });
      const wasNotCancelled = element.dispatchEvent(event);
      // With no listener calling preventDefault(), dispatchEvent returns true.
      expect(wasNotCancelled).toBe(true);
    }
  });
});
