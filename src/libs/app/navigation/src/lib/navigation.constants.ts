// import { NavItem } from './nav-item.model'; // Commented out due to missing module

import { NavItem } from './navigation-item.model';

export const ROUTES = {
  PLAYER: 'player',
  FILE_TRANSFER: 'file-transfer',
  MIXER: 'dj-mixer',
  DEVICES: 'devices',
  SETTINGS: 'settings',
  THEMES: 'themes',
} as const;

export const ROUTE_TITLES = {
  [ROUTES.PLAYER]: 'Player',
  [ROUTES.FILE_TRANSFER]: 'File Transfer',
  [ROUTES.MIXER]: 'DJ Mixer',
  [ROUTES.DEVICES]: 'Devices',
  [ROUTES.SETTINGS]: 'Settings',
  [ROUTES.THEMES]: 'Theme',
} as const;

export const NAV_ITEMS: NavItem[] = [
  {
    name: ROUTE_TITLES[ROUTES.PLAYER],
    icon: 'play_arrow',
    route: ROUTES.PLAYER,
  },
  {
    name: ROUTE_TITLES[ROUTES.MIXER],
    icon: 'tune',
    route: ROUTES.MIXER,
  },
  {
    name: ROUTE_TITLES[ROUTES.FILE_TRANSFER],
    icon: 'upload',
    route: ROUTES.FILE_TRANSFER,
  },
  {
    name: ROUTE_TITLES[ROUTES.DEVICES],
    icon: 'devices',
    route: ROUTES.DEVICES,
  },
  {
    name: ROUTE_TITLES[ROUTES.THEMES],
    icon: 'palette',
    route: ROUTES.THEMES,
  },
  {
    name: ROUTE_TITLES[ROUTES.SETTINGS],
    icon: 'settings',
    route: ROUTES.SETTINGS,
  },
] as const;
