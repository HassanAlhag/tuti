import { brand }         from "@tuti/shared/brand.js";
import { footerRouteGroups } from "../../config/customerRoutes.js";
import { getPortalUrl }  from "./portalUrls.js";

export function ClientFooter({ onNavigate }) {
  return (
    <footer className="cl-footer">
      <div className="cl-footer-inner">
        {/* Brand column */}
        <div className="cl-footer-brand">
          <span className="cl-footer-mark">{brand.mark}</span>
          <span className="cl-footer-name">{brand.name}</span>
          <p className="cl-footer-tagline">{brand.tagline}</p>
          <small>{brand.origin}</small>
        </div>

        {/* Navigation columns */}
        <nav className="cl-footer-nav" aria-label="Footer navigation">
          {footerRouteGroups.map(({ title, links }) => (
            <div key={title}>
              <p className="cl-footer-links-heading">{title}</p>
              <div className="cl-footer-links">
                {links.map(({ label, nav, portalKey }) => {
                  if (portalKey) {
                    // Resolve through the shared helper — returns null in
                    // production when the env var is missing
                    const href = getPortalUrl(portalKey);
                    if (!href) return null; // hide unconfigured portals
                    return (
                      <a
                        key={label}
                        href={href}
                        className="cl-footer-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {label}
                      </a>
                    );
                  }
                  // Internal navigation
                  return (
                    <button
                      key={label}
                      type="button"
                      className="cl-footer-link"
                      onClick={() => onNavigate(...nav)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="cl-footer-bottom">
        <p className="cl-footer-copy">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
        <p className="cl-footer-copy">UAE · Premium gifting marketplace</p>
      </div>
    </footer>
  );
}
