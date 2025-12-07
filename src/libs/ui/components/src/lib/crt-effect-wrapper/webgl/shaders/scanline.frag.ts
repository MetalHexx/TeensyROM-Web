/**
 * Post-Processing Fragment Shader for CRT Effects
 *
 * ## Architecture: Video Texture Sampling + Multiplicative Blending
 *
 * The shader samples the video frame as a WebGL texture and applies CRT effects
 * multiplicatively, creating authentic color filtering and brightness modulation.
 *
 * Pipeline:
 * 1. Sample video pixel: RGB video color from u_videoTexture
 * 2. Calculate phosphor mask: RGB multiplier for subpixel filtering
 * 3. Calculate scanlines: Brightness multiplier (0-1)
 * 4. Calculate vignette: Edge darkening multiplier (0-1)
 * 5. Combine: finalColor = videoColor * phosphorMask * scanlines * vignette
 * 6. Output: Full opaque frame (alpha = 1.0)
 *
 * ## Key Differences from Overlay Approach
 *
 * OLD (Overlay):
 * - Canvas drawn on top of video with alpha blending
 * - Only able to darken or tint via additive blending
 * - Blacks never truly black when glow is applied
 * - Effects limited to overlay capabilities
 *
 * NEW (Post-Processing):
 * - Canvas is the only output, samples video as texture
 * - Multiplicative blending: videoRGB * effectRGB
 * - True color filtering with RGB phosphor separation
 * - Authentic CRT appearance with proper blacks
 * - Single-pass rendering with all effects combined
 *
 * ## Effect Combination Strategy
 *
 * All effects multiply together. Each component returns a factor from 0-1:
 * - Phosphor: RGB mask (per-color channel filtering)
 * - Scanlines: Brightness factor (dark lines = low factor)
 * - Vignette: Radial darkening (edges = lower factor)
 *
 * Multiplication creates natural light attenuation:
 * - Bright areas stay bright (factors near 1.0)
 * - Dark areas get darker (factors near 0.0)
 * - RGB phosphor creates colored light filtering
 */
export const SCANLINE_FRAGMENT_SHADER = `
  #extension GL_OES_standard_derivatives : enable
  precision highp float;

  // === Video Texture ===
  uniform sampler2D u_videoTexture;  // The video frame to process

  // === CRT Settings Uniforms ===
  uniform float u_scanlineIntensity;  // 0.0 - 1.0, how dark the scanlines get
  uniform float u_scanlineSize;       // Controls line thickness/spacing
  uniform float u_vignetteStrength;   // 0.0 - 2.0, edge darkening intensity
  uniform vec2 u_resolution;          // Canvas width/height in device pixels

  // === Phosphor Pattern Uniforms ===
  uniform int u_phosphorPattern;      // 0=none, 1=aperture-grille, 2=shadow-mask, 3=dot-triad
  uniform float u_phosphorIntensity;  // 0.0 - 1.0, strength of phosphor effect

  varying vec2 v_texCoord;

  // === Constants ===
  #define PI 3.14159265359

  // === Scanline Pattern ===
  //
  // Anti-aliased sine-wave scanlines using analytical derivatives.
  // At small line sizes, the sine frequency exceeds the Nyquist limit
  // causing Moiré patterns. We use fwidth() to detect this and fade
  // the effect where aliasing would occur.
  //
  float calculateScanline(vec2 uv, float lineSize, vec2 resolution) {
    // Calculate pixel position in screen space
    float pixelY = uv.y * resolution.y;
    
    // Frequency based on line size: PI / lineSize gives one dark band per lineSize pixels
    float frequency = 3.14159265359 / max(lineSize, 1.0);
    
    // Phase for the sine wave
    float phase = pixelY * frequency;
    
    // Analytical anti-aliasing: fwidth gives the rate of change per pixel
    // When the phase changes too fast (> PI per pixel), we're aliasing
    float phaseDerivative = fwidth(phase);
    
    // Sine wave normalized to 0-1
    float wave = 0.5 + 0.5 * sin(phase);
    
    // Anti-alias factor: fade effect when derivative is too high
    // At derivative = 0, full effect. At derivative >= PI, no effect (returns 0.5)
    float antiAlias = clamp(1.0 - phaseDerivative / 3.14159265359, 0.0, 1.0);
    
    // Blend wave toward neutral (0.5) based on anti-alias factor
    float antiAliasedWave = mix(0.5, wave, antiAlias);
    
    // Intensity controls blend: 0 = no effect (1.0), 1 = full effect
    return mix(1.0, antiAliasedWave, u_scanlineIntensity);
  }

  // === Vignette Effect ===
  //
  // Radial darkening from center to corners. Returns a factor (0-1) where:
  // - 1.0 = center (no darkening)
  // - 0.0 = corners (maximum darkening)
  //
  float calculateVignette(vec2 uv, float strength) {
    vec2 center = uv - 0.5;
    float distSq = dot(center, center);
    float vignetteFactor = 1.0 - (distSq * strength);
    return clamp(vignetteFactor, 0.0, 1.0);
  }

  // === Phosphor Pattern Functions ===
  //
  // Each function returns an RGB mask (0-1 per channel) representing
  // which phosphor elements are "visible" at this pixel position.
  // Used multiplicatively: videoColor * phosphorMask
  //

  // Aperture Grille (Sony Trinitron style)
  // Vertical RGB stripes - each column dedicated to one color
  vec3 apertureGrille(vec2 uv, vec2 resolution) {
    float x = uv.x * resolution.x;
    float col = mod(floor(x), 3.0);
    
    float stripePos = fract(x);
    float stripeBrightness = 0.85 + 0.15 * sin(stripePos * PI);
    
    vec3 mask;
    if (col < 1.0) {
      mask = vec3(stripeBrightness, 0.0, 0.0);  // Red stripe
    } else if (col < 2.0) {
      mask = vec3(0.0, stripeBrightness, 0.0);  // Green stripe
    } else {
      mask = vec3(0.0, 0.0, stripeBrightness);  // Blue stripe
    }
    
    return mask;
  }

  // Shadow Mask (Traditional CRT)
  // Staggered RGB dot pattern
  vec3 shadowMask(vec2 uv, vec2 resolution) {
    float x = uv.x * resolution.x;
    float y = uv.y * resolution.y;
    
    float rowOffset = mod(floor(y), 2.0) * 1.5;
    float col = mod(floor(x + rowOffset), 3.0);
    
    vec2 cellPos = fract(vec2(x + rowOffset, y));
    
    float dotRadius = 0.45;
    float dot = 1.0 - smoothstep(dotRadius - 0.15, dotRadius + 0.15, length(cellPos - 0.5));
    
    vec3 mask;
    if (col < 1.0) {
      mask = vec3(dot, 0.0, 0.0);
    } else if (col < 2.0) {
      mask = vec3(0.0, dot, 0.0);
    } else {
      mask = vec3(0.0, 0.0, dot);
    }
    
    return mask;
  }

  // Dot Triad (Arcade monitors)
  // Triangular RGB arrangement
  vec3 dotTriad(vec2 uv, vec2 resolution) {
    float x = uv.x * resolution.x;
    float y = uv.y * resolution.y;
    
    float row = mod(floor(y), 2.0);
    float col = mod(floor(x + row), 3.0);
    
    vec2 cellPos = fract(vec2(x, y));
    
    float dotRadius = 0.4;
    float dot = 1.0 - smoothstep(dotRadius - 0.1, dotRadius + 0.2, length(cellPos - 0.5));
    
    float glow = 0.7 + 0.3 * (1.0 - length(cellPos - 0.5) * 2.0);
    dot *= max(glow, 0.0);
    
    vec3 mask;
    if (col < 1.0) {
      mask = vec3(dot, 0.0, 0.0);
    } else if (col < 2.0) {
      mask = vec3(0.0, dot, 0.0);
    } else {
      mask = vec3(0.0, 0.0, dot);
    }
    
    return mask;
  }

  // Main phosphor calculation
  // Returns RGB multiplicative mask
  vec3 calculatePhosphor(vec2 uv, vec2 resolution, int pattern, float intensity) {
    if (pattern == 0 || intensity <= 0.0) {
      return vec3(1.0);  // No filtering
    }
    
    vec3 mask;
    if (pattern == 1) {
      mask = apertureGrille(uv, resolution);
    } else if (pattern == 2) {
      mask = shadowMask(uv, resolution);
    } else {
      mask = dotTriad(uv, resolution);
    }
    
    // Blend between no effect (white) and full pattern
    return mix(vec3(1.0), mask, intensity);
  }

  void main() {
    // 1. Sample video texture (flip Y coordinate - texture coords are inverted from content)
    vec2 flippedUv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
    vec4 videoColor = texture2D(u_videoTexture, flippedUv);
    
    // 2. Calculate all multiplicative factors
    // Scanlines and vignette use raw v_texCoord for screen-space effects
    float scanlineFactor = calculateScanline(v_texCoord, u_scanlineSize, u_resolution);
    float vignetteFactor = calculateVignette(v_texCoord, u_vignetteStrength);
    // Phosphor uses flippedUv to align with video content
    vec3 phosphorMask = calculatePhosphor(flippedUv, u_resolution, u_phosphorPattern, u_phosphorIntensity);
    
    // 3. Apply multiplicative effects to video color
    // All factors are 0-1, so multiplication darkens the image authentically
    vec3 finalColor = videoColor.rgb * phosphorMask * scanlineFactor * vignetteFactor;
    
    // 4. Output full opaque frame (no alpha blending dependency)
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
