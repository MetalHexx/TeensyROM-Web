import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeckService, MidiMappings, MixerApplier } from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';
import { DjBootstrapService } from './dj-bootstrap.service';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

describe('DjBootstrapService', () => {
  let hydrateMock: ReturnType<typeof vi.fn>;
  let installMock: ReturnType<typeof vi.fn>;
  let mappingsHydrateMock: ReturnType<typeof vi.fn>;

  function configure(): DjBootstrapService {
    TestBed.configureTestingModule({
      providers: [
        DjBootstrapService,
        { provide: DeckService, useValue: { hydrate: hydrateMock } },
        { provide: MixerApplier, useValue: { install: installMock } },
        { provide: MidiMappings, useValue: { hydrate: mappingsHydrateMock } },
      ],
    });
    return TestBed.inject(DjBootstrapService);
  }

  beforeEach(() => {
    hydrateMock = vi.fn().mockResolvedValue(undefined);
    installMock = vi.fn();
    mappingsHydrateMock = vi.fn().mockResolvedValue(undefined);
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

  it('a rejected mappings hydrate logs a warning, never throws, and leaves the bindings hydrate alone', async () => {
    mappingsHydrateMock.mockRejectedValueOnce(new Error('offline'));
    const service = configure();

    expect(() => service.init()).not.toThrow();
    await vi.waitFor(() => expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1));

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: mappings hydration failed — offline');
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
