import { Provider } from '@angular/core';
import { TRANSFER_CONTEXT } from './transfer-context.interface';
import { TransferContextService } from './transfer-context.service';

export const TRANSFER_CONTEXT_PROVIDER: Provider = {
  provide: TRANSFER_CONTEXT,
  useExisting: TransferContextService,
};

export const TRANSFER_CONTEXT_PROVIDERS: Provider[] = [TransferContextService, TRANSFER_CONTEXT_PROVIDER];
