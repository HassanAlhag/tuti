export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={22} aria-hidden="true" /> : null}
      <span>{text}</span>
    </div>
  );
}
