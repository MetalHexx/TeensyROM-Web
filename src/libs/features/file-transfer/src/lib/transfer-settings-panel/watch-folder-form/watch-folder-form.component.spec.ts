import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Device } from '@teensyrom-nx/domain';
import { WatchFolderFormComponent } from './watch-folder-form.component';
import { WatchFolderFormErrors } from '../watch-folder-form.util';

const devices = [
  { deviceId: 'dev-1', name: 'Rack', sdStorage: { available: true }, usbStorage: { available: false } },
] as unknown as Device[];

describe('WatchFolderFormComponent', () => {
  let fixture: ComponentFixture<WatchFolderFormComponent>;

  const query = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  const render = async (errors: WatchFolderFormErrors = {}, folder = '') => {
    await TestBed.configureTestingModule({
      imports: [WatchFolderFormComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(WatchFolderFormComponent);
    fixture.componentRef.setInput(
      'formGroup',
      new FormGroup({
        folder: new FormControl(folder, Validators.required),
        device: new FormControl(''),
        storage: new FormControl(''),
        devicePath: new FormControl('/auto-transfer'),
        launch: new FormControl(false),
      })
    );
    fixture.componentRef.setInput('devices', devices);
    fixture.componentRef.setInput('errors', errors);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('renders each refusal under its field and a field-less one above the buttons', async () => {
    await render({
      folder: 'No such folder',
      device: 'Device is gone',
      storage: 'No such storage',
      devicePath: 'Bad device folder',
      form: 'Engine unavailable',
    });

    expect(query('error-folder')?.textContent).toContain('No such folder');
    expect(query('error-device')?.textContent).toContain('Device is gone');
    expect(query('error-storage')?.textContent).toContain('No such storage');
    expect(query('error-device-path')?.textContent).toContain('Bad device folder');
    expect(query('error-form')?.textContent).toContain('Engine unavailable');
  });

  it('renders no error when there is no refusal', async () => {
    await render();

    expect(query('error-folder')).toBeNull();
    expect(query('error-form')).toBeNull();
  });

  it('emits cancel on Escape and does not submit an invalid form', async () => {
    await render();
    const cancel = vi.fn();
    const submit = vi.fn();
    fixture.componentInstance.formCancel.subscribe(cancel);
    fixture.componentInstance.formSubmit.subscribe(submit);

    query('form-folder')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    query('form-folder')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(submit).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
