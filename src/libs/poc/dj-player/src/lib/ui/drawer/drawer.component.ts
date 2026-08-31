import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * A collapsible section: a header button carrying a chevron and a title, projected content beneath
 * it once expanded. Collapsed by default — nothing behind it is more urgent than what an operator is
 * already looking at. Content-agnostic: `DjPocViewComponent` places one per drawer the wireframe
 * draws (SETUP & DIAGNOSTICS, TRACK ANALYSIS) and projects each drawer's own content in.
 */
@Component({
  selector: 'lib-drawer',
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent {
  readonly title = input.required<string>();
  readonly expanded = model<boolean>(false);

  protected toggle(): void {
    this.expanded.update((value) => !value);
  }
}
