import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '@teensyrom-nx/ui/styles';

/**
 * Throwaway spike for the ASID DJ player — reachable only by typing `/dev/dj-poc` in the browser.
 * Each later phase fills in one of the placeholder sections below.
 */
@Component({
  selector: 'lib-dj-poc-view',
  templateUrl: './dj-poc-view.component.html',
  styleUrl: './dj-poc-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DjPocViewComponent {
  // This route bypasses LayoutComponent, the only place ThemeService is normally injected —
  // without this, ThemeService never constructs and the app's dark-mode class never applies.
  private readonly themeService = inject(ThemeService);
}
