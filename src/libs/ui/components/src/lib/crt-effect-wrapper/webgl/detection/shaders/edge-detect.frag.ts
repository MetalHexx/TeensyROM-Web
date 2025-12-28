/**
 * Simple Passthrough Fragment Shader
 *
 * Renders video content as-is to a downsampled framebuffer.
 * CPU-based brute-force scanner reads this to detect black bars.
 *
 * No GPU-side detection - all detection happens on CPU for simplicity.
 */
export const edgeDetectFragmentShader = `
precision mediump float;

uniform sampler2D u_videoTexture;
varying vec2 v_texCoord;

void main() {
  // Simple passthrough - just render the video as-is
  // The CPU-based brute-force scanner will read this and detect black bars
  gl_FragColor = texture2D(u_videoTexture, v_texCoord);
}
`;
