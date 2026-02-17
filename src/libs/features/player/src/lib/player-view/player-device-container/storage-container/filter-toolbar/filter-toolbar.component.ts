import { Component, inject, input, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScalingCompactCardComponent,
  IconButtonComponent,
  IconButtonColor,
  JoystickIconComponent,
  ImageIconComponent,
  TooltipConfig,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { PLAYER_CONTEXT, StorageStore } from '@teensyrom-nx/application';
import { PlayerFilterType } from '@teensyrom-nx/domain';
import { RandomRollButtonComponent } from './random-roll-button';

@Component({
  selector: 'lib-filter-toolbar',
  imports: [
    CommonModule,
    ScalingCompactCardComponent,
    IconButtonComponent,
    JoystickIconComponent,
    ImageIconComponent,
    RandomRollButtonComponent,
  ],
  templateUrl: './filter-toolbar.component.html',
  styleUrl: './filter-toolbar.component.scss',
})
export class FilterToolbarComponent {
  private readonly playerContext = inject(PLAYER_CONTEXT);
  private readonly storageStore = inject(StorageStore);

  deviceId = input.required<string>();
  readonly showCard = input<boolean>(true);

  // Expose PlayerFilterType enum for template access
  readonly PlayerFilterType = PlayerFilterType;

  // Tooltip configurations
  readonly allFilterTooltip: TooltipConfig = {
    title: 'Filter: Allow All Files',
    body: 'Allows all file types to be included in random launches and search results.',
    position: TooltipPosition.Top,
  };

  readonly gamesFilterTooltip: TooltipConfig = {
    title: 'Filter: Games/Programs Only',
    body: 'Restricts random launches and search results to games and programs only.',
    position: TooltipPosition.Top,
  };

  readonly musicFilterTooltip: TooltipConfig = {
    title: 'Filter: Music Only',
    body: 'Restricts random launches and search results to music files only.',
    position: TooltipPosition.Top,
  };

  readonly imagesFilterTooltip: TooltipConfig = {
    title: 'Filter: Images / Text files Only',
    body: 'Restricts random launches and search results to images and text files only.',
    position: TooltipPosition.Top,
  };

  // Computed signal for active filter
  activeFilter = computed(
    () => this.playerContext.getShuffleSettings(this.deviceId())()?.filter ?? PlayerFilterType.All
  );

  // Computed signal for search state
  private readonly searchState = computed(() => {
    return this.storageStore.getSearchState(this.deviceId())();
  });

  // Computed signal to check if search is active
  private readonly hasActiveSearch = computed(() => this.searchState()?.hasSearched ?? false);

  constructor() {
    // Effect: Re-search when filter changes during active search
    effect(() => {
      const currentFilter = this.activeFilter();
      const searchActive = this.hasActiveSearch();

      // Use untracked to get search state without creating dependency
      untracked(() => {
        if (searchActive) {
          const state = this.searchState();

          // Only re-search if we have valid state and search text
          if (state && state.searchText) {
            void this.storageStore.searchFiles({
              deviceId: this.deviceId(),
              searchText: state.searchText,
              filterType: currentFilter,
            });
          }
        }
      });
    });
  }

  // Helper method to determine button color based on active state only
  getButtonColor(filterType: PlayerFilterType): IconButtonColor {
    return this.activeFilter() === filterType ? 'highlight' : 'normal';
  }

  onAllClick(): void {
    this.playerContext.setFilterMode(this.deviceId(), PlayerFilterType.All);
  }

  onGamesClick(): void {
    this.playerContext.setFilterMode(this.deviceId(), PlayerFilterType.Games);
  }

  onMusicClick(): void {
    this.playerContext.setFilterMode(this.deviceId(), PlayerFilterType.Music);
  }

  onImagesClick(): void {
    this.playerContext.setFilterMode(this.deviceId(), PlayerFilterType.Images);
  }

  async onRandomLaunchClick(): Promise<void> {
    console.log('🚀 LaunchRandomFile method called!');
    const deviceId = this.deviceId();
    console.log('📱 Device ID:', deviceId);

    if (deviceId) {
      try {
        await this.playerContext.launchRandomFile(deviceId);
      } catch (error) {
        console.error('Failed to launch random file:', error);
      }
    } else {
      console.log('❌ No device ID provided, skipping launch');
    }
  }
}
