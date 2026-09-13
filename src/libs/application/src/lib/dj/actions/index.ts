import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import { FILE_CONTENT_SERVICE, IFileContentService } from '@teensyrom-nx/domain';
import { DjState, WritableStore } from '../dj-store';
import { retrieveFile } from './retrieve-file';

export function withDjActions() {
  return withMethods(
    (store, fileContentService: IFileContentService = inject(FILE_CONTENT_SERVICE)) => {
      const writableStore = store as WritableStore<DjState>;
      return {
        ...retrieveFile(writableStore, fileContentService),
      };
    }
  );
}
