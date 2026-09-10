import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { JumpButtonGroupComponent, JumpButtonModel } from './jump-button-group.component';

function testButtons(): readonly JumpButtonModel[] {
  return [
    { id: 'up', label: '+50%', accessibleName: 'Speed up 50% deck A' },
    { id: 'home', label: 'Home', accessibleName: 'Speed home deck A' },
    { id: 'down', label: '−50%', accessibleName: 'Speed down 50% deck A', disabled: true },
  ];
}

describe('JumpButtonGroupComponent', () => {
  let fixture: ComponentFixture<JumpButtonGroupComponent>;
  let component: JumpButtonGroupComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JumpButtonGroupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JumpButtonGroupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('buttons', testButtons());
    fixture.detectChanges();
  });

  function buttonEls(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  it('renders one button per model entry, in order', () => {
    expect(buttonEls().map((button) => button.textContent?.trim())).toEqual([
      '+50%',
      'Home',
      '−50%',
    ]);
  });

  it("emits the pressed button's own id", () => {
    const emitted: string[] = [];
    component.jump.subscribe((id) => emitted.push(id));

    buttonEls()[1].click();

    expect(emitted).toEqual(['home']);
  });

  it('renders a disabled entry as a disabled button, and leaves the others enabled', () => {
    expect(buttonEls()[2].disabled).toBe(true);
    expect(buttonEls()[0].disabled).toBe(false);
    expect(buttonEls()[1].disabled).toBe(false);
  });
});
