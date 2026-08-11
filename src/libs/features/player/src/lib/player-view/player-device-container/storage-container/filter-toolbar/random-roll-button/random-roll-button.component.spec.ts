import { By } from '@angular/platform-browser';
import { renderPlayerComponent } from '../../../../../../testing/render-player-component';
import { RandomRollButtonComponent } from './random-roll-button.component';

describe('RandomRollButtonComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    // The color round-trip and click behaviors are proven by reaching into the real
    // lib-icon-button child, so this is one of the components where the harness's
    // default child stub would hide the behavior under test.
    return renderPlayerComponent(RandomRollButtonComponent, { inputs, stubChildren: false });
  }

  it('creates the component', () => {
    const { component } = render();
    expect(component).toBeTruthy();
  });

  it('emits buttonClick when the button is clicked', () => {
    const { component } = render();

    let emitted = false;
    component.buttonClick.subscribe(() => (emitted = true));
    component.onButtonClick();

    expect(emitted).toBe(true);
  });

  it('adds the dice-roll class to the icon when the animation is triggered', () => {
    const { component } = render();
    const matIcon = document.createElement('mat-icon');
    const mockEvent = {
      target: {
        parentElement: {
          querySelector: () => matIcon,
        },
      },
    } as unknown as Event;

    component.animateDiceRoll(mockEvent);

    expect(matIcon.classList.contains('dice-roll')).toBe(true);
  });

  it('defaults the button color to normal', () => {
    const { component } = render();
    expect(component.getButtonColor()).toBe('normal');
  });

  it('forwards the button color to the icon-button child', () => {
    const { fixture } = render({ getButtonColor: 'error' });
    const iconButton = fixture.debugElement.query(By.css('lib-icon-button'));
    expect(iconButton.componentInstance.color()).toBe('error');
  });

  it('tracks the button color across changes', () => {
    const { component, setInput } = render();
    expect(component.getButtonColor()).toBe('normal');

    setInput('getButtonColor', 'error');
    expect(component.getButtonColor()).toBe('error');

    setInput('getButtonColor', 'highlight');
    expect(component.getButtonColor()).toBe('highlight');
  });
});
