export function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-icon">{Icon ? <Icon size={20} aria-hidden="true" /> : null}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}
