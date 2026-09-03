import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MixerColumnComponent } from './mixer-column.component';
import { MixerService } from '../mixer.service';
import { DECKS } from '../../deck/deck.config';

describe('MixerColumnComponent', () => {
  let fixture: ComponentFixture<MixerColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MixerColumnComponent],
      providers: [MixerService],
    }).compileComponents();

    fixture = TestBed.createComponent(MixerColumnComponent);
    fixture.detectChanges();
  });

  it('renders one channel fader per DECKS entry plus the crossfader, nothing else', () => {
    const root = fixture.nativeElement as HTMLElement;
    const container = root.querySelector('.mixer-column') as HTMLElement;

    expect(container.children).toHaveLength(2);
    expect(root.querySelectorAll('lib-channel-fader')).toHaveLength(DECKS.length);
    expect(root.querySelectorAll('lib-crossfader')).toHaveLength(1);
  });

  it('carries no curve selector or numeric register readout, only the faders and crossfader ranges', () => {
    const root = fixture.nativeElement as HTMLElement;

    // One range input per deck fader, plus the crossfader's own.
    expect(root.querySelectorAll('input[type="range"]')).toHaveLength(DECKS.length + 1);
    expect(root.querySelector('select')).toBeNull();
  });
});
