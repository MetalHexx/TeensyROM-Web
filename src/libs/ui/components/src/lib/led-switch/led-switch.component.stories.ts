import { AfterViewInit, ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { LedSwitchComponent } from './led-switch.component';

/** Calls `setLiveLight` once rendered, the way a painter would. */
@Component({
  selector: 'lib-led-switch-live-demo',
  imports: [LedSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lib-led-switch [label]="label()" accessibleName="Live light demo" [locked]="locked()" />
  `,
})
class LiveLightDemoComponent implements AfterViewInit {
  readonly label = input('Ring');
  readonly lit = input(false);
  readonly ghost = input(false);
  readonly locked = input(false);

  private readonly led = viewChild.required(LedSwitchComponent);

  ngAfterViewInit(): void {
    this.led().setLiveLight(this.lit(), this.ghost());
  }
}

const meta: Meta<LedSwitchComponent> = {
  title: 'DJ/LED Switch',
  component: LedSwitchComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LiveLightDemoComponent] })],
  parameters: {
    docs: {
      description: {
        component:
          'A small labelled pill with an LED dot, for Ring, Sync, Filt and LP/BP/HP. A native ' +
          'button: Enter and Space press it. It keeps no on/off state; the caller reacts to ' +
          '`press`, and a painter sets the live light through `setLiveLight(lit, ghost)` directly ' +
          "on the host, outside change detection. Lit fills the dot; ghost draws the tune's own " +
          'choice under a lock as a dashed outline with a hollow ring dot; locked adds a heavier ' +
          'magenta outline and `aria-pressed`, so no state rests on colour alone.',
      },
    },
  },
  argTypes: {
    label: { description: "The pill's text, drawn in uppercase: 'Ring', 'Sync', 'Filt', 'LP'." },
    accessibleName: { description: "Accessible name, e.g. 'Ring modulation, voice 1'; the caller composes it." },
    disabled: { description: 'Disables the button; no `press` is emitted.' },
    locked: { description: 'Locked: a magenta outline weight, reflected as `aria-pressed`.' },
    press: { description: 'Emits on click, or Enter / Space.' },
  },
};

export default meta;
type Story = StoryObj<LedSwitchComponent>;

export const Default: Story = {
  args: { label: 'Ring', accessibleName: 'Ring modulation, voice 1', disabled: false, locked: false },
  render: (args) => ({
    props: args,
    template: `
      <lib-led-switch
        [label]="label"
        [accessibleName]="accessibleName"
        [disabled]="disabled"
        [locked]="locked"
      />
    `,
  }),
};

export const Disabled: Story = { args: { ...Default.args, disabled: true }, render: Default.render };

export const Locked: Story = { args: { ...Default.args, locked: true }, render: Default.render };

/** Off, lit, ghost under a lock, and lit under a lock. */
export const States: Story = {
  render: () => ({
    template: `
      <div style="display: flex; gap: 12px; padding: 8px;">
        <lib-led-switch-live-demo label="Sync" />
        <lib-led-switch-live-demo label="Sync" [lit]="true" />
        <lib-led-switch-live-demo label="Sync" [ghost]="true" [locked]="true" />
        <lib-led-switch-live-demo label="Sync" [lit]="true" [locked]="true" />
      </div>
    `,
  }),
};
