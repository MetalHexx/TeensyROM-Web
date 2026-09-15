import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeckService } from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';
import { DjBootstrapService } from './dj-bootstrap.service';

vi.mock('@teensyrom-nx/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@teensyrom-nx/utils')>();
  return { ...actual, logWarn: vi.fn(actual.logWarn) };
});

describe('DjBootstrapService', () => {
  let hydrateMock: ReturnType<typeof vi.fn>;

  function configure(): DjBootstrapService {
    TestBed.configureTestingModule({
      providers: [DjBootstrapService, { provide: DeckService, useValue: { hydrate: hydrateMock } }],
    });
    return TestBed.inject(DjBootstrapService);
  }

  beforeEach(() => {
    hydrateMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(logWarn).mockClear();
  });

  it('init constructs the service (building both runtimes via DeckService) and calls hydrate', () => {
    const service = configure();

    service.init();

    expect(hydrateMock).toHaveBeenCalledTimes(1);
  });

  it('a rejected hydrate logs a warning and never throws', async () => {
    hydrateMock.mockRejectedValueOnce(new Error('boom'));
    const service = configure();

    expect(() => service.init()).not.toThrow();
    await vi.waitFor(() => expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1));

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: bindings hydration failed — boom');
  });

  it('a rejection with a non-Error value still logs, stringified', async () => {
    hydrateMock.mockRejectedValueOnce('offline');
    const service = configure();

    service.init();
    await vi.waitFor(() => expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1));

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith('DjBootstrap: bindings hydration failed — offline');
  });
});
