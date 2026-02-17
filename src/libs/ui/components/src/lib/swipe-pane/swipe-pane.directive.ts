import { Directive, inject, input, TemplateRef } from '@angular/core';

@Directive({
  selector: '[libSwipePane]',
  standalone: true,
})
export class SwipePaneDirective {
  readonly templateRef = inject(TemplateRef);
  readonly label = input<string>('');
}
