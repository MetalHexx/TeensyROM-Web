import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ColorTheme, ColorThemeKind } from '@teensyrom-nx/domain';
import { ThemeListComponent } from './theme-list.component';
import { READ_ONLY_TEXT } from '../theme-texts';

const makeTheme = (id: string, name: string, kind: ColorThemeKind): ColorTheme => ({
  id,
  name,
  kind,
  parts: {
    device: { background: 0, border: 4, banner: 4, time: 10, option: 7, sources: 14, name: 13 },
  },
});

describe('ThemeListComponent', () => {
  let fixture: ComponentFixture<ThemeListComponent>;
  const shipped = [makeTheme('a', 'TR Default', ColorThemeKind.Shipped)];

  const setup = (custom: ColorTheme[], selectedId: string | null = null) => {
    TestBed.configureTestingModule({
      imports: [ThemeListComponent],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(ThemeListComponent);
    fixture.componentRef.setInput('shipped', shipped);
    fixture.componentRef.setInput('custom', custom);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders the card title without a native title attribute', () => {
    const el = setup([makeTheme('c', 'Mine', ColorThemeKind.Custom)]);

    expect(el.textContent).toContain('Themes');
    expect(el.querySelectorAll('[title]').length).toBe(0);
  });

  it('renders only the shipped group when there are no custom themes', () => {
    const el = setup([]);

    expect(el.querySelector('[role="listbox"][aria-label="Shipped themes"]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Custom themes"]')).toBeNull();
  });

  it('renders the custom group when custom themes exist', () => {
    const el = setup([makeTheme('c', 'Mine', ColorThemeKind.Custom)]);

    const group = el.querySelector('[aria-label="Custom themes"]');
    expect(group?.querySelectorAll('lib-selectable-row').length).toBe(1);
  });

  it('gives shipped rows a named lock and no lock on custom rows', () => {
    const el = setup([makeTheme('c', 'Mine', ColorThemeKind.Custom)]);

    expect(el.querySelectorAll(`[aria-label="${READ_ONLY_TEXT}"]`).length).toBe(1);
    expect(el.querySelector('[aria-label="Custom themes"] .lock')).toBeNull();
  });

  it('names the swatch strip with its seven color names', () => {
    const el = setup([]);

    const strip = el.querySelector('.swatches');
    expect(strip?.getAttribute('aria-label')).toMatch(/^Colors: /);
    expect(strip?.querySelectorAll('lib-c64-color-swatch').length).toBe(7);
  });

  it('marks the selected row and emits the id of a clicked row', () => {
    const el = setup([makeTheme('c', 'Mine', ColorThemeKind.Custom)], 'c');
    const emitted: string[] = [];
    fixture.componentInstance.themeSelected.subscribe((id) => emitted.push(id));

    const rows = el.querySelectorAll<HTMLElement>('lib-selectable-row');
    expect(rows[0].getAttribute('aria-selected')).toBe('false');
    expect(rows[1].getAttribute('aria-selected')).toBe('true');

    rows[0].click();
    expect(emitted).toEqual(['a']);
  });
});
