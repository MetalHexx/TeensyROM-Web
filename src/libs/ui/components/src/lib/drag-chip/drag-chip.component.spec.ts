import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { DragChipComponent } from './drag-chip.component';

describe('DragChipComponent', () => {
  let component: DragChipComponent;
  let fixture: ComponentFixture<DragChipComponent>;
  let componentRef: ComponentRef<DragChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DragChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DragChipComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    componentRef.setInput('label', 'test.sid');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should render label', () => {
    componentRef.setInput('label', 'song.sid');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.icon-label-text');

    expect(label.textContent).toContain('song.sid');
  });

  it('should use default icon when not specified', () => {
    componentRef.setInput('label', 'test.sid');
    fixture.detectChanges();

    expect(component.icon()).toBe('music_note');
  });

  it('should use custom icon when specified', () => {
    componentRef.setInput('icon', 'folder');
    componentRef.setInput('label', 'test.sid');
    fixture.detectChanges();

    expect(component.icon()).toBe('folder');
  });
});
