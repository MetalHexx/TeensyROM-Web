import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FileDescriptionMiniComponent } from './file-description-mini.component';
import { PLAYER_CONTEXT } from '@teensyrom-nx/application';
import { signal } from '@angular/core';
import { FileItemType } from '@teensyrom-nx/domain';

describe('FileDescriptionMiniComponent', () => {
  let component: FileDescriptionMiniComponent;
  let fixture: ComponentFixture<FileDescriptionMiniComponent>;

  const mockPlayerContext = {
    getCurrentFile: () =>
      signal({
        file: {
          name: 'Test Song.sid',
          title: 'Test Song',
          creator: 'Test Composer',
          type: FileItemType.Song,
          meta1: '2 min',
          meta2: 'HVSC',
        },
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileDescriptionMiniComponent],
      providers: [provideNoopAnimations(), { provide: PLAYER_CONTEXT, useValue: mockPlayerContext }],
    }).compileComponents();

    fixture = TestBed.createComponent(FileDescriptionMiniComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'test-device-id');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display title', () => {
    expect(component.displayTitle()).toBe('Test Song');
  });

  it('should display creator', () => {
    expect(component.creator()).toBe('Test Composer');
  });

  it('should handle missing file', () => {
    const emptyContext = {
      getCurrentFile: () => signal(null),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FileDescriptionMiniComponent],
      providers: [provideNoopAnimations(), { provide: PLAYER_CONTEXT, useValue: emptyContext }],
    });
    fixture = TestBed.createComponent(FileDescriptionMiniComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'test-device-id');
    fixture.detectChanges();

    expect(component.hasFile()).toBe(false);
  });
});
