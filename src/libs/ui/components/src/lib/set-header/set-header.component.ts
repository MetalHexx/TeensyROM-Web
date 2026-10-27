import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { InlineEditTitleComponent } from '../inline-edit-title/inline-edit-title.component';
import { SynthKeyComponent } from '../synth-key/synth-key.component';

/** How safely the set's latest change has reached storage. */
export type SetSaveState = 'saved' | 'saving' | 'failed';

/** The set header's caller-composed state. */
export interface SetHeaderModel {
  readonly name: string;
  /** The name field's maximum length, e.g. 64. */
  readonly nameMaxLength: number;
  /** e.g. '8 SIDS'. */
  readonly countText: string;
  readonly save: SetSaveState;
  /** The lamp's words: 'Saved' | 'Saving' | 'Not saved'. */
  readonly saveText: string;
  /** Names the rename button and field, e.g. 'Rename set Friday warm-up'. */
  readonly renameLabel: string;
  /** e.g. 'New set'. */
  readonly newAccessibleName: string;
  /** e.g. 'Delete set Hubbard only'. */
  readonly deleteAccessibleName: string;
  /** The confirm's question, e.g. "Delete Hubbard only? This can't be undone.". */
  readonly deletePrompt: string;
  /** True before the library is ready: the name cannot be edited and the keys are inert. */
  readonly disabled: boolean;
}

const NAME_REQUIRED = 'A set needs a name.';

/**
 * The set card's header: the set's name (renamed in place), a Saved lamp that is a polite status
 * for assistive tech, the SID count, and the Delete and New keys. Delete opens an inline confirm
 * in the header: focus moves to Cancel, Escape cancels and returns focus to the Delete key, and
 * only the confirm's Delete key emits `deleteSet`. Purely presentational — the caller composes
 * every word and owns the set.
 *
 * @example
 * ```html
 * <lib-set-header
 *   [model]="header()"
 *   (rename)="onRename($event)"
 *   (newSet)="onNew()"
 *   (deleteSet)="onDelete()"
 * />
 * ```
 */
@Component({
  selector: 'lib-set-header',
  imports: [InlineEditTitleComponent, SynthKeyComponent],
  templateUrl: './set-header.component.html',
  styleUrl: './set-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetHeaderComponent {
  /** The header's state. */
  readonly model = input.required<SetHeaderModel>();
  /** Emits the new name when a valid, changed name is committed. */
  readonly rename = output<string>();
  /** Emits when the New key is pressed. */
  readonly newSet = output<void>();
  /** Emits when the delete confirm's Delete key is pressed. */
  readonly deleteSet = output<void>();

  /** Whether the inline delete confirm is showing. */
  protected readonly confirming = signal(false);

  /** A set cannot be left without a name. */
  protected readonly isValidName = (draft: string): boolean => draft.trim().length > 0;
  protected readonly nameRequired = NAME_REQUIRED;

  private readonly injector = inject(Injector);
  private readonly deleteKey = viewChild('deleteKey', { read: ElementRef<HTMLElement> });
  private readonly cancelKey = viewChild('cancelKey', { read: ElementRef<HTMLElement> });

  /** Opens the confirm and moves focus to Cancel, the safe choice. */
  protected askToDelete(): void {
    this.confirming.set(true);
    afterNextRender(() => this.focusKey(this.cancelKey()), { injector: this.injector });
  }

  /** Closes the confirm and returns focus to the Delete key that opened it. */
  protected cancelDelete(): void {
    this.confirming.set(false);
    this.focusKey(this.deleteKey());
  }

  /** Closes the confirm and reports the deletion. */
  protected confirmDelete(): void {
    this.confirming.set(false);
    this.deleteSet.emit();
  }

  private focusKey(key: ElementRef<HTMLElement> | undefined): void {
    key?.nativeElement.querySelector('button')?.focus();
  }
}
