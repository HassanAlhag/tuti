export function PageTitle({ kicker, title, description }) {
  return (
    <div className="page-title">
      {kicker && <span className="eyebrow">{kicker}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
