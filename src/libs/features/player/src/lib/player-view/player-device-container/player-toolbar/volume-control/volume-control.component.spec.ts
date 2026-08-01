import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VolumeControlComponent } from './volume-control.component';
import { AudioStore } from '@teensyrom-nx/application';

function createMockAudioStore() {
  return {
    isMuted: signal(false) as WritableSignal<boolean>,
    masterVolume: signal(0.75) as WritableSignal<number>,
    toggleMute: vi.fn(),
    setMasterVolume: vi.fn(),
  };
}

describe('VolumeControlComponent', () => {
  let component: VolumeControlComponent;
  let fixture: ComponentFixture<VolumeControlComponent>;
  let mockAudioStore: ReturnType<typeof createMockAudioStore>;

  beforeEach(async () => {
    mockAudioStore = createMockAudioStore();

    await TestBed.configureTestingModule({
      imports: [VolumeControlComponent],
      providers: [{ provide: AudioStore, useValue: mockAudioStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(VolumeControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('volume icon states', () => {
    it('should show volume_off icon when muted', () => {
      mockAudioStore.isMuted.set(true);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('lib-icon-button mat-icon');
      expect(icon.textContent.trim()).toBe('volume_off');
    });

    it('should show volume_up icon when volume >= 0.5 and not muted', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0.75);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('lib-icon-button mat-icon');
      expect(icon.textContent.trim()).toBe('volume_up');
    });

    it('should show volume_down icon when volume < 0.5 and > 0 and not muted', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0.3);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('lib-icon-button mat-icon');
      expect(icon.textContent.trim()).toBe('volume_down');
    });

    it('should show volume_mute icon when volume is 0 and not muted', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('lib-icon-button mat-icon');
      expect(icon.textContent.trim()).toBe('volume_mute');
    });

    it('should show volume_up icon when volume is exactly 0.5', () => {
      mockAudioStore.isMuted.set(false);
      mockAudioStore.masterVolume.set(0.5);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('lib-icon-button mat-icon');
      expect(icon.textContent.trim()).toBe('volume_up');
    });
  });

  describe('interactions', () => {
    it('should call toggleMute when mute button is clicked', () => {
      const button = fixture.nativeElement.querySelector('lib-icon-button button');
      button.click();

      expect(mockAudioStore.toggleMute).toHaveBeenCalledOnce();
    });

    it('should call setMasterVolume with correct value when slider changes', () => {
      const slider: HTMLInputElement = fixture.nativeElement.querySelector('.volume-slider');
      slider.value = '0.42';
      slider.dispatchEvent(new Event('input'));

      expect(mockAudioStore.setMasterVolume).toHaveBeenCalledWith(0.42);
    });

    it('should reflect masterVolume signal in the slider value', () => {
      mockAudioStore.masterVolume.set(0.6);
      fixture.detectChanges();

      const slider: HTMLInputElement = fixture.nativeElement.querySelector('.volume-slider');
      expect(parseFloat(slider.value)).toBeCloseTo(0.6);
    });
  });

  describe('compact mode', () => {
    it('should show slider when compact is not provided (default false)', () => {
      const slider = fixture.nativeElement.querySelector('.volume-slider');
      expect(slider).toBeTruthy();
    });

    it('should show slider when compact is explicitly false', () => {
      fixture.componentRef.setInput('compact', false);
      fixture.detectChanges();

      const slider = fixture.nativeElement.querySelector('.volume-slider');
      expect(slider).toBeTruthy();
    });

    it('should hide slider when compact is true', () => {
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();

      const slider = fixture.nativeElement.querySelector('.volume-slider');
      expect(slider).toBeNull();
    });

    it('should still show mute icon button when compact is true', () => {
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();

      const iconButton = fixture.nativeElement.querySelector('lib-icon-button');
      expect(iconButton).toBeTruthy();
    });

    it('should call toggleMute when mute button is clicked in compact mode', () => {
      fixture.componentRef.setInput('compact', true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('lib-icon-button button');
      button.click();

      expect(mockAudioStore.toggleMute).toHaveBeenCalledOnce();
    });

    it('should show volume_off icon when muted in compact mode', () => {
      fixture.componentRef.setInput('compact', true);
      mockAudioStore.isMuted.set(true);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('lib-icon-button mat-icon');
      expect(icon.textContent.trim()).toBe('volume_off');
    });
  });

  describe('disabled state', () => {
    it('should disable mute button when disabled input is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector('lib-icon-button button');
      expect(button.disabled).toBe(true);
    });

    it('should disable slider when disabled input is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const slider: HTMLInputElement =
        fixture.nativeElement.querySelector('.volume-slider');
      expect(slider.disabled).toBe(true);
    });

    it('should apply disabled class to container when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.volume-control');
      expect(container.classList.contains('disabled')).toBe(true);
    });
  });
});
