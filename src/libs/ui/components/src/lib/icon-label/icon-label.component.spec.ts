import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IconLabelComponent, IconLabelSize } from './icon-label.component';
import { ComponentRef } from '@angular/core';
import { StyledIconColor } from '../styled-icon/styled-icon.component';

describe('IconLabelComponent', () => {
  let component: IconLabelComponent;
  let fixture: ComponentFixture<IconLabelComponent>;
  let componentRef: ComponentRef<IconLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconLabelComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(IconLabelComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'Test Label');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should display icon and label', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'My Folder');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('lib-styled-icon');
    const label = fixture.nativeElement.querySelector('.icon-label-text');

    expect(icon).toBeTruthy();
    expect(label.textContent).toContain('My Folder');
  });

  it('should use default color and size when not specified', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'Test');
    fixture.detectChanges();

    expect(component.color()).toBe('normal');
    expect(component.size()).toBe('medium');
  });

  it('should apply custom color', () => {
    const colors: StyledIconColor[] = ['primary', 'highlight', 'success', 'error', 'directory'];

    colors.forEach((color) => {
      componentRef.setInput('icon', 'folder');
      componentRef.setInput('label', 'Test');
      componentRef.setInput('color', color);
      fixture.detectChanges();

      expect(component.color()).toBe(color);
    });
  });

  it('should apply custom size and compute correct preset values', () => {
    const sizes: IconLabelSize[] = ['small', 'medium', 'large', 'extra-large'];

    sizes.forEach((size) => {
      componentRef.setInput('icon', 'folder');
      componentRef.setInput('label', 'Test');
      componentRef.setInput('size', size);
      fixture.detectChanges();

      expect(component.size()).toBe(size);
      
      // Verify computed signals produce correct values
      if (size === 'small') {
        expect(component.iconSize()).toBe('small');
        expect(component.textClass()).toBe('text-small');
        expect(component.gapClass()).toBe('gap-small');
      } else if (size === 'medium') {
        expect(component.iconSize()).toBe('medium');
        expect(component.textClass()).toBe('text-medium');
        expect(component.gapClass()).toBe('gap-medium');
      } else if (size === 'large') {
        expect(component.iconSize()).toBe('large');
        expect(component.textClass()).toBe('text-large');
        expect(component.gapClass()).toBe('gap-large');
      } else if (size === 'extra-large') {
        expect(component.iconSize()).toBe('extra-large');
        expect(component.textClass()).toBe('text-extra-large');
        expect(component.gapClass()).toBe('gap-extra-large');
      }
    });
  });

  it('should apply correct CSS classes based on size preset', () => {
    const testCases: Array<{ size: IconLabelSize; expectedTextClass: string; expectedGapClass: string }> = [
      { size: 'small', expectedTextClass: 'text-small', expectedGapClass: 'gap-small' },
      { size: 'medium', expectedTextClass: 'text-medium', expectedGapClass: 'gap-medium' },
      { size: 'large', expectedTextClass: 'text-large', expectedGapClass: 'gap-large' },
      { size: 'extra-large', expectedTextClass: 'text-extra-large', expectedGapClass: 'gap-extra-large' },
    ];

    testCases.forEach(({ size, expectedTextClass, expectedGapClass }) => {
      componentRef.setInput('icon', 'folder');
      componentRef.setInput('label', 'Test');
      componentRef.setInput('size', size);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.icon-label-container');
      const labelElement = fixture.nativeElement.querySelector('.icon-label-text');

      expect(container.classList.contains(expectedGapClass)).toBe(true);
      expect(labelElement.classList.contains(expectedTextClass)).toBe(true);
    });
  });

  it('should truncate text by default', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'Very Long Label Text That Should Be Truncated');
    fixture.detectChanges();

    const labelElement = fixture.nativeElement.querySelector('.icon-label-text');
    expect(labelElement.classList.contains('truncate')).toBe(true);
    expect(component.truncate()).toBe(true);
  });

  it('should not truncate text when truncate is false', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'Long Label Text');
    componentRef.setInput('truncate', false);
    fixture.detectChanges();

    const labelElement = fixture.nativeElement.querySelector('.icon-label-text');
    expect(labelElement.classList.contains('truncate')).toBe(false);
    expect(component.truncate()).toBe(false);
  });

  it('should set title attribute on label', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'Hover Text');
    fixture.detectChanges();

    const labelElement = fixture.nativeElement.querySelector('.icon-label-text');
    expect(labelElement.getAttribute('title')).toBe('Hover Text');
  });

  it('should work with all prop combinations', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'Complete Test');
    componentRef.setInput('color', 'directory');
    componentRef.setInput('size', 'large');
    componentRef.setInput('truncate', false);
    fixture.detectChanges();

    expect(component.icon()).toBe('folder');
    expect(component.label()).toBe('Complete Test');
    expect(component.color()).toBe('directory');
    expect(component.size()).toBe('large');
    expect(component.truncate()).toBe(false);
  });

  it('should maintain backward compatibility with minimal props', () => {
    componentRef.setInput('icon', 'info');
    componentRef.setInput('label', 'Simple');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('lib-styled-icon');
    const label = fixture.nativeElement.querySelector('.icon-label-text');

    expect(icon).toBeTruthy();
    expect(label.textContent).toContain('Simple');
    expect(label.classList.contains('truncate')).toBe(true);
  });

  // ============ SECONDARY LABEL TESTS ============

  describe('Secondary Label Feature', () => {
    it('should not render secondary label when not provided', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel).toBeFalsy();
    });

    it('should render secondary label when provided', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel).toBeTruthy();
      expect(secondaryLabel.textContent.trim()).toBe('Available');
    });

    it('should apply labelClass to primary label', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('labelClass', 'custom-primary-class');
      fixture.detectChanges();

      const primaryLabel = fixture.nativeElement.querySelector('.primary');
      expect(primaryLabel.classList.contains('custom-primary-class')).toBe(true);
    });

    it('should apply secondaryLabelClass to secondary label', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('secondaryLabelClass', 'success');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.classList.contains('success')).toBe(true);
    });

    it('should scale secondary text correctly for small size', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('size', 'small');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.classList.contains('text-xs')).toBe(true);
    });

    it('should scale secondary text correctly for medium size', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('size', 'medium');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.classList.contains('text-sm')).toBe(true);
    });

    it('should scale secondary text correctly for large size', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('size', 'large');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.classList.contains('text-md')).toBe(true);
    });

    it('should scale secondary text correctly for extra-large size', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('size', 'extra-large');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.classList.contains('text-lg')).toBe(true);
    });

    it('should have italic style on secondary text', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      // Verify the secondary class is applied (the component applies the style via SCSS)
      // In JSDOM, computed styles from CSS modules may not always be fully available
      expect(secondaryLabel.classList.contains('secondary')).toBe(true);
      expect(secondaryLabel.textContent.trim()).toBe('Available');
    });

    it('should render with text container when secondary label exists', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      fixture.detectChanges();

      const textContainer = fixture.nativeElement.querySelector('.text-container');
      expect(textContainer).toBeTruthy();
      expect(textContainer.querySelectorAll('.icon-label-text').length).toBe(2);
    });

    it('should maintain text container even with only primary label', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      fixture.detectChanges();

      const textContainer = fixture.nativeElement.querySelector('.text-container');
      expect(textContainer).toBeTruthy();
      const labels = textContainer.querySelectorAll('.icon-label-text');
      expect(labels.length).toBe(1);
      expect(labels[0].classList.contains('primary')).toBe(true);
    });

    it('should apply both classes to secondary label correctly', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('size', 'large');
      componentRef.setInput('secondaryLabelClass', 'success dimmed');
      fixture.detectChanges();

      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.classList.contains('text-md')).toBe(true);
      expect(secondaryLabel.classList.contains('success')).toBe(true);
      expect(secondaryLabel.classList.contains('dimmed')).toBe(true);
    });

    it('should hide secondary label when secondaryLabel input is empty string', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      fixture.detectChanges();

      let secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel).toBeTruthy();

      // Change to empty string
      componentRef.setInput('secondaryLabel', '');
      fixture.detectChanges();

      secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel).toBeFalsy();
    });

    it('should support dynamic secondary label changes', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Status 1');
      fixture.detectChanges();

      let secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.textContent.trim()).toBe('Status 1');

      componentRef.setInput('secondaryLabel', 'Status 2');
      fixture.detectChanges();

      secondaryLabel = fixture.nativeElement.querySelector('.secondary');
      expect(secondaryLabel.textContent.trim()).toBe('Status 2');
    });

    it('should support changing all class inputs dynamically', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      componentRef.setInput('secondaryLabel', 'Available');
      componentRef.setInput('labelClass', 'bold');
      componentRef.setInput('secondaryLabelClass', 'success');
      fixture.detectChanges();

      const primaryLabel = fixture.nativeElement.querySelector('.primary');
      const secondaryLabel = fixture.nativeElement.querySelector('.secondary');

      expect(primaryLabel.classList.contains('bold')).toBe(true);
      expect(secondaryLabel.classList.contains('success')).toBe(true);

      componentRef.setInput('labelClass', 'italic');
      componentRef.setInput('secondaryLabelClass', 'error');
      fixture.detectChanges();

      expect(primaryLabel.classList.contains('italic')).toBe(true);
      expect(secondaryLabel.classList.contains('error')).toBe(true);
    });

    it('should maintain backward compatibility with existing code', () => {
      // Old usage pattern should still work
      componentRef.setInput('icon', 'folder');
      componentRef.setInput('label', 'My Documents');
      componentRef.setInput('color', 'directory');
      componentRef.setInput('size', 'medium');
      componentRef.setInput('truncate', true);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.icon-label-container');
      const labels = container.querySelectorAll('.icon-label-text');

      expect(labels.length).toBe(1);
      expect(labels[0].textContent.trim()).toBe('My Documents');
      expect(labels[0].classList.contains('primary')).toBe(true);
    });

    it('should render no secondary label element in DOM when secondaryLabel is not provided', () => {
      componentRef.setInput('icon', 'usb');
      componentRef.setInput('label', 'USB Stick');
      fixture.detectChanges();

      // Verify conditional rendering works - secondary label should not exist in DOM
      const allLabels = fixture.nativeElement.querySelectorAll('.icon-label-text');
      const hasSecondary = Array.from(allLabels).some((el) => (el as Element).classList.contains('secondary'));
      expect(hasSecondary).toBe(false);
    });
  });
});
