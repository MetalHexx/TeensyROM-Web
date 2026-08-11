import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { AudioStore } from '@teensyrom-nx/application';
import { renderPlayerComponent } from '../../../../../../testing/render-player-component';
import { VolumePopupComponent } from './volume-popup.component';

function render(inputs: Record<string, unknown> = {}, options: { stubChildren?: boolean } = {}) {
  const isMuted = signal(false);
  const masterVolume = signal(0.75);
  const audioStore = {
    isMuted,
    masterVolume,
    toggleMute: vi.fn(),
    setMasterVolume: vi.fn(),
  };

  const result = renderPlayerComponent(VolumePopupComponent, {
    inputs,
    stubChildren: options.stubChildren,
    providers: [{ provide: AudioStore, useValue: audioStore }],
  });

  return { ...result, audioStore, isMuted, masterVolume };
}

describe('VolumePopupComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  describe('volumeIcon()', () => {
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
  });

  it('opens the dropdown when the trigger is clicked', () => {
    // Needs the real DropdownDialogComponent so the viewChild the trigger toggles resolves.
    const { fixture, component } = render({}, { stubChildren: false });

    const triggerButton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    triggerButton.click();
    fixture.detectChanges();

    expect(component['dropdown']()?.isOpen()).toBe(true);
  });

  it("calls the store's toggleMute when the mute toggle is used", () => {
    const { component, audioStore } = render();

    component.onToggleMute();

    expect(audioStore.toggleMute).toHaveBeenCalledOnce();
  });

  it('forwards the slider value to the store', () => {
    const { component, audioStore } = render();

    component.onVolumeChange({ target: { value: '0.42' } } as unknown as Event);

    expect(audioStore.setMasterVolume).toHaveBeenCalledWith(0.42);
  });

  it('reflects muted, zero-volume store state across computed signals', () => {
    const { component, isMuted, masterVolume } = render();
    isMuted.set(true);
    masterVolume.set(0);

    expect(component.isMuted()).toBe(true);
    expect(component.currentVolume()).toBe(0);
    expect(component.volumeIcon()).toBe('volume_off');
    expect(component.muteAriaLabel()).toBe('Unmute audio');
  });

  it("uses the 'Mute audio' aria label when unmuted", () => {
    const { component, isMuted, masterVolume } = render();
    isMuted.set(false);
    masterVolume.set(0.5);

    expect(component.muteAriaLabel()).toBe('Mute audio');
  });

  it('disables the trigger button when the disabled input is true', () => {
    const { fixture } = render({ disabled: true });

    const trigger = fixture.debugElement.query(By.css('lib-icon-button'));

    expect(trigger.properties['disabled']).toBe(true);
  });
});
