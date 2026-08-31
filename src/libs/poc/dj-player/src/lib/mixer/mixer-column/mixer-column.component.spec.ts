import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MixerColumnComponent } from './mixer-column.component';
import { MixerService } from '../mixer.service';

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

  it('renders exactly the reserved region and the crossfader, nothing else', () => {
    const root = fixture.nativeElement as HTMLElement;
    const container = root.querySelector('.mixer-column') as HTMLElement;

    expect(container.children).toHaveLength(2);
    expect(root.querySelectorAll('.reserved')).toHaveLength(1);
    expect(root.querySelectorAll('lib-crossfader')).toHaveLength(1);
  });

  it('carries no per-deck fader, curve selector or numeric register readout', () => {
    const root = fixture.nativeElement as HTMLElement;

    // The crossfader contributes exactly one range input; a second would be a per-deck fader.
    expect(root.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(root.querySelector('select')).toBeNull();
  });
});
