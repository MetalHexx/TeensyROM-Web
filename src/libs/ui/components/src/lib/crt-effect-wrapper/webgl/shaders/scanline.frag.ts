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
  uniform sampler2D u_videoTexture;

  // === CRT Settings Uniforms ===
  uniform float u_scanlineIntensity;
  uniform float u_scanlineSize;
  uniform float u_vignetteStrength;
  uniform float u_screenCurvature;
  uniform float u_bloomIntensity;
  uniform float u_barrelDistortion;
  uniform float u_chromaticAberration;
  uniform vec2 u_resolution;

  // === Phosphor Pattern Uniforms ===
  uniform int u_phosphorPattern;      // 0=none, 1=aperture-grille, 2=shadow-mask, 3=dot-triad
  uniform float u_phosphorIntensity;  // 0.0 - 1.0, strength of phosphor effect
  
  // === Monochrome Phosphor Uniform ===
  uniform float u_monochromePhosphor;  // 0.0=none, 1.0=white, 2.0=amber, 3.0=green

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

  // === Barrel Distortion Effect ===
  //
  // Applies geometric warping to texture coordinates to simulate curved CRT glass.
  // Uses quintic (5th order) distortion formula to minimize banding artifacts:
  //   distorted = center + (original - center) * (1 + k₁*r² + k₂*r⁴ + k₃*r⁶)
  //
  // Anti-banding approach: Higher-order polynomial provides smoother gradient
  // across the distortion range. The 60/30/10 coefficient split creates a
  // natural falloff curve that avoids the sharp transitions causing banding.
  //
  // Performance: Only 2 extra multiplies vs quadratic (r4 = r2*r2, r6 = r4*r2)
  //
  // Returns distorted UV coordinates (may be outside [0.0, 1.0] range at edges).
  // Out-of-bounds coordinates are handled in main() to show black.
  //
  vec2 applyBarrelDistortion(vec2 uv, float intensity) {
    // Zero-intensity optimization - critical for performance when effect is disabled
    if (intensity == 0.0) return uv;

    // Calculate radial distortion from center point
    // Use dot product for r² directly (no sqrt needed)
    vec2 centered = uv - vec2(0.5);
    float r2 = dot(centered, centered);

    // Quintic distortion formula with optimized coefficients
    // k₁ (r²): Primary distortion strength (intensity * 0.6)
    // k₂ (r⁴): Mid-range smoothing (intensity * 0.3)
    // k₃ (r⁶): Edge smoothing to eliminate banding (intensity * 0.1)
    // This distribution creates a smooth S-curve gradient
    float r4 = r2 * r2;
    float r6 = r4 * r2;
    float distortionFactor = 1.0 + (intensity * 0.6 * r2) + (intensity * 0.3 * r4) + (intensity * 0.1 * r6);
    
    // Return distorted coordinates (no clamping - allows edges to pull inward)
    return vec2(0.5) + centered * distortionFactor;
  }

  // === Chromatic Aberration Effect ===
  //
  // Simulates lens aberration in CRT monitors where RGB channels separate horizontally.
  // Uses simple horizontal offset - red shifts left, green centered, blue shifts right.
  // This creates the classic color fringing visible on CRT edges and high-contrast areas.
  //
  // Based on the technique used in https://daenavan.github.io/crt-threejs/
  // which provides a more pronounced and visible chromatic aberration effect.
  //
  // Returns vec3 with separated RGB channels sampled from different texture positions.
  //
  vec3 applyChromaticAberration(sampler2D videoTexture, vec2 uv, float intensity) {
    // Zero-intensity optimization - single texture sample when disabled
    if (intensity <= 0.0) {
      return texture2D(videoTexture, uv).rgb;
    }
    
    // Convert intensity (0-10 user range) to horizontal UV offset
    // Scale to 0.001 per unit for subtle but visible separation
    vec2 offset = vec2(intensity * 0.001, 0.0);
    
    // Sample RGB channels with horizontal offset
    // Red channel shifts left (negative X offset)
    float r = texture2D(videoTexture, uv - offset).r;
    // Green channel stays centered (no offset) - anchor point
    float g = texture2D(videoTexture, uv).g;
    // Blue channel shifts right (positive X offset)
    float b = texture2D(videoTexture, uv + offset).b;
    
    return vec3(r, g, b);
  }

  // === Vignette Effect ===
  //
  // Box-shaped vignette with rounded corners matching CSS border-radius.
  // At curvature=0, creates sharp rectangular vignette.
  // At curvature>0, rounds corners to match the dialog's border-radius in screen pixels.
  // Returns a factor (0-1) where:
  // - 1.0 = center (no darkening)
  // - 0.0 = edges (maximum darkening)
  //
  float calculateVignette(vec2 uv, float strength, float curvature, vec2 resolution) {
    vec2 center = abs(uv - 0.5);
    
    // Convert curvature (in pixels) to UV space based on smaller dimension
    // Scale by 1.8x to visually match CSS border-radius (vignette appears tighter due to gradient)
    float minDimension = min(resolution.x, resolution.y);
    float cornerRadiusUV = (curvature * 1.8) / minDimension;
    
    // Rounded-box vignette matching CSS border-radius
    // Calculate distance from corner regions
    vec2 cornerStart = vec2(0.5) - cornerRadiusUV;
    vec2 toCorner = max(center - cornerStart, 0.0);
    
    // Use box distance on edges, add circular distance in corners
    float boxDist = max(center.x, center.y);
    float cornerDist = length(toCorner);
    float dist = boxDist + cornerDist - cornerRadiusUV;
    
    // Square and scale to match original vignette intensity
    float vignetteFactor = 1.0 - (dist * dist * 2.0 * strength);
    return clamp(vignetteFactor, 0.0, 1.0);
  }

  // === Bloom Effect ===
  //
  // Two-pass bloom algorithm simulating phosphor glow in CRT displays:
  // 1. Bright-pass filter: Extract bright pixels above luminance threshold (~0.6)
  // 2. 9-tap Gaussian blur: Apply smooth blur pattern for realistic glow
  //
  // This creates the characteristic soft halo around bright areas that's visible
  // on authentic CRT displays due to phosphor persistence and light scattering.
  //
  // Performance: ~18 texture samples per pixel when enabled (9-tap pattern x2 for blur).
  // Zero-intensity optimization provides single-sample passthrough when disabled.
  //
  vec3 applyBloom(sampler2D videoTexture, vec2 uv, float intensity, vec2 resolution) {
    // Zero-intensity optimization - critical for performance when bloom is disabled
    if (intensity <= 0.0) {
      return texture2D(videoTexture, uv).rgb;
    }
    
    // Sample original color
    vec3 originalColor = texture2D(videoTexture, uv).rgb;
    
    // Step 1: Bright-pass filter
    // Extract bright pixels using luminance threshold (0.6 = 60% brightness)
    // Only pixels brighter than threshold contribute to glow
    float luminance = dot(originalColor, vec3(0.299, 0.587, 0.114));
    float brightPassThreshold = 0.6;
    vec3 brightColor = originalColor * smoothstep(brightPassThreshold - 0.1, brightPassThreshold + 0.1, luminance);
    
    // Step 2: 9-tap Gaussian blur
    // Blur kernel size adapts to resolution for consistent glow appearance
    // Base blur radius: 2.0 pixels, scales with intensity
    vec2 texelSize = vec2(1.0) / resolution;
    float blurRadius = 2.0 * intensity;
    
    // 9-tap Gaussian kernel weights (normalized to sum = 1.0)
    // Center: 0.25, Adjacent: 0.125, Diagonal: 0.0625
    vec3 bloom = brightColor * 0.25; // Center sample
    
    // Adjacent samples (up, down, left, right)
    bloom += texture2D(videoTexture, uv + vec2(0.0, blurRadius) * texelSize).rgb * 0.125;
    bloom += texture2D(videoTexture, uv - vec2(0.0, blurRadius) * texelSize).rgb * 0.125;
    bloom += texture2D(videoTexture, uv + vec2(blurRadius, 0.0) * texelSize).rgb * 0.125;
    bloom += texture2D(videoTexture, uv - vec2(blurRadius, 0.0) * texelSize).rgb * 0.125;
    
    // Diagonal samples (corners)
    bloom += texture2D(videoTexture, uv + vec2(blurRadius, blurRadius) * texelSize).rgb * 0.0625;
    bloom += texture2D(videoTexture, uv + vec2(-blurRadius, blurRadius) * texelSize).rgb * 0.0625;
    bloom += texture2D(videoTexture, uv + vec2(blurRadius, -blurRadius) * texelSize).rgb * 0.0625;
    bloom += texture2D(videoTexture, uv + vec2(-blurRadius, -blurRadius) * texelSize).rgb * 0.0625;
    
    // Combine original with bloom (additive blending)
    // Intensity controls bloom contribution: 0.0 = none, 2.0 = strong glow
    return originalColor + bloom * intensity * 0.5;
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

  // === Monochrome Phosphor Effect ===
  //
  // Converts the display to single-color phosphor output, simulating vintage computer terminals.
  // Uses luminance-based conversion to preserve brightness relationships while tinting with phosphor color.
  //
  // Classic terminal phosphor colors:
  // - White: IBM PC monochrome, early workstations
  // - Amber: Classic terminal warm tone (orange-amber)
  // - Green: VT220, IBM 3270, classic hacker aesthetic
  //
  // Algorithm:
  // 1. Calculate luminance using standard Rec. 709 coefficients
  // 2. Select phosphor color based on u_monochromePhosphor value
  // 3. Multiply luminance by phosphor color to create tinted output
  //
  vec3 applyMonochromePhosphor(vec3 color, float phosphorType) {
    // Zero-intensity optimization - passthrough when disabled
    if (phosphorType == 0.0) {
      return color;
    }
    
    // Calculate luminance using Rec. 709 standard coefficients
    // These weights represent human eye sensitivity to RGB channels
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    
    // Select phosphor color based on type
    vec3 phosphorColor;
    if (phosphorType == 1.0) {
      // White phosphor - IBM PC monochrome, early workstations
      phosphorColor = vec3(1.0, 1.0, 1.0);
    } else if (phosphorType == 2.0) {
      // Amber phosphor - warm orange-amber tone of classic terminals
      phosphorColor = vec3(1.0, 0.75, 0.0);
    } else if (phosphorType == 3.0) {
      // Green phosphor - VT220, IBM 3270 style
      phosphorColor = vec3(0.0, 1.0, 0.0);
    } else {
      // Fallback to white for invalid values
      phosphorColor = vec3(1.0, 1.0, 1.0);
    }
    
    // Apply phosphor color to luminance
    return luma * phosphorColor;
  }

  void main() {
    // 1. Apply barrel distortion to texture coordinates before sampling
    vec2 flippedUv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
    flippedUv = applyBarrelDistortion(flippedUv, u_barrelDistortion);
    
    // 2. Check if distorted coordinates are out of bounds
    // Barrel distortion pulls edges inward, leaving black areas at screen edges
    if (flippedUv.x < 0.0 || flippedUv.x > 1.0 || flippedUv.y < 0.0 || flippedUv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    
    // 3. Sample video texture with chromatic aberration (RGB color separation)
    // This is a lens effect that happens during image capture, before phosphor glow
    vec3 baseColor = applyChromaticAberration(u_videoTexture, flippedUv, u_chromaticAberration);
    
    // 4. Apply bloom to the base color (phosphor glow effect)
    // Note: Current bloom implementation samples texture directly, so we get double bloom
    // To properly combine CA + bloom, we'd need to refactor bloom to work on pre-sampled colors
    // For now, blend between CA-only and bloom-only based on bloom intensity
    vec3 bloomedColor;
    if (u_bloomIntensity > 0.0) {
      vec3 bloomResult = applyBloom(u_videoTexture, flippedUv, u_bloomIntensity, u_resolution);
      // Blend: use CA color for base, add bloom glow on top
      // This isn't perfect but maintains both effects
      bloomedColor = baseColor + (bloomResult - texture2D(u_videoTexture, flippedUv).rgb) * u_bloomIntensity * 0.5;
    } else {
      bloomedColor = baseColor;
    }
    
    // 5. Apply monochrome phosphor effect (color transformation)
    // This converts the image to single-color phosphor BEFORE multiplicative effects
    vec3 monochromeColor = applyMonochromePhosphor(bloomedColor, u_monochromePhosphor);
    
    // 6. Calculate all multiplicative factors
    // Scanlines and vignette use raw v_texCoord for screen-space effects
    float scanlineFactor = calculateScanline(v_texCoord, u_scanlineSize, u_resolution);
    float vignetteFactor = calculateVignette(v_texCoord, u_vignetteStrength, u_screenCurvature, u_resolution);
    // Phosphor uses distorted flippedUv to align with video content
    vec3 phosphorMask = calculatePhosphor(flippedUv, u_resolution, u_phosphorPattern, u_phosphorIntensity);
    
    // 7. Apply multiplicative effects to monochrome color
    // All factors are 0-1, so multiplication darkens the image authentically
    vec3 finalColor = monochromeColor * phosphorMask * scanlineFactor * vignetteFactor;
    
    // 8. Output full opaque frame (no alpha blending dependency)
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
