import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MixerColumnComponent } from './mixer-column.component';
import { MixerService } from '../mixer.service';
import { DeckRegistry } from '../../deck/deck-registry';
import { DECKS } from '../../deck/deck.config';

describe('MixerColumnComponent', () => {
  let fixture: ComponentFixture<MixerColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MixerColumnComponent],
      providers: [MixerService, DeckRegistry],
    }).compileComponents();

    fixture = TestBed.createComponent(MixerColumnComponent);
    fixture.detectChanges();
  });

  it('renders one deck strip per DECKS entry plus the crossfader, nothing else', () => {
    const root = fixture.nativeElement as HTMLElement;
    const container = root.querySelector('.mixer-column') as HTMLElement;

    expect(container.children).toHaveLength(2);
    expect(root.querySelectorAll('lib-deck-strip')).toHaveLength(DECKS.length);
    expect(root.querySelectorAll('lib-crossfader')).toHaveLength(1);
  });

  it('carries no dropdown selector anywhere in the column', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('select')).toBeNull();
  });
});
