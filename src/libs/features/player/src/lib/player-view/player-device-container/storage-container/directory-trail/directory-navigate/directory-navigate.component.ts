import { Component, input, output, computed } from '@angular/core';
import { IconButtonComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';

@Component({
  selector: 'lib-directory-navigate',
  standalone: true,
  imports: [IconButtonComponent],
  templateUrl: './directory-navigate.component.html',
  styleUrl: './directory-navigate.component.scss',
})
export class DirectoryNavigateComponent {
  // Inputs
  canNavigateUp = input<boolean>(false);
  canNavigateBack = input<boolean>(false);
  canNavigateForward = input<boolean>(false);
  isLoading = input<boolean>(false);

  // Outputs
  backClicked = output<void>();
  forwardClicked = output<void>();
  upClicked = output<void>();
  refreshClicked = output<void>();

  // Tooltip configurations
  readonly backTooltip: TooltipConfig = {
    title: 'Previous Directory',
    body: 'Takes you to the previous directory in your navigation history',
    position: TooltipPosition.Top,
  };

  readonly forwardTooltip: TooltipConfig = {
    title: 'Next Directory',
    body: 'Takes you to the next directory in your navigation history',
    position: TooltipPosition.Top,
  };

  readonly upTooltip: TooltipConfig = {
    title: 'Parent Directory',
    body: 'Go to parent directory of the current directory',
    position: TooltipPosition.Top,
  };

  readonly refreshTooltip: TooltipConfig = {
    title: 'Refresh Directory',
    body: 'Synchronizes the current directory with the latest files and subdirectories on your TeensyROM storage.',
    position: TooltipPosition.Top,
  };

  // Event handlers
  onBackClick(): void {
    this.backClicked.emit();
  }

  onForwardClick(): void {
    this.forwardClicked.emit();
  }

  onUpClick(): void {
    this.upClicked.emit();
  }

  onRefreshClick(): void {
    this.refreshClicked.emit();
  }
}
