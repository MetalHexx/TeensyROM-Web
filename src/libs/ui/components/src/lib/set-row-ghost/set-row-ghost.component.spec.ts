import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SetRowGhostComponent, type SetRowGhostRow } from './set-row-ghost.component';

describe('SetRowGhostComponent', () => {
  let fixture: ComponentFixture<SetRowGhostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SetRowGhostComponent] }).compileComponents();
    fixture = TestBed.createComponent(SetRowGhostComponent);
  });

  function show(row: SetRowGhostRow): void {
    fixture.componentRef.setInput('row', row);
    fixture.detectChanges();
  }

  const text = (selector: string): string | undefined =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();

  it('shows the number, title and author of the row', () => {
    show({ numberText: '03', title: 'Cybernoid II', author: 'Jeroen Tel' });

    expect(text('.number')).toBe('03');
    expect(text('.title')).toBe('Cybernoid II');
    expect(text('.author')).toBe('Jeroen Tel');
  });

  it('omits an empty author', () => {
    show({ numberText: '04', title: 'Unknown tune', author: '' });

    expect(text('.title')).toBe('Unknown tune');
    expect((fixture.nativeElement as HTMLElement).querySelector('.author')).toBeNull();
  });
});
