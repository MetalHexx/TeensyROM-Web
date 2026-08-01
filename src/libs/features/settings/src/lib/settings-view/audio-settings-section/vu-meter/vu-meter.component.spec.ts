import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VuMeterComponent } from './vu-meter.component';

describe('VuMeterComponent', () => {
  let component: VuMeterComponent;
  let fixture: ComponentFixture<VuMeterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VuMeterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VuMeterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Rendering with level 0', () => {
    it('should cover 100% when level is 0 (silent)', () => {
      fixture.componentRef.setInput('level', 0);
      fixture.detectChanges();

      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('100%');
    });
  });

  describe('Rendering with level 0.5', () => {
    it('should cover 50% when level is 0.5', () => {
      fixture.componentRef.setInput('level', 0.5);
      fixture.detectChanges();

      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('50%');
    });
  });

  describe('Rendering with level 1.0', () => {
    it('should cover 0% when level is 1.0 (full volume)', () => {
      fixture.componentRef.setInput('level', 1.0);
      fixture.detectChanges();

      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('0%');
    });
  });

  describe('Input changes', () => {
    it('should update cover width when level changes', () => {
      fixture.componentRef.setInput('level', 0.2);
      fixture.detectChanges();

      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('80%');

      fixture.componentRef.setInput('level', 0.8);
      fixture.detectChanges();

      expect(cover.style.width).toBe('20%');
    });
  });

  describe('Clamping', () => {
    it('should clamp negative values to 0', () => {
      fixture.componentRef.setInput('level', -0.5);
      fixture.detectChanges();

      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('100%');
    });

    it('should clamp values above 1 to 1', () => {
      fixture.componentRef.setInput('level', 1.5);
      fixture.detectChanges();

      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('0%');
    });
  });

  describe('Accessibility', () => {
    it('should have role="meter" on the track', () => {
      fixture.detectChanges();

      const track = fixture.nativeElement.querySelector('.vu-meter-track');
      expect(track.getAttribute('role')).toBe('meter');
    });

    it('should expose aria-valuenow matching the level', () => {
      fixture.componentRef.setInput('level', 0.65);
      fixture.detectChanges();

      const track = fixture.nativeElement.querySelector('.vu-meter-track');
      expect(track.getAttribute('aria-valuenow')).toBe('0.65');
    });

    it('should expose aria-valuetext with percentage', () => {
      fixture.componentRef.setInput('level', 0.65);
      fixture.detectChanges();

      const track = fixture.nativeElement.querySelector('.vu-meter-track');
      expect(track.getAttribute('aria-valuetext')).toBe('Volume level 65%');
    });
  });

  describe('Default level', () => {
    it('should default to level 0 when no input is provided', () => {
      fixture.detectChanges();

      expect(component.level()).toBe(0);
      const cover = fixture.nativeElement.querySelector('.vu-meter-cover') as HTMLElement;
      expect(cover.style.width).toBe('100%');
    });
  });
});
