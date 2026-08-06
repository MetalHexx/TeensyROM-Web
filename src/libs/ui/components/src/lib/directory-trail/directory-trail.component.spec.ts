import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { DirectoryTrailComponent } from './directory-trail.component';
import { DirectoryNavigateComponent } from './directory-navigate/directory-navigate.component';
import { DirectoryBreadcrumbComponent } from './directory-breadcrumb/directory-breadcrumb.component';

describe('DirectoryTrailComponent', () => {
  let component: DirectoryTrailComponent;
  let fixture: ComponentFixture<DirectoryTrailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DirectoryTrailComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectoryTrailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('currentPath', '/games/arcade');
    fixture.componentRef.setInput('storageTypeLabel', 'SD Card');
    fixture.componentRef.setInput('canNavigateUp', true);
    fixture.componentRef.setInput('canNavigateBack', true);
    fixture.componentRef.setInput('canNavigateForward', false);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Child Component Integration', () => {
    it('should pass correct props to directory navigate component', () => {
      const navigateComponent = fixture.debugElement.query(
        (el) => el.componentInstance instanceof DirectoryNavigateComponent
      )?.componentInstance;

      expect(navigateComponent?.canNavigateUp()).toBe(true);
      expect(navigateComponent?.canNavigateBack()).toBe(true);
      expect(navigateComponent?.canNavigateForward()).toBe(false);
      expect(navigateComponent?.isLoading()).toBe(false);
    });

    it('should pass correct props to directory breadcrumb component', () => {
      const breadcrumbComponent = fixture.debugElement.query(
        (el) => el.componentInstance instanceof DirectoryBreadcrumbComponent
      )?.componentInstance;

      expect(breadcrumbComponent?.currentPath()).toBe('/games/arcade');
      expect(breadcrumbComponent?.storageType()).toBe('SD Card');
    });
  });

  describe('DOM Structure', () => {
    it('should not render card wrapper', () => {
      const compiled = fixture.nativeElement;
      const card = compiled.querySelector('lib-scaling-compact-card');
      expect(card).toBeFalsy();
    });

    it('should render directory-trail-container as root element', () => {
      const compiled = fixture.nativeElement;
      const container = compiled.querySelector('.directory-trail-container');
      expect(container).toBeTruthy();
    });

    it('should render child navigation components', () => {
      const compiled = fixture.nativeElement;
      const navigate = compiled.querySelector('lib-directory-navigate');
      const breadcrumb = compiled.querySelector('lib-directory-breadcrumb');
      expect(navigate).toBeTruthy();
      expect(breadcrumb).toBeTruthy();
    });
  });

  describe('Output Forwarding', () => {
    it('should forward backClicked', () => {
      const emitSpy = vi.fn();
      component.backClicked.subscribe(emitSpy);

      component.onBackClick();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should forward forwardClicked', () => {
      const emitSpy = vi.fn();
      component.forwardClicked.subscribe(emitSpy);

      component.onForwardClick();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should forward upClicked', () => {
      const emitSpy = vi.fn();
      component.upClicked.subscribe(emitSpy);

      component.onUpClick();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should forward refreshClicked', () => {
      const emitSpy = vi.fn();
      component.refreshClicked.subscribe(emitSpy);

      component.onRefreshClick();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should forward navigationRequested', () => {
      const emitSpy = vi.fn();
      component.navigationRequested.subscribe(emitSpy);

      component.onNavigationRequested('/games');

      expect(emitSpy).toHaveBeenCalledWith('/games');
    });
  });
});
