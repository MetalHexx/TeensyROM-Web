import { describe, it, expect } from 'vitest';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { FileTimeComponent } from './file-time.component';

describe('FileTimeComponent', () => {
  it('creates', () => {
    const { component } = renderPlayerComponent(FileTimeComponent);

    expect(component).toBeTruthy();
  });

  it('formats sub-hour times as M:SS / M:SS', () => {
    const { component } = renderPlayerComponent(FileTimeComponent, {
      inputs: { currentTime: 4000, totalTime: 514000, show: true },
    });

    expect(component.formattedTime()).toBe('0:04 / 8:34');
  });

  it('formats times of an hour or more with an hours component', () => {
    const { component } = renderPlayerComponent(FileTimeComponent, {
      inputs: { currentTime: 3661000, totalTime: 7200000, show: true },
    });

    expect(component.formattedTime()).toBe('1:01:01 / 2:00:00');
  });

  it('hides the time element entirely when show is false', () => {
    const { fixture } = renderPlayerComponent(FileTimeComponent, {
      inputs: { currentTime: 4000, totalTime: 514000, show: false },
    });

    expect(fixture.nativeElement.querySelector('.file-time')).toBeNull();
  });

  it('clamps a negative current time to 0:00', () => {
    const { component } = renderPlayerComponent(FileTimeComponent, {
      inputs: { currentTime: -10, totalTime: 100000, show: true },
    });

    expect(component.formattedCurrentTime()).toBe('0:00');
  });

  describe('displayMode', () => {
    it('shows both times when displayMode is both', () => {
      const { component } = renderPlayerComponent(FileTimeComponent, {
        inputs: { currentTime: 95000, totalTime: 514000, show: true, displayMode: 'both' },
      });

      expect(component.formattedTime()).toBe('1:35 / 8:34');
    });

    it('shows only the current time when displayMode is current', () => {
      const { component } = renderPlayerComponent(FileTimeComponent, {
        inputs: { currentTime: 95000, totalTime: 514000, show: true, displayMode: 'current' },
      });

      expect(component.formattedCurrentTime()).toBe('1:35');
    });

    it('shows only the total time when displayMode is total', () => {
      const { component } = renderPlayerComponent(FileTimeComponent, {
        inputs: { currentTime: 95000, totalTime: 514000, show: true, displayMode: 'total' },
      });

      expect(component.formattedTotalTime()).toBe('8:34');
    });
  });
});
