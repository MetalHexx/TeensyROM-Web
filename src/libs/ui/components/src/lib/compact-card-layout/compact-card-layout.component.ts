import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import type { GlassyIntensity } from '../shared/glassy.types';

@Component({
  selector: 'lib-compact-card-layout',
  imports: [CommonModule, MatCardModule],
  templateUrl: './compact-card-layout.component.html',
  styleUrl: './compact-card-layout.component.scss',
  host: {
    '[class.no-overflow]': 'enableOverflow() === false',
  },
})
export class CompactCardLayoutComponent {
  enableOverflow = input<boolean>(true);
  cardClass = input<string>(''); // Optional CSS class(es) to apply to the mat-card
  
  /**
   * Enable/disable glassy backdrop effect (default: true)
   * Set to false to disable glassy styling entirely
   */
  glassy = input<boolean>(true);
  
  /**
   * Glassy effect intensity (default: 'dark')
   * Options: 'subtle', 'light', 'medium', 'strong', 'dark', 'default'
   * Only applies when glassy=true
   */
  glassyIntensity = input<GlassyIntensity>('dark');
  
  /**
   * Computed CSS classes for the mat-card
   */
  protected computedCardClass = computed(() => {
    const classes: string[] = [];
    
    // Add custom cardClass if provided
    if (this.cardClass()) {
      classes.push(this.cardClass());
    }
    
    // Add glassy classes if enabled
    if (this.glassy()) {
      const intensity = this.glassyIntensity();
      if (intensity === 'default') {
        classes.push('glassy-card');
      } else {
        classes.push(`glassy-${intensity}`);
        classes.push('elevated-card');
      }
    }
    
    return classes.join(' ');
  });
}
