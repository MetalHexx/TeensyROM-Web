import { StoryMeta } from '../story-source';

/**
 * Shaped after `card-layout.component.stories.ts`: a title, a component reference and argTypes
 * that carry controls but no descriptions — which is what every story file in the library looks
 * like today.
 */
export const cardLayoutMeta: StoryMeta = {
  title: 'Layout/Card Layout',
  component: { name: 'CardLayoutComponent' },
  argTypes: {
    glassyIntensity: {
      control: 'select',
      options: ['subtle', 'light', 'medium', 'strong', 'dark', 'default'],
    },
  },
};

/** The forward-looking shape: a narrative on `parameters` and a description on an argType. */
export const annotatedCardLayoutMeta: StoryMeta = {
  title: 'Layout/Card Layout',
  component: { name: 'CardLayoutComponent' },
  parameters: {
    docs: { description: { component: 'Wraps content in the glassy card chrome. Use it for panels.' } },
  },
  argTypes: {
    glassyIntensity: { description: 'Story-authored intensity guidance.' },
    metadataSource: { description: '   ' },
  },
};

export const tooltipMeta: StoryMeta = {
  title: 'Overlay & Interaction/Tooltip',
  component: { name: 'TooltipDirective' },
};

export const animationChainingSystemMeta: StoryMeta = {
  title: 'Systems/Animation Chaining',
  parameters: {
    docs: {
      description: {
        component: 'Sequences container animations. Each stage waits on the previous stage to settle.',
      },
    },
  },
};

/** Modules as a `StoryModuleLoader` returns them — the meta is the default export. */
export function storyModule(meta: StoryMeta): Record<string, unknown> {
  return { default: meta, Primary: { args: {} } };
}
