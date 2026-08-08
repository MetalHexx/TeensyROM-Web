import { StateSignals, WritableStateSource } from '@ngrx/signals';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;
