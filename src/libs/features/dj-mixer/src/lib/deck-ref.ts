export interface DeckRef {
  readonly letter: string; // 'A', 'B', … — String.fromCharCode(65 + index)
  readonly index: number; // position in the enabled-device list; drives grid-area names
}
