import { AlertCircle, ArrowLeft, LogIn, RefreshCw, ShoppingBag } from "lucide-react";

/**
 * Shared customer-web route-state surfaces (Phase 8, css-revamp-phase-8.md).
 * Rendered inside <ClientLayout> so the header/search/cart/account controls
 * stay usable while a route is loading, has failed to load, doesn't exist,
 * or requires sign-in — see docs/design/css-revamp-phase-8.md for the
 * architecture this replaces.
 */

export function RouteLoading({ label = "Loading…" }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-skeleton-block route-skeleton-block--wide" />
      <span className="route-skeleton-row">
        <span className="route-skeleton-block" />
        <span className="route-skeleton-block" />
        <span className="route-skeleton-block" />
      </span>
      <span className="route-skeleton-block route-skeleton-block--tall" />
      <span className="route-loading-label">{label}</span>
    </div>
  );
}

export function RouteErrorState({
  heading = "We couldn't load this page",
  message = "Please check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  onSecondary,
  secondaryLabel = "Back to Home",
}) {
  return (
    <div className="route-state-panel route-error-state" role="alert">
      <span className="route-state-icon route-state-icon--error">
        <AlertCircle aria-hidden="true" size={22} />
      </span>
      <h2>{heading}</h2>
      <p>{message}</p>
      <div className="route-state-actions">
        {onRetry ? (
          <button className="primary-action" onClick={onRetry} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            {retryLabel}
          </button>
        ) : null}
        {onSecondary ? (
          <button className="ghost-action" onClick={onSecondary} type="button">
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function RouteNotFound({
  heading = "We couldn't find that page",
  message = "The link may be incorrect, or the page may have moved.",
  onPrimary,
  primaryLabel = "Go to Shop",
  onSecondary,
  secondaryLabel = "Back to Home",
}) {
  return (
    <div className="route-state-panel route-not-found-state" role="status">
      <span className="route-state-icon">
        <ShoppingBag aria-hidden="true" size={22} />
      </span>
      <h1>{heading}</h1>
      <p>{message}</p>
      <div className="route-state-actions">
        {onPrimary ? (
          <button className="primary-action" onClick={onPrimary} type="button">
            <ArrowLeft aria-hidden="true" size={16} />
            {primaryLabel}
          </button>
        ) : null}
        {onSecondary ? (
          <button className="ghost-action" onClick={onSecondary} type="button">
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function RouteAuthRequired({
  heading = "Sign in to continue",
  message = "Create a free account or sign in to view this page.",
  onSignIn,
  signInLabel = "Sign in",
  onContinue,
  continueLabel = "Continue shopping",
}) {
  return (
    <div className="route-state-panel route-auth-required-state" role="status">
      <span className="route-state-icon">
        <LogIn aria-hidden="true" size={22} />
      </span>
      <h2>{heading}</h2>
      <p>{message}</p>
      <div className="route-state-actions">
        {onSignIn ? (
          <button className="primary-action" onClick={onSignIn} type="button">
            <LogIn aria-hidden="true" size={16} />
            {signInLabel}
          </button>
        ) : null}
        {onContinue ? (
          <button className="ghost-action" onClick={onContinue} type="button">
            {continueLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
