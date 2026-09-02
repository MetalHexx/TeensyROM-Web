import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { DrawerComponent } from './drawer.component';

@Component({
  selector: 'lib-drawer-host-fixture',
  template: `
    <lib-drawer title="SETUP & DIAGNOSTICS">
      <p class="probe">projected content</p>
    </lib-drawer>
  `,
  imports: [DrawerComponent],
})
class DrawerHostFixtureComponent {}

describe('DrawerComponent', () => {
  let fixture: ComponentFixture<DrawerHostFixtureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerHostFixtureComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerHostFixtureComponent);
    fixture.detectChanges();
  });

  function headButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function probe(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.probe');
  }

  it("carries the drawer's own title as its header button's accessible name", () => {
    expect(headButton().textContent?.trim()).toContain('SETUP & DIAGNOSTICS');
  });

  it('starts collapsed, projecting nothing until expanded', () => {
    expect(headButton().getAttribute('aria-expanded')).toBe('false');
    expect(probe()).toBeNull();
  });

  it('expands on click, projecting its content, then collapses again on a second click', () => {
    headButton().click();
    fixture.detectChanges();

    expect(headButton().getAttribute('aria-expanded')).toBe('true');
    expect(probe()?.textContent).toBe('projected content');

    headButton().click();
    fixture.detectChanges();

    expect(headButton().getAttribute('aria-expanded')).toBe('false');
    expect(probe()).toBeNull();
  });
});
