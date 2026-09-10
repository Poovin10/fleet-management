import { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  raised?: boolean;
};

export function Card({ children, className = '', raised = false }: CardProps) {
  return (
    <div
      className={[
        'bg-surface border border-border rounded-lg p-6',
        raised ? 'shadow-raised' : 'shadow-card',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

type StatRowProps = {
  label: string;
  sublabel?: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'accent';
};

export function StatRow({ label, sublabel, value, tone = 'default' }: StatRowProps) {
  const toneClass = {
    default: 'text-fg',
    success: 'text-success',
    danger: 'text-danger',
    accent: 'text-accent',
  }[tone];

  return (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0">
      <div>
        <div className="text-sm font-medium text-fg">{label}</div>
        {sublabel && <div className="text-xs text-fg-muted mt-0.5">{sublabel}</div>}
      </div>
      <div className={`font-nums text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}