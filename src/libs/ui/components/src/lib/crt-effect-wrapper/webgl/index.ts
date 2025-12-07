/**
 * WebGL CRT Effect Rendering Infrastructure
 *
 * This module provides a WebGL-based renderer for CRT visual effects
 * that eliminates Moiré banding at non-100% browser zoom levels.
 *
 * @example
 * ```typescript
 * import { CrtRenderer } from './webgl';
 *
 * if (CrtRenderer.isSupported()) {
 *   const renderer = new CrtRenderer();
 *   if (renderer.init(canvas)) {
 *     renderer.updateSettings(settings);
 *     renderer.resize(width, height);
 *     renderer.render();
 *   }
 * }
 * ```
 */

// Main renderer class
export { CrtRenderer } from './crt-renderer';

// Shader sources (for advanced customization)
export { PASSTHROUGH_VERTEX_SHADER } from './shaders/passthrough.vert';
export { SCANLINE_FRAGMENT_SHADER } from './shaders/scanline.frag';

// Testing utilities
export { createMockWebGLContext, createMockCanvas, GL_CONSTANTS } from './webgl-context.mock';
export type { MockWebGLContext } from './webgl-context.mock';
