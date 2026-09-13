import { withMethods } from '@ngrx/signals';
import { getFile } from './get-file';
import { DjState, WritableStore } from '../dj-store';

export function withDjSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<DjState>;
    return {
      ...getFile(writableStore),
    };
  });
}
