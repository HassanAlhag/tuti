const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiButton({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  as: Component = "button",
  type = "button",
  className = "",
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading;
  const classes = cx(
    "tuti-button",
    `tuti-button--${variant}`,
    `tuti-button--${size}`,
    fullWidth && "tuti-button--full",
    loading && "is-loading",
    className
  );

  const componentProps = {
    className: classes,
    onClick,
    "aria-busy": loading || undefined,
    ...props,
  };

  if (Component === "button") {
    componentProps.type = type;
    componentProps.disabled = isDisabled;
  } else if (isDisabled) {
    componentProps["aria-disabled"] = true;
    componentProps.onClick = undefined;
  }

  return (
    <Component {...componentProps}>
      {loading ? <span className="tuti-button__spinner" aria-hidden="true" /> : null}
      {icon && iconPosition === "left" ? <span className="tuti-button__icon" aria-hidden="true">{icon}</span> : null}
      <span className="tuti-button__label">{children}</span>
      {icon && iconPosition === "right" ? <span className="tuti-button__icon" aria-hidden="true">{icon}</span> : null}
    </Component>
  );
}
