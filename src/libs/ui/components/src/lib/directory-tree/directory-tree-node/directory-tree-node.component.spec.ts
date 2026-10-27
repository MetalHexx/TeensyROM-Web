import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { DirectoryTreeNodeComponent } from './directory-tree-node.component';
import { IconLabelComponent } from '../../icon-label/icon-label.component';

describe('DirectoryTreeNodeComponent', () => {
  let fixture: ComponentFixture<DirectoryTreeNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DirectoryTreeNodeComponent] }).compileComponents();
    fixture = TestBed.createComponent(DirectoryTreeNodeComponent);
    fixture.componentRef.setInput('icon', 'folder');
    fixture.componentRef.setInput('text', 'Games');
    fixture.detectChanges();
  });

  const iconLabel = (): IconLabelComponent =>
    fixture.debugElement.query(By.directive(IconLabelComponent)).componentInstance;

  it('shows the label in full by default', () => {
    expect(iconLabel().truncate()).toBe(false);
    expect(iconLabel().shrink()).toBe(false);
    expect(fixture.nativeElement.classList.contains('truncating')).toBe(false);
  });

  it('passes truncate and shrink to the label when truncating', () => {
    fixture.componentRef.setInput('truncate', true);
    fixture.detectChanges();

    expect(iconLabel().truncate()).toBe(true);
    expect(iconLabel().shrink()).toBe(true);
    expect(fixture.nativeElement.classList.contains('truncating')).toBe(true);
    expect(fixture.nativeElement.querySelector('.directory-tree-node').classList.contains('truncating')).toBe(true);
  });
});
