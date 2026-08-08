import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FileTransferViewComponent } from './file-transfer-view.component';

describe('FileTransferViewComponent', () => {
  let fixture: ComponentFixture<FileTransferViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTransferViewComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(FileTransferViewComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all four region containers', () => {
    const native = fixture.nativeElement as HTMLElement;

    expect(native.querySelector('[data-testid="top-row"]')).toBeTruthy();
    expect(native.querySelector('[data-testid="content-row"]')).toBeTruthy();
    expect(native.querySelector('[data-testid="left-container"]')).toBeTruthy();
    expect(native.querySelector('[data-testid="right-container"]')).toBeTruthy();
  });

  it('should render the destination and transfer status cards in the top row', () => {
    const topRow = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="top-row"]'
    );

    expect(topRow?.querySelector('lib-destination-card')).toBeTruthy();
    expect(topRow?.querySelector('lib-transfer-status-card')).toBeTruthy();
  });
});
