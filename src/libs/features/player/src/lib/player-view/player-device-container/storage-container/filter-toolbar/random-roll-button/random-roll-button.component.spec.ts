import { By } from '@angular/platform-browser';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../../../testing/render-player-component';
import { RandomRollButtonComponent } from './random-roll-button.component';

describe('RandomRollButtonComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    // The color round-trip assertion reaches the real lib-icon-button child's own `color`
    // input to prove it's forwarded correctly.
    return renderPlayerComponent(RandomRollButtonComponent, {
      inputs,
      realChildren: [IconButtonComponent],
    });
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
