// Logic for "the server says our session is no longer valid". Kept free of axios/socket/DOM
// imports (everything is injected) so it can be unit tested with plain Node.

export const AUTH_STORAGE_KEYS = ["token", "userId", "role"];

// pages a signed-out user is expected to be on - never redirect away from these
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function clearAuthState(storage) {
  for (const key of AUTH_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // storage unavailable (private mode etc.) - nothing to clear
    }
  }
}

// Drops local auth state and sends the user to /login (once, and not if already on a public page).
export function endSession({ storage, onClear, redirect, pathname }) {
  clearAuthState(storage);
  if (onClear) onClear();
  if (!PUBLIC_PATHS.includes(pathname)) {
    redirect("/login");
  }
}

// Failed login/OTP/reset calls also answer 401 ("Invalid credentials"); those are normal form
// errors on a public page, not an expired session. Logout itself is the one /auth/ call that counts.
export function isSessionExpiredResponse({ status, url = "", hasToken }) {
  if (status !== 401 || !hasToken) return false;
  const isAuthFormEndpoint = url.startsWith("/auth/") && !url.startsWith("/auth/logout");
  return !isAuthFormEndpoint;
}

// Axios response-error handler. Always re-rejects so callers still see the original error.
export function handleResponseError(error, deps) {
  const { storage } = deps;
  const expired = isSessionExpiredResponse({
    status: error?.response?.status,
    url: error?.config?.url,
    hasToken: !!storage.getItem("token"),
  });

  if (expired) {
    endSession({ ...deps, pathname: deps.getPathname() });
  }
  return Promise.reject(error);
}
