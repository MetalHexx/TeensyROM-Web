import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { VoicePanelComponent, VoicePanelModel } from './voice-panel.component';
import type { VoiceRowModel } from '../voice-row/voice-row.component';

function rowModel(n: number, muted = false): VoiceRowModel {
  return {
    label: `V${n}`,
    muted,
    holdLabel: muted ? 'Punch' : 'Kill',
    checkboxId: `voice-mute-${n}-a`,
    muteAccessibleName: `Mute voice ${n} deck A`,
    holdAccessibleName: muted ? `Punch voice ${n} deck A` : `Kill voice ${n} deck A`,
  };
}

function testModel(): VoicePanelModel {
  return {
    accessibleName: 'Voice deck A',
    rows: [rowModel(1), rowModel(2), rowModel(3)],
    clearAccessibleName: 'Clear all voice mutes deck A',
  };
}

describe('VoicePanelComponent', () => {
  let fixture: ComponentFixture<VoicePanelComponent>;
  let component: VoicePanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [VoicePanelComponent] }).compileComponents();

    fixture = TestBed.createComponent(VoicePanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('model', testModel());
    fixture.detectChanges();
  });

  it('renders one lib-voice-row per model().rows entry', () => {
    expect(fixture.nativeElement.querySelectorAll('lib-voice-row').length).toBe(3);
  });

  it("surfaces a row's mutedChange with its own index", () => {
    const emitted: { index: number; muted: boolean }[] = [];
    component.mutedChange.subscribe((event) => emitted.push(event));

    const checkbox = fixture.nativeElement.querySelectorAll(
      'input[type="checkbox"]'
    )[1] as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{ index: 1, muted: true }]);
  });

  it("surfaces a row's heldChange with its own index", () => {
    const emitted: { index: number; held: boolean }[] = [];
    component.heldChange.subscribe((event) => emitted.push(event));

    const button = fixture.nativeElement.querySelectorAll('.voice-hold')[2] as HTMLButtonElement;
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitted).toEqual([{ index: 2, held: true }]);
  });

  it('fires clearMutes when Clear is pressed', () => {
    let fired = false;
    component.clearMutes.subscribe(() => (fired = true));

    const clearButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) =>
        (button as HTMLButtonElement).getAttribute('aria-label') ===
        'Clear all voice mutes deck A'
    ) as HTMLButtonElement;
    clearButton.click();

    expect(fired).toBe(true);
  });
});
