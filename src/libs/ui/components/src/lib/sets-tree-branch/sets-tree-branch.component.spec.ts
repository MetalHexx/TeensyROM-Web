import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SetsTreeBranchComponent, type SetsTreeBranchModel } from './sets-tree-branch.component';

const model: SetsTreeBranchModel = {
  label: 'Sets',
  sets: [
    { id: 's1', name: 'Friday warm-up', loaded: true, accessibleName: 'Set Friday warm-up, loaded' },
    { id: 's2', name: 'Hubbard only', loaded: false, accessibleName: 'Set Hubbard only' },
  ],
};

describe('SetsTreeBranchComponent', () => {
  let fixture: ComponentFixture<SetsTreeBranchComponent>;
  let emitted: unknown[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SetsTreeBranchComponent] }).compileComponents();
    fixture = TestBed.createComponent(SetsTreeBranchComponent);
    emitted = [];
    fixture.componentInstance.expandedChange.subscribe((v) => emitted.push(['expandedChange', v]));
    fixture.componentInstance.setSelect.subscribe((v) => emitted.push(['setSelect', v]));
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const branch = (): HTMLElement => el().querySelector('.branch-row') as HTMLElement;
  const setRows = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('.set-row'));

  function press(target: HTMLElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it('is expanded by default, with a group of treeitems', () => {
    expect(branch().getAttribute('role')).toBe('treeitem');
    expect(branch().getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelector('[role="group"]')).not.toBeNull();
    expect(setRows()).toHaveLength(2);
    expect(setRows()[0].textContent).toContain('Friday warm-up');
    expect(setRows()[1].textContent).toContain('Hubbard only');
  });

  it('hides the sets and flips the chevron when collapsed', () => {
    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();

    expect(branch().getAttribute('aria-expanded')).toBe('false');
    expect(el().querySelector('[role="group"]')).toBeNull();
    expect(branch().querySelector('.chevron')?.textContent?.trim()).toBe('chevron_right');
  });

  it('toggles the branch by click, Enter and Space', () => {
    branch().click();
    press(branch(), 'Enter');
    const space = press(branch(), ' ');

    expect(emitted).toEqual([
      ['expandedChange', false],
      ['expandedChange', false],
      ['expandedChange', false],
    ]);
    expect(space.defaultPrevented).toBe(true);
  });

  it('emits the new state when collapsed', () => {
    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();
    branch().click();

    expect(emitted).toEqual([['expandedChange', true]]);
  });

  it('selects a set by click, Enter and Space', () => {
    setRows()[0].click();
    press(setRows()[1], 'Enter');
    press(setRows()[1], ' ');

    expect(emitted).toEqual([
      ['setSelect', 's1'],
      ['setSelect', 's2'],
      ['setSelect', 's2'],
    ]);
  });

  it('truncates the set rows but not the branch label', () => {
    const nodes = Array.from(el().querySelectorAll<HTMLElement>('lib-directory-tree-node'));
    const branchNode = branch().querySelector('lib-directory-tree-node') as HTMLElement;

    expect(branchNode.classList.contains('truncating')).toBe(false);
    expect(nodes.filter((n) => n.classList.contains('truncating'))).toHaveLength(2);
    expect(setRows().every((r) => r.querySelector('lib-directory-tree-node')?.classList.contains('truncating'))).toBe(
      true
    );
  });

  it('marks the loaded set selected without a light, and names every row', () => {
    expect(setRows().map((r) => r.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(el().querySelector('.light')).toBeNull();
    expect(setRows().map((r) => r.getAttribute('aria-label'))).toEqual([
      'Set Friday warm-up, loaded',
      'Set Hubbard only',
    ]);
  });
});
