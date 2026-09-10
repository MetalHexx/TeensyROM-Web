import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SpeedPanelComponent, SpeedPanelModel } from './speed-panel.component';

function testModel(overrides: Partial<SpeedPanelModel> = {}): SpeedPanelModel {
  return {
    accessibleName: 'Speed deck A',
    valueText: '1.000x',
    faderValue: 1,
    faderAccessibleName: 'Speed multiplier deck A',
    min: 0.5,
    max: 1.5,
    step: 0.001,
    jumpButtons: [
      { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A' },
      { id: 'home', label: 'Home', accessibleName: 'Speed home deck A' },
      { id: 'down', label: '−50%', accessibleName: 'Speed down 50% deck A' },
    ],
    ...overrides,
  };
}

describe('SpeedPanelComponent', () => {
  let fixture: ComponentFixture<SpeedPanelComponent>;
  let component: SpeedPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeedPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeedPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('model', testModel());
    fixture.detectChanges();
  });

  it('renders valueText as given', () => {
    expect(fixture.nativeElement.querySelector('.speed-value').textContent.trim()).toBe('1.000x');
  });

  it("forwards the fader's numeric emission on faderChange", () => {
    const emitted: number[] = [];
    component.faderChange.subscribe((value) => emitted.push(value));

    const input = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    input.value = '1.25';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([1.25]);
  });

  it("forwards the pressed jump button's own id on jump", () => {
    const emitted: string[] = [];
    component.jump.subscribe((id) => emitted.push(id));

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    buttons[1].click();

    expect(emitted).toEqual(['home']);
  });
});
