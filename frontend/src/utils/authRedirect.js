/**
 * Preserve where the user was going before auth (election deep links, etc.).
 * Uses ?next= query param + sessionStorage so multi-step register still works.
 */

const RETURN_STORAGE_KEY = "amarvote_return_to";

const SAFE_PATH_PREFIXES = [
  "/dashboard",
  "/create-election",
  "/election-page",
  "/all-elections",
  "/profile",
  "/authenticated-users",
  "/api-logs",
  "/user-analytics",
];

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/otp-login",
]);

/**
 * @param {string | null | undefined} path
 * @returns {boolean}
 */
export function isSafeReturnPath(path) {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;

  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (AUTH_PATHS.has(url.pathname)) return false;
    return SAFE_PATH_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    );
  } catch {
    return false;
  }
}

/**
 * @param {string | null | undefined} path
 */
export function rememberReturnPath(path) {
  if (!isSafeReturnPath(path)) return;
  try {
    sessionStorage.setItem(RETURN_STORAGE_KEY, path);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearReturnPath() {
  try {
    sessionStorage.removeItem(RETURN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {URLSearchParams | { get: (key: string) => string | null } | null | undefined} searchParams
 * @returns {string | null}
 */
export function readReturnPath(searchParams) {
  const fromQuery =
    searchParams?.get?.("next") ||
    searchParams?.get?.("returnUrl") ||
    searchParams?.get?.("redirect");

  if (isSafeReturnPath(fromQuery)) {
    rememberReturnPath(fromQuery);
    return fromQuery;
  }

  try {
    const stored = sessionStorage.getItem(RETURN_STORAGE_KEY);
    if (isSafeReturnPath(stored)) return stored;
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Resolve destination after successful login/register, then clear storage.
 * @param {URLSearchParams | { get: (key: string) => string | null } | null | undefined} searchParams
 * @param {string} [fallback="/dashboard"]
 */
export function consumeReturnPath(searchParams, fallback = "/dashboard") {
  const path = readReturnPath(searchParams) || fallback;
  clearReturnPath();
  return isSafeReturnPath(path) ? path : fallback;
}

/**
 * @param {string} returnPath
 * @param {"login" | "register"} [mode="login"]
 */
export function buildAuthUrl(returnPath, mode = "login") {
  const base = mode === "register" ? "/register" : "/login";
  if (!isSafeReturnPath(returnPath)) return base;
  rememberReturnPath(returnPath);
  return `${base}?next=${encodeURIComponent(returnPath)}`;
}

/**
 * Current in-app path suitable for post-auth return.
 * @param {{ pathname: string, search?: string }} location
 */
export function pathFromLocation(location) {
  if (!location?.pathname) return null;
  const path = `${location.pathname}${location.search || ""}`;
  return isSafeReturnPath(path) ? path : null;
}

/**
 * Redirect to login while preserving the current protected URL.
 * @param {string} [returnPath]
 */
export function redirectToLogin(returnPath) {
  const path =
    returnPath ||
    `${window.location.pathname}${window.location.search}`;
  window.location.href = buildAuthUrl(path, "login");
}
