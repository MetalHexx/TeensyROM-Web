import { Component, input, output } from '@angular/core';
import { DirectoryNavigateComponent } from './directory-navigate/directory-navigate.component';
import { DirectoryBreadcrumbComponent } from './directory-breadcrumb/directory-breadcrumb.component';

@Component({
  selector: 'lib-directory-trail',
  standalone: true,
  imports: [DirectoryNavigateComponent, DirectoryBreadcrumbComponent],
  templateUrl: './directory-trail.component.html',
  styleUrl: './directory-trail.component.scss',
})
export class DirectoryTrailComponent {
  currentPath = input.required<string>();
  storageTypeLabel = input.required<string>();
  canNavigateUp = input<boolean>(false);
  canNavigateBack = input<boolean>(false);
  canNavigateForward = input<boolean>(false);
  isLoading = input<boolean>(false);

  backClicked = output<void>();
  forwardClicked = output<void>();
  upClicked = output<void>();
  refreshClicked = output<void>();
  navigationRequested = output<string>();

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

  onNavigationRequested(path: string): void {
    this.navigationRequested.emit(path);
  }
}
