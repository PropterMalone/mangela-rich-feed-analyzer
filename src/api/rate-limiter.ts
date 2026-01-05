/**
 * Rate limiter for Bluesky API requests
 * Bluesky limit: 3000 requests per 5 minutes
 * We use a conservative 2500 to leave buffer
 */

export interface RateLimiterConfig {
  maxRequests: number; // Max requests in window
  windowMs: number; // Window size in milliseconds
  minDelayMs: number; // Minimum delay between requests
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimiterConfig = {
  maxRequests: 2500, // Conservative limit (actual is 3000/5min)
  windowMs: 5 * 60 * 1000, // 5 minutes
  minDelayMs: 50, // 50ms minimum between requests
};

export class RateLimiter {
  private requestTimes: number[] = [];
  private config: RateLimiterConfig;
  private lastRequestTime = 0;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Wait for a slot to become available
   * Returns when it's safe to make a request
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Clean old timestamps outside the window
    this.requestTimes = this.requestTimes.filter((t) => now - t < this.config.windowMs);

    // Check if we're at the limit
    if (this.requestTimes.length >= this.config.maxRequests) {
      // Calculate how long to wait until the oldest request expires
      const oldestRequest = this.requestTimes[0];
      const waitTime = oldestRequest + this.config.windowMs - now;

      if (waitTime > 0) {
        console.log(`[Universe] Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        // Recursively check again after waiting
        return this.waitForSlot();
      }
    }

    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minDelayMs) {
      await this.sleep(this.config.minDelayMs - timeSinceLastRequest);
    }

    // Record this request
    this.requestTimes.push(Date.now());
    this.lastRequestTime = Date.now();
  }

  /**
   * Record a request (call after making the request)
   */
  recordRequest(): void {
    this.requestTimes.push(Date.now());
    this.lastRequestTime = Date.now();
  }

  /**
   * Get current usage stats
   */
  getStats(): { used: number; remaining: number; windowResetMs: number } {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((t) => now - t < this.config.windowMs);

    const used = this.requestTimes.length;
    const remaining = Math.max(0, this.config.maxRequests - used);
    const windowResetMs =
      this.requestTimes.length > 0 ? this.requestTimes[0] + this.config.windowMs - now : 0;

    return { used, remaining, windowResetMs };
  }

  /**
   * Check if we're near the rate limit
   */
  isNearLimit(threshold = 0.9): boolean {
    const stats = this.getStats();
    return stats.used / this.config.maxRequests >= threshold;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestTimes = [];
    this.lastRequestTime = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global rate limiter instance
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global rate limiter
 */
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter
 */
export function resetRateLimiter(): void {
  globalRateLimiter?.reset();
}
