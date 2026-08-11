import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { AlertMessage, AlertSeverity, AlertPosition, IAlertService } from '@teensyrom-nx/domain';
import { createMockAlertService } from './alert-service.mock';

describe('createMockAlertService', () => {
  it('provides a default empty alerts$ stream and spies for every method', async () => {
    const service = createMockAlertService() as IAlertService;

    const alerts = await firstValueFrom(service.alerts$);

    expect(alerts).toEqual([]);
    expect(service.show).toBeDefined();
    expect(service.success).toBeDefined();
    expect(service.dismiss).toBeDefined();
  });

  it('lets an override replace one member while the rest keep their defaults', async () => {
    const overrideAlerts: AlertMessage[] = [
      { id: '1', message: 'hi', severity: AlertSeverity.Info, position: AlertPosition.TopRight },
    ];
    const service = createMockAlertService({
      alerts$: of(overrideAlerts),
      error: vi.fn(),
    }) as IAlertService;

    const alerts = await firstValueFrom(service.alerts$);

    expect(alerts).toBe(overrideAlerts);
    expect(service.show).toBeDefined();
  });
});
