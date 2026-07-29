/**
 * Classifies a seller-data-load failure so the bootstrap screen (App.jsx)
 * can show the right message instead of always saying "Cannot connect" --
 * a 403 ownership rejection means the server responded just fine, it's
 * just that this account isn't recorded as owning a shop; that's a very
 * different problem from the server being unreachable.
 *
 * `error.status` is only present when a real HTTP response came back (see
 * packages/shared/api/client.js's request()). Its absence means fetch()
 * itself never got a response at all (server unreachable, DNS failure,
 * CORS block, etc.) -- a genuine connection failure.
 */
export function classifyLoadError(error) {
  if (error?.status === 403) return "ownership";
  if (error?.status === 401) return "unauthenticated";
  return "network";
}
