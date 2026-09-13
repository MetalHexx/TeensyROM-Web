import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TransportPanelComponent, TransportPanelModel } from './transport-panel.component';

function testModel(): TransportPanelModel {
  return {
    accessibleName: 'Transport deck A',
    bar: { kind: 'unknown' },
    scrubAccessibleName: 'Position deck A',
    transport: { state: 'stopped', label: 'Stopped' },
    canPlay: true,
    canPause: false,
    canStop: true,
    repeatTrack: true,
    tuneSources: [
      { id: 'auto', label: 'Auto Tune', accessibleName: 'Auto Tune deck A' },
      { id: 'amiga', label: 'Amiga Tune', accessibleName: 'Amiga Tune deck A' },
    ],
    subtune: {
      text: 'Subtune 1 of 1',
      disabled: true,
      previousAccessibleName: 'Previous subtune deck A',
      nextAccessibleName: 'Next subtune deck A',
    },
    actionAccessibleNames: {
      play: 'Play deck A',
      pause: 'Pause deck A',
      stop: 'Stop deck A',
      repeat: 'Repeat track deck A',
      chooseFile: 'Choose file deck A',
    },
    errors: [],
  };
}

describe('TransportPanelComponent', () => {
  let fixture: ComponentFixture<TransportPanelComponent>;
  let component: TransportPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TransportPanelComponent] }).compileComponents();

    fixture = TestBed.createComponent(TransportPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('model', testModel());
    fixture.componentRef.setInput('positionPercent', 0);
    fixture.componentRef.setInput('frameLabel', 'frame 0');
    fixture.detectChanges();
  });

  function setModel(overrides: Partial<TransportPanelModel>): void {
    fixture.componentRef.setInput('model', { ...testModel(), ...overrides });
    fixture.detectChanges();
  }

  /** `fixture.nativeElement` is untyped; naming it once keeps every query below typed. */
  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(text: string): HTMLButtonElement {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === text
    ) as HTMLButtonElement;
  }

  function fileInput(): HTMLInputElement {
    return root().querySelector('input[type="file"]') as HTMLInputElement;
  }

  function rangeInput(): HTMLInputElement {
    return root().querySelector('input[type="range"]') as HTMLInputElement;
  }

  /**
   * jsdom refuses both a `files` assignment and a non-empty `value` on a file input, so each is
   * redefined over the real element — the value stub is what makes the component's own reset
   * observable, since a genuinely picked file is the only thing that leaves a value behind.
   */
  function stubPick(input: HTMLInputElement, files: readonly File[]): { readonly value: string } {
    let value = files.length > 0 ? `C:\\fakepath\\${files[0].name}` : '';
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    Object.defineProperty(input, 'value', {
      get: () => value,
      set: (next: string) => (value = next),
      configurable: true,
    });
    return {
      get value(): string {
        return value;
      },
    };
  }

  describe('outputs', () => {
    it('fires play, pause and stop from their own buttons', () => {
      const fired: string[] = [];
      component.playClick.subscribe(() => fired.push('play'));
      component.pauseClick.subscribe(() => fired.push('pause'));
      component.stopClick.subscribe(() => fired.push('stop'));

      setModel({ canPlay: true, canPause: true, canStop: true });
      button('Play').click();
      button('Pause').click();
      button('Stop').click();

      expect(fired).toEqual(['play', 'pause', 'stop']);
    });

    it("carries the clicked source's own id on tuneSelect", () => {
      const emitted: string[] = [];
      component.tuneSelect.subscribe((id) => emitted.push(id));

      button('Amiga Tune').click();

      expect(emitted).toEqual(['amiga']);
    });

    it("carries the toggle's new checked state on repeatTrackChange", () => {
      const emitted: boolean[] = [];
      component.repeatTrackChange.subscribe((enabled) => emitted.push(enabled));

      const toggle = root().querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(toggle.checked).toBe(true);

      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));

      expect(emitted).toEqual([false]);
    });

    it('fires previousSubtune and nextSubtune from the stepper', () => {
      const fired: string[] = [];
      component.previousSubtune.subscribe(() => fired.push('previous'));
      component.nextSubtune.subscribe(() => fired.push('next'));

      setModel({ subtune: { ...testModel().subtune, disabled: false } });
      button('◀').click();
      button('▶').click();

      expect(fired).toEqual(['previous', 'next']);
    });

    it('forwards the position bar\'s drag ticks and release value', () => {
      const dragged: number[] = [];
      const committed: number[] = [];
      component.scrubInput.subscribe((value) => dragged.push(value));
      component.scrubCommit.subscribe((value) => committed.push(value));

      const range = rangeInput();
      range.value = '64';
      range.dispatchEvent(new Event('input'));
      range.dispatchEvent(new Event('change'));

      expect(dragged).toEqual([64]);
      expect(committed).toEqual([64]);
    });
  });

  describe('file picking', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('showFilePicker', true);
      fixture.detectChanges();
    });

    it('carries the picked File itself on fileSelect, never the event', () => {
      const emitted: File[] = [];
      component.fileSelect.subscribe((file) => emitted.push(file));

      const file = new File([new Uint8Array([1])], 'mytune.sid');
      const input = fileInput();
      stubPick(input, [file]);
      input.dispatchEvent(new Event('change'));

      expect(emitted).toEqual([file]);
    });

    it('emits nothing when the picker closed with no file chosen', () => {
      const emitted: File[] = [];
      component.fileSelect.subscribe((file) => emitted.push(file));

      const input = fileInput();
      stubPick(input, []);
      input.dispatchEvent(new Event('change'));

      expect(emitted).toEqual([]);
    });

    it('clears the input after a pick, so the same file picked again still emits', () => {
      const emitted: File[] = [];
      component.fileSelect.subscribe((file) => emitted.push(file));

      const file = new File([new Uint8Array([1])], 'mytune.sid');
      const input = fileInput();
      const picked = stubPick(input, [file]);
      input.dispatchEvent(new Event('change'));

      expect(picked.value).toBe('');

      input.dispatchEvent(new Event('change'));

      expect(emitted).toEqual([file, file]);
    });
  });

  describe('model-driven state', () => {
    it('disables each transport button from its own gate', () => {
      setModel({ canPlay: false, canPause: true, canStop: false });

      expect(button('Play').disabled).toBe(true);
      expect(button('Pause').disabled).toBe(false);
      expect(button('Stop').disabled).toBe(true);

      setModel({ canPlay: true, canPause: false, canStop: true });

      expect(button('Play').disabled).toBe(false);
      expect(button('Pause').disabled).toBe(true);
      expect(button('Stop').disabled).toBe(false);
    });

    it('renders one alert per error entry, in order, and none when the list is empty', () => {
      const alertTexts = (): (string | undefined)[] =>
        Array.from(root().querySelectorAll<HTMLElement>('[role="alert"]')).map((alert) =>
          alert.textContent?.trim()
        );

      expect(alertTexts()).toEqual([]);

      setModel({ errors: ['Delivery stalled.', 'Not a valid SID file.'] });

      expect(alertTexts()).toEqual(['Delivery stalled.', 'Not a valid SID file.']);
    });

    it('renders one button per tune source, in the model\'s own order', () => {
      const labels = Array.from(
        root().querySelectorAll<HTMLButtonElement>('.tune-sources button')
      ).map((candidate) => candidate.textContent?.trim());

      expect(labels).toEqual(['Auto Tune', 'Amiga Tune']);
    });

    it('feeds the position bar from the per-frame input rather than the model', () => {
      fixture.componentRef.setInput('positionPercent', 37);
      fixture.detectChanges();

      expect(rangeInput().value).toBe('37');
    });
  });

  describe('the tune-source line', () => {
    it('renders neither the tune buttons nor the file picker with no sources and no showFilePicker', () => {
      setModel({ tuneSources: [] });

      expect(root().querySelectorAll('.tune-sources button').length).toBe(0);
      expect(root().querySelector('.file-picker')).toBeNull();
    });

    it('renders the tune buttons without the file picker when sources exist and showFilePicker is unset', () => {
      expect(root().querySelectorAll('.tune-sources button').length).toBe(2);
      expect(root().querySelector('.file-picker')).toBeNull();
    });

    it('renders both the tune buttons and the file picker when showFilePicker is set alongside sources', () => {
      fixture.componentRef.setInput('showFilePicker', true);
      fixture.detectChanges();

      expect(root().querySelectorAll('.tune-sources button').length).toBe(2);
      expect(root().querySelector('.file-picker')).not.toBeNull();
    });

    it('renders the file picker with no tune buttons when showFilePicker is set and sources are empty', () => {
      setModel({ tuneSources: [] });
      fixture.componentRef.setInput('showFilePicker', true);
      fixture.detectChanges();

      expect(root().querySelectorAll('.tune-sources button').length).toBe(0);
      expect(root().querySelector('.file-picker')).not.toBeNull();
    });
  });

  it('places the subtune stepper before the status LED in line 2', () => {
    const transportLine = root().querySelector('.line-transport') as HTMLElement;
    const stepper = transportLine.querySelector('lib-stepper');
    const led = transportLine.querySelector('lib-status-led');

    expect(stepper).not.toBeNull();
    expect(led).not.toBeNull();
    if (stepper === null || led === null) {
      throw new Error('unreachable: asserted non-null above');
    }
    expect(stepper.compareDocumentPosition(led) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
