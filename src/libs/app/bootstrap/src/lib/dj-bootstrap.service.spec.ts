import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DeckMemoryKeeper,
  DeckService,
  DjSets,
  MidiControllers,
  MidiInputRouter,
  MixerApplier,
} from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';
import { DjBootstrapService } from './dj-bootstrap.service';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

describe('DjBootstrapService', () => {
  let hydrateMock: ReturnType<typeof vi.fn>;
  let installMock: ReturnType<typeof vi.fn>;
  let keeperInstallMock: ReturnType<typeof vi.fn>;
  let mappingsHydrateMock: ReturnType<typeof vi.fn>;
  let routerStartMock: ReturnType<typeof vi.fn>;
  let setsHydrateMock: ReturnType<typeof vi.fn>;

  function configure(): DjBootstrapService {
    TestBed.configureTestingModule({
      providers: [
        DjBootstrapService,
        { provide: DeckService, useValue: { hydrate: hydrateMock } },
        { provide: MixerApplier, useValue: { install: installMock } },
        { provide: DeckMemoryKeeper, useValue: { install: keeperInstallMock } },
        { provide: MidiControllers, useValue: { hydrate: mappingsHydrateMock } },
        { provide: MidiInputRouter, useValue: { start: routerStartMock } },
        { provide: DjSets, useValue: { hydrate: setsHydrateMock } },
      ],
    });
    return TestBed.inject(DjBootstrapService);
  }

  beforeEach(() => {
    hydrateMock = vi.fn().mockResolvedValue(undefined);
    installMock = vi.fn();
    keeperInstallMock = vi.fn();
    mappingsHydrateMock = vi.fn().mockResolvedValue(undefined);
    routerStartMock = vi.fn();
    setsHydrateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(logWarn).mockClear();
  });

  it('init constructs the service (building both runtimes via DeckService) and calls hydrate', () => {
    const service = configure();

    service.init();

    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('init installs the mixer applier exactly once', () => {
    const service = configure();

    service.init();

    expect(installMock).toHaveBeenCalledTimes(1);
  });

  it('init installs the memory keeper exactly once, after the mixer applier', () => {
    const service = configure();

    service.init();

    expect(keeperInstallMock).toHaveBeenCalledTimes(1);
    expect(installMock.mock.invocationCallOrder[0]).toBeLessThan(
      keeperInstallMock.mock.invocationCallOrder[0]
    );
  });

  it('a throwing keeper install logs a warning, never throws, and still hydrates', () => {
    keeperInstallMock.mockImplementationOnce(() => {
      throw new Error('no effects');
    });
    const service = configure();

    expect(() => service.init()).not.toThrow();

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      'DjBootstrap: memory keeper install failed — no effects'
    );
    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('a throwing mixer install logs a warning, never throws, and still hydrates', () => {
    installMock.mockImplementationOnce(() => {
      throw new Error('no effects');
    });
    const service = configure();

    expect(() => service.init()).not.toThrow();

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: mixer install failed — no effects');
    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('a rejected hydrate logs a warning and never throws', async () => {
    hydrateMock.mockRejectedValueOnce(new Error('boom'));
    const service = configure();

    expect(() => service.init()).not.toThrow();
    await vi.waitFor(() => expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1));

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: bindings hydration failed — boom');
  });

  it('init hydrates the MIDI mappings alongside the bindings', () => {
    const service = configure();

    service.init();

    expect(mappingsHydrateMock).toHaveBeenCalledTimes(1);
    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('init hydrates the DJ library once, alongside the bindings', () => {
    const service = configure();

    service.init();

    expect(setsHydrateMock).toHaveBeenCalledTimes(1);
    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('starts routing controller input once the controllers have hydrated', async () => {
    const service = configure();

    service.init();
    await vi.waitFor(() => expect(routerStartMock).toHaveBeenCalledTimes(1));

    expect(mappingsHydrateMock).toHaveBeenCalledTimes(1);
    expect(mappingsHydrateMock.mock.invocationCallOrder[0]).toBeLessThan(
      routerStartMock.mock.invocationCallOrder[0]
    );
  });

  it('a rejected mappings hydrate logs a warning, never throws, starts no routing, and leaves the bindings hydrate alone', async () => {
    mappingsHydrateMock.mockRejectedValueOnce(new Error('offline'));
    const service = configure();

    expect(() => service.init()).not.toThrow();
    await vi.waitFor(() => expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1));

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: mappings hydration failed — offline');
    expect(routerStartMock).not.toHaveBeenCalled();
    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('a rejection with a non-Error value still logs, stringified', async () => {
    hydrateMock.mockRejectedValueOnce('offline');
    const service = configure();

    service.init();
    await vi.waitFor(() => expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1));

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: bindings hydration failed — offline');
  });
});
