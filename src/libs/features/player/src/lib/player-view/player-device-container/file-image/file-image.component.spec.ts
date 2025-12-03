import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FileImageComponent } from './file-image.component';
import { CRT_STORAGE, ICrtStorage } from '@teensyrom-nx/domain';

/** Mock CRT storage for testing - stores nothing, returns null */
const mockCrtStorage: ICrtStorage = {
  save: vi.fn(),
  load: vi.fn(() => null),
  hasSavedSettings: vi.fn(() => false),
  clear: vi.fn(),
};

describe('FileImageComponent', () => {
  let component: FileImageComponent;
  let fixture: ComponentFixture<FileImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileImageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: CRT_STORAGE, useValue: mockCrtStorage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileImageComponent);
    component = fixture.componentInstance;
    // Set required input before change detection
    fixture.componentRef.setInput('deviceId', 'test-device');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
