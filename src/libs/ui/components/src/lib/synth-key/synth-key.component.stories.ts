import type { Meta, StoryObj } from '@storybook/angular';
import { SynthKeyComponent } from './synth-key.component';

const meta: Meta<SynthKeyComponent> = {
  title: 'DJ/Synth Key',
  component: SynthKeyComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A raised dark DJ key with an uppercase mono label and an optional icon. A native ' +
          'button: Enter and Space press it. It keeps no state; the caller reacts to `press` and ' +
          'feeds the state back. `latched` null is a one-shot key with no light; true/false is a ' +
          'latching key, exposed as `aria-pressed` and lit cyan while true. `lit` overrides the ' +
          'light when it means something other than the pressed state. `stateLight` draws a ' +
          'green (playing), amber blinking (paused, steady under reduced motion) or dark (off) ' +
          'bar along the top for Play/Pause. A parent hides the label by setting ' +
          '`--synth-key-label-display: none` on the key; the accessible name is unaffected.',
      },
    },
  },
  argTypes: {
    label: { description: 'Uppercase mono label; may be empty for an icon-only key.' },
    icon: { description: "Material icon ligature, e.g. 'play_arrow'." },
    accessibleName: { description: "Accessible name, e.g. 'Play deck A'; the caller composes it." },
    disabled: { description: 'Disables the key: dimmed, no light, no `press`.' },
    latched: {
      description:
        'null: one-shot key, no light. true/false: latching key, `aria-pressed`, lit cyan while true.',
    },
    lit: { description: 'Overrides the light of a latching key; null follows `latched`.' },
    stateLight: {
      description: "Play/Pause bar along the top: 'playing' green, 'paused' amber blinking, 'off' dark.",
    },
    press: { description: 'Emits on click, or Enter / Space.' },
  },
};

export default meta;
type Story = StoryObj<SynthKeyComponent>;

const render: Story['render'] = (args) => ({
  props: args,
  template: `
    <lib-synth-key
      [label]="label"
      [icon]="icon"
      [accessibleName]="accessibleName"
      [disabled]="disabled"
      [latched]="latched"
      [lit]="lit"
      [stateLight]="stateLight"
    />
  `,
});

const base = {
  label: 'Cue',
  icon: null,
  accessibleName: 'Cue deck A',
  disabled: false,
  latched: null,
  lit: null,
  stateLight: null,
};

/** A one-shot key: no light. */
export const OneShot: Story = { args: base, render };

/** A latching key that is off: pressed state false, no light. */
export const LatchingOff: Story = { args: { ...base, label: 'Sync', accessibleName: 'Sync deck A', latched: false }, render };

/** A latching key that is on: `aria-pressed` true, lit cyan. */
export const LatchingLit: Story = { args: { ...base, label: 'Sync', accessibleName: 'Sync deck A', latched: true }, render };

/** Pressed but not lit — the light means something other than the pressed state. */
export const LitOverride: Story = {
  args: { ...base, label: 'Mute', accessibleName: 'Mute voice 1', latched: true, lit: false },
  render,
};

/** Play/Pause with its state light: green while playing. */
export const PlayPlaying: Story = {
  args: { ...base, label: 'Play', icon: 'pause', accessibleName: 'Pause deck A', stateLight: 'playing' },
  render,
};

/** Play/Pause with its state light: amber, blinking, while paused (steady under reduced motion). */
export const PlayPaused: Story = {
  args: { ...base, label: 'Play', icon: 'play_arrow', accessibleName: 'Play deck A', stateLight: 'paused' },
  render,
};

/** Play/Pause with its state light dark. */
export const PlayOff: Story = {
  args: { ...base, label: 'Play', icon: 'play_arrow', accessibleName: 'Play deck A', stateLight: 'off' },
  render,
};

/** Icon and label together. */
export const WithIcon: Story = {
  args: { ...base, label: 'Play', icon: 'play_arrow', accessibleName: 'Play deck A' },
  render,
};

/** Icon-only: the wrapper hides the label with `--synth-key-label-display: none`; the accessible name stays. */
export const IconOnly: Story = {
  args: { ...base, label: 'Play', icon: 'play_arrow', accessibleName: 'Play deck A' },
  render: (args) => ({
    props: args,
    template: `
      <div style="--synth-key-label-display: none">
        <lib-synth-key [label]="label" [icon]="icon" [accessibleName]="accessibleName" />
      </div>
    `,
  }),
};

/** Dimmed and not interactive; no light even when latched. */
export const Disabled: Story = { args: { ...base, latched: true, disabled: true }, render };

/** Keyboard focus ring. */
export const Focused: Story = {
  args: base,
  render,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};
