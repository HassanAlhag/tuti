export function PanelHeader({ icon: Icon, title, action }) {
  return (
    <header className="panel-header">
      <div>
        {Icon ? <Icon size={18} /> : null}
        <h2>{title}</h2>
      </div>
      {action ? <span>{action}</span> : null}
    </header>
  );
}
