const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiMediaStage({
  category = "default",
  image,
  alt = "",
  children,
  size = "md",
  className = "",
  ...props
}) {
  const normalizedCategory = ["perfume", "cake", "gift_box"].includes(category) ? category : "default";

  return (
    <div
      className={cx(
        "tuti-media-stage",
        `tuti-media-stage--${normalizedCategory}`,
        `tuti-media-stage--${size}`,
        className
      )}
      {...props}
    >
      {image ? (
        <img className="tuti-media-stage__image" src={image} alt={alt} loading="lazy" />
      ) : (
        <div className="tuti-media-stage__fallback" aria-hidden="true">
          <span className="tuti-media-stage__shape tuti-media-stage__shape--primary" />
          <span className="tuti-media-stage__shape tuti-media-stage__shape--secondary" />
          <span className="tuti-media-stage__shine" />
        </div>
      )}
      {children ? <div className="tuti-media-stage__content">{children}</div> : null}
    </div>
  );
}
