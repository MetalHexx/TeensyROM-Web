import { describe, it, expect, beforeEach } from 'vitest';
import { CropAnimator } from './crop-animator';
import { CropRect } from './black-bar-detector';

describe('CropAnimator', () => {
  let animator: CropAnimator;

  beforeEach(() => {
    animator = new CropAnimator();
  });

  describe('Initialization', () => {
    it('should initialize to no-crop state (0,0,1,1)', () => {
      const current = animator.getCurrent();

      expect(current).toEqual({
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      });
    });

    it('should be converged at initialization', () => {
      expect(animator.isConverged()).toBe(true);
    });
  });

  describe('setTarget', () => {
    it('should update target crop rectangle', () => {
      const targetCrop: CropRect = {
        left: 0.1,
        top: 0.2,
        width: 0.8,
        height: 0.6,
      };

      animator.setTarget(targetCrop);

      // After setTarget but before update, current should still be at initial state
      const current = animator.getCurrent();
      expect(current).toEqual({ left: 0, top: 0, width: 1, height: 1 });

      // Should no longer be converged
      expect(animator.isConverged()).toBe(false);
    });

    it('should not mutate the input crop rectangle', () => {
      const targetCrop: CropRect = {
        left: 0.1,
        top: 0.2,
        width: 0.8,
        height: 0.6,
      };
      const originalTarget = { ...targetCrop };

      animator.setTarget(targetCrop);
      animator.update(); // Advance animation

      // Input should not be modified
      expect(targetCrop).toEqual(originalTarget);
    });
  });

  describe('Lerp Convergence', () => {
    it('should gradually converge toward target over multiple frames', () => {
      const target: CropRect = { left: 0, top: 0.1, width: 1, height: 0.8 };
      animator.setTarget(target);

      // Track progress over multiple frames
      const snapshots: CropRect[] = [];
      for (let i = 0; i < 50; i++) {
        snapshots.push(animator.update());
      }

      // First frame should move 10% toward target
      expect(snapshots[0].top).toBeCloseTo(0.01, 4); // 0 + (0.1 - 0) * 0.1 = 0.01
      expect(snapshots[0].height).toBeCloseTo(0.98, 4); // 1 + (0.8 - 1) * 0.1 = 0.98

      // Should progressively get closer to target
      expect(snapshots[10].top).toBeGreaterThan(snapshots[0].top);
      expect(snapshots[10].top).toBeLessThan(target.top);

      // Should eventually converge to target (within threshold)
      const final = snapshots[snapshots.length - 1];
      expect(Math.abs(final.top - target.top)).toBeLessThan(0.002);
      expect(Math.abs(final.height - target.height)).toBeLessThan(0.002);
    });

    it('should converge to target after sufficient frames', () => {
      animator.setTarget({ left: 0, top: 0.2, width: 1, height: 0.6 });

      // Run animation for 100 frames (ensure convergence within 0.001 threshold)
      // With 0.1 lerp step, converges asymptotically
      for (let i = 0; i < 100; i++) {
        animator.update();
      }

      expect(animator.isConverged()).toBe(true);
    });

    it('should lerp all four components independently', () => {
      const target: CropRect = {
        left: 0.1,
        top: 0.2,
        width: 0.7,
        height: 0.6,
      };
      animator.setTarget(target);

      const firstFrame = animator.update();

      // Each component should move 10% toward its target
      expect(firstFrame.left).toBeCloseTo(0.01, 5); // 0 + (0.1 - 0) * 0.1
      expect(firstFrame.top).toBeCloseTo(0.02, 5); // 0 + (0.2 - 0) * 0.1
      expect(firstFrame.width).toBeCloseTo(0.97, 5); // 1 + (0.7 - 1) * 0.1
      expect(firstFrame.height).toBeCloseTo(0.96, 5); // 1 + (0.6 - 1) * 0.1
    });
  });

  describe('reset', () => {
    it('should reset to no-crop state immediately', () => {
      // Set some target and advance animation
      animator.setTarget({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 });
      for (let i = 0; i < 10; i++) {
        animator.update();
      }

      // Current should be somewhere between initial and target
      const beforeReset = animator.getCurrent();
      expect(beforeReset.left).toBeGreaterThan(0);
      expect(beforeReset.width).toBeLessThan(1);

      // Reset should immediately return to no-crop
      animator.reset();

      const afterReset = animator.getCurrent();
      expect(afterReset).toEqual({
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      });
    });

    it('should be converged after reset', () => {
      animator.setTarget({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 });
      animator.update();

      animator.reset();

      expect(animator.isConverged()).toBe(true);
    });

    it('should not animate after reset until new target is set', () => {
      animator.setTarget({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 });
      animator.update();
      animator.reset();

      const current1 = animator.getCurrent();
      const current2 = animator.update();
      const current3 = animator.update();

      // All should be identical (no animation without target)
      expect(current1).toEqual(current2);
      expect(current2).toEqual(current3);
    });
  });

  describe('Mid-Animation Retargeting', () => {
    it('should smoothly transition to new target mid-animation', () => {
      // Set initial target and advance partway
      animator.setTarget({ left: 0, top: 0.2, width: 1, height: 0.6 });
      for (let i = 0; i < 5; i++) {
        animator.update();
      }

      const midAnimationState = animator.getCurrent();

      // Change target mid-animation
      const newTarget: CropRect = { left: 0.1, top: 0.1, width: 0.8, height: 0.8 };
      animator.setTarget(newTarget);

      // Should continue from current state toward new target
      const afterRetarget = animator.update();

      // Should be moving toward new target, not jumping
      expect(afterRetarget.left).toBeGreaterThan(midAnimationState.left);
      expect(afterRetarget.left).toBeLessThan(newTarget.left);

      // Should eventually converge to new target
      for (let i = 0; i < 50; i++) {
        animator.update();
      }

      const final = animator.getCurrent();
      expect(Math.abs(final.left - newTarget.left)).toBeLessThan(0.001);
      expect(Math.abs(final.top - newTarget.top)).toBeLessThan(0.001);
      expect(Math.abs(final.width - newTarget.width)).toBeLessThan(0.001);
      expect(Math.abs(final.height - newTarget.height)).toBeLessThan(0.001);
    });

    it('should not jump when target changes', () => {
      animator.setTarget({ left: 0, top: 0.2, width: 1, height: 0.6 });
      for (let i = 0; i < 5; i++) {
        animator.update();
      }

      const beforeChange = animator.getCurrent();

      // Change target
      animator.setTarget({ left: 0.3, top: 0.3, width: 0.4, height: 0.4 });

      const afterChange = animator.update();

      // Should take small step, not jump to new target
      const leftDelta = Math.abs(afterChange.left - beforeChange.left);
      const topDelta = Math.abs(afterChange.top - beforeChange.top);

      expect(leftDelta).toBeLessThan(0.05); // Small step, not jump
      expect(topDelta).toBeLessThan(0.05);
    });
  });

  describe('getCurrent', () => {
    it('should return current state without advancing animation', () => {
      animator.setTarget({ left: 0.1, top: 0.1, width: 0.8, height: 0.8 });

      const before = animator.getCurrent();
      const after = animator.getCurrent();

      // Multiple calls should return same state
      expect(before).toEqual(after);
      expect(before).toEqual({ left: 0, top: 0, width: 1, height: 1 });
    });

    it('should return a copy, not reference to internal state', () => {
      const current = animator.getCurrent();
      current.left = 999; // Try to mutate

      const current2 = animator.getCurrent();
      expect(current2.left).toBe(0); // Should be unchanged
    });
  });

  describe('update', () => {
    it('should return a copy, not reference to internal state', () => {
      animator.setTarget({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 });

      const result = animator.update();
      result.left = 999; // Try to mutate

      const result2 = animator.update();
      expect(result2.left).not.toBe(999); // Should be unchanged
    });

    it('should advance animation each call', () => {
      animator.setTarget({ left: 0, top: 0.2, width: 1, height: 0.6 });

      const frame1 = animator.update();
      const frame2 = animator.update();
      const frame3 = animator.update();

      // Each frame should be progressively closer to target
      expect(frame2.top).toBeGreaterThan(frame1.top);
      expect(frame3.top).toBeGreaterThan(frame2.top);
    });
  });

  describe('isConverged', () => {
    it('should return false when animating toward target', () => {
      animator.setTarget({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 });
      animator.update();

      expect(animator.isConverged()).toBe(false);
    });

    it('should return true when current matches target', () => {
      animator.setTarget({ left: 0, top: 0, width: 1, height: 1 });
      expect(animator.isConverged()).toBe(true);
    });

    it('should return true after sufficient convergence time', () => {
      animator.setTarget({ left: 0.1, top: 0.1, width: 0.8, height: 0.8 });

      for (let i = 0; i < 100; i++) {
        animator.update();
      }

      expect(animator.isConverged()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle target equal to current (no animation needed)', () => {
      const current = animator.getCurrent();
      animator.setTarget(current);

      expect(animator.isConverged()).toBe(true);

      const result = animator.update();
      expect(result).toEqual(current);
    });

    it('should handle very small differences (convergence threshold)', () => {
      // Set target very close to current
      animator.setTarget({ left: 0.0001, top: 0.0001, width: 0.9999, height: 0.9999 });

      const result = animator.update();

      // Should snap to target (within convergence threshold)
      expect(result.left).toBeCloseTo(0.0001, 5);
      expect(result.top).toBeCloseTo(0.0001, 5);
      expect(result.width).toBeCloseTo(0.9999, 5);
      expect(result.height).toBeCloseTo(0.9999, 5);
    });

    it('should handle extreme values', () => {
      // Test with crop that removes everything (edge case)
      animator.setTarget({ left: 0.5, top: 0.5, width: 0, height: 0 });

      for (let i = 0; i < 100; i++) {
        const result = animator.update();

        // Should handle gracefully without NaN or Infinity
        expect(result.left).toBeGreaterThanOrEqual(0);
        expect(result.left).toBeLessThanOrEqual(1);
        expect(result.width).toBeGreaterThanOrEqual(0);
        expect(result.width).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Performance Characteristics', () => {
    it('should take approximately 23 frames to reach 90% of target (with 0.1 step)', () => {
      // With lerp step 0.1, each frame covers 10% of remaining distance
      // After n frames: remaining = 0.9^n
      // To reach 10% remaining (90% complete): 0.9^n = 0.1 → n ≈ 22 frames
      const target: CropRect = { left: 0, top: 1, width: 1, height: 0 };
      animator.setTarget(target);

      let frames = 0;
      let current = animator.getCurrent();

      while (Math.abs(current.top - target.top) > 0.1 && frames < 50) {
        current = animator.update();
        frames++;
      }

      // Should be close to 23 frames (allowing for threshold snapping)
      expect(frames).toBeGreaterThanOrEqual(20);
      expect(frames).toBeLessThanOrEqual(25);
    });

    it('should handle 1000 update calls efficiently', () => {
      animator.setTarget({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 });

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        animator.update();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 updates in less than 10ms (very fast)
      expect(duration).toBeLessThan(10);
    });
  });
});
