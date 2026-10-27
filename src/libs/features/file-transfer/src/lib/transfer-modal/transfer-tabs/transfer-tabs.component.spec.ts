import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { TransferTab } from '@teensyrom-nx/application';
import { TransferTabsComponent } from './transfer-tabs.component';

const TABS: TransferTab[] = [
  { deviceId: 'a', percent: 40, ended: false },
  { deviceId: 'b', percent: 100, ended: true },
  { deviceId: 'c', percent: 5, ended: false },
];

describe('TransferTabsComponent', () => {
  let fixture: ComponentFixture<TransferTabsComponent>;
  let selectSpy: ReturnType<typeof vi.fn>;

  const setup = (tabs: TransferTab[] = TABS, selected: string | null = 'a') => {
    fixture = TestBed.createComponent(TransferTabsComponent);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('deviceNames', { a: 'TR-1', b: 'Workbench TR' });
    selectSpy = vi.fn();
    fixture.componentInstance.select.subscribe(selectSpy);
    fixture.detectChanges();
  };

  const tabButtons = () => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('[role="tab"]'));

  it('is a tablist of tab buttons, marking only the selected one', () => {
    setup();

    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeTruthy();
    expect(tabButtons().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('shows the device name with its percent, or Done once ended, falling back to the id', () => {
    setup();

    const labels = tabButtons().map((b) =>
      Array.from(b.querySelectorAll('span'))
        .map((span) => span.textContent?.trim())
        .join(' ')
    );
    expect(labels).toEqual(['TR-1 40%', 'Workbench TR Done', 'c 5%']);
  });

  it('shows a single tab for a single transfer', () => {
    setup([TABS[0]]);

    expect(tabButtons().length).toBe(1);
  });

  it('emits the clicked tab device', () => {
    setup();

    tabButtons()[2].click();

    expect(selectSpy).toHaveBeenCalledWith('c');
  });

  it('moves between tabs with the arrow keys, wrapping at the ends', () => {
    setup();

    tabButtons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(selectSpy).toHaveBeenLastCalledWith('b');

    tabButtons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(selectSpy).toHaveBeenLastCalledWith('c');

    tabButtons()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(selectSpy).toHaveBeenLastCalledWith('a');
  });

  it('keeps only the selected tab in the tab order', () => {
    setup(TABS, 'b');

    expect(tabButtons().map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });
});
