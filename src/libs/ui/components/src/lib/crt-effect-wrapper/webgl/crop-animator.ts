import { CropRect } from './black-bar-detector';

/**
 * Smooth animation engine for black bar crop rectangle transitions.
 *
 * Takes discrete crop detection results and interpolates them smoothly
 * over multiple frames using linear interpolation (lerp). This creates
 * a "camera operator" feel where crops ease into position rather than
 * snapping abruptly.
 *
 * Phase 1 implementation uses simple lerp with 10% step per frame.
 * Phase 2 will add configurable easing curves and user-adjustable speeds.
 *
 * @example
 * ```typescript
 * const animator = new CropAnimator();
 *
 * // Detection found new crop
 * animator.setTarget({ left: 0, top: 0.1, width: 1, height: 0.8 });
 *
 * // Call every frame (60 FPS)
 * const currentCrop = animator.update();
 * gl.uniform4f(u_cropRect, currentCrop.left, currentCrop.top,
 *              currentCrop.width, currentCrop.height);
 * ```
 */
export class CropAnimator {
  /**
   * Current animated crop state (output value).
   * Updated each frame by update() method.
   */
  private current: CropRect;

  /**
   * Target crop from detection (destination value).
   * Set by setTarget() when detection finds new crop.
   */
  private target: CropRect;

  /**
   * Linear interpolation step per frame (0-1).
   * Default 0.1 = 10% step toward target each frame at 60 FPS.
   *
   * Higher values = faster convergence (more responsive but less smooth)
   * Lower values = slower convergence (smoother but less responsive)
   *
   * Phase 1: Fixed at 0.1
   * Phase 2: Will be configurable via cropSmoothness setting
   */
  private readonly lerpStep = 0.1;

  /**
   * Threshold below which animation is considered complete.
   * When current is within this distance of target, snap to target.
   *
   * Prevents infinite micro-adjustments due to float precision.
   */
  private readonly convergenceThreshold = 0.001;

  constructor() {
    // Initialize to no-crop state (full frame visible)
    this.current = { left: 0, top: 0, width: 1, height: 1 };
    this.target = { left: 0, top: 0, width: 1, height: 1 };
  }

  /**
   * Set new target crop rectangle from detection.
   *
   * The animator will smoothly transition from current state toward
   * this target over multiple frames via lerp.
   *
   * @param rect Normalized crop rectangle (0-1 coords) from detector
   */
  setTarget(rect: CropRect): void {
    this.target = { ...rect };
  }

  /**
   * Update animation and return current interpolated crop.
   *
   * Call this every frame (60 FPS) to advance the animation.
   * Returns the current interpolated crop rectangle for shader uniform.
   *
   * Implementation:
   * - Lerp each component: current = current + (target - current) * lerpStep
   * - Snap to target when within convergence threshold
   * - Always returns a copy to prevent external mutation
   *
   * @returns Current interpolated crop rectangle
   */
  update(): CropRect {
    this.current.left = this.lerpValue(this.current.left, this.target.left);
    this.current.top = this.lerpValue(this.current.top, this.target.top);
    this.current.width = this.lerpValue(this.current.width, this.target.width);
    this.current.height = this.lerpValue(this.current.height, this.target.height);

    return { ...this.current };
  }

  /**
   * Reset animation to no-crop state (full frame).
   *
   * Sets both current and target to (0,0,1,1), effectively disabling crop.
   * Use this when autoCropBlackBars is toggled off.
   */
  reset(): void {
    this.current = { left: 0, top: 0, width: 1, height: 1 };
    this.target = { left: 0, top: 0, width: 1, height: 1 };
  }

  /**
   * Get current crop state without updating animation.
   *
   * Useful for reading current state without advancing the animation.
   *
   * @returns Copy of current crop rectangle
   */
  getCurrent(): CropRect {
    return { ...this.current };
  }

  /**
   * Check if animation has converged to target.
   *
   * Returns true when current is within convergenceThreshold of target
   * for all four components (left, top, width, height).
   *
   * Useful for debugging or determining when animation is complete.
   *
   * @returns true if animation has converged, false otherwise
   */
  isConverged(): boolean {
    return (
      Math.abs(this.current.left - this.target.left) < this.convergenceThreshold &&
      Math.abs(this.current.top - this.target.top) < this.convergenceThreshold &&
      Math.abs(this.current.width - this.target.width) < this.convergenceThreshold &&
      Math.abs(this.current.height - this.target.height) < this.convergenceThreshold
    );
  }

  /**
   * Linear interpolation helper for single value.
   *
   * Interpolates from current toward target by lerpStep percentage.
   * Snaps to target when within convergence threshold.
   *
   * @param current Current value
   * @param target Target value
   * @returns Interpolated value
   */
  private lerpValue(current: number, target: number): number {
    const delta = target - current;

    if (Math.abs(delta) < this.convergenceThreshold) {
      return target;
    }

    return current + delta * this.lerpStep;
  }
}
