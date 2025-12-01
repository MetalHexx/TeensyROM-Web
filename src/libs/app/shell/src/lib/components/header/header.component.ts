import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { NavButtonComponent } from './nav-button/nav-button.component';
import { ThemeService } from '@teensyrom-nx/ui/styles';
import { VERSION_SERVICE, } from '@teensyrom-nx/domain';

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
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  readonly themeService = inject(ThemeService);
  readonly currentTheme = this.themeService.currentTheme;
  
  private readonly versionService = inject(VERSION_SERVICE);
  readonly appVersion = signal<string>('v?.?.?');

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
