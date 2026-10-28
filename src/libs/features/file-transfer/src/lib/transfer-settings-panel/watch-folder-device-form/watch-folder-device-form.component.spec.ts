import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Device, StorageType } from '@teensyrom-nx/domain';
import { WatchFolderDeviceFormComponent } from './watch-folder-device-form.component';
import { WatchFolderFormErrors } from '../watch-folder-form.util';

describe('WatchFolderDeviceFormComponent', () => {
  let fixture: ComponentFixture<WatchFolderDeviceFormComponent>;
  let group: FormGroup;

  const query = <T extends HTMLElement = HTMLElement>(testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<T>(`[data-testid="${testId}"]`);

  const render = async (mode: 'add' | 'edit', errors: WatchFolderFormErrors = {}) => {
    await TestBed.configureTestingModule({
      imports: [WatchFolderDeviceFormComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(WatchFolderDeviceFormComponent);
    fixture.componentRef.setInput('mode', mode);
    group = new FormGroup({
      ...(mode === 'add' ? { device: new FormControl(''), storage: new FormControl('') } : {}),
      devicePath: new FormControl('/auto-transfer'),
      launch: new FormControl(false),
    });
    fixture.componentRef.setInput('formGroup', group);
    fixture.componentRef.setInput('deviceName', 'Rack');
    fixture.componentRef.setInput('storageType', StorageType.Usb);
    fixture.componentRef.setInput('errors', errors);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('renders each refusal under its field in add mode', async () => {
    await render('add', {
      device: 'Device is gone',
      storage: 'No such storage',
      devicePath: 'Bad device folder',
      form: 'Engine unavailable',
    });

    expect(query('error-device')?.textContent).toContain('Device is gone');
    expect(query('error-storage')?.textContent).toContain('No such storage');
    expect(query('error-device-path')?.textContent).toContain('Bad device folder');
    expect(query('error-form')?.textContent).toContain('Engine unavailable');
  });

  it('shows the device and storage read-only with the note in edit mode', async () => {
    await render('edit');

    expect(query('form-device')).toBeNull();
    expect(query<HTMLInputElement>('form-device-readonly')?.readOnly).toBe(true);
    expect(query<HTMLInputElement>('form-device-readonly')?.value).toBe('Rack');
    const storage = query('form-storage-readonly');
    expect(storage?.querySelector('.mat-button-toggle-checked')?.textContent?.trim()).toBe('USB');
    const toggles = Array.from(storage?.querySelectorAll('mat-button-toggle') ?? []);
    expect(toggles).toHaveLength(2);
    expect(toggles.every((toggle) => toggle.classList.contains('mat-button-toggle-disabled'))).toBe(true);
    expect(query('form-readonly-note')).not.toBeNull();
  });

  it('shows no note and an editable device picker in add mode', async () => {
    await render('add');

    expect(query('form-readonly-note')).toBeNull();
    expect(query('form-device')).not.toBeNull();
  });

  it('offers SD and USB in add mode, disabling the storage the chosen device lacks', async () => {
    await render('add');
    const rack = {
      deviceId: 'dev-1',
      name: 'Rack',
      sdStorage: { available: true },
      usbStorage: { available: false },
    } as unknown as Device;
    fixture.componentRef.setInput('devices', [rack]);
    group.controls['device'].setValue('dev-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toggles = Array.from(query('form-storage')?.querySelectorAll('mat-button-toggle') ?? []);
    expect(toggles.map((toggle) => toggle.textContent?.trim())).toEqual(['SD', 'USB']);
    expect(toggles.map((toggle) => toggle.classList.contains('mat-button-toggle-disabled'))).toEqual([
      false,
      true,
    ]);
  });
});
