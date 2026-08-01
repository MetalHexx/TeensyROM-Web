import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { VolumePopupComponent } from './volume-popup.component';
import { AudioStore } from '@teensyrom-nx/application';

function createMockAudioStore() {
  return {
    isMuted: signal(false) as WritableSignal<boolean>,
    masterVolume: signal(0.75) as WritableSignal<number>,
    toggleMute: vi.fn(),
    setMasterVolume: vi.fn(),
  };
}

describe('VolumePopupComponent', () => {
  let component: VolumePopupComponent;
  let fixture: ComponentFixture<VolumePopupComponent>;
  let mockAudioStore: ReturnType<typeof createMockAudioStore>;

  beforeEach(async () => {
    mockAudioStore = createMockAudioStore();

    await TestBed.configureTestingModule({
      imports: [VolumePopupComponent, NoopAnimationsModule],
      providers: [{ provide: AudioStore, useValue: mockAudioStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(VolumePopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('trigger icon states', () => {
    it('should show volume_off icon when muted', () => {
      mockAudioStore.isMuted.set(true);
      fixture.detectChanges();

      const icons = fixture.nativeElement.querySelectorAll('lib-icon-button mat-icon');
      // First icon-button is the trigger
      expect(icons[0].textContent.trim()).toBe('volume_off');
    });

    it('should show volume_up icon when volume >= 0.5 and not muted', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0.75);
      fixture.detectChanges();

      const icons = fixture.nativeElement.querySelectorAll('lib-icon-button mat-icon');
      expect(icons[0].textContent.trim()).toBe('volume_up');
    });

    it('should show volume_down icon when volume < 0.5 and > 0', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0.3);
      fixture.detectChanges();

      const icons = fixture.nativeElement.querySelectorAll('lib-icon-button mat-icon');
      expect(icons[0].textContent.trim()).toBe('volume_down');
    });

    it('should show volume_mute icon when volume is 0 and not muted', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0);
      fixture.detectChanges();

      const icons = fixture.nativeElement.querySelectorAll('lib-icon-button mat-icon');
      expect(icons[0].textContent.trim()).toBe('volume_mute');
    });
  });

  describe('popup interactions', () => {
    it('should open dropdown when trigger is clicked', () => {
      const triggerButton = fixture.nativeElement.querySelector('lib-icon-button button');
      triggerButton.click();
      fixture.detectChanges();

      expect(component['dropdown']()?.isOpen()).toBe(true);
    });

    it('should call toggleMute when popup mute button is clicked', () => {
      // Open popup first
      component.onTriggerClick();
      fixture.detectChanges();

      // The popup content is rendered in the CDK overlay, not inside the component host.
      // We test via the component method directly.
      component.onToggleMute();

      expect(mockAudioStore.toggleMute).toHaveBeenCalledOnce();
    });

    it('should call setMasterVolume with correct value when slider changes', () => {
      component.onVolumeChange({ target: { value: '0.42' } } as unknown as Event);

      expect(mockAudioStore.setMasterVolume).toHaveBeenCalledWith(0.42);
    });
  });

  describe('computed signals', () => {
    it('should reflect current store state in computed signals', () => {
      mockAudioStore.isMuted.set(true);
      mockAudioStore.masterVolume.set(0);

      expect(component.isMuted()).toBe(true);
      expect(component.currentVolume()).toBe(0);
      expect(component.volumeIcon()).toBe('volume_off');
      expect(component.muteAriaLabel()).toBe('Unmute audio');
    });

    it('should show Mute aria label when not muted', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0.5);

      expect(component.muteAriaLabel()).toBe('Mute audio');
    });
  });

  describe('disabled state', () => {
    it('should disable trigger button when disabled input is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const triggerButton: HTMLButtonElement = fixture.nativeElement.querySelector(
        'lib-icon-button button'
      );
      expect(triggerButton.disabled).toBe(true);
    });
  });
});
