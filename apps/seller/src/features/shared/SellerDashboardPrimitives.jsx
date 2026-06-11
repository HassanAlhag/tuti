import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";

export function SellerPageHeader({ eyebrow, title, subtitle, meta, actions }) {
  return (
    <div className="sd-page-header">
      <div className="sd-page-title-block">
        {eyebrow && <span className="sd-page-eyebrow">{eyebrow}</span>}
        <h2 className="sd-section-title">{title}</h2>
        {subtitle && <p className="sd-section-sub">{subtitle}</p>}
      </div>
      {(meta || actions) && (
        <div className="sd-page-header-side">
          {meta}
          {actions && <div className="sd-page-actions">{actions}</div>}
        </div>
      )}
    </div>
  );
}

export function SellerInsightCard({ icon: Icon, label, value, detail, tone = "brand" }) {
  return (
    <article className={`sd-insight-card sd-insight-card--${tone}`}>
      <span className="sd-insight-icon">{Icon && <Icon size={18} />}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <p>{detail}</p>}
      </div>
    </article>
  );
}

export function SellerChecklistPanel({ icon, title, action, items }) {
  return (
    <div className="sd-panel">
      <PanelHeader icon={icon} title={title} action={action} />
      <div className="sd-checklist">
        {items.map((item) => {
          const Icon = item.icon || CheckCircle2;
          return (
            <div className={`sd-check-row sd-check-row--${item.status}`} key={item.label}>
              <span className="sd-check-icon"><Icon size={15} /></span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <span className="sd-check-state">{item.state}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SellerQueuePanel({ icon, title, action, items, emptyIcon, emptyText }) {
  return (
    <div className="sd-panel">
      <PanelHeader icon={icon} title={title} action={action} />
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon || icon} text={emptyText} />
      ) : (
        <div className="sd-queue-list">
          {items.map((item) => (
            <div className="sd-queue-row" key={item.id}>
              <span className={`sd-queue-dot sd-queue-dot--${item.tone || "brand"}`} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              {item.meta && <span className="sd-queue-meta">{item.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
