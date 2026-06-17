import { useState, useEffect } from "react";

const STORAGE_KEY = "tuti_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <p className="cookie-banner-text">
        We use essential cookies to keep you logged in and remember your cart.
        Analytics cookies help us improve Tuti.{" "}
        <a href="/legal?tab=cookies" className="cookie-banner-link">Learn more</a>
      </p>
      <div className="cookie-banner-actions">
        <button className="secondary-action compact" type="button" onClick={decline}>
          Decline optional
        </button>
        <button className="primary-action compact" type="button" onClick={accept}>
          Accept all
        </button>
      </div>
    </div>
  );
}
