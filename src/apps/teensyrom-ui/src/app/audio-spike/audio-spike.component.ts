import { Component, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as signalR from '@microsoft/signalr';

interface AudioDevice {
  index: number;
  name: string;
  maxInputChannels: number;
  defaultSampleRate: number;
}

@Component({
  selector: 'app-audio-spike',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding: 1rem 1.5rem; font-family: monospace; color: #eee; background: #111; min-height: 100vh; box-sizing: border-box;">
      <h2 style="margin:0 0 .75rem">🔊 Audio Spike</h2>

      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start">

        <!-- LEFT COLUMN -->
        <div style="flex:1; min-width:280px; max-width:500px">

          <fieldset style="border:1px solid #444; padding:.5rem .75rem; margin-bottom:.75rem">
            <legend style="color:#aaa">Hub</legend>
            <div style="margin-bottom:.5rem">
              <label style="display:block; font-size:.8rem; color:#aaa">Server URL:</label>
              <input type="text" [(ngModel)]="baseUrl" [disabled]="hubState() !== 'disconnected'" style="width:100%; box-sizing:border-box; font-size:.85rem" placeholder="http://192.168.1.x:213" />
            </div>
            <button (click)="connectHub()" [disabled]="hubState() !== 'disconnected'">Connect</button>
            <span style="margin-left:.75rem">{{ hubState() }}</span>
          </fieldset>

          <fieldset style="border:1px solid #444; padding:.5rem .75rem; margin-bottom:.75rem">
            <legend style="color:#aaa">Devices</legend>
            <button (click)="loadDevices()" [disabled]="hubState() !== 'connected'">Load devices</button>
            <span style="margin-left:.75rem;color:#888">{{ devices().length }} found</span>
            <div style="max-height:100px; overflow-y:auto; margin-top:.5rem; font-size:.78rem; line-height:1.6">
              @for (d of devices(); track d.index) {
                <div [style.background]="d.index === selectedDeviceIndex() ? '#2a2a2a' : 'transparent'"
                     style="padding:0 .25rem; cursor:pointer; white-space:nowrap"
                     (click)="selectDevice(d)">
                  [{{ d.index }}] {{ d.name }} — {{ d.maxInputChannels }}ch
                </div>
              }
            </div>
          </fieldset>

          <fieldset style="border:1px solid #444; padding:.5rem .75rem; margin-bottom:.75rem">
            <legend style="color:#aaa">Stream</legend>

            <div style="display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem">
              <button (click)="prevDevice()" [disabled]="!canGoPrev()" style="min-width:2rem">◀</button>
              <span style="flex:1; font-size:.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                @if (devices().length > 0) {
                  <strong>[{{ selectedDeviceIndex() }}]</strong> {{ currentDeviceName() }}
                  <em style="color:#888">&nbsp;({{ currentDeviceListPos() + 1 }}/{{ devices().length }})</em>
                } @else { No devices loaded }
              </span>
              <button (click)="nextDevice()" [disabled]="!canGoNext()" style="min-width:2rem">▶</button>
            </div>

            <div style="margin-bottom:.5rem">
              <label>Channels: <input type="number" [(ngModel)]="selectedChannels" min="1" max="2" style="width:3rem; margin:0 .4rem" /></label>
            </div>

            <button (click)="startStream()" [disabled]="streaming()">▶ Start</button>
            <button (click)="stopStream()" [disabled]="!streaming()" style="margin-left:.5rem">■ Stop</button>
          </fieldset>
        </div>

        <!-- RIGHT COLUMN -->
        <div style="flex:1; min-width:280px; max-width:500px">

          <fieldset style="border:1px solid #444; padding:.5rem .75rem; margin-bottom:.75rem">
            <legend style="color:#aaa">Signal</legend>
            <p style="margin:.2rem 0">Frames: <strong>{{ frameCount() }}</strong></p>
            <p style="margin:.2rem 0">AudioContext: {{ audioContextState() }}</p>

            <div style="display:flex; align-items:center; gap:.6rem; margin:.6rem 0">
              <div [style.background]="ledColor()"
                   [style.box-shadow]="ledGlow()"
                   style="width:20px;height:20px;border-radius:50%;border:2px solid #555;flex-shrink:0;transition:background .1s,box-shadow .1s">
              </div>
              <div style="flex:1;height:16px;background:#222;border-radius:4px;overflow:hidden;border:1px solid #444">
                <div [style.width.%]="audioLevel() * 100"
                     style="height:100%;background:linear-gradient(90deg,#2a6,#8f4);transition:width .08s">
                </div>
              </div>
              <span style="min-width:3.5ch;font-size:.8rem">{{ (audioLevel() * 100).toFixed(0) }}%</span>
            </div>

            <p style="color:#f90; margin:.2rem 0">{{ statusMessage() }}</p>
          </fieldset>

          @if (diagLog().length > 0) {
            <fieldset style="border:1px solid #444; padding:.5rem .75rem">
              <legend style="color:#aaa">Diagnostics <button (click)="diagLog.set([])" style="font-size:.7rem">Clear</button></legend>
              <pre style="margin:0;max-height:200px;overflow-y:auto;font-size:.72rem;line-height:1.5">{{ diagLog().join('\n') }}</pre>
            </fieldset>
          }

        </div>
      </div>
    </div>
  `,
})
export class AudioSpikeComponent implements OnDestroy {
  // ── State ──────────────────────────────────────────────────────────────
  hubState = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  devices = signal<AudioDevice[]>([]);
  streaming = signal(false);
  frameCount = signal(0);
  audioContextState = signal('—');
  statusMessage = signal('');

  selectedDeviceIndex = signal(0);
  selectedChannels = 1;
  audioLevel = signal(0);
  diagLog = signal<string[]>([]);
  baseUrl = signal(`http://${window.location.hostname}:213`);

  // ── Device navigation ─────────────────────────────────────────────────
  currentDeviceListPos = computed(() =>
    this.devices().findIndex((d) => d.index === this.selectedDeviceIndex())
  );
  currentDeviceName = computed(() => {
    const d = this.devices().find((d) => d.index === this.selectedDeviceIndex());
    return d ? `${d.name} (${d.maxInputChannels}ch)` : '—';
  });
  ledColor = computed(() => {
    const l = this.audioLevel();
    if (l > 0.1) return '#00ff44';
    if (l > 0.005) return '#44aa44';
    return '#444';
  });
  ledGlow = computed(() =>
    this.audioLevel() > 0.005 ? '0 0 10px #00ff44' : 'none'
  );
  canGoPrev = computed(() => this.currentDeviceListPos() > 0);
  canGoNext = computed(() => {
    const pos = this.currentDeviceListPos();
    return pos >= 0 && pos < this.devices().length - 1;
  });

  selectDevice(device: AudioDevice) {
    this.selectedDeviceIndex.set(device.index);
  }

  async prevDevice() {
    const pos = this.currentDeviceListPos();
    if (pos <= 0) return;
    await this.switchToDevice(this.devices()[pos - 1]);
  }

  async nextDevice() {
    const pos = this.currentDeviceListPos();
    if (pos < 0 || pos >= this.devices().length - 1) return;
    await this.switchToDevice(this.devices()[pos + 1]);
  }

  private async switchToDevice(device: AudioDevice) {
    const wasStreaming = this.streaming();
    if (wasStreaming) this.stopStream();
    this.selectedDeviceIndex.set(device.index);
    this.statusMessage.set(`Switched to [${device.index}] ${device.name}`);
    if (wasStreaming) await this.startStream();
  }

  // ── Internal ──────────────────────────────────────────────────────────
  private hub: signalR.HubConnection | null = null;
  private audioCtx: AudioContext | null = null;
  private nextPlayTime = 0;
  private streamSubscription: signalR.ISubscription<unknown> | null = null;
  private levelDecayTimer: ReturnType<typeof setInterval> | null = null;

  private readonly SAMPLE_RATE = 48000;

  // ── Hub connection ────────────────────────────────────────────────────
  async connectHub() {
    this.hubState.set('connecting');

    const hubUrl = `${this.baseUrl()}/api/audioSpikeHub`;
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    try {
      await this.hub.start();
      this.hubState.set('connected');
      this.statusMessage.set('Hub connected ✓');
    } catch (e) {
      this.hubState.set('disconnected');
      this.statusMessage.set(`Hub failed: ${e}`);
    }
  }

  async loadDevices() {
    if (!this.hub) return;
    try {
      const result = await this.hub.invoke<AudioDevice[]>('GetDevices');
      this.devices.set(result);
      this.statusMessage.set(`${result.length} input device(s) found ✓`);
    } catch (e) {
      this.statusMessage.set(`GetDevices failed: ${e}`);
    }
  }

  // ── Streaming ─────────────────────────────────────────────────────────
  async startStream() {
    if (!this.hub || this.streaming()) return;

    // Resume AudioContext (required by browsers for user gesture)
    this.audioCtx = new AudioContext({ sampleRate: this.SAMPLE_RATE });
    await this.audioCtx.resume();
    this.nextPlayTime = this.audioCtx.currentTime + 0.2; // 200ms pre-buffer
    this.frameCount.set(0);
    this.streaming.set(true);
    this.audioContextState.set(this.audioCtx.state);

    // Decay the level meter when frames stop arriving
    this.levelDecayTimer = setInterval(() => {
      this.audioLevel.update((v) => Math.max(0, v * 0.85));
    }, 80);

    // SignalR streaming via IAsyncEnumerable
    const stream = this.hub.stream<Uint8Array>(
      'StreamAudio',
      this.selectedDeviceIndex(),
      this.selectedChannels
    );

    this.streamSubscription = stream.subscribe({
      next: (chunk) => this.playChunk(chunk as unknown),
      error: (e) => {
        this.statusMessage.set(`Stream error: ${e}`);
        this.streaming.set(false);
      },
      complete: () => {
        this.statusMessage.set('Stream complete');
        this.streaming.set(false);
      },
    });

    this.statusMessage.set('Streaming… 🎵');
  }

  stopStream() {
    this.streamSubscription?.dispose();
    this.streamSubscription = null;
    this.audioCtx?.close();
    this.audioCtx = null;
    if (this.levelDecayTimer !== null) {
      clearInterval(this.levelDecayTimer);
      this.levelDecayTimer = null;
    }
    this.audioLevel.set(0);
    this.streaming.set(false);
    this.statusMessage.set('Stopped');
  }

  // ── Decoding ──────────────────────────────────────────────────────────
  // SignalR JSON protocol sends byte[] as base64 strings. Detect and decode.
  private decodeChunk(raw: unknown): Uint8Array {
    if (typeof raw === 'string') {
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    if (raw instanceof Uint8Array) return raw;
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    return new Uint8Array(raw as ArrayLike<number>);
  }

  private addDiag(msg: string) {
    this.diagLog.update((lines) => [...lines.slice(-29), msg]);
  }

  // ── Audio playback ────────────────────────────────────────────────────
  private playChunk(raw: unknown) {
    if (!this.audioCtx) return;

    const frame = this.frameCount() + 1;
    this.frameCount.set(frame);
    this.audioContextState.set(this.audioCtx.state);

    const rawBytes = this.decodeChunk(raw);

    // Diagnostic: log first 3 chunks and every 50th
    if (frame <= 3 || frame % 50 === 0) {
      const rawType = typeof raw === 'string' ? 'base64-string' : (raw as object)?.constructor?.name ?? typeof raw;
      const hex = Array.from(rawBytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
      this.addDiag(`#${frame} type=${rawType} bytes=${rawBytes.byteLength} first8=[${hex}]`);
    }

    // Raw bytes = float32 PCM. Convert to Float32Array.
    const float32 = new Float32Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 4);

    // Measure peak amplitude for VU meter
    let peak = 0;
    for (let i = 0; i < float32.length; i++) {
      const abs = Math.abs(float32[i]);
      if (abs > peak) peak = abs;
    }
    if (frame <= 3 || frame % 50 === 0) {
      this.addDiag(`#${frame} peak=${peak.toFixed(6)} float32len=${float32.length}`);
    }
    this.audioLevel.set(Math.min(1, peak));
    // Use ChannelMergerNode to explicitly route mono to both L and R
    const numFrames = float32.length / this.selectedChannels;
    const monoBuffer = this.audioCtx.createBuffer(1, numFrames, this.SAMPLE_RATE);

    if (this.selectedChannels === 1) {
      monoBuffer.getChannelData(0).set(float32);
    } else {
      // De-interleave: average channels down to mono for merger
      const ch0 = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        let sum = 0;
        for (let ch = 0; ch < this.selectedChannels; ch++) sum += float32[i * this.selectedChannels + ch];
        ch0[i] = sum / this.selectedChannels;
      }
      monoBuffer.getChannelData(0).set(ch0);
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = monoBuffer;

    // Merge mono into stereo so both speakers play
    const merger = this.audioCtx.createChannelMerger(2);
    source.connect(merger, 0, 0);
    source.connect(merger, 0, 1);
    merger.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;
    // Clamp: if we're too far behind, skip ahead to avoid compounding delay
    if (this.nextPlayTime < now) this.nextPlayTime = now + 0.05;

    source.start(this.nextPlayTime);
    this.nextPlayTime += monoBuffer.duration;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────
  ngOnDestroy() {
    this.stopStream();
    this.hub?.stop();
    if (this.levelDecayTimer !== null) clearInterval(this.levelDecayTimer);
  }
}
