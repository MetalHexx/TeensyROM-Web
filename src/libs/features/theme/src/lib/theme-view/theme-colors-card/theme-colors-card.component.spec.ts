import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DEVICE_COLOR_SLOTS } from '@teensyrom-nx/domain';
import { ThemeColorsCardComponent } from './theme-colors-card.component';
import { ColorSlotRowComponent } from '../color-slot-row/color-slot-row.component';
import { By } from '@angular/platform-browser';

describe('ThemeColorsCardComponent', () => {
  let fixture: ComponentFixture<ThemeColorsCardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ThemeColorsCardComponent],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(ThemeColorsCardComponent);
    fixture.componentRef.setInput('colors', {
      background: 0,
      border: 4,
      banner: 4,
      time: 10,
      option: 7,
      sources: 14,
      name: 13,
    });
    fixture.componentRef.setInput('subtitle', 'TR Default · Shipped, read-only');
    fixture.componentRef.setInput('infoText', 'Info about the colors');
    fixture.detectChanges();
  });

  it('renders one row per color slot', () => {
    const rows = fixture.debugElement.queryAll(By.directive(ColorSlotRowComponent));

    expect(rows.length).toBe(DEVICE_COLOR_SLOTS.length);
  });

  it('shows the subtitle and names the info icon with the info text', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('TR Default · Shipped, read-only');
    expect(el.querySelector('.info')?.getAttribute('aria-label')).toBe('Info about the colors');
  });

  it('renders the card title without a native title attribute', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('C64 menu colors');
    expect(el.querySelectorAll('[title]').length).toBe(0);
  });

  it('emits the slot and color index when a row changes', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.colorChange.subscribe((c) => emitted.push(c));

    const rows = fixture.debugElement.queryAll(By.directive(ColorSlotRowComponent));
    (rows[2].componentInstance as ColorSlotRowComponent).valueChange.emit(9);

    expect(emitted).toEqual([{ slot: 'banner', colorIndex: 9 }]);
  });
});
