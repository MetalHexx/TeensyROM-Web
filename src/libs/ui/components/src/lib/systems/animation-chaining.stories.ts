import type { Meta, StoryObj } from '@storybook/angular';

const meta: Meta = {
  title: 'Systems/Animation Chaining',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Automatic animation coordination between components via Angular's dependency injection. Components can chain animations when nested, or use explicit triggers for independent control.

**How It Works**

Animation components use Angular DI to provide/inject completion signals via the \`PARENT_ANIMATION_COMPLETE\` injection token (\`libs/ui/components/src/lib/shared/animation-tokens.ts\`). Components **do not auto-chain by default** — you must explicitly opt in using \`animationParent="auto"\` or set a custom animation parent. This prevents unintended chaining when nesting components purely for layout.

**Priority System**

1. **Explicit trigger** (highest): use the provided \`animationTrigger\` signal
2. **Custom parent override** (high): use the provided \`animationParent\` to opt in or redirect chains
3. **Immediate** (default): render immediately if no trigger or parent is specified

**Controlling Animation Chaining**

All animatable components support an \`animationParent\` input (typed as \`AnimationParentMode\` in \`animation.types.ts\`) for controlling when they wait for parent animations:

- \`undefined\` (default): no waiting — the component animates immediately, ignoring any parent animations
- \`null\`: same as \`undefined\` — no waiting, immediate animation
- \`'auto'\`: opt in to wait for the nearest animation parent in the DI tree
- \`AnimationParent\`: wait for a specific component reference (can be a sibling, ancestor, or any component)

**Important**: components **always register as animation parents** regardless of their \`animationParent\` setting. The \`animationParent\` input only controls whether a component **waits for** a parent, not whether it **is available as** a parent to its children.

> "Animation parent" refers to the animation chaining relationship, not the DOM parent. Any component can be set as an animation parent — sibling, ancestor, or anywhere in the tree. This decouples animation choreography from component hierarchy.

**Usage**

\`\`\`html
<!-- Explicit auto-chaining: nested components opt in to wait for parent -->
<lib-sliding-container [animationTrigger]="isReady()">
  <!-- Must explicitly use animationParent="auto" to wait for parent -->
  <lib-scaling-compact-card animationEntry="from-top" animationParent="auto">
    <div>Animates after parent (explicit opt-in)</div>
  </lib-scaling-compact-card>
</lib-sliding-container>

<!-- Independent control: components animate immediately by default -->
<div class="layout">
  <lib-scaling-card>Animates immediately</lib-scaling-card>
  <lib-scaling-card>Animates immediately</lib-scaling-card>
  <lib-scaling-card [animationTrigger]="showCard3()">Explicit timing</lib-scaling-card>
</div>

<!-- Custom parent: redirect animation chain to any component -->
<div class="layout">
  <!-- Master timeline controller (animation parent for coordination) -->
  <lib-sliding-container #masterTimeline [animationTrigger]="show()"> </lib-sliding-container>

  <!-- Elsewhere in the tree - siblings sync to same animation parent -->
  <lib-scaling-card [animationParent]="masterTimeline">Card A</lib-scaling-card>
  <lib-scaling-card [animationParent]="masterTimeline">Card B</lib-scaling-card>
</div>
\`\`\`

**Flexibility**: by default, components animate immediately. Use \`animationParent="auto"\` for parent/child coordination, explicit \`animationTrigger\` signals for any timing pattern, or \`animationParent\` with a component reference for custom choreography — sequenced animations, parallel animations, conditional animations, independent timelines, and so on.

**Applies To**: all animation components — \`ScalingCardComponent\`, \`ScalingCompactCardComponent\`, \`ScalingContainerComponent\`, \`SlidingContainerComponent\`, \`FadingContainerComponent\`.
        `.trim(),
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Overview: Story = {
  render: () => ({ template: '<p>See the Docs tab.</p>' }),
};
