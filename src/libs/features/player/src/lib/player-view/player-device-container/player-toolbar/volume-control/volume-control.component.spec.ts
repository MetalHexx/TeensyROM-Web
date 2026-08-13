import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { AudioStore } from '@teensyrom-nx/application';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { VolumeControlComponent } from './volume-control.component';

function render(inputs: Record<string, unknown> = {}) {
  const isMuted = signal(false);
  const masterVolume = signal(0.75);
  const audioStore = {
    isMuted,
    masterVolume,
    toggleMute: vi.fn(),
    setMasterVolume: vi.fn(),
  };

  const result = renderPlayerComponent(VolumeControlComponent, {
    inputs,
    providers: [{ provide: AudioStore, useValue: audioStore }],
  });

  return { ...result, audioStore, isMuted, masterVolume };
}

describe('VolumeControlComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  describe('volumeIcon()', () => {
    it('is volume_off when muted', () => {
      const { component, isMuted } = render();
      isMuted.set(true);

      expect(component.volumeIcon()).toBe('volume_off');
    });

    it('is volume_up when volume >= 0.5 and not muted', () => {
      const { component, masterVolume } = render();
      masterVolume.set(0.75);

      expect(component.volumeIcon()).toBe('volume_up');
    });

    it('is volume_down when volume is between 0 and 0.5', () => {
      const { component, masterVolume } = render();
      masterVolume.set(0.3);

      expect(component.volumeIcon()).toBe('volume_down');
    });

    it('is volume_mute when volume is exactly 0 and unmuted', () => {
      const { component, masterVolume } = render();
      masterVolume.set(0);

      expect(component.volumeIcon()).toBe('volume_mute');
    });

    it('is volume_up at the 0.5 boundary', () => {
      const { component, masterVolume } = render();
      masterVolume.set(0.5);

      expect(component.volumeIcon()).toBe('volume_up');
    });
  });

  it('calls toggleMute when the mute button is clicked', () => {
    const { fixture, audioStore } = render();

    const button = fixture.debugElement.query(By.css('lib-icon-button'));
    button.nativeElement.dispatchEvent(new Event('buttonClick'));

    expect(audioStore.toggleMute).toHaveBeenCalledOnce();
  });

  it('calls setMasterVolume with the new value when the slider changes', () => {
    const { fixture, audioStore } = render();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector('.volume-slider');
    slider.value = '0.42';
    slider.dispatchEvent(new Event('input'));

    expect(audioStore.setMasterVolume).toHaveBeenCalledWith(0.42);
  });

  it("reflects the masterVolume signal in the slider's value", () => {
    const { fixture, masterVolume } = render();
    masterVolume.set(0.6);
    fixture.detectChanges();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector('.volume-slider');

    expect(parseFloat(slider.value)).toBeCloseTo(0.6);
  });

  describe('compact mode', () => {
    it('shows the slider by default', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('.volume-slider')).toBeTruthy();
    });

    it('hides the slider when compact is true', () => {
      const { fixture } = render({ compact: true });

      expect(fixture.nativeElement.querySelector('.volume-slider')).toBeNull();
    });

    it('still shows the mute icon-button when compact is true', () => {
      const { fixture } = render({ compact: true });

      expect(fixture.nativeElement.querySelector('lib-icon-button')).toBeTruthy();
    });
  });

  describe('disabled state', () => {
    it('disables the mute button when disabled is true', () => {
      const { fixture } = render({ disabled: true });

      const button = fixture.debugElement.query(By.css('lib-icon-button'));

      expect(button.properties['disabled']).toBe(true);
    });

    it('disables the slider when disabled is true', () => {
      const { fixture } = render({ disabled: true });

      const slider: HTMLInputElement = fixture.nativeElement.querySelector('.volume-slider');

      expect(slider.disabled).toBe(true);
    });

    it('applies the disabled class to the container', () => {
      const { fixture } = render({ disabled: true });

      const container = fixture.nativeElement.querySelector('.volume-control');

      expect(container.classList.contains('disabled')).toBe(true);
    });
  });
});
