import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StepperComponent } from './stepper.component';

describe('StepperComponent', () => {
  let fixture: ComponentFixture<StepperComponent>;
  let component: StepperComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepperComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('text', 'Subtune 1 of 3');
    fixture.componentRef.setInput('previousAccessibleName', 'Previous subtune deck A');
    fixture.componentRef.setInput('nextAccessibleName', 'Next subtune deck A');
    fixture.detectChanges();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  function previousButton(): HTMLButtonElement {
    return buttons()[0];
  }

  function nextButton(): HTMLButtonElement {
    return buttons()[1];
  }

  it('renders the caller-supplied caption', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Subtune 1 of 3');
  });

  it('emits previous when the previous button is clicked', () => {
    const emitted: void[] = [];
    component.previous.subscribe(() => emitted.push(undefined));

    previousButton().click();

    expect(emitted.length).toBe(1);
  });

  it('emits next when the next button is clicked', () => {
    const emitted: void[] = [];
    component.next.subscribe(() => emitted.push(undefined));

    nextButton().click();

    expect(emitted.length).toBe(1);
  });

  it('defaults both buttons to enabled', () => {
    expect(previousButton().disabled).toBe(false);
    expect(nextButton().disabled).toBe(false);
  });

  it('reaches previousDisabled through to the previous button only', () => {
    fixture.componentRef.setInput('previousDisabled', true);
    fixture.detectChanges();

    expect(previousButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(false);
  });

  it('reaches nextDisabled through to the next button only', () => {
    fixture.componentRef.setInput('nextDisabled', true);
    fixture.detectChanges();

    expect(previousButton().disabled).toBe(false);
    expect(nextButton().disabled).toBe(true);
  });

  it('names each button from its own caller-supplied accessible name', () => {
    expect(previousButton().getAttribute('aria-label')).toBe('Previous subtune deck A');
    expect(nextButton().getAttribute('aria-label')).toBe('Next subtune deck A');
  });
});
