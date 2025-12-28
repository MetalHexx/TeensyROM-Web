/**
 * Black bar detection exports for GPU-based edge detection.
 *
 * Phase 1.1 implementation using WebGL fragment shaders for real-time
 * edge detection without CPU overhead.
 */
export { DetectionPassRenderer } from './detection-pass-renderer';
export { EdgeAnalysisProcessor } from './edge-analysis-processor';
export { edgeDetectFragmentShader } from './shaders';
