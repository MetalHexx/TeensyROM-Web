import type { Meta, StoryObj } from '@storybook/angular';
import { HoldPressDirective } from './hold-press.directive';

const meta: Meta<HoldPressDirective> = {
  title: 'DJ/Hold Press',
  component: HoldPressDirective,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`[libHoldPress]` turns a native button into a momentary hold control: `holdChange` ' +
          'emits `true` on press and `false` on release, by pointer or by Enter / Space (the only ' +
          'way a keyboard user can express "while held"). Pointer capture keeps the release on the ' +
          'button if the press drags off it; key auto-repeat is ignored. Safety releases make sure ' +
          'a consumer never sees a press without its release: pointer cancel, blur ending a ' +
          'keyboard hold, the host becoming `holdDisabled` mid-hold, and the host being destroyed ' +
          "mid-hold each emit `false` once. `held` is a signal for the host's own styling. The " +
          'directive adds no look of its own; `lib-hold-pad` and the voice row apply it.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<HoldPressDirective>;

/** A plain button using the directive: hold it with the pointer or Enter / Space and watch the readout. */
export const Default: Story = {
  render: () => ({
    template: `
      <button
        type="button"
        libHoldPress
        (holdChange)="state = $event ? 'held' : 'released'"
        style="padding: 8px 16px;"
      >
        Hold me
      </button>
      <span style="margin-left: 12px;">{{ state }}</span>
    `,
    props: { state: 'released' },
  }),
};
