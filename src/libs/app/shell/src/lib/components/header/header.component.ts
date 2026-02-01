import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { NavButtonComponent } from './nav-button/nav-button.component';
import { ThemeService, PreferencesService } from '@teensyrom-nx/ui/styles';
import { VERSION_SERVICE } from '@teensyrom-nx/domain';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';
import { TooltipConfig, TooltipTitleColor, TooltipPosition } from '@teensyrom-nx/ui/components';

@Component({
  selector: 'lib-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatRadioModule,
    NavButtonComponent,
    IconButtonComponent,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  readonly currentTheme = this.themeService.currentTheme;
  readonly themeIcon = computed(() => this.currentTheme() === 'dark' ? 'dark_mode' : 'light_mode');
  
  readonly preferencesService = inject(PreferencesService);
  readonly tooltipsEnabled = this.preferencesService.tooltipsEnabled;
  
  private readonly versionService = inject(VERSION_SERVICE);
  readonly appVersion = signal<string>('v?.?.?');

  // Tooltip configuration for toggle button
  readonly tooltipToggleTooltip: TooltipConfig = {
    title: 'Toggle Tooltips',
    titleColor: TooltipTitleColor.Default,
    body: 'Enable / Disable help tooltips. Some tooltips will always be displayed.',
    position: TooltipPosition.Bottom,
    alwaysShow: true, // Always show this tooltip so users can re-enable tooltips
  };

  // Tooltip configuration for theme toggle
  readonly themeToggleTooltip: TooltipConfig = {
    title: 'Theme',
    titleColor: TooltipTitleColor.Default,
    body: 'Toggle dark/light mode',
    position: TooltipPosition.Right,
    alwaysShow: true, // Always show so users can see what the button does
  };

  ngOnInit(): void {
    this.versionService.getVersion().subscribe({
      next: (version) => {
        this.appVersion.set(`v${version.version}`);
      },
      error: () => {
        // Error already logged by service, keep placeholder
        this.appVersion.set('v?.?.?');
      },
    });
  }
}
