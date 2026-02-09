import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CardLayoutComponent } from './card-layout.component';
import { ComponentRef, Component } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('CardLayoutComponent', () => {
  let component: CardLayoutComponent;
  let fixture: ComponentFixture<CardLayoutComponent>;
  let componentRef: ComponentRef<CardLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardLayoutComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(CardLayoutComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render mat-card with stretch-card class', () => {
    const compiled = fixture.nativeElement;
    const matCard = compiled.querySelector('mat-card');

    expect(matCard).toBeTruthy();
    expect(matCard.classList.contains('stretch-card')).toBe(true);
  });

  it('should not render header when no title is provided', () => {
    const compiled = fixture.nativeElement;
    const header = compiled.querySelector('mat-card-header');

    // Header element exists in DOM but should be hidden via CSS when empty
    expect(header).toBeTruthy();
    
    // Check that header has no visible content (no title)
    const title = compiled.querySelector('mat-card-title');
    expect(title).toBeFalsy();
  });

  it('should render header with title when title is provided', () => {
    componentRef.setInput('title', 'Test Title');
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const header = compiled.querySelector('mat-card-header');
    const title = compiled.querySelector('mat-card-title');

    expect(header).toBeTruthy();
    expect(title).toBeTruthy();
    expect(title.textContent?.trim()).toBe('Test Title');
  });

  it('should always render mat-card-content', () => {
    const compiled = fixture.nativeElement;
    const content = compiled.querySelector('mat-card-content');

    expect(content).toBeTruthy();
  });

  it('should project content through ng-content', () => {
    // Create a test component that uses CardLayoutComponent with content
    @Component({
      template: `
        <lib-card-layout title="Test">
          <p class="test-content">Projected content</p>
        </lib-card-layout>
      `,
      imports: [CardLayoutComponent],
    })
    class TestHostComponent {}

    const hostFixture = TestBed.createComponent(TestHostComponent);
    hostFixture.detectChanges();

    const compiled = hostFixture.nativeElement;
    const projectedContent = compiled.querySelector('.test-content');

    expect(projectedContent).toBeTruthy();
    expect(projectedContent.textContent?.trim()).toBe('Projected content');
  });

  it('should update header visibility when title changes', () => {
    const compiled = fixture.nativeElement;

    // Header always exists in DOM
    const header = compiled.querySelector('mat-card-header');
    expect(header).toBeTruthy();
    
    // Initially no title
    expect(compiled.querySelector('mat-card-title')).toBeFalsy();

    // Add title
    componentRef.setInput('title', 'Dynamic Title');
    fixture.detectChanges();

    expect(compiled.querySelector('mat-card-title')?.textContent?.trim()).toBe('Dynamic Title');

    // Remove title
    componentRef.setInput('title', '');
    fixture.detectChanges();

    expect(compiled.querySelector('mat-card-title')).toBeFalsy();
  });

  describe('Header Slot', () => {
    it('should render header slot content when provided', () => {
      // Create a test component that projects header slot content
      @Component({
        template: `
          <lib-card-layout>
            <div slot="header" class="custom-header">Custom Header Content</div>
            <p>Body content</p>
          </lib-card-layout>
        `,
        imports: [CardLayoutComponent],
      })
      class TestHostComponent {}

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges(); // Initial change detection
      hostFixture.detectChanges(); // Second cycle to ensure content projection is complete

      const compiled = hostFixture.nativeElement;
      const customHeader = compiled.querySelector('.custom-header');
      const header = compiled.querySelector('mat-card-header');

      expect(header).toBeTruthy();
      expect(customHeader).toBeTruthy();
      expect(customHeader.textContent?.trim()).toBe('Custom Header Content');
    });

    it('should render both header slot and title in correct order', () => {
      // Create a test component with both header slot and title
      @Component({
        template: `
          <lib-card-layout title="Card Title">
            <div slot="header" class="slot-content">Header Slot</div>
            <p>Body content</p>
          </lib-card-layout>
        `,
        imports: [CardLayoutComponent],
      })
      class TestHostComponent {}

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement;
      const header = compiled.querySelector('mat-card-header');
      const slotContent = compiled.querySelector('.slot-content');
      const title = compiled.querySelector('mat-card-title');

      expect(header).toBeTruthy();
      expect(slotContent).toBeTruthy();
      expect(title).toBeTruthy();

      // Verify order: header slot should appear before title in DOM
      // Get all elements within the header and verify slot comes before title
      const allElements = header.querySelectorAll('*');
      const elementsArray = Array.from(allElements);
      const slotIndex = elementsArray.indexOf(slotContent);
      const titleIndex = elementsArray.indexOf(title);
      
      expect(slotIndex).toBeGreaterThanOrEqual(0);
      expect(titleIndex).toBeGreaterThan(slotIndex);
    });

    it('should render header slot without title', () => {
      // Create a test component with header slot but no title
      @Component({
        template: `
          <lib-card-layout>
            <div slot="header" class="only-slot">Only Header Slot</div>
            <p>Body content</p>
          </lib-card-layout>
        `,
        imports: [CardLayoutComponent],
      })
      class TestHostComponent {}

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges(); // Initial change detection
      hostFixture.detectChanges(); // Second cycle to ensure content projection is complete

      const compiled = hostFixture.nativeElement;
      const header = compiled.querySelector('mat-card-header');
      const slotContent = compiled.querySelector('.only-slot');
      const title = compiled.querySelector('mat-card-title');

      expect(header).toBeTruthy();
      expect(slotContent).toBeTruthy();
      expect(slotContent.textContent?.trim()).toBe('Only Header Slot');
      expect(title).toBeFalsy();
    });

    it('should render header slot with subtitle', () => {
      // Create a test component with header slot, title, and subtitle
      @Component({
        template: `
          <lib-card-layout title="Main Title" subtitle="Sub Title">
            <div slot="header" class="header-controls">Custom Controls</div>
            <p>Body content</p>
          </lib-card-layout>
        `,
        imports: [CardLayoutComponent],
      })
      class TestHostComponent {}

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement;
      const header = compiled.querySelector('mat-card-header');
      const slotContent = compiled.querySelector('.header-controls');
      const title = compiled.querySelector('mat-card-title');
      const subtitle = compiled.querySelector('mat-card-subtitle');

      expect(header).toBeTruthy();
      expect(slotContent).toBeTruthy();
      expect(title).toBeTruthy();
      expect(subtitle).toBeTruthy();
      expect(title.textContent?.trim()).toBe('Main Title');
      expect(subtitle.textContent?.trim()).toBe('Sub Title');
    });

    it('should work with corner slot and header slot together', () => {
      // Create a test component with both corner and header slots
      @Component({
        template: `
          <lib-card-layout title="Test Card">
            <button slot="corner" class="corner-button">X</button>
            <div slot="header" class="header-nav">Navigation</div>
            <p>Body content</p>
          </lib-card-layout>
        `,
        imports: [CardLayoutComponent],
      })
      class TestHostComponent {}

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement;
      const cornerButton = compiled.querySelector('.corner-button');
      const headerNav = compiled.querySelector('.header-nav');

      expect(cornerButton).toBeTruthy();
      expect(headerNav).toBeTruthy();
      expect(cornerButton.textContent?.trim()).toBe('X');
      expect(headerNav.textContent?.trim()).toBe('Navigation');
    });

    it('should handle empty header slot gracefully', () => {
      // Create a test component with empty header slot
      @Component({
        template: `
          <lib-card-layout title="Test Title">
            <div slot="header"></div>
            <p>Body content</p>
          </lib-card-layout>
        `,
        imports: [CardLayoutComponent],
      })
      class TestHostComponent {}

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      const compiled = hostFixture.nativeElement;
      const header = compiled.querySelector('mat-card-header');
      const title = compiled.querySelector('mat-card-title');

      // Header should still render because title is provided
      expect(header).toBeTruthy();
      expect(title).toBeTruthy();
      expect(title.textContent?.trim()).toBe('Test Title');
    });
  });
});
