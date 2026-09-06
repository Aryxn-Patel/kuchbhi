/**
 * Minimal client-side error reporting.
 *
 * Logs to the console; wire it up to whatever error tracking service you use
 * (e.g. Sentry) by adding a call inside `reportError` below.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error("[error-boundary]", message, {
    route: window.location.pathname,
    ...context,
    error,
  });
}
