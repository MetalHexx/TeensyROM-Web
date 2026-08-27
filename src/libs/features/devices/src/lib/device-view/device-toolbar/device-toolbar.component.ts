import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCompactCardComponent, ActionButtonComponent, TooltipConfig, TooltipPosition } from '@teensyrom-nx/ui/components';
import { DeviceStore } from '@teensyrom-nx/application';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'lib-device-toolbar',
  imports: [
    CommonModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    ScalingCompactCardComponent,
    ActionButtonComponent,
    MatButtonModule,
  ],
  templateUrl: './device-toolbar.component.html',
  styleUrl: './device-toolbar.component.scss',
})
export class DeviceToolbarComponent {
  private readonly deviceStore = inject(DeviceStore);
  protected readonly hasEnabledDevices = this.deviceStore.hasEnabledDevices;

  // Tooltip configurations
  readonly scanTooltip: TooltipConfig = {
    title: 'Discover Devices',
    body: 'Scans your local network and COM ports for TeensyROM devices. Searches the subnet associated to the machine the API is running on.',
    position: TooltipPosition.Top
  };

  readonly directConnectTooltip: TooltipConfig = {
    title: 'Connect by IP address',
    body: 'Connect directly to a TeensyROM at this address without scanning the local network. The address is remembered after a successful connection.',
    position: TooltipPosition.Top,
  };

  readonly resetTooltip = computed<TooltipConfig>(() => ({
    title: 'Reset Devices',
    body: this.hasEnabledDevices() 
      ? 'Resets all enabled TeensyROM devices' 
      : 'No enabled TeensyROM devices available to reset',
    position: TooltipPosition.Top
  }));

  readonly pingTooltip = computed<TooltipConfig>(() => ({
    title: 'Ping Devices',
    body: this.hasEnabledDevices() 
      ? 'Sends a ping command to all enabled TeensyROM devices.  See logs for response.' 
      : 'No enabled TeensyROM devices available to ping',
    position: TooltipPosition.Top
  }));

  readonly indexAllTooltip = computed<TooltipConfig>(() => ({
    title: 'Index All Storage',
    body: this.hasEnabledDevices() 
      ? 'Indexes files for all enabled TeensyROM devices.  This makes files available for search and random launch.' 
      : 'No enabled TeensyROM devices available to index',
    position: TooltipPosition.Top
  }));

  onIndexAllStorage() {
    this.deviceStore.indexStorageAllStorage();
  }

  onRefreshDevices() {
    // Full network scan when user manually triggers discovery
    this.deviceStore.findDevices(true);
  }

  onConnectByIp(ipAddress: string) {
    const trimmedAddress = ipAddress.trim();
    if (trimmedAddress) {
      this.deviceStore.connectTcpDevice(trimmedAddress);
    }
  }

  onResetDevices() {
    this.deviceStore.resetAllDevices();
  }

  onPingDevices() {
    this.deviceStore.pingAllDevices();
  }
}
