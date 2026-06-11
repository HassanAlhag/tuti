export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={22} /> : null}
      <span>{text}</span>
    </div>
  );
}
