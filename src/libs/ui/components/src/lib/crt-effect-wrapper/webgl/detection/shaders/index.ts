/**
 * Shader exports for GPU-based black bar detection.
 *
 * Edge detection shader runs on the GPU to identify presence of black bars
 * at video edges, providing validation for C64 video mode preset cropping.
 */
export { edgeDetectFragmentShader } from './edge-detect.frag';
