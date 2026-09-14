import { Provider } from '@angular/core';
import { DECK_BINDINGS_REPOSITORY } from '@teensyrom-nx/application';
import { IndexedDbDeckBindingsRepository } from './database';

/**
 * Provider configuration for DJ storage infrastructure.
 *
 * `IndexedDbTuneStore` is deliberately not bound here: no application code injects a `TuneStore`
 * directly — it is composed into the tunes inserter and resolver inside infrastructure (P02-T03),
 * and those two are what the application injects. It stays a `providedIn: 'root'` class for that
 * composition.
 */
export const DJ_STORAGE_PROVIDERS: Provider[] = [
  { provide: DECK_BINDINGS_REPOSITORY, useClass: IndexedDbDeckBindingsRepository },
];
