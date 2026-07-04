import { TutiBadge } from "../primitives/index.js";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiTrustStrip({
  items = [],
  variant = "inline",
  className = "",
}) {
  if (!items.length) return null;

  return (
    <div className={cx("tuti-trust-strip", `tuti-trust-strip--${variant}`, className)}>
      {items.map((item, index) => (
        <div className="tuti-trust-strip__item" key={item.id || item.title || index}>
          {item.icon ? <span className="tuti-trust-strip__icon" aria-hidden="true">{item.icon}</span> : null}
          <div>
            <strong>{item.title || item.label}</strong>
            {item.description ? <span>{item.description}</span> : null}
          </div>
          {item.badge ? <TutiBadge tone={item.tone || "cyan"}>{item.badge}</TutiBadge> : null}
        </div>
      ))}
    </div>
  );
}
