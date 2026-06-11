export function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-icon">{Icon ? <Icon size={20} /> : null}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}
