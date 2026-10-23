import { AfterViewInit, ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';
import { WaveformButtonComponent, WaveformKind } from './waveform-button.component';

/** Calls `setLiveLight` once rendered, the way a painter would. */
@Component({
  selector: 'lib-waveform-button-live-demo',
  imports: [WaveformButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lib-waveform-button
      [waveform]="waveform()"
      accessibleName="Live light demo"
      [locked]="locked()"
    />
  `,
})
class LiveLightDemoComponent implements AfterViewInit {
  readonly waveform = input<WaveformKind>('pulse');
  readonly lit = input(false);
  readonly ghost = input(false);
  readonly locked = input(false);

  private readonly button = viewChild.required(WaveformButtonComponent);

  ngAfterViewInit(): void {
    this.button().setLiveLight(this.lit(), this.ghost());
  }
}

const meta: Meta<WaveformButtonComponent> = {
  title: 'DJ/Waveform Button',
  component: WaveformButtonComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LiveLightDemoComponent] })],
  parameters: {
    docs: {
      description: {
        component:
          'A small panel button drawing one SID waveform glyph. A native button: Enter and Space ' +
          'press it. It keeps no on/off state; the caller reacts to `press`, and a painter sets ' +
          'the live light through `setLiveLight(lit, ghost)` directly on the host, outside change ' +
          'detection. Lit thickens the glyph and adds a cyan glow; ghost draws the tune\'s own ' +
          'choice under a lock as a dashed outline; locked adds a heavier magenta outline and ' +
          '`aria-pressed`, so no state rests on colour alone.',
      },
    },
  },
  argTypes: {
    waveform: {
      description: 'Which waveform glyph to draw.',
      control: 'inline-radio',
      options: ['triangle', 'sawtooth', 'pulse', 'noise'],
    },
    accessibleName: { description: "Accessible name, e.g. 'Pulse, voice 1'; the caller composes it." },
    disabled: { description: 'Disables the button; no `press` is emitted.' },
    locked: { description: 'Locked: a magenta outline weight, reflected as `aria-pressed`.' },
    press: { description: 'Emits on click, or Enter / Space.' },
  },
};

export default meta;
type Story = StoryObj<WaveformButtonComponent>;

export const Default: Story = {
  args: { waveform: 'pulse', accessibleName: 'Pulse, voice 1', disabled: false, locked: false },
  render: (args) => ({
    props: args,
    template: `
      <lib-waveform-button
        [waveform]="waveform"
        [accessibleName]="accessibleName"
        [disabled]="disabled"
        [locked]="locked"
      />
    `,
  }),
};

export const Disabled: Story = { args: { ...Default.args, disabled: true }, render: Default.render };

export const Locked: Story = { args: { ...Default.args, locked: true }, render: Default.render };

/** All four glyphs: off, lit, ghost, and lit under a lock. */
export const States: Story = {
  render: () => ({
    template: `
      <div style="display: grid; grid-template-columns: repeat(4, max-content); gap: 12px; padding: 8px;">
        @for (kind of ['triangle', 'sawtooth', 'pulse', 'noise']; track kind) {
          <lib-waveform-button-live-demo [waveform]="kind" />
          <lib-waveform-button-live-demo [waveform]="kind" [lit]="true" />
          <lib-waveform-button-live-demo [waveform]="kind" [ghost]="true" [locked]="true" />
          <lib-waveform-button-live-demo [waveform]="kind" [lit]="true" [locked]="true" />
        }
      </div>
    `,
  }),
};
