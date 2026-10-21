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

  describe('disabled', () => {
    function jumpButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('button'));
    }

    function fader(): HTMLInputElement {
      return fixture.nativeElement.querySelector('input[type="range"]');
    }

    function disable(): void {
      fixture.componentRef.setInput('model', testModel({ disabled: true }));
      fixture.detectChanges();
    }

    it('leaves the fader and every jump button enabled by default', () => {
      expect(fader().disabled).toBe(false);
      expect(jumpButtons().every((button) => !button.disabled)).toBe(true);
    });

    it('disables the fader and every jump button', () => {
      disable();

      expect(fader().disabled).toBe(true);
      expect(jumpButtons()).toHaveLength(3);
      expect(jumpButtons().every((button) => button.disabled)).toBe(true);
    });

    it("keeps a jump button's own disabled while the panel is enabled", () => {
      fixture.componentRef.setInput(
        'model',
        testModel({
          jumpButtons: [
            { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A', disabled: true },
            { id: 'home', label: 'Home', accessibleName: 'Speed home deck A' },
          ],
        })
      );
      fixture.detectChanges();

      expect(jumpButtons().map((button) => button.disabled)).toEqual([true, false]);
    });

    it('emits nothing from the fader or a jump button while disabled', () => {
      disable();
      const emitted: unknown[] = [];
      component.faderChange.subscribe((v) => emitted.push(v));
      component.jump.subscribe((id) => emitted.push(id));

      fader().value = '1.25';
      fader().dispatchEvent(new Event('input'));
      jumpButtons().forEach((button) => button.click());

      expect(emitted).toEqual([]);
    });
  });

  it('marks the fader as the speed anchor', () => {
    const anchor = fixture.nativeElement.querySelector('[data-control="speed"]');

    expect(anchor?.tagName).toBe('LIB-CHANNEL-FADER');
  });
});
