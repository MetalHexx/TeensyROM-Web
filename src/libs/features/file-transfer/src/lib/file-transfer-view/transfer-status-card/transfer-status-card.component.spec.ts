import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { TransferStatusCardComponent } from './transfer-status-card.component';

describe('TransferStatusCardComponent', () => {
  let fixture: ComponentFixture<TransferStatusCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferStatusCardComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferStatusCardComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render as a scaling card titled Transfer status', () => {
    const card = fixture.debugElement.query(By.directive(ScalingCardComponent));
    expect(card).toBeTruthy();
    expect(card.componentInstance.title()).toBe('Transfer status');
  });
});
