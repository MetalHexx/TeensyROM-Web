import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  StyledIconComponent,
  StyledIconColor,
  StyledIconSize,
} from '../styled-icon/styled-icon.component';

export type IconLabelSize = 'small' | 'medium' | 'large' | 'extra-large';

interface IconLabelSizePreset {
  iconSize: StyledIconSize;
  textClass: string;
  gapClass: string;
}

const SIZE_PRESETS: Record<IconLabelSize, IconLabelSizePreset> = {
  small: {
    iconSize: 'small',
    textClass: 'text-small',
    gapClass: 'gap-small',
  },
  medium: {
    iconSize: 'medium',
    textClass: 'text-medium',
    gapClass: 'gap-medium',
  },
  large: {
    iconSize: 'large',
    textClass: 'text-large',
    gapClass: 'gap-large',
  },
  'extra-large': {
    iconSize: 'extra-large',
    textClass: 'text-extra-large',
    gapClass: 'gap-extra-large',
  },
};

@Component({
  selector: 'lib-icon-label',
  standalone: true,
  imports: [CommonModule, StyledIconComponent],
  templateUrl: './icon-label.component.html',
  styleUrl: './icon-label.component.scss',
})
export class IconLabelComponent {
  icon = input<string>('');
  label = input<string>('');
  color = input<StyledIconColor>('normal');
  size = input<IconLabelSize>('medium');
  truncate = input<boolean>(true);

  // Computed signals for preset-based styling
  iconSize = computed(() => SIZE_PRESETS[this.size()].iconSize);
  textClass = computed(() => SIZE_PRESETS[this.size()].textClass);
  gapClass = computed(() => SIZE_PRESETS[this.size()].gapClass);
}
