const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiBadge({
  children,
  tone = "neutral",
  icon,
  className = "",
  ...props
}) {
  return (
    <span className={cx("tuti-badge", `tuti-badge--${tone}`, className)} {...props}>
      {icon ? <span className="tuti-badge__icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
