/**
 * Secondary entry point for the DJ-only components. Only the lazily-loaded DJ feature and the
 * dev-only DJ proof of concept import them, so they stay out of the main barrel: a barrel the app
 * shell imports eagerly would pull every one of them into the initial bundle.
 */
export * from './lib/synth-key/synth-key.component';
export * from './lib/hold-pad/hold-pad.component';
export * from './lib/position-strip/position-strip.component';
export * from './lib/deck-transport/deck-transport.component';
export * from './lib/synth-fader/synth-fader.component';
export * from './lib/deck-channel-strip/deck-channel-strip.component';
export * from './lib/deck-settings-sign/deck-settings-sign.component';
export * from './lib/loops-cues-plate/loops-cues-plate.component';
export * from './lib/binding-plate/binding-plate.component';
export * from './lib/hold-press/hold-press.directive';
export * from './lib/voice-row/voice-row.component';
export * from './lib/voice-panel/voice-panel.component';
export * from './lib/loop-tile/loop-tile.component';
export * from './lib/loop-tile-grid/loop-tile-grid.component';
export * from './lib/loop-boundary/loop-boundary.component';
export * from './lib/loop-selected-row/loop-selected-row.component';
export * from './lib/set-card/set-card.component';
export * from './lib/set-header/set-header.component';
export * from './lib/set-control-plate/set-control-plate.component';
export * from './lib/set-row/set-row.component';
export * from './lib/set-row-ghost/set-row-ghost.component';
export * from './lib/sets-tree-branch/sets-tree-branch.component';
export * from './lib/deck-set-row/deck-set-row.component';
export * from './lib/fold-handle/fold-handle.component';
export * from './lib/key-match-light/key-match-light.component';
export * from './lib/sid-voice-strip/sid-voice-strip.component';
export * from './lib/voice-wave/model/wave-view';
export * from './lib/voice-wave/wave-protocol';
export * from './lib/voice-wave/wave-feed-buffer';
export * from './lib/voice-wave/wave-worker-host';
export * from './lib/voice-wave/voice-wave-renderer';
export * from './lib/voice-wave/voice-wave.component';
