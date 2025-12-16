import { describe, it, expect } from 'vitest';
import { SCANLINE_FRAGMENT_SHADER } from './scanline.frag';

/**
 * Shader Barrel Distortion Tests
 *
 * These tests verify the mathematical correctness of the barrel distortion
 * implementation by analyzing the shader source code and validating the
 * distortion formula properties.
 *
 * Note: Full GPU shader execution testing requires WebGL context, which is
 * beyond the scope of unit tests. These tests verify the algorithm logic.
 */
describe('Scanline Fragment Shader - Barrel Distortion', () => {
  describe('shader structure', () => {
    it('should declare u_barrelDistortion uniform', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('uniform float u_barrelDistortion');
    });

    it('should define applyBarrelDistortion function', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('vec2 applyBarrelDistortion');
    });

    it('should accept uv and intensity parameters', () => {
      const functionSignature = /vec2\s+applyBarrelDistortion\s*\(\s*vec2\s+uv\s*,\s*float\s+intensity\s*\)/;
      expect(SCANLINE_FRAGMENT_SHADER).toMatch(functionSignature);
    });
  });

  describe('zero-intensity optimization', () => {
    it('should have early return when intensity is 0.0', () => {
      // Critical performance optimization - must return unchanged UV
      expect(SCANLINE_FRAGMENT_SHADER).toContain('if (intensity == 0.0) return uv');
    });

    it('should check intensity before any distortion calculations', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const functionStart = shader.indexOf('vec2 applyBarrelDistortion');
      const intensityCheck = shader.indexOf('if (intensity == 0.0)', functionStart);
      const centeredCalc = shader.indexOf('centered = uv', functionStart);

      // Zero check should come before distortion calculations
      expect(intensityCheck).toBeLessThan(centeredCalc);
      expect(intensityCheck).toBeGreaterThan(-1);
    });
  });

  describe('radial distortion formula', () => {
    it('should calculate centered coordinates', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('centered = uv - vec2(0.5');
    });

    it('should calculate r² using efficient dot product', () => {
      // Using dot(centered, centered) avoids expensive sqrt operation
      expect(SCANLINE_FRAGMENT_SHADER).toContain('r2 = dot(centered, centered)');
    });

    it('should apply quadratic radial distortion formula', () => {
      // Formula: vec2(0.5) + centered * (1.0 + intensity * r2)
      // This creates barrel/pincushion warping that increases toward edges
      const formulaPattern = /vec2\(0\.5\)\s*\+\s*centered\s*\*\s*\(\s*1\.0\s*\+\s*intensity\s*\*\s*r2\s*\)/;
      expect(SCANLINE_FRAGMENT_SHADER).toMatch(formulaPattern);
    });

    it('should use r² (squared distance) for quadratic distortion', () => {
      // r² creates smooth barrel curve vs linear which looks artificial
      expect(SCANLINE_FRAGMENT_SHADER).toContain('r2');
    });
  });

  describe('out-of-bounds handling', () => {
    it('should check for out-of-bounds coordinates in main()', () => {
      const mainFunction = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('void main()')
      );
      // Check if distorted UVs are outside [0,1] range
      expect(mainFunction).toContain('flippedUv.x < 0.0');
      expect(mainFunction).toContain('flippedUv.x > 1.0');
      expect(mainFunction).toContain('flippedUv.y < 0.0');
      expect(mainFunction).toContain('flippedUv.y > 1.0');
    });

    it('should return black for out-of-bounds coordinates', () => {
      const mainFunction = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('void main()')
      );
      // Should output black (0,0,0,1) for out-of-bounds pixels
      expect(mainFunction).toContain('gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0)');
    });

    it('should not clamp coordinates in distortion function', () => {
      const distortionFunc = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('vec2 applyBarrelDistortion'),
        SCANLINE_FRAGMENT_SHADER.indexOf('// === Vignette')
      );
      // Should NOT clamp to allow edges to pull inward
      expect(distortionFunc).not.toContain('clamp(distorted');
    });
  });

  describe('main() integration', () => {
    it('should call applyBarrelDistortion in main()', () => {
      const mainFunction = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('void main()')
      );
      expect(mainFunction).toContain('applyBarrelDistortion');
    });

    it('should apply distortion before texture sampling', () => {
      const mainFunction = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('void main()')
      );
      const distortionCall = mainFunction.indexOf('applyBarrelDistortion');
      const chromaticCall = mainFunction.indexOf('applyChromaticAberration');

      // Distortion must be applied before chromatic aberration (which samples the texture)
      expect(distortionCall).toBeLessThan(chromaticCall);
      expect(distortionCall).toBeGreaterThan(-1);
    });

    it('should pass u_barrelDistortion to function', () => {
      const distortionCallPattern = /applyBarrelDistortion\([^,]+,\s*u_barrelDistortion\s*\)/;
      expect(SCANLINE_FRAGMENT_SHADER).toMatch(distortionCallPattern);
    });

    it('should apply distortion to flippedUv coordinates', () => {
      const mainFunction = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('void main()')
      );
      
      // Should apply distortion to flippedUv and reassign result
      expect(mainFunction).toContain('flippedUv = applyBarrelDistortion(flippedUv');
    });
  });

  describe('mathematical properties', () => {
    describe('center preservation', () => {
      it('should preserve center point (0.5, 0.5)', () => {
        // When uv = (0.5, 0.5):
        // centered = (0.5, 0.5) - (0.5, 0.5) = (0.0, 0.0)
        // r = length((0.0, 0.0)) = 0.0
        // distorted = (0.5, 0.5) + (0.0, 0.0) * (1.0 + intensity * 0.0 * 0.0)
        //           = (0.5, 0.5) + (0.0, 0.0) = (0.5, 0.5)
        // This verifies the formula always maps center to center
        expect(SCANLINE_FRAGMENT_SHADER).toContain('vec2(0.5) + centered');
      });
    });

    describe('radial symmetry', () => {
      it('should use squared radial distance from center', () => {
        // Using dot(centered, centered) for r² ensures all points at same
        // distance from center receive same distortion (radial symmetry)
        expect(SCANLINE_FRAGMENT_SHADER).toContain('r2 = dot(centered, centered)');
      });
    });

    describe('distortion intensity', () => {
      it('should increase displacement with higher intensity', () => {
        // Formula multiplies by intensity, so higher values
        // create more displacement from center
        const formula = /centered\s*\*\s*\(\s*1\.0\s*\+\s*intensity\s*\*\s*r2/;
        expect(SCANLINE_FRAGMENT_SHADER).toMatch(formula);
      });

      it('should increase displacement with distance from center', () => {
        // The r² term means points farther from center (higher squared distance)
        // experience more distortion
        expect(SCANLINE_FRAGMENT_SHADER).toContain('intensity * r2');
      });
    });
  });

  describe('GLSL syntax compliance', () => {
    it('should use GLSL ES 1.0 compatible syntax', () => {
      // Check for vec2, vec3, float types (not modern GLSL types)
      expect(SCANLINE_FRAGMENT_SHADER).toContain('vec2');
      expect(SCANLINE_FRAGMENT_SHADER).toContain('float');
      
      // Should not use modern GLSL features
      expect(SCANLINE_FRAGMENT_SHADER).not.toContain('dvec');
      expect(SCANLINE_FRAGMENT_SHADER).not.toContain('uint');
    });

    it('should use precision qualifiers', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('precision');
    });

    it('should properly declare uniforms with u_ prefix', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('uniform float u_barrelDistortion');
      expect(SCANLINE_FRAGMENT_SHADER).toContain('uniform float u_screenCurvature');
    });
  });

  describe('performance considerations', () => {
    it('should minimize operations when intensity is zero', () => {
      // Early return avoids all distortion calculations
      const zeroCheckPattern = /if\s*\(\s*intensity\s*==\s*0\.0\s*\)\s*return\s+uv/;
      expect(SCANLINE_FRAGMENT_SHADER).toMatch(zeroCheckPattern);
    });

    it('should use efficient r² calculation without sqrt', () => {
      // Use dot product for r² directly, avoiding expensive sqrt operation
      const shader = SCANLINE_FRAGMENT_SHADER;
      const distortionFunc = shader.substring(
        shader.indexOf('vec2 applyBarrelDistortion'),
        shader.indexOf('float calculateVignette')
      );
      
      // Should use dot() for r², not length()
      expect(distortionFunc).toContain('r2 = dot(centered, centered)');
      expect(distortionFunc).not.toContain('length(centered)');
    });
  });

  describe('documentation', () => {
    it('should have function documentation comment', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const funcIndex = shader.indexOf('vec2 applyBarrelDistortion');
      const precedingText = shader.substring(Math.max(0, funcIndex - 500), funcIndex);
      
      // Should have comment before function
      expect(precedingText).toMatch(/\/\//);
    });

    it('should document the barrel distortion formula', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const distortionSection = shader.substring(
        shader.indexOf('=== Barrel Distortion'),
        shader.indexOf('vec2 applyBarrelDistortion') + 200
      );
      
      expect(distortionSection).toContain('Barrel Distortion');
    });
  });
});

/**
 * Mathematical Behavior Verification
 *
 * These tests document the expected mathematical behavior of the distortion formula.
 * They serve as specification and regression prevention.
 */
describe('Barrel Distortion Formula - Mathematical Specification', () => {
  describe('formula behavior at key coordinates', () => {
    it('should document center point behavior', () => {
      // At (0.5, 0.5): centered = (0,0), r2 = 0, distorted = (0.5, 0.5)
      // Center is always preserved regardless of intensity
      const formula = 'vec2(0.5) + centered * (1.0 + intensity * r2)';
      expect(SCANLINE_FRAGMENT_SHADER).toContain(formula);
    });

    it('should document corner point behavior', () => {
      // At (1.0, 1.0): centered = (0.5, 0.5), r2 = 0.5
      // distorted = (0.5, 0.5) + (0.5, 0.5) * (1.0 + intensity * 0.5)
      // Maximum distortion occurs at corners
      expect(SCANLINE_FRAGMENT_SHADER).toContain('r2 = dot(centered, centered)');
    });

    it('should document edge midpoint behavior', () => {
      // At (1.0, 0.5): centered = (0.5, 0.0), r2 = 0.25
      // distorted = (0.5, 0.5) + (0.5, 0.0) * (1.0 + intensity * 0.25)
      // Less distortion than corners but more than center
      const formula = 'centered * (1.0 + intensity * r2)';
      expect(SCANLINE_FRAGMENT_SHADER).toContain(formula);
    });
  });

  describe('edge cases', () => {
    it('should handle zero intensity', () => {
      // When intensity=0, should return original UV without calculation
      expect(SCANLINE_FRAGMENT_SHADER).toContain('if (intensity == 0.0) return uv');
    });

    it('should use efficient r² calculation without sqrt', () => {
      // Use dot product for r² directly, avoiding expensive sqrt operation
      expect(SCANLINE_FRAGMENT_SHADER).toContain('r2 = dot(centered, centered)');
      // Should NOT use length() in the distortion function
      const distortionFunc = SCANLINE_FRAGMENT_SHADER.substring(
        SCANLINE_FRAGMENT_SHADER.indexOf('vec2 applyBarrelDistortion'),
        SCANLINE_FRAGMENT_SHADER.indexOf('// === Vignette')
      );
      expect(distortionFunc).not.toContain('length(centered)');
    });

    it('should allow distortion to create out-of-bounds coordinates', () => {
      // Distortion function should NOT call clamp(), allowing edge pixels to pull inward
      const shader = SCANLINE_FRAGMENT_SHADER;
      const funcStart = shader.indexOf('vec2 applyBarrelDistortion');
      const funcEnd = shader.indexOf('}', shader.indexOf('return vec2(0.5) + centered', funcStart));
      const distortionFunc = shader.substring(funcStart, funcEnd + 1);
      // Check that clamp() function is not called (not just the word in comments)
      expect(distortionFunc).not.toMatch(/clamp\s*\(/);
    });
  });
});

/**
 * Bloom Effect Shader Tests
 *
 * These tests verify the two-pass bloom algorithm:
 * 1. Bright-pass filter extracts bright pixels above luminance threshold
 * 2. 9-tap Gaussian blur creates smooth glow around bright areas
 *
 * This simulates the phosphor glow characteristic of CRT displays.
 */
describe('Scanline Fragment Shader - Bloom Effect', () => {
  describe('shader structure', () => {
    it('should declare u_bloomIntensity uniform', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('uniform float u_bloomIntensity');
    });

    it('should define applyBloom function', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('vec3 applyBloom');
    });

    it('should accept videoTexture, uv, intensity, and resolution parameters', () => {
      const functionSignature = /vec3\s+applyBloom\s*\(\s*sampler2D\s+videoTexture\s*,\s*vec2\s+uv\s*,\s*float\s+intensity\s*,\s*vec2\s+resolution\s*\)/;
      expect(SCANLINE_FRAGMENT_SHADER).toMatch(functionSignature);
    });
  });

  describe('zero-intensity optimization', () => {
    it('should have early return when intensity is 0.0', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('if (intensity <= 0.0)');
    });

    it('should return texture sample directly when disabled', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      expect(bloomFunc).toContain('return texture2D(videoTexture, uv).rgb');
    });

    it('should check intensity before any bloom calculations', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const functionStart = shader.indexOf('vec3 applyBloom');
      const intensityCheck = shader.indexOf('if (intensity <= 0.0)', functionStart);
      const brightPassCalc = shader.indexOf('brightColor', functionStart);

      expect(intensityCheck).toBeLessThan(brightPassCalc);
      expect(intensityCheck).toBeGreaterThan(-1);
    });
  });

  describe('bright-pass filter algorithm', () => {
    it('should calculate luminance using standard coefficients', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('dot(originalColor, vec3(0.299, 0.587, 0.114))');
    });

    it('should define bright-pass threshold', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('brightPassThreshold = 0.6');
    });

    it('should use smoothstep for soft threshold transition', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      expect(bloomFunc).toMatch(/smoothstep\s*\(\s*brightPassThreshold\s*-\s*0\.1\s*,\s*brightPassThreshold\s*\+\s*0\.1/);
    });

    it('should extract bright color above threshold', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('brightColor = originalColor * smoothstep');
    });
  });

  describe('9-tap Gaussian blur', () => {
    it('should calculate texel size from resolution', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('texelSize = vec2(1.0) / resolution');
    });

    it('should scale blur radius with intensity', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('blurRadius = 2.0 * intensity');
    });

    it('should include center sample with weight 0.25', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('bloom = brightColor * 0.25');
    });

    it('should include 4 adjacent samples with weight 0.125 each', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      // Count occurrences of * 0.125 (should be 4 for adjacent samples)
      const adjacentSamples = (bloomFunc.match(/\*\s*0\.125/g) || []).length;
      expect(adjacentSamples).toBe(4);
    });

    it('should include 4 diagonal samples with weight 0.0625 each', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      // Count occurrences of * 0.0625 (should be 4 for diagonal samples)
      const diagonalSamples = (bloomFunc.match(/\*\s*0\.0625/g) || []).length;
      expect(diagonalSamples).toBe(4);
    });

    it('should sample all 4 cardinal directions', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      // Check for up, down, left, right samples
      expect(bloomFunc).toContain('vec2(0.0, blurRadius)');  // up
      expect(bloomFunc).toContain('vec2(blurRadius, 0.0)');  // right
      expect(bloomFunc).toMatch(/-\s*vec2\(0\.0,\s*blurRadius\)/); // down
      expect(bloomFunc).toMatch(/-\s*vec2\(blurRadius,\s*0\.0\)/); // left
    });

    it('should sample all 4 diagonal corners', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      // Check for diagonal samples (positive/negative combinations)
      expect(bloomFunc).toContain('vec2(blurRadius, blurRadius)');
      expect(bloomFunc).toContain('vec2(-blurRadius, blurRadius)');
      expect(bloomFunc).toContain('vec2(blurRadius, -blurRadius)');
      expect(bloomFunc).toContain('vec2(-blurRadius, -blurRadius)');
    });
  });

  describe('additive blending', () => {
    it('should combine original color with bloom', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('originalColor + bloom');
    });

    it('should scale bloom contribution by intensity', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('bloom * intensity * 0.5');
    });

    it('should return combined color', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      expect(bloomFunc).toMatch(/return\s+originalColor\s+\+\s+bloom\s+\*\s+intensity\s+\*\s+0\.5/);
    });
  });

  describe('main() integration', () => {
    it('should call applyBloom in main() function', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const mainFunc = shader.substring(shader.indexOf('void main()'));
      expect(mainFunc).toContain('applyBloom');
    });

    it('should apply bloom BEFORE scanlines and vignette', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const mainFunc = shader.substring(shader.indexOf('void main()'));
      
      const bloomCall = mainFunc.indexOf('applyBloom');
      const scanlineCall = mainFunc.indexOf('calculateScanline');
      const vignetteCall = mainFunc.indexOf('calculateVignette');
      
      expect(bloomCall).toBeGreaterThan(-1);
      expect(bloomCall).toBeLessThan(scanlineCall);
      expect(bloomCall).toBeLessThan(vignetteCall);
    });

    it('should pass video texture to bloom function', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const mainFunc = shader.substring(shader.indexOf('void main()'));
      expect(mainFunc).toMatch(/applyBloom\s*\(\s*u_videoTexture/);
    });

    it('should pass bloom intensity uniform', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const mainFunc = shader.substring(shader.indexOf('void main()'));
      expect(mainFunc).toContain('u_bloomIntensity');
    });

    it('should pass resolution uniform for texel size calculation', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const mainFunc = shader.substring(shader.indexOf('void main()'));
      const bloomCall = mainFunc.substring(mainFunc.indexOf('applyBloom'));
      expect(bloomCall).toContain('u_resolution');
    });

    it('should use bloomed color for subsequent effects', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const mainFunc = shader.substring(shader.indexOf('void main()'));
      // Bloom feeds into monochrome phosphor
      expect(mainFunc).toContain('bloomedColor');
      expect(mainFunc).toMatch(/applyMonochromePhosphor\s*\(\s*bloomedColor/);
      // Monochrome color is used in final multiplicative calculation
      expect(mainFunc).toMatch(/finalColor\s*=\s*monochromeColor\s*\*/);
    });
  });

  describe('GLSL syntax compliance', () => {
    it('should use valid GLSL ES 1.0 texture sampling', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('texture2D(videoTexture');
    });

    it('should use vec2/vec3 types correctly', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      expect(bloomFunc).toContain('vec2 texelSize');
      expect(bloomFunc).toContain('vec3 originalColor');
      expect(bloomFunc).toContain('vec3 brightColor');
      expect(bloomFunc).toContain('vec3 bloom');
    });

    it('should use float literals with decimal points', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      // Check that weights are properly formatted
      expect(bloomFunc).toMatch(/0\.25(?!\d)/); // 0.25, not 0.250
      expect(bloomFunc).toMatch(/0\.125(?!\d)/); // 0.125, not 0.1250
      expect(bloomFunc).toMatch(/0\.0625(?!\d)/); // 0.0625
    });
  });

  describe('performance considerations', () => {
    it('should have zero-cost optimization when disabled', () => {
      // Single texture sample when intensity <= 0
      expect(SCANLINE_FRAGMENT_SHADER).toContain('if (intensity <= 0.0)');
    });

    it('should minimize texture samples (9 total when enabled)', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      // Count texture2D calls in bloom function (should be 10: 1 original + 9 blur samples)
      // 1 for original color, then 9 for Gaussian blur (1 center + 4 adjacent + 4 diagonal)
      const textureSamples = (bloomFunc.match(/texture2D\(/g) || []).length;
      expect(textureSamples).toBe(10);
    });

    it('should use efficient texel size calculation', () => {
      expect(SCANLINE_FRAGMENT_SHADER).toContain('vec2(1.0) / resolution');
    });
  });

  describe('documentation', () => {
    it('should document the two-pass algorithm', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomComment = shader.substring(
        shader.indexOf('// === Bloom Effect ==='),
        shader.indexOf('vec3 applyBloom')
      );
      expect(bloomComment).toContain('Two-pass');
      expect(bloomComment).toContain('Bright-pass filter');
      expect(bloomComment).toContain('Gaussian blur');
    });

    it('should document bright-pass threshold value', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomFunc = shader.substring(
        shader.indexOf('vec3 applyBloom'),
        shader.indexOf('// === Phosphor Pattern Functions ===')
      );
      expect(bloomFunc).toMatch(/0\.6.*60%/);
    });

    it('should document performance characteristics', () => {
      const shader = SCANLINE_FRAGMENT_SHADER;
      const bloomComment = shader.substring(
        shader.indexOf('// === Bloom Effect ==='),
        shader.indexOf('vec3 applyBloom')
      );
      expect(bloomComment).toContain('Performance');
      expect(bloomComment).toContain('Zero-intensity optimization');
    });
  });
});
