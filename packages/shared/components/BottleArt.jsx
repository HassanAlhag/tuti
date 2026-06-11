export function BottleArt({ product, compact = false }) {
  if (product?.imagePath) {
    return (
      <div
        className={compact ? "bottle-art compact" : "bottle-art"}
        aria-hidden="true"
      >
        <img
          src={product.imagePath}
          alt=""
          className="bottle-art-img"
        />
      </div>
    );
  }
  return (
    <div
      className={compact ? "bottle-art compact" : "bottle-art"}
      style={{ "--bottle": product?.color || "#52796f", "--accent": product?.accent || "#e9c46a" }}
      aria-hidden="true"
    >
      <span className="bottle-cap" />
      <span className="bottle-neck" />
      <span className="bottle-body" />
      <span className="bottle-shine" />
    </div>
  );
}
