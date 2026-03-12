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
