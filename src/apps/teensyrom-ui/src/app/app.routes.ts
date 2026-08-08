import { Route } from '@angular/router';
import { LayoutComponent } from '@teensyrom-nx/app/shell';
import { playerRouteResolver } from '@teensyrom-nx/app/navigation';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'devices',
        pathMatch: 'full',
      },
      {
        path: 'devices',
        data: { title: 'Devices' },
        loadComponent: () =>
          import('@teensyrom-nx/features/device').then((m) => m.DeviceViewComponent),
      },
      {
        path: 'player',
        data: { title: 'Player' },
        resolve: { initialized: playerRouteResolver },
        loadComponent: () =>
          import('@teensyrom-nx/features/player').then((m) => m.PlayerViewComponent),
      },
      {
        path: 'file-transfer',
        data: { title: 'File Transfer' },
        loadComponent: () =>
          import('@teensyrom-nx/features/file-transfer').then((m) => m.FileTransferViewComponent),
      },
      {
        path: 'settings',
        data: { title: 'Settings' },
        loadComponent: () =>
          import('@teensyrom-nx/features/settings').then((m) => m.SettingsViewComponent),
      },
    ],
  },
];
