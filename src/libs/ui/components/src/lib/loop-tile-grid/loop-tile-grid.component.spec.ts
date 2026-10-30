import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoopTileGridComponent } from './loop-tile-grid.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';

function tile(id: string, overrides: Partial<LoopTileModel> = {}): LoopTileModel {
  return {
    id,
    name: `Item ${id}`,
    kind: 'loop',
    lengthText: '4.0s',
    activity: 'idle',
    selected: false,
    ready: true,
    triggerAccessibleName: `Trigger ${id}`,
    selectAccessibleName: `Select ${id}`,
    ownSettings: false,
    playNowAccessibleName: `Play now ${id}`,
    ...overrides,
  };
}

describe('LoopTileGridComponent', () => {
  let fixture: ComponentFixture<LoopTileGridComponent>;
  let scrolled: Element[];
  let original: unknown;

  beforeEach(async () => {
    original = Element.prototype.scrollIntoView;
    scrolled = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    await TestBed.configureTestingModule({ imports: [LoopTileGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(LoopTileGridComponent);
    fixture.componentRef.setInput('accessibleName', 'Loops and cues');
    setTiles([tile('a'), tile('b'), tile('c')]);
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = original as Element['scrollIntoView'];
  });

  function setTiles(tiles: LoopTileModel[]): void {
    fixture.componentRef.setInput('tiles', tiles);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const items = (): HTMLElement[] => Array.from(el().querySelectorAll('[role="listitem"]'));

  it('renders a named list with one item per tile', () => {
    expect(el().querySelector('[role="list"]')?.getAttribute('aria-label')).toBe('Loops and cues');
    expect(items()).toHaveLength(3);
  });

  it('emits the tile id for trigger, play now and select', () => {
    const triggered: string[] = [];
    const playedNow: string[] = [];
    const selected: string[] = [];
    fixture.componentInstance.triggerTile.subscribe((id) => triggered.push(id));
    fixture.componentInstance.playNowTile.subscribe((id) => playedNow.push(id));
    fixture.componentInstance.selectTile.subscribe((id) => selected.push(id));
    items()[1].querySelector<HTMLButtonElement>('lib-synth-key button')?.click();
    items()[0].querySelector<HTMLButtonElement>('lib-synth-key.play-now button')?.click();
    items()[2].querySelector<HTMLButtonElement>('button.select')?.click();
    expect(triggered).toEqual(['b']);
    expect(playedNow).toEqual(['a']);
    expect(selected).toEqual(['c']);
  });

  describe('the running progress', () => {
    /** The progress each tile's timeline carries, in display order; '' where none was set. */
    const progress = (): string[] =>
      items().map(
        (item) =>
          item
            .querySelector<HTMLElement>('.timeline')
            ?.style.getPropertyValue('--loop-tile-progress') ?? ''
      );

    it('is drawn by the running tile only, and set on it alone', () => {
      setTiles([tile('a'), tile('b', { activity: 'running' }), tile('c', { activity: 'queued' })]);
      fixture.componentInstance.setLiveProgress(40);

      const fills = Array.from(el().querySelectorAll<HTMLElement>('.fill'));
      expect(fills).toHaveLength(1);
      expect(items()[1].contains(fills[0])).toBe(true);
      expect(progress()).toEqual(['', '40%', '']);
    });

    it('never touches the grid host, where every tile would restyle with it', () => {
      setTiles([tile('a', { activity: 'running' }), tile('b')]);

      fixture.componentInstance.setLiveProgress(40);

      expect(el().getAttribute('style')).toBeNull();
    });

    it('is held to 0–100', () => {
      setTiles([tile('a', { activity: 'running' })]);
      const grid = fixture.componentInstance;

      grid.setLiveProgress(140);
      expect(progress()).toEqual(['100%']);

      grid.setLiveProgress(Number.NaN);
      expect(progress()).toEqual(['0%']);
    });

    it('reaches a tile that starts running after it was set', () => {
      fixture.componentInstance.setLiveProgress(25);

      setTiles([tile('a'), tile('b', { activity: 'running' }), tile('c')]);

      expect(items()[1].querySelector('.fill')).not.toBeNull();
      expect(progress()).toEqual(['', '25%', '']);
    });

    it('moves to the tile that runs next', () => {
      setTiles([tile('a', { activity: 'running' }), tile('b')]);
      fixture.componentInstance.setLiveProgress(30);

      setTiles([tile('a'), tile('b', { activity: 'running' })]);

      expect(progress()[1]).toBe('30%');
    });

    it('leaves the tiles to an inherited progress until one is set', () => {
      setTiles([tile('a', { activity: 'running' })]);

      expect(progress()).toEqual(['']);
    });
  });

  it('shows the empty text when there are no tiles', () => {
    fixture.componentRef.setInput('emptyText', 'No loops yet');
    setTiles([]);
    expect(el().querySelector('[role="list"]')).toBeNull();
    expect(el().textContent).toContain('No loops yet');
  });

  it('scrolls the newly selected tile into view, and only when the selection changes', async () => {
    setTiles([tile('a'), tile('b', { selected: true }), tile('c')]);
    await fixture.whenStable();
    expect(scrolled).toEqual([items()[1]]);

    setTiles([tile('a'), tile('b', { selected: true, activity: 'running' }), tile('c')]);
    await fixture.whenStable();
    expect(scrolled).toHaveLength(1);

    setTiles([tile('a'), tile('b'), tile('c', { selected: true })]);
    await fixture.whenStable();
    expect(scrolled).toEqual([items()[1], items()[2]]);
  });

  it('does not scroll when nothing is selected', async () => {
    setTiles([tile('a'), tile('b')]);
    await fixture.whenStable();
    expect(scrolled).toHaveLength(0);
  });
});
