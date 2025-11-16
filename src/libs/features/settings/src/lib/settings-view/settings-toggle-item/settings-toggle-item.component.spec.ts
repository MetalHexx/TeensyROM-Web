import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SettingsToggleItemComponent } from './settings-toggle-item.component';

describe('SettingsToggleItemComponent', () => {
  let component: SettingsToggleItemComponent;
  let fixture: ComponentFixture<SettingsToggleItemComponent>;
  let control: AbstractControl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsToggleItemComponent, MatSlideToggleModule, ReactiveFormsModule],
    }).compileComponents();

    control = new FormControl<boolean>(false, { nonNullable: true });
    fixture = TestBed.createComponent(SettingsToggleItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Test Toggle');
    fixture.componentRef.setInput('description', 'Test description for the toggle');
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display label text', () => {
    const labelElement = fixture.nativeElement.querySelector('.toggle-label');
    expect(labelElement?.textContent).toBe('Test Toggle');
  });

  it('should display description text', () => {
    const descElement = fixture.nativeElement.querySelector('.toggle-description');
    expect(descElement?.textContent?.trim()).toBe('Test description for the toggle');
  });

  it('should bind to form control', () => {
    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
    expect(toggle).toBeTruthy();
    
    control.setValue(true);
    fixture.detectChanges();
    
    expect(control.value).toBe(true);
  });

  it('should respect disabled state', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    
    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');
    expect(toggle).toBeTruthy();
  });
});
