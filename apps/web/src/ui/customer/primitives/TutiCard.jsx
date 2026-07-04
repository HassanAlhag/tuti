const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiCard({
  children,
  variant = "default",
  padding = "md",
  interactive = false,
  as: Component = "div",
  className = "",
  ...props
}) {
  return (
    <Component
      className={cx(
        "tuti-card",
        `tuti-card--${variant}`,
        `tuti-card--pad-${padding}`,
        interactive && "tuti-card--interactive",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
