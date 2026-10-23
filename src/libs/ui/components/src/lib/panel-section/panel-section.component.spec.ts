import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { PanelSectionComponent } from './panel-section.component';

@Component({
  imports: [PanelSectionComponent],
  template: `<lib-panel-section title="Filter"><p class="inner">content</p></lib-panel-section>`,
})
class HostComponent {}

describe('PanelSectionComponent', () => {
  it('names its fieldset with the title input and projects its content', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const fieldset = fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement;
    expect(fieldset.querySelector('legend')?.textContent?.trim()).toBe('Filter');
    expect(fieldset.querySelector('.inner')?.textContent).toBe('content');
  });
});
