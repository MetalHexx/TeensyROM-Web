/**
 * Passthrough vertex shader for fullscreen quad rendering.
 *
 * Transforms clip-space positions (-1 to 1) and generates UV texture
 * coordinates (0 to 1) for fragment shader sampling.
 *
 * This shader is designed for a fullscreen quad rendered with a TRIANGLE_STRIP
 * of 4 vertices at corners: (-1,-1), (1,-1), (-1,1), (1,1).
 */
export const PASSTHROUGH_VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    // Convert from clip space (-1 to 1) to texture space (0 to 1)
    v_texCoord = (a_position + 1.0) / 2.0;
  }
`;
