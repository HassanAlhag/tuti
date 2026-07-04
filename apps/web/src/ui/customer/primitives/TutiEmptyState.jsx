const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiEmptyState({
  title,
  description,
  action,
  icon,
  className = "",
  ...props
}) {
  return (
    <div className={cx("tuti-empty-state", className)} {...props}>
      {icon ? <div className="tuti-empty-state__icon" aria-hidden="true">{icon}</div> : null}
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      {action ? <div className="tuti-empty-state__action">{action}</div> : null}
    </div>
  );
}
