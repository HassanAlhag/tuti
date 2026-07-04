const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiSection({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  className = "",
  density = "normal",
  ...props
}) {
  const hasHeader = eyebrow || title || subtitle || action;

  return (
    <section className={cx("tuti-section", `tuti-section--${density}`, className)} {...props}>
      {hasHeader ? (
        <div className="tuti-section__header">
          <div className="tuti-section__copy">
            {eyebrow ? <p className="tuti-section__eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="tuti-section__title">{title}</h2> : null}
            {subtitle ? <p className="tuti-section__subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="tuti-section__action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
