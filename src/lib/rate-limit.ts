type Counter = {
  count: number;
  windowStartedAt: number;
};

type LoginAttemptState = {
  attempts: number[];
  lockedUntil?: number;
};

const apiCounterStore = new Map<string, Counter>();
const loginAttemptsStore = new Map<string, LoginAttemptState>();
const concurrentRequestsStore = new Map<string, number>();

export function hitApiRateLimit(userId: string, max = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const state = apiCounterStore.get(userId);

  if (!state || now - state.windowStartedAt >= windowMs) {
    apiCounterStore.set(userId, { count: 1, windowStartedAt: now });
    return false;
  }

  state.count += 1;
  apiCounterStore.set(userId, state);
  return state.count > max;
}

export function isLoginLocked(email: string): boolean {
  const record = loginAttemptsStore.get(email.toLowerCase());
  if (!record?.lockedUntil) {
    return false;
  }
  return record.lockedUntil > Date.now();
}

export function recordFailedLogin(email: string): { isLocked: boolean; retryAfterMs?: number } {
  const normalized = email.toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const lockMs = 15 * 60 * 1000;

  const state = loginAttemptsStore.get(normalized) ?? { attempts: [] };
  state.attempts = state.attempts.filter((ts) => now - ts <= windowMs);
  state.attempts.push(now);

  if (state.attempts.length >= maxAttempts) {
    state.lockedUntil = now + lockMs;
    loginAttemptsStore.set(normalized, state);
    return { isLocked: true, retryAfterMs: lockMs };
  }

  loginAttemptsStore.set(normalized, state);
  return { isLocked: false };
}

export function clearFailedLogin(email: string): void {
  loginAttemptsStore.delete(email.toLowerCase());
}

/**
 * Check if user has reached concurrent request limit.
 * Prevents resource exhaustion from multiple simultaneous requests.
 * 
 * @param userId - User ID to check
 * @param maxConcurrent - Maximum concurrent requests allowed (default: 10)
 * @returns true if within limit, false if limit exceeded
 */
export function checkConcurrentLimit(
  userId: string,
  maxConcurrent = 10
): boolean {
  const current = concurrentRequestsStore.get(userId) || 0;
  
  if (current >= maxConcurrent) {
    console.warn('Concurrent request limit exceeded:', {
      userId,
      current,
      maxConcurrent,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
  
  concurrentRequestsStore.set(userId, current + 1);
  return true;
}

/**
 * Release a concurrent request slot for a user.
 * Should be called in finally block to ensure cleanup.
 * 
 * @param userId - User ID to release slot for
 */
export function releaseConcurrentSlot(userId: string): void {
  const current = concurrentRequestsStore.get(userId) || 0;
  const newCount = Math.max(0, current - 1);
  
  if (newCount === 0) {
    concurrentRequestsStore.delete(userId);
  } else {
    concurrentRequestsStore.set(userId, newCount);
  }
}

/**
 * Get current concurrent request count for a user (for monitoring).
 * 
 * @param userId - User ID to check
 * @returns Current number of concurrent requests
 */
export function getConcurrentCount(userId: string): number {
  return concurrentRequestsStore.get(userId) || 0;
}
