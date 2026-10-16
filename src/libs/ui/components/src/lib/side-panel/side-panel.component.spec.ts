import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach } from 'vitest';
import { SidePanelComponent } from './side-panel.component';

@Component({
  imports: [SidePanelComponent],
  template: `
    <lib-side-panel
      [heading]="heading()"
      [closeAccessibleName]="closeName()"
      (closePanel)="closed = closed + 1"
    >
      <button sidePanelActions type="button" class="header-action">Mapping mode</button>
      <p class="body-content">Body</p>
    </lib-side-panel>
  `,
})
class HostComponent {
  readonly heading = signal('Bindings');
  readonly closeName = signal('Close panel');
  closed = 0;
}

describe('SidePanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function panel(): HTMLElement {
    return root().querySelector('lib-side-panel') as HTMLElement;
  }

  it('renders the heading as an h2', () => {
    expect(root().querySelector('h2')?.textContent?.trim()).toBe('Bindings');
  });

  it('announces as a complementary landmark named by the heading', () => {
    expect(panel().getAttribute('role')).toBe('complementary');
    expect(panel().getAttribute('aria-label')).toBe('Bindings');
  });

  it('projects header actions into the header and everything else into the body', () => {
    const header = root().querySelector('.side-panel-header');
    const body = root().querySelector('.side-panel-body');

    expect(header?.querySelector('.header-action')).not.toBeNull();
    expect(header?.querySelector('.body-content')).toBeNull();
    expect(body?.querySelector('.body-content')).not.toBeNull();
  });

  it('puts the header actions between the title and the close button', () => {
    const children = Array.from(root().querySelector('.side-panel-header')?.children ?? []);

    expect(children.map((child) => child.tagName.toLowerCase())).toEqual([
      'h2',
      'div',
      'lib-icon-button',
    ]);
    expect(children[1].querySelector('.header-action')).not.toBeNull();
  });

  it('names the close button, by default and as overridden', () => {
    const closeButton = () => root().querySelector('lib-icon-button button');

    expect(closeButton()?.getAttribute('aria-label')).toBe('Close panel');

    fixture.componentInstance.closeName.set('Close bindings');
    fixture.detectChanges();

    expect(closeButton()?.getAttribute('aria-label')).toBe('Close bindings');
  });

  it('emits closePanel when the close button is pressed', () => {
    (root().querySelector('lib-icon-button button') as HTMLButtonElement).click();

    expect(fixture.componentInstance.closed).toBe(1);
  });
});
