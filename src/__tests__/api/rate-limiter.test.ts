import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from '../../api/rate-limiter.js';

describe('RateLimiter', () => {
  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const limiter = new RateLimiter();
      const stats = limiter.getStats();
      expect(stats.used).toBe(0);
      expect(stats.remaining).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxRequests);
    });

    it('should accept custom config', () => {
      const limiter = new RateLimiter({ maxRequests: 100 });
      const stats = limiter.getStats();
      expect(stats.remaining).toBe(100);
    });
  });

  describe('recordRequest', () => {
    it('should track requests via recordRequest', () => {
      const limiter = new RateLimiter();

      limiter.recordRequest();
      limiter.recordRequest();
      limiter.recordRequest();

      const stats = limiter.getStats();
      expect(stats.used).toBe(3);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const limiter = new RateLimiter();

      // Record 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      const stats = limiter.getStats();
      expect(stats.used).toBe(5);
      expect(stats.remaining).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxRequests - 5);
    });

    it('should expire old requests from the window', async () => {
      vi.useFakeTimers();

      const limiter = new RateLimiter({ windowMs: 1000 });
      limiter.recordRequest();
      expect(limiter.getStats().used).toBe(1);

      // Advance time past the window
      vi.advanceTimersByTime(1001);

      expect(limiter.getStats().used).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('isNearLimit', () => {
    it('should return false when well under limit', () => {
      const limiter = new RateLimiter();
      expect(limiter.isNearLimit()).toBe(false);
    });

    it('should return true when near limit', () => {
      const limiter = new RateLimiter({ maxRequests: 10 });

      // Record 9 requests (90%)
      for (let i = 0; i < 9; i++) {
        limiter.recordRequest();
      }

      expect(limiter.isNearLimit()).toBe(true);
      expect(limiter.isNearLimit(0.8)).toBe(true);
      expect(limiter.isNearLimit(0.95)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all tracked requests', () => {
      const limiter = new RateLimiter();

      for (let i = 0; i < 5; i++) {
        limiter.recordRequest();
      }

      expect(limiter.getStats().used).toBe(5);

      limiter.reset();

      expect(limiter.getStats().used).toBe(0);
    });
  });

  describe('waitForSlot', () => {
    it('should allow request when under limit', async () => {
      const limiter = new RateLimiter({ minDelayMs: 0 });
      await limiter.waitForSlot();
      expect(limiter.getStats().used).toBe(1);
    });

    it('should track request after waiting', async () => {
      const limiter = new RateLimiter({ minDelayMs: 0 });
      await limiter.waitForSlot();
      await limiter.waitForSlot();
      await limiter.waitForSlot();

      const stats = limiter.getStats();
      expect(stats.used).toBe(3);
    });
  });

  describe('rate limiting behavior (sync)', () => {
    it('should correctly report when at limit', () => {
      const limiter = new RateLimiter({ maxRequests: 3 });

      // Fill up the limit using recordRequest
      limiter.recordRequest();
      limiter.recordRequest();
      limiter.recordRequest();

      expect(limiter.getStats().used).toBe(3);
      expect(limiter.getStats().remaining).toBe(0);
      expect(limiter.isNearLimit()).toBe(true);
    });
  });
});
