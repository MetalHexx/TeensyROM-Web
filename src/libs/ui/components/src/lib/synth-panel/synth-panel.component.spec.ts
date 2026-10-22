import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SynthPanelComponent } from './synth-panel.component';

@Component({
  imports: [SynthPanelComponent],
  template: `<lib-synth-panel><p class="inner">content</p></lib-synth-panel>`,
})
class HostComponent {}

describe('SynthPanelComponent', () => {
  it('projects its content and hides the decorative screws from assistive technology', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.inner')?.textContent).toBe('content');
    const screws = Array.from(root.querySelectorAll('.screw'));
    expect(screws.length).toBeGreaterThan(0);
    expect(screws.every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
