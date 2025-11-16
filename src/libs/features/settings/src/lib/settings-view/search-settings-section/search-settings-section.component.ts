import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';

/**
 * Presentational component for search settings section.
 * Displays search weight sliders, stop words list, and banned directories/files arrays.
 *
 * @example
 * ```html
 * <lib-search-settings-section
 *   [formGroup]="settingsForm().get('searchSettings')"
 * ></lib-search-settings-section>
 * ```
 */
@Component({
  selector: 'lib-search-settings-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    ScalingCardComponent,
  ],
  templateUrl: './search-settings-section.component.html',
  styleUrl: './search-settings-section.component.scss',
})
export class SearchSettingsSectionComponent {
  /**
   * FormGroup containing search settings controls:
   * - weights: FormGroup (nested)
   *   - nameWeight: FormControl<number>
   *   - titleWeight: FormControl<number>
   *   - creatorWeight: FormControl<number>
   *   - releaseInfoWeight: FormControl<number>
   *   - descriptionWeight: FormControl<number>
   * - stopWords: FormControl<string[]>
   * - bannedDirectories: FormControl<string[]>
   * - bannedFiles: FormControl<string[]>
   */
  formGroup = input.required<FormGroup>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);

  /**
   * Computed signal to access nested weights FormGroup
   */
  weightsGroup = computed(() => this.formGroup().get('weights') as FormGroup);
}
