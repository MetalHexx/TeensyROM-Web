import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeckTransportComponent, DeckTransportModel } from './deck-transport.component';

function testModel(): DeckTransportModel {
  return {
    accessibleName: 'Transport deck A',
    state: 'stopped',
    stateLabel: 'Stop',
    held: false,
    title: 'Commando',
    author: 'Rob Hubbard',
    emptyText: 'No tune — drop a SID here',
    totalText: '03:12',
    bar: { kind: 'loop', introPercent: 25 },
    marks: [],
    scrubAccessibleName: 'Position deck A',
    playPause: { showing: 'play', disabled: false },
    canStop: true,
    repeatTrack: false,
    subtune: {
      text: '1/3',
      disabled: false,
      previousAccessibleName: 'Previous subtune deck A',
      nextAccessibleName: 'Next subtune deck A',
    },
    actionAccessibleNames: {
      play: 'Play deck A',
      pause: 'Pause deck A',
      stop: 'Stop deck A',
      repeat: 'Repeat track deck A',
    },
    errors: [],
    set: {
      positionText: '02/08',
      setName: 'Friday warm-up',
      previousDisabled: false,
      nextDisabled: false,
      previousAccessibleName: 'Previous in the set deck A',
      nextAccessibleName: 'Next in the set deck A',
    },
  };
}

describe('DeckTransportComponent', () => {
  let fixture: ComponentFixture<DeckTransportComponent>;
  let emitted: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeckTransportComponent] }).compileComponents();

    fixture = TestBed.createComponent(DeckTransportComponent);
    fixture.componentRef.setInput('model', testModel());

    emitted = [];
    const component = fixture.componentInstance;
    component.playPauseClick.subscribe(() => emitted.push('playPause'));
    component.stopClick.subscribe(() => emitted.push('stop'));
    component.repeatTrackChange.subscribe((latched) => emitted.push(`repeat:${latched}`));
    component.previousSubtune.subscribe(() => emitted.push('previous'));
    component.nextSubtune.subscribe(() => emitted.push('next'));
    component.previousInSet.subscribe(() => emitted.push('previousInSet'));
    component.nextInSet.subscribe(() => emitted.push('nextInSet'));
    component.scrubInput.subscribe((value) => emitted.push(`input:${value}`));
    component.scrubCommit.subscribe((value) => emitted.push(`commit:${value}`));
    fixture.detectChanges();

    // The playhead readouts, set the way a painter sets them.
    component.setLivePosition(40);
    component.setLiveElapsed('01:23.4');
    component.setLiveFrame('frame 1234');
  });

  function setModel(overrides: Partial<DeckTransportModel>): void {
    fixture.componentRef.setInput('model', { ...testModel(), ...overrides });
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function keyButton(selector: string): HTMLButtonElement {
    return root().querySelector(`${selector} button`) as HTMLButtonElement;
  }

  function text(): string {
    return root().textContent ?? '';
  }

  describe('outputs', () => {
    it('emits playPauseClick from the Play/Pause key', () => {
      keyButton('[data-control="play-pause"]').click();

      expect(emitted).toEqual(['playPause']);
    });

    it('emits stopClick from the Stop key', () => {
      keyButton('[data-control="stop"]').click();

      expect(emitted).toEqual(['stop']);
    });

    it('does not emit stopClick when it cannot stop', () => {
      setModel({ canStop: false });
      keyButton('[data-control="stop"]').click();

      expect(emitted).toEqual([]);
    });

    it('does not emit playPauseClick while Play/Pause is disabled', () => {
      setModel({ playPause: { showing: 'play', disabled: true } });
      keyButton('[data-control="play-pause"]').click();

      expect(emitted).toEqual([]);
    });

    it.each([
      [false, 'repeat:true'],
      [true, 'repeat:false'],
    ])(
      'emits the inverse of the latch when Repeat is pressed while %s',
      (repeatTrack, expected) => {
        setModel({ repeatTrack });
        keyButton('[data-control="repeat"]').click();

        expect(emitted).toEqual([expected]);
      }
    );

    it('reflects the repeat latch as aria-pressed', () => {
      expect(keyButton('[data-control="repeat"]').getAttribute('aria-pressed')).toBe('false');

      setModel({ repeatTrack: true });
      expect(keyButton('[data-control="repeat"]').getAttribute('aria-pressed')).toBe('true');
    });

    it('emits previousSubtune and nextSubtune from the stepper keys', () => {
      keyButton('[data-control="subtune"] [data-part="previous"]').click();
      keyButton('[data-control="subtune"] [data-part="next"]').click();

      expect(emitted).toEqual(['previous', 'next']);
    });

    it('does not step while the stepper is disabled', () => {
      setModel({ subtune: { ...testModel().subtune, disabled: true } });
      keyButton('[data-control="subtune"] [data-part="previous"]').click();
      keyButton('[data-control="subtune"] [data-part="next"]').click();

      expect(emitted).toEqual([]);
    });

    it('emits previousInSet and nextInSet from the set row keys', () => {
      keyButton('[data-control="set-previous"]').click();
      keyButton('[data-control="set-next"]').click();

      expect(emitted).toEqual(['previousInSet', 'nextInSet']);
    });

    it('shows the deck set position and name, and disables the keys the model disables', () => {
      expect(text()).toContain('02/08');
      expect(text()).toContain('Friday warm-up');

      setModel({
        set: { ...testModel().set, previousDisabled: true, nextDisabled: true },
      });
      keyButton('[data-control="set-previous"]').click();
      keyButton('[data-control="set-next"]').click();

      expect(emitted).toEqual([]);
    });

    it('forwards the strip’s preview and commit as scrubInput and scrubCommit', () => {
      const range = root().querySelector('input[type="range"]') as HTMLInputElement;
      range.value = '55';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));

      expect(emitted).toEqual(['input:55', 'commit:55']);
    });
  });

  describe('anchors', () => {
    it.each([
      '[data-control="seek"]',
      '[data-control="play-pause"]',
      '[data-control="stop"]',
      '[data-control="repeat"]',
      '[data-control="subtune"] [data-part="previous"]',
      '[data-control="subtune"] [data-part="next"]',
    ])('renders %s', (anchor) => {
      expect(root().querySelector(anchor)).not.toBeNull();
    });
  });

  describe('Play/Pause key', () => {
    it('is named for what it will do and lit by the deck state', () => {
      expect(keyButton('[data-control="play-pause"]').getAttribute('aria-label')).toBe(
        'Play deck A'
      );
      expect(keyButton('[data-control="play-pause"]').getAttribute('data-state-light')).toBe('off');

      setModel({
        state: 'playing',
        playPause: { showing: 'pause', disabled: false },
      });
      expect(keyButton('[data-control="play-pause"]').getAttribute('aria-label')).toBe(
        'Pause deck A'
      );
      expect(keyButton('[data-control="play-pause"]').getAttribute('data-state-light')).toBe(
        'playing'
      );

      setModel({ state: 'paused' });
      expect(keyButton('[data-control="play-pause"]').getAttribute('data-state-light')).toBe(
        'paused'
      );
    });
  });

  describe('held', () => {
    const stateAttr = (): string | null =>
      root().querySelector('.state')?.getAttribute('data-state') ?? null;
    const playheadHeld = (): boolean =>
      root().querySelector('.playhead')?.hasAttribute('data-held') ?? false;

    it('shows the held state and passes held to the strip while a finger is down', () => {
      setModel({ state: 'paused', stateLabel: 'Held', held: true });

      expect(stateAttr()).toBe('held');
      expect(root().querySelector('.state-word')?.textContent).toBe('Held');
      expect(playheadHeld()).toBe(true);
    });

    it('keeps the Play key on the deck’s own state while held', () => {
      setModel({ state: 'playing', held: true, playPause: { showing: 'pause', disabled: false } });

      expect(keyButton('[data-control="play-pause"]').getAttribute('data-state-light')).toBe(
        'playing'
      );
    });

    it('shows the deck’s own state and a plain playhead otherwise', () => {
      setModel({ state: 'paused' });

      expect(stateAttr()).toBe('paused');
      expect(playheadHeld()).toBe(false);
    });
  });

  describe('seek strip', () => {
    function range(): HTMLInputElement {
      return root().querySelector('input[type="range"]') as HTMLInputElement;
    }

    it('says the position as time', () => {
      expect(range().getAttribute('aria-label')).toBe('Position deck A');
      expect(range().getAttribute('aria-valuetext')).toBe('01:23.4 of 03:12');
    });

    it('shows the live position on the strip', () => {
      expect(range().value).toBe('40');

      fixture.componentInstance.setLivePosition(62.5);

      expect(range().value).toBe('62.5');
    });

    it('follows the elapsed time and a new total in its value text', () => {
      fixture.componentInstance.setLiveElapsed('01:30.0');
      expect(range().getAttribute('aria-valuetext')).toBe('01:30.0 of 03:12');

      setModel({ totalText: '04:00' });
      expect(range().getAttribute('aria-valuetext')).toBe('01:30.0 of 04:00');
    });

    it('is disabled while analyzing', () => {
      setModel({ state: 'analyzing', bar: { kind: 'analyzing' } });

      expect((root().querySelector('input[type="range"]') as HTMLInputElement).disabled).toBe(true);
    });

    it('draws the model’s marks in the strip’s lane', () => {
      setModel({
        marks: [
          {
            id: 'loop-1',
            kind: 'loop',
            startPercent: 20,
            endPercent: 35,
            activity: 'running',
            selected: true,
          },
          {
            id: 'cue-1',
            kind: 'cue',
            startPercent: 60,
            endPercent: null,
            activity: 'idle',
            selected: false,
          },
        ],
      });

      expect(root().querySelectorAll('.lane .mark').length).toBe(2);
    });
  });

  describe('display', () => {
    it('shows the state word, title, author, elapsed, total and frame', () => {
      expect(text()).toContain('Stop');
      expect(text()).toContain('Commando');
      expect(text()).toContain('Rob Hubbard');
      expect(text()).toContain('01:23.4');
      expect(text()).toContain('/ 03:12');
      expect(text()).toContain('frame 1234');
    });

    it('writes the live elapsed time and frame straight to the display, with no change detection', () => {
      fixture.componentInstance.setLiveElapsed('00:07.5');
      fixture.componentInstance.setLiveFrame('frame 375');

      expect(root().querySelector('.elapsed')?.textContent).toBe('00:07.5');
      expect(root().querySelector('.frame')?.textContent).toBe('frame 375');
    });

    it('keeps the live readouts through a change-detection pass', () => {
      setModel({ stateLabel: 'Play', state: 'playing' });

      expect(root().querySelector('.elapsed')?.textContent).toBe('01:23.4');
      expect(root().querySelector('.frame')?.textContent).toBe('frame 1234');
    });

    it('brings back the latest readouts when an error display gives way to the tune again', () => {
      setModel({ state: 'error', stateLabel: 'Error', errors: ['Delivery stalled.'] });
      fixture.componentInstance.setLiveElapsed('00:10.0');
      fixture.componentInstance.setLiveFrame('frame 500');

      setModel({});

      expect(root().querySelector('.elapsed')?.textContent).toBe('00:10.0');
      expect(root().querySelector('.frame')?.textContent).toBe('frame 500');
    });

    it('shows the empty text, and no author, when nothing is loaded', () => {
      setModel({ state: 'empty', title: null, author: null, totalText: '--:--' });

      expect(text()).toContain('No tune — drop a SID here');
      expect(text()).not.toContain('Commando');
      expect(root().querySelector('.author')).toBeNull();
    });

    it('shows the analyzing label', () => {
      setModel({ state: 'analyzing', stateLabel: 'Analyzing…', bar: { kind: 'analyzing' } });

      expect(text()).toContain('Analyzing…');
    });

    it('raises no alert when nothing is wrong', () => {
      expect(root().querySelector('[role="alert"]')).toBeNull();
    });

    it('shows each error as an alert in the display’s place', () => {
      setModel({
        state: 'error',
        stateLabel: 'Error',
        errors: ['Delivery stalled.', 'Not a valid SID file.'],
      });

      const alerts = Array.from(root().querySelectorAll('[role="alert"]')).map((alert) =>
        alert.textContent?.trim()
      );
      expect(alerts).toEqual(['Delivery stalled.', 'Not a valid SID file.']);
      expect(text()).not.toContain('Commando');
      expect(text()).not.toContain('frame 1234');
    });

    it('shows errors even when the deck state is not error', () => {
      setModel({ state: 'paused', errors: ['Seek failed.'] });

      expect(root().querySelector('[role="alert"]')?.textContent?.trim()).toBe('Seek failed.');
    });

    it('shows the state label when the deck has errored with no reason to give', () => {
      setModel({ state: 'error', stateLabel: 'Error', errors: [] });

      expect(text()).toContain('Error');
      expect(root().querySelector('[role="alert"]')).toBeNull();
    });
  });
});
