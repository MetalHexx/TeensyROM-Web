import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERT_SERVICE,
  CRT_STORAGE,
  DEVICE_SERVICE,
  DEVICE_STORAGE_SERVICE,
  type AsidLaunchOutcome,
} from '@teensyrom-nx/domain';
import { PLAYER_CONTEXT } from '../player/player-context.interface';
import { AsidPlayerLauncher } from './asid-player-launcher';
import { DjStore } from './dj-store';
import type { Slot } from './slot';

const MOVED: AsidLaunchOutcome = { launched: true, movedToSerial: true };
const PLAIN: AsidLaunchOutcome = { launched: true, movedToSerial: false };
const failed = (message: string): AsidLaunchOutcome => ({
  launched: false,
  reason: 'launchFailed',
  message,
});

describe('AsidPlayerLauncher', () => {
  let launcher: AsidPlayerLauncher;
  let store: InstanceType<typeof DjStore>;
  let deviceService: {
    launchAsidPlayer: ReturnType<typeof vi.fn>;
    findDevices: ReturnType<typeof vi.fn>;
  };
  let alertService: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function bind(slot: Slot, id: string): void {
    store.setBinding({
      slot,
      binding: { device: { id, name: `Cart ${id}` }, portId: null, present: false, error: null },
    });
  }

  function answers(byDevice: Record<string, Observable<AsidLaunchOutcome>>): void {
    deviceService.launchAsidPlayer.mockImplementation((id: string) => byDevice[id]);
  }

  beforeEach(() => {
    deviceService = {
      launchAsidPlayer: vi.fn(),
      findDevices: vi.fn().mockReturnValue(of([])),
    };
    alertService = { info: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: DEVICE_SERVICE, useValue: deviceService },
        { provide: ALERT_SERVICE, useValue: alertService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: {} },
        { provide: PLAYER_CONTEXT, useValue: { reflectDeviceReset: vi.fn() } },
        { provide: CRT_STORAGE, useValue: { clearDevice: vi.fn() } },
      ],
    });
    launcher = TestBed.inject(AsidPlayerLauncher);
    store = TestBed.inject(DjStore);
  });

  it('launches both bound decks, each by its own device id', async () => {
    bind('A', 'dev-a');
    bind('B', 'dev-b');
    answers({ 'dev-a': of(PLAIN), 'dev-b': of(PLAIN) });

    await launcher.launch();

    expect(deviceService.launchAsidPlayer).toHaveBeenCalledWith('dev-a');
    expect(deviceService.launchAsidPlayer).toHaveBeenCalledWith('dev-b');
  });

  it('raises nothing for a plain success and refreshes no devices', async () => {
    bind('A', 'dev-a');
    answers({ 'dev-a': of(PLAIN) });

    await launcher.launch();

    expect(alertService.info).not.toHaveBeenCalled();
    expect(alertService.error).not.toHaveBeenCalled();
    expect(deviceService.findDevices).not.toHaveBeenCalled();
  });

  it('names the deck in an info alert when its cartridge moved, and refreshes the device list', async () => {
    bind('B', 'dev-b');
    answers({ 'dev-b': of(MOVED) });

    await launcher.launch();

    expect(alertService.info).toHaveBeenCalledTimes(1);
    expect(alertService.info.mock.calls[0][0]).toContain('Deck B');
    expect(alertService.error).not.toHaveBeenCalled();
    expect(deviceService.findDevices).toHaveBeenCalledTimes(1);
  });

  it('still launches the other deck when one fails, and names the failed deck with the API message', async () => {
    bind('A', 'dev-a');
    bind('B', 'dev-b');
    answers({ 'dev-a': of(failed('USB port is held')), 'dev-b': of(MOVED) });

    await launcher.launch();

    expect(deviceService.launchAsidPlayer).toHaveBeenCalledWith('dev-b');
    expect(alertService.error).toHaveBeenCalledTimes(1);
    const message = alertService.error.mock.calls[0][0] as string;
    expect(message).toContain('Deck A');
    expect(message).toContain('USB port is held');
    expect(alertService.info.mock.calls[0][0]).toContain('Deck B');
  });

  it('treats an unexpected rejection as a failure of that deck only', async () => {
    bind('A', 'dev-a');
    bind('B', 'dev-b');
    answers({ 'dev-a': throwError(() => new Error('boom')), 'dev-b': of(PLAIN) });

    await launcher.launch();

    expect(alertService.error).toHaveBeenCalledTimes(1);
    expect(alertService.error.mock.calls[0][0]).toContain('Deck A');
    expect(store.asidLaunching()).toBe(false);
  });

  it('skips an unbound deck', async () => {
    bind('B', 'dev-b');
    answers({ 'dev-b': of(PLAIN) });

    await launcher.launch();

    expect(deviceService.launchAsidPlayer).toHaveBeenCalledTimes(1);
    expect(deviceService.launchAsidPlayer).toHaveBeenCalledWith('dev-b');
  });

  it('does nothing at all with neither deck bound', async () => {
    await launcher.launch();

    expect(deviceService.launchAsidPlayer).not.toHaveBeenCalled();
    expect(alertService.info).not.toHaveBeenCalled();
    expect(alertService.error).not.toHaveBeenCalled();
    expect(deviceService.findDevices).not.toHaveBeenCalled();
    expect(store.asidLaunching()).toBe(false);
  });

  it('holds asidLaunching from the press until both decks answer, and ignores a press meanwhile', async () => {
    bind('A', 'dev-a');
    bind('B', 'dev-b');
    const a = new Subject<AsidLaunchOutcome>();
    const b = new Subject<AsidLaunchOutcome>();
    answers({ 'dev-a': a, 'dev-b': b });

    const running = launcher.launch();
    expect(store.asidLaunching()).toBe(true);

    await launcher.launch();
    expect(deviceService.launchAsidPlayer).toHaveBeenCalledTimes(2);

    a.next(PLAIN);
    a.complete();
    await Promise.resolve();
    expect(store.asidLaunching()).toBe(true);

    b.next(failed('nope'));
    b.complete();
    await running;

    expect(store.asidLaunching()).toBe(false);
  });
});
