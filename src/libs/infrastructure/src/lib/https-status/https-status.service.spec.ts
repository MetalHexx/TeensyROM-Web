import { firstValueFrom } from 'rxjs';
import { EngineApiService, GetHttpsStatusResponse } from '@teensyrom-nx/data-access/api-client';
import { HttpsStatusService } from './https-status.service';

function serviceReturning(result: Promise<Partial<GetHttpsStatusResponse>>): HttpsStatusService {
  const api = { getHttpsStatus: () => result } as unknown as EngineApiService;
  return new HttpsStatusService(api);
}

describe('HttpsStatusService', () => {
  it('reports the port when the engine is serving https', async () => {
    const service = serviceReturning(Promise.resolve({ port: 10214, listening: true }));

    expect(await firstValueFrom(service.getSecurePort())).toBe(10214);
  });

  it('reports null when the engine is not serving https', async () => {
    const service = serviceReturning(Promise.resolve({ port: 10214, listening: false }));

    expect(await firstValueFrom(service.getSecurePort())).toBeNull();
  });

  it('reports null when the status cannot be read', async () => {
    const service = serviceReturning(Promise.reject(new Error('unreachable')));

    expect(await firstValueFrom(service.getSecurePort())).toBeNull();
  });
});
