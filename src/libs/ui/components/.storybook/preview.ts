import type { Preview } from '@storybook/angular';
import { withThemeByClassName } from '@storybook/addon-themes';

// The global stylesheet is loaded via the `styles` build option in
// project.json rather than imported here: this framework's webpack builder
// only pipes component-scoped styleUrls through the style-loader chain,
// not side-effecting imports from preview config.
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export const decorators = [
  withThemeByClassName({
    themes: { light: '', dark: 'dark-mode' },
    defaultTheme: 'light',
  }),
];

export default preview;
