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
export * from './lib/loops-cues-plate/loops-cues-plate.component';
export * from './lib/binding-plate/binding-plate.component';
export * from './lib/hold-press/hold-press.directive';
export * from './lib/voice-row/voice-row.component';
export * from './lib/voice-panel/voice-panel.component';
