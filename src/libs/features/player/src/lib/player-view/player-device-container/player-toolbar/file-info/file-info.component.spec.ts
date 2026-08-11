import { describe, it, expect } from 'vitest';
import { By } from '@angular/platform-browser';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { FileInfoComponent } from './file-info.component';

describe('FileInfoComponent', () => {
  it('creates', () => {
    const { component } = renderPlayerComponent(FileInfoComponent);

    expect(component).toBeTruthy();
  });

  it('accepts a null fileItem input', () => {
    const { component } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: null },
    });

    expect(component.fileItem()).toBeNull();
  });

  it('renders the title and creator elements when the file has data', () => {
    const { fixture } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ title: 'Test Song', creator: 'Test Artist' }) },
    });

    expect(fixture.nativeElement.querySelector('.file-title')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.file-creator')).toBeTruthy();
  });

  it('renders no file-info block with a null fileItem', () => {
    const { fixture } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: null },
    });

    expect(fixture.nativeElement.querySelector('.file-info')).toBeNull();
  });

  it('renders the file-info container when fileItem exists', () => {
    const { fixture } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem() },
    });

    expect(fixture.nativeElement.querySelector('.file-info')).toBeTruthy();
  });

  it('still renders the title element when the title is empty', () => {
    const { fixture } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ title: '' }) },
    });

    expect(fixture.nativeElement.querySelector('.file-title')).toBeTruthy();
  });

  it('falls back to rendering fileTypeName when creator is empty', () => {
    const { fixture, component } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ creator: '', meta1: 'prg' }) },
    });

    expect(fixture.nativeElement.querySelector('.file-creator')?.textContent).toBe(
      component.fileTypeName()
    );
  });

  it('renders no creator div when both creator and fileTypeName are empty', () => {
    const { fixture } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ creator: '', meta1: '' }) },
    });

    expect(fixture.nativeElement.querySelector('.file-creator')).toBeNull();
  });

  describe('fileTypeName', () => {
    const typeTestCases: Array<{ meta1: string; expected: string }> = [
      { meta1: 'sid', expected: 'Music' },
      { meta1: 'crt', expected: 'Cartridge' },
      { meta1: 'prg', expected: 'Program' },
      { meta1: 'p00', expected: 'Program' },
      { meta1: 'hex', expected: 'Machine Code' },
      { meta1: 'kla', expected: 'Koala Image' },
      { meta1: 'koa', expected: 'Koala Image' },
      { meta1: 'art', expected: 'Art Studio Image' },
      { meta1: 'aas', expected: 'Art Studio Image' },
      { meta1: 'hpi', expected: 'HiRes Image' },
      { meta1: 'd64', expected: 'Disk Image' },
      { meta1: 'seq', expected: 'Sequential File' },
      { meta1: 'txt', expected: 'Text File' },
      { meta1: 'zip', expected: 'Archive' },
      { meta1: 'nfo', expected: 'Info File' },
      { meta1: 'unknown', expected: 'Unknown' },
    ];

    typeTestCases.forEach(({ meta1, expected }) => {
      it(`maps meta1 "${meta1}" to "${expected}"`, () => {
        const { component } = renderPlayerComponent(FileInfoComponent, {
          inputs: { fileItem: createTestFileItem({ creator: '', meta1 }) },
        });

        expect(component.fileTypeName()).toBe(expected);
      });
    });
  });

  it('normalizes uppercase meta1 before mapping', () => {
    const { component } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ creator: '', meta1: 'SID' }) },
    });

    expect(component.fileTypeName()).toBe('Music');
  });

  it('uppercases an unmapped extension', () => {
    const { component } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ creator: '', meta1: 'xyz' }) },
    });

    expect(component.fileTypeName()).toBe('XYZ');
  });

  it('returns an empty type name when meta1 is empty', () => {
    const { component } = renderPlayerComponent(FileInfoComponent, {
      inputs: { fileItem: createTestFileItem({ creator: '', meta1: '' }) },
    });

    expect(component.fileTypeName()).toBe('');
  });

  describe('imageUrls', () => {
    it('is empty when fileItem is null', () => {
      const { component } = renderPlayerComponent(FileInfoComponent, {
        inputs: { fileItem: null },
      });

      expect(component.imageUrls()).toEqual([]);
    });

    it('is empty when the images array is empty', () => {
      const { component } = renderPlayerComponent(FileInfoComponent, {
        inputs: { fileItem: createTestFileItem({ images: [] }) },
      });

      expect(component.imageUrls()).toEqual([]);
    });

    it('extracts the URL from a single image', () => {
      const { component } = renderPlayerComponent(FileInfoComponent, {
        inputs: {
          fileItem: createTestFileItem({
            images: [
              {
                url: 'https://example.com/image1.png',
                fileName: 'image1.png',
                path: '/images/image1.png',
                source: 'gamebase',
              },
            ],
          }),
        },
      });

      expect(component.imageUrls()).toEqual(['https://example.com/image1.png']);
    });

    it('updates reactively when fileItem changes', () => {
      const { component, setInput } = renderPlayerComponent(FileInfoComponent, {
        inputs: {
          fileItem: createTestFileItem({
            images: [
              {
                url: 'https://example.com/image1.png',
                fileName: 'image1.png',
                path: '/images/image1.png',
                source: 'gamebase',
              },
            ],
          }),
        },
      });

      expect(component.imageUrls()).toEqual(['https://example.com/image1.png']);

      setInput(
        'fileItem',
        createTestFileItem({
          images: [
            {
              url: 'https://example.com/image2.png',
              fileName: 'image2.png',
              path: '/images/image2.png',
              source: 'gamebase',
            },
          ],
        })
      );

      expect(component.imageUrls()).toEqual(['https://example.com/image2.png']);
    });
  });

  describe('CycleImageComponent forwarding', () => {
    it('forwards imageUrls to the child', () => {
      const { fixture, component } = renderPlayerComponent(FileInfoComponent, {
        inputs: {
          fileItem: createTestFileItem({
            images: [
              {
                url: 'https://example.com/img1.png',
                fileName: 'img1.png',
                path: '/images/img1.png',
                source: 'gamebase',
              },
            ],
          }),
        },
      });

      const cycleImage = fixture.debugElement.query(By.css('lib-cycle-image'));
      expect(cycleImage.properties['images']).toEqual(component.imageUrls());
    });

    it('forwards a fixed 4000ms interval', () => {
      const { fixture } = renderPlayerComponent(FileInfoComponent, {
        inputs: { fileItem: createTestFileItem() },
      });

      const cycleImage = fixture.debugElement.query(By.css('lib-cycle-image'));
      expect(cycleImage.properties['intervalMs']).toBe(4000);
    });

    it('forwards the thumbnail size', () => {
      const { fixture } = renderPlayerComponent(FileInfoComponent, {
        inputs: { fileItem: createTestFileItem() },
      });

      const cycleImage = fixture.debugElement.query(By.css('lib-cycle-image'));
      expect(cycleImage.nativeElement.getAttribute('size')).toBe('thumbnail');
    });

    it('still renders with an empty images array', () => {
      const { fixture } = renderPlayerComponent(FileInfoComponent, {
        inputs: { fileItem: createTestFileItem({ images: [] }) },
      });

      const cycleImage = fixture.debugElement.query(By.css('lib-cycle-image'));
      expect(cycleImage).toBeTruthy();
      expect(cycleImage.properties['images']).toEqual([]);
    });
  });
});
