/** Absolute login lifetime. After this, the session is treated as signed out. */
export const LOGIN_MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Bump to invalidate every existing website login.
 * Old season players kept 30-day cookies, so the site still treated them as registered.
 */
export const SESSION_EPOCH = 2;

type LoginToken = {
  sessionEpoch?: unknown;
  loggedInAt?: unknown;
  expired?: unknown;
};

export function isLoginSessionFresh(token: LoginToken | null | undefined) {
  if (!token || token.expired === true) return false;
  if (token.sessionEpoch !== SESSION_EPOCH) return false;
  if (typeof token.loggedInAt !== "number") return false;
  return Math.floor(Date.now() / 1000) - token.loggedInAt < LOGIN_MAX_AGE_SECONDS;
}
