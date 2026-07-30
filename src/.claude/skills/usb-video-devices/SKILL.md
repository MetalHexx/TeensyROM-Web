---
name: usb-video-devices
description: 'Browser navigator.mediaDevices APIs for enumerating and inspecting USB video capture devices (enumerateDevices, getUserMedia, getSettings, getCapabilities, applyConstraints). Use when working with video-capture components, listing available cameras, reading/applying video track resolution or frame-rate constraints, handling USB device permission/hotplug behavior, or checking browser compatibility for MediaStream/MediaDevices APIs.'
---

# USB Video Devices Skill

Reference for the browser `navigator.mediaDevices`/`MediaStreamTrack` APIs used to enumerate and inspect USB video capture devices.

## When to Use This Skill

- Listing available cameras/video-input devices (`enumerateDevices`)
- Requesting a video stream for a specific device (`getUserMedia`)
- Reading a track's currently-applied settings (`getSettings`) or its supported ranges (`getCapabilities`)
- Applying new constraints (resolution, frame rate) to an active track (`applyConstraints`)
- Handling permission timing (labels are empty until granted) or USB hotplug (`ondevicechange`)
- Checking browser compatibility before relying on a given API

## Core APIs

| API | Purpose |
|-----|---------|
| `navigator.mediaDevices.enumerateDevices()` | Returns `MediaDeviceInfo[]` — filter by `kind === 'videoinput'` for cameras. `label`/`deviceId`/`groupId` per device. |
| `navigator.mediaDevices.getUserMedia(constraints)` | Requests access, returns an active `MediaStream` with tracks. |
| `videoTrack.getSettings()` | Actual applied settings (width, height, frameRate, facingMode, etc.) for a live track. |
| `videoTrack.getCapabilities()` | Supported ranges (min/max) for the same properties. |
| `videoTrack.applyConstraints(constraints)` | Changes resolution/frame rate on an active track. |

```typescript
const devices = await navigator.mediaDevices.enumerateDevices();
const videoInputs = devices.filter(d => d.kind === 'videoinput');

const stream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: { exact: videoInputs[0].deviceId } },
});
const track = stream.getVideoTracks()[0];
const settings = track.getSettings();      // current width/height/frameRate/...
const capabilities = track.getCapabilities(); // supported ranges
```

See [references/USB_VIDEO_DEVICE_INFORMATION.md](references/USB_VIDEO_DEVICE_INFORMATION.md) for the full property tables, a complete device-info-extraction function, and the browser compatibility matrix.

## Key Insights

- **Permission**: `enumerateDevices()` returns devices with empty `label` strings until permission is granted — request permission first, then enumerate (this is the pattern `video-capture.component.ts` already follows).
- **`deviceId` persists** across sessions for the same origin — safe to store as the user's preferred camera.
- **Hotplug**: listen for `navigator.mediaDevices.ondevicechange` to detect USB insert/removal and re-enumerate; tracks auto-stop when a USB device is unplugged.
- **Limitations**: USB devices often report generic labels (e.g., "USB Video Device"); not every device supports every capability — always guard on `getCapabilities()` before reading a property; enumeration requires HTTPS (or `localhost`).
- Always call `stream.getTracks().forEach(track => track.stop())` when done with a stream to release the device.
