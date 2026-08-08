import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { DestinationCardComponent } from './destination-card.component';
import { DropzonePlaceholderComponent } from './dropzone-placeholder/dropzone-placeholder.component';

describe('DestinationCardComponent', () => {
  let fixture: ComponentFixture<DestinationCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationCardComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinationCardComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render as a scaling card titled Destination', () => {
    const card = fixture.debugElement.query(By.directive(ScalingCardComponent));
    expect(card).toBeTruthy();
    expect(card.componentInstance.title()).toBe('Destination');
  });

  it('should render the dropzone placeholder as its body', () => {
    const dropzone = fixture.debugElement.query(By.directive(DropzonePlaceholderComponent));
    expect(dropzone).toBeTruthy();
  });
});
