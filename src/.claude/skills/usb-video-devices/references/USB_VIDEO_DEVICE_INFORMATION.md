# USB Video Device Information via Navigator API

When working with USB video streams in the browser, the `navigator` object provides several APIs to access device information. This document outlines what's available and how to use it.

## Primary APIs

### 1. **navigator.mediaDevices.enumerateDevices()**

Returns a list of media input/output devices connected to the system.

```typescript
const devices = await navigator.mediaDevices.enumerateDevices();
```

**Returns**: `MediaDeviceInfo[]`

**Available Properties per Device**:

| Property | Type | Description | Notes |
|----------|------|-------------|-------|
| `deviceId` | `string` | Unique identifier for the device | Persists across sessions on same origin |
| `label` | `string` | Human-readable name (e.g., "USB Video Device") | Empty until permission granted |
| `kind` | `'audioinput' \| 'audiooutput' \| 'videoinput'` | Type of media device | Filter by `'videoinput'` for cameras |
| `groupId` | `string` | Groups related devices (e.g., camera + mic on same USB device) | Useful for pairing audio/video |

**Example**:

```typescript
const devices = await navigator.mediaDevices.enumerateDevices();
const videoInputs = devices.filter(d => d.kind === 'videoinput');

videoInputs.forEach(device => {
  console.log(`Device: ${device.label}`);
  console.log(`ID: ${device.deviceId}`);
  console.log(`Group: ${device.groupId}`);
});
```

### 2. **navigator.mediaDevices.getUserMedia(constraints)**

Requests access to media devices and returns a `MediaStream` with active tracks.

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: { exact: 'device-id-here' } },
  audio: false
});
```

**Accessing Track Information**:

```typescript
const videoTrack = stream.getVideoTracks()[0];

// Track properties
console.log(videoTrack.label);           // Device name
console.log(videoTrack.enabled);         // Is track active?
console.log(videoTrack.readyState);      // 'live' or 'ended'
console.log(videoTrack.kind);            // 'video'
console.log(videoTrack.muted);           // Is track muted?
console.log(videoTrack.id);              // Unique track ID
```

### 3. **videoTrack.getSettings()**

Returns the actual applied settings for a video track.

```typescript
const videoTrack = stream.getVideoTracks()[0];
const settings = videoTrack.getSettings();
```

**Available Settings**:

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Current video width in pixels |
| `height` | `number` | Current video height in pixels |
| `frameRate` | `number` | Frames per second |
| `aspectRatio` | `number` | Width/height ratio |
| `resizeMode` | `'none' \| 'crop-and-scale'` | How video is resized |
| `facingMode` | `'user' \| 'environment' \| 'left' \| 'right'` | Camera orientation |
| `torch` | `boolean` | Is flashlight on (mobile) |
| `zoom` | `number` | Zoom level (if supported) |
| `brightness` | `number` | Video brightness (if supported) |
| `contrast` | `number` | Video contrast (if supported) |
| `saturation` | `number` | Video saturation (if supported) |
| `sharpness` | `number` | Video sharpness (if supported) |
| `focusMode` | `'continuous' \| 'single-shot' \| 'fixed'` | Focus behavior |
| `exposureMode` | `'continuous' \| 'single-shot' \| 'manual'` | Exposure behavior |

**Example**:

```typescript
const settings = videoTrack.getSettings();
console.log(`Resolution: ${settings.width}x${settings.height}`);
console.log(`Frame rate: ${settings.frameRate} fps`);
console.log(`Aspect ratio: ${settings.aspectRatio}`);
```

### 4. **videoTrack.getCapabilities()**

Returns the range of settings the device supports.

```typescript
const capabilities = videoTrack.getCapabilities();
```

**Example**:

```typescript
const caps = videoTrack.getCapabilities();
console.log(`Supported widths: ${caps.width?.min} - ${caps.width?.max}`);
console.log(`Supported heights: ${caps.height?.min} - ${caps.height?.max}`);
console.log(`Frame rates: ${caps.frameRate?.min} - ${caps.frameRate?.max}`);
console.log(`Zoom range: ${caps.zoom?.min} - ${caps.zoom?.max}`);
```

### 5. **videoTrack.applyConstraints(constraints)**

Applies new constraints to an active track (e.g., change resolution).

```typescript
await videoTrack.applyConstraints({
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 }
});
```

## Complete Information Extraction Pattern

Here's a comprehensive function to gather all available device information:

```typescript
async function getDetailedVideoDeviceInfo(): Promise<void> {
  try {
    // 1. Get all devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');

    for (const device of videoDevices) {
      console.log('=== Device Info ===');
      console.log(`Label: ${device.label}`);
      console.log(`ID: ${device.deviceId}`);
      console.log(`Group ID: ${device.groupId}`);
      console.log(`Kind: ${device.kind}`);

      try {
        // 2. Request stream to get track details
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
          audio: false
        });

        const videoTrack = stream.getVideoTracks()[0];

        console.log('\n--- Track Information ---');
        console.log(`Track Label: ${videoTrack.label}`);
        console.log(`Track ID: ${videoTrack.id}`);
        console.log(`Ready State: ${videoTrack.readyState}`);
        console.log(`Enabled: ${videoTrack.enabled}`);
        console.log(`Muted: ${videoTrack.muted}`);

        // 3. Get current settings
        const settings = videoTrack.getSettings();
        console.log('\n--- Current Settings ---');
        console.log(`Resolution: ${settings.width}x${settings.height}`);
        console.log(`Frame Rate: ${settings.frameRate} fps`);
        console.log(`Aspect Ratio: ${settings.aspectRatio}`);
        console.log(`Facing Mode: ${settings.facingMode}`);
        console.log(`Resize Mode: ${settings.resizeMode}`);

        // 4. Get capabilities
        const capabilities = videoTrack.getCapabilities();
        console.log('\n--- Capabilities ---');
        if (capabilities.width) {
          console.log(`Width Range: ${capabilities.width.min}-${capabilities.width.max}`);
        }
        if (capabilities.height) {
          console.log(`Height Range: ${capabilities.height.min}-${capabilities.height.max}`);
        }
        if (capabilities.frameRate) {
          console.log(`Frame Rate Range: ${capabilities.frameRate.min}-${capabilities.frameRate.max}`);
        }
        if (capabilities.zoom) {
          console.log(`Zoom Range: ${capabilities.zoom.min}-${capabilities.zoom.max}`);
        }

        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn(`Cannot access device ${device.label}:`, error);
      }

      console.log('\n');
    }
  } catch (error) {
    console.error('Failed to enumerate devices:', error);
  }
}
```

## Key Insights for USB Video Devices

### Permission Requirements

- **Before Permission**: `enumerateDevices()` returns devices but with empty `label` strings for privacy
- **After Permission**: Full device labels are available
- **Current Implementation**: Your `video-capture.component.ts` requests permission first, then enumerates - this is the correct pattern

### Device Persistence

- `deviceId` persists across browser sessions for the same origin
- Useful for remembering user's preferred camera choice
- Can be stored in localStorage or IndexedDB

### USB-Specific Considerations

| Aspect | Details |
|--------|---------|
| **Hotplug Support** | Use `navigator.mediaDevices.ondevicechange` event to detect USB device insertion/removal |
| **Multiple Cameras** | `groupId` groups related devices (e.g., USB hub with multiple cameras) |
| **Power Management** | Tracks automatically stop when USB device is unplugged |
| **Bandwidth** | USB 2.0 limits resolution/frame rate compared to built-in cameras |

### Common Limitations

- **Label Accuracy**: USB devices may report generic names like "USB Video Device" instead of brand names
- **Setting Support**: Not all devices support all capabilities (check `getCapabilities()`)
- **Cross-Origin**: Device enumeration restricted by browser security (HTTPS only, except localhost)
- **Privacy**: User must grant permission for each origin separately

## Events to Monitor

```typescript
// Listen for device changes (USB plugged in/out)
navigator.mediaDevices.ondevicechange = () => {
  console.log('Available devices changed');
  // Re-enumerate devices
};

// Monitor track events
videoTrack.onmute = () => console.log('Track muted');
videoTrack.onunmute = () => console.log('Track unmuted');
videoTrack.onended = () => console.log('Track ended (device disconnected?)');
```

## Browser Compatibility

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| `enumerateDevices()` | ✅ 45+ | ✅ 39+ | ✅ 11+ | ✅ 12+ |
| `getUserMedia()` | ✅ 53+ | ✅ 36+ | ✅ 11+ | ✅ 12+ |
| `getSettings()` | ✅ 59+ | ✅ 55+ | ✅ 11+ | ✅ 79+ |
| `getCapabilities()` | ✅ 59+ | ✅ 55+ | ⚠️ Limited | ✅ 79+ |
| `applyConstraints()` | ✅ 59+ | ✅ 55+ | ⚠️ Limited | ✅ 79+ |

## References

- [MDN: MediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)
- [MDN: MediaStreamTrack](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack)
- [W3C: Media Capture and Streams](https://w3c.github.io/mediacapture-main/)
- [W3C: Image Capture](https://w3c.github.io/image-capture/)
