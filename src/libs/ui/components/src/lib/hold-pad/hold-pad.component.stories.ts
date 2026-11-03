import type { Meta, StoryObj } from '@storybook/angular';
import { HoldPadComponent } from './hold-pad.component';

const meta: Meta<HoldPadComponent> = {
  title: 'DJ/Hold Pad',
  component: HoldPadComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small rounded pad with no light that glows magenta while held — Kill and Punch, or ' +
          'the speed nudge − and +. A native button using `libHoldPress`: a hold works by pointer ' +
          'or by Enter / Space, `heldChange` emits `true` on press and `false` on release, and a ' +
          'hold ended by blur, pointer cancel, becoming disabled or removal emits `false` once. ' +
          'The `held` input lights the pad for a hold the caller knows of, such as one made on a ' +
          "controller; the pad's own hold lights it too. The lit state shows as `aria-pressed`. " +
          'The Held stories press it with an Enter keydown; the HeldFromState stories use `held`.',
      },
    },
  },
  argTypes: {
    label: { description: "'Kill' / 'Punch', or '−' / '+'." },
    accessibleName: {
      description: "Accessible name, e.g. 'Kill voice 1 deck A'; the caller composes it.",
    },
    shape: {
      description: "'pill' is 44×22, 'round' is 26×26.",
      control: 'inline-radio',
      options: ['pill', 'round'],
    },
    held: { description: 'Lights the pad for a hold the caller knows of, e.g. from a controller.' },
    disabled: { description: 'Disables the pad; releases a hold in progress once.' },
    heldChange: { description: 'Emits `true` on press and `false` on release or cancel.' },
  },
};

export default meta;
type Story = StoryObj<HoldPadComponent>;

const render: Story['render'] = (args) => ({
  props: args,
  template: `
    <lib-hold-pad
      [label]="label"
      [accessibleName]="accessibleName"
      [shape]="shape"
      [held]="held"
      [disabled]="disabled"
    />
  `,
});

const pill = {
  label: 'Kill',
  accessibleName: 'Kill voice 1 deck A',
  shape: 'pill',
  disabled: false,
  held: false,
} as const;
const round = {
  label: '+',
  accessibleName: 'Speed up deck A',
  shape: 'round',
  disabled: false,
  held: false,
} as const;

const pressWithEnter = async ({ canvasElement }: { canvasElement: HTMLElement }): Promise<void> => {
  canvasElement
    .querySelector('button')
    ?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
};

export const PillIdle: Story = { args: pill, render };

export const PillHeld: Story = { args: pill, render, play: pressWithEnter };

const focusPad = async ({ canvasElement }: { canvasElement: HTMLElement }): Promise<void> => {
  canvasElement.querySelector('button')?.focus();
};

export const PillFocused: Story = { args: pill, render, play: focusPad };

export const RoundFocused: Story = { args: round, render, play: focusPad };

export const PillDisabled: Story = { args: { ...pill, disabled: true }, render };

export const RoundIdle: Story = { args: round, render };

export const RoundHeld: Story = { args: round, render, play: pressWithEnter };

/** Lit by the caller's `held`, with no pointer. */
export const PillHeldFromState: Story = { args: { ...pill, held: true }, render };

export const RoundHeldFromState: Story = { args: { ...round, held: true }, render };

export const RoundDisabled: Story = { args: { ...round, disabled: true }, render };
