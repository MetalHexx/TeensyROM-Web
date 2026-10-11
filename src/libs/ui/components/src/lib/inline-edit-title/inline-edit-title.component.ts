import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

let nextInstanceId = 0;

/**
 * A title that renames itself in place. In its resting state it is a button showing `value`, with a
 * pencil icon revealed on hover and keyboard focus. Clicking it (or pressing Enter) swaps in a text
 * field over the same line box, so surrounding content never moves between the resting, editing,
 * invalid and saving states.
 *
 * It inherits font, line height, letter spacing and colour from its container, so drop it inside
 * whatever already styles the title (for example a `mat-card-title`). The component is
 * rule-agnostic: the consumer supplies `isValid` and `maxLength`, and owns the persisted value —
 * `commit` only reports what the user typed, and the component keeps showing `value` until the
 * consumer updates it.
 *
 * Enter commits (an invalid draft keeps the field open and flags it), Escape cancels, and leaving
 * the field commits a valid changed draft and otherwise reverts. Reach for this over
 * `InputFieldComponent` when the text being edited is a heading rather than a form field.
 *
 * @example
 * ```html
 * <h2>
 *   <lib-inline-edit-title
 *     [value]="device.name"
 *     [maxLength]="24"
 *     [isValid]="isValidName"
 *     [saving]="isSaving"
 *     [editLabel]="'Rename ' + device.name"
 *     invalidDescription="Name must be 1-24 characters."
 *     (commit)="rename($event)"
 *   ></lib-inline-edit-title>
 * </h2>
 * ```
 */
@Component({
  selector: 'lib-inline-edit-title',
  imports: [MatIconModule],
  templateUrl: './inline-edit-title.component.html',
  styleUrl: './inline-edit-title.component.scss',
})
export class InlineEditTitleComponent {
  /** The committed text shown in the resting state, and the baseline an edit is compared against. */
  readonly value = input.required<string>();

  /** Maximum characters the field accepts; also the denominator of the `n/max` counter — defaults to `24`. */
  readonly maxLength = input<number>(24);

  /** The consumer's rule for a committable draft. Receives the raw draft — defaults to accepting anything. */
  readonly isValid = input<(draft: string) => boolean>(() => true);

  /** Disables the field while the consumer is persisting a committed change — defaults to `false`. */
  readonly saving = input<boolean>(false);

  /** Accessible name for the title button and the text field, e.g. `Rename TR-1` — defaults to `''`. */
  readonly editLabel = input<string>('');

  /** Visually hidden explanation announced and linked via `aria-describedby` while the draft is flagged invalid — defaults to `''`. */
  readonly invalidDescription = input<string>('');

  /** Emits the trimmed draft when the user commits a valid draft that differs from `value`. */
  readonly commit = output<string>();

  /** Whether the text field is showing in place of the resting button. */
  protected readonly editing = signal(false);

  /** The text currently in the field. */
  protected readonly draft = signal('');

  /** Whether an attempted commit of an invalid draft is being flagged (red outline and counter). */
  protected readonly showInvalid = signal(false);

  /** Unique id linking the field to its hidden invalid description. */
  protected readonly descriptionId = `lib-inline-edit-title-description-${nextInstanceId++}`;

  /** The `n/max` counter text. */
  protected readonly counter = computed(() => `${this.draft().length}/${this.maxLength()}`);

  private readonly injector = inject(Injector);
  private readonly titleButton = viewChild<ElementRef<HTMLButtonElement>>('titleButton');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /** Enters edit mode with the committed text selected. */
  protected startEdit(): void {
    this.draft.set(this.value());
    this.showInvalid.set(false);
    this.editing.set(true);
    afterNextRender(
      () => {
        const field = this.field()?.nativeElement;
        field?.focus();
        field?.select();
      },
      { injector: this.injector }
    );
  }

  /** Tracks the typed text, and clears the invalid flag as soon as the draft becomes valid again. */
  protected onInput(event: Event): void {
    const draft = (event.target as HTMLInputElement).value;
    this.draft.set(draft);
    if (this.showInvalid()) {
      this.showInvalid.set(!this.isValid()(draft));
    }
  }

  /** Commits the draft, or flags it when invalid. Ignores the Enter that confirms an IME composition. */
  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).isComposing) {
      return;
    }
    if (!this.isValid()(this.draft())) {
      this.showInvalid.set(true);
      return;
    }
    this.finish(true);
    this.focusTitleButton();
  }

  /** Abandons the draft and returns focus to the title button. */
  protected onEscape(): void {
    this.finish(false);
    this.focusTitleButton();
  }

  /** Leaving the field commits a valid changed draft and otherwise reverts, without taking focus back. */
  protected onBlur(): void {
    if (!this.editing()) {
      return;
    }
    this.finish(this.isValid()(this.draft()));
  }

  private finish(commit: boolean): void {
    const trimmed = this.draft().trim();
    this.editing.set(false);
    this.showInvalid.set(false);
    if (commit && trimmed !== this.value()) {
      this.commit.emit(trimmed);
    }
  }

  private focusTitleButton(): void {
    afterNextRender(() => this.titleButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
